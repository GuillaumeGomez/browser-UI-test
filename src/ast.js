const {
    cleanString,
    Element,
    ExpressionsValidator,
    IdentElement,
    matchInteger,
    NumberElement,
    Parser,
    StringElement,
    VariableElement,
} = require('./parser.js');
const utils = require('./utils');
const path = require('path');

const savedAsts = new Map();

function makeError(message, line) {
    return {
        'message': message,
        'isFatal': true,
        'line': line === null ? null : {
            'line': line,
        },
    };
}

function replaceVariable(elem, variables, functionArgs, forceVariableAsString, errors) {
    const variableName = elem.value;
    const lineNumber = elem.line;
    const startPos = elem.startPos;
    const endPos = elem.endPos;
    const associatedValue = utils.getVariableValue(variables, variableName, functionArgs);
    if (associatedValue === null) {
        const e = makeError(
            `variable \`${variableName}\` not found in options nor environment`, lineNumber);
        errors.push(e);
        return new VariableElement(variableName, startPos, endPos, elem.fullText, lineNumber, e);
    }
    if (associatedValue instanceof Element) {
        // Nothing to be done in here.
        return associatedValue;
    } else if (typeof associatedValue === 'boolean') {
        return new IdentElement(
            associatedValue.toString(), startPos, endPos, lineNumber);
    } else if (typeof associatedValue === 'number' ||
        // eslint-disable-next-line no-extra-parens
        (!forceVariableAsString && matchInteger(associatedValue) === true)) {
        return new NumberElement(associatedValue, startPos, endPos, lineNumber);
    } else if (typeof associatedValue === 'string') {
        return new StringElement(
            associatedValue,
            startPos,
            endPos,
            `"${cleanString(associatedValue)}"`,
            lineNumber,
        );
    }
    // this is a JSON dict and it should be parsed.
    const p = new Parser(JSON.stringify(associatedValue));
    p.currentLine = lineNumber;
    p.parseJson();
    errors.push(...p.errors);
    return p.elems[0];
}

// In this function we voluntarily don't go into `block` elements as they'll be handled separately.
function replaceVariables(elem, variables, functionArgs, forceVariableAsString, errors) {
    if (elem.kind === 'variable') {
        return replaceVariable(elem, variables, functionArgs, forceVariableAsString, errors);
    } else if (['expression', 'tuple', 'array', 'object-path'].includes(elem.kind)) {
        elem.value = elem.value
            .map(e => replaceVariables(e, variables, functionArgs, forceVariableAsString, errors))
            .filter(e => e !== null);
    } else if (elem.kind === 'json') {
        elem.value = elem.value
            .map(e => {
                return {
                    'key': replaceVariables(e.key, variables, functionArgs, true, errors),
                    'value': replaceVariables(e.value, variables, functionArgs, false, errors),
                };
            })
            .filter(e => e.value !== null);
    }
    return elem;
}

class CommandNode {
    constructor(command, commandLine, ast, hasVariable, commandStart, text) {
        this.commandName = command.toLowerCase();
        this.line = commandLine;
        this.ast = ast;
        this.hasVariable = hasVariable;
        this.commandStart = commandStart;
        if (ast.length > 0) {
            this.argsStart = ast[0].startPos;
            this.argsEnd = ast[ast.length - 1].endPos;
        } else {
            this.argsStart = 0;
            this.argsEnd = 0;
        }
        this.text = text;
    }

    getInferredAst(variables, functionArgs) {
        // We clone the AST to not modify the original. And because it's JS, it's super annoying
        // to do...
        let inferred = [];
        const errors = [];
        if (!this.hasVariable) {
            inferred = this.ast.map(e => e.clone());
        } else {
            for (const elem of this.ast) {
                const e = replaceVariables(elem.clone(), variables, functionArgs, false, errors);
                if (e !== null) {
                    inferred.push(e);
                }
            }
        }
        if (errors.length === 0) {
            const validation = new ExpressionsValidator(inferred, true, this.text);
            if (validation.errors.length !== 0) {
                errors.push(...validation.errors);
            }
        }
        return {
            'ast': inferred,
            'errors': errors,
        };
    }

    getOriginalCommand() {
        let end = this.argsEnd;
        if (end === 0) {
            end = this.commandStart + this.commandName.length;
            while (end < this.text.length && this.text[end] !== ':') {
                end += 1;
            }
            if (end < this.text.length) {
                // To go beyond the ':'.
                end += 1;
            }
        }
        return this.text.slice(this.commandStart, end);
    }

    clone() {
        const n = new this.constructor(
            this.commandName,
            this.line,
            this.ast.map(e => e.clone()),
            this.hasVariable,
            this.commandStart,
            this.text,
        );
        return n;
    }
}

class AstLoader {
    constructor(filePath, currentDir, content = null) {
        this.filePath = filePath;
        this.absolutePath = null;
        this.errors = [];
        this.commands = [];
        if (content === null) {
            if (currentDir === null || path.isAbsolute(filePath)) {
                this.absolutePath = path.normalize(filePath);
            } else {
                this.absolutePath = path.normalize(path.resolve(currentDir, filePath));
            }
            if (savedAsts.has(this.absolutePath)) {
                const ast = savedAsts.get(this.absolutePath);
                this.commands = ast.commands;
                this.text = ast.text;
                this.errors = ast.errors;
                return;
            }
            try {
                this.text = utils.readFile(this.absolutePath);
            } catch (err) {
                this.errors.push(makeError(
                    `File \`${filePath}\` (\`${this.absolutePath}\`) does not exist`,
                    null,
                ));
                this.text = '';
                return;
            }
        } else {
            this.text = content;
        }
        const parser = new Parser(this.text);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const ret = parser.parseNextCommand();
            if (ret.errors !== false) {
                this.errors.push(...parser.errors);
                if (parser.hasFatalError) {
                    // Only stop parsing if we encounter a fatal error.
                    break;
                }
                // The errors will be kept so it's fine to not store all commands node since we
                // will abort before trying to run them. However, we still want to get all parser
                // errors so we continue.
            } else if (ret.finished === true) {
                break;
            } else {
                this.commands.push(new CommandNode(
                    parser.command.getRaw(),
                    ret.commandLine,
                    parser.elems,
                    parser.hasVariable,
                    parser.commandStart,
                    this.text,
                ));
            }
        }
        if (this.absolutePath !== null) {
            savedAsts.set(this.absolutePath, {
                'commands': this.commands,
                'text': this.text,
                'errors': this.errors,
            });
        }
    }

    hasErrors() {
        return this.errors.length > 0;
    }
}

module.exports = {
    'AstLoader': AstLoader,
    'CommandNode': CommandNode,
    'replaceVariables': replaceVariables,
};
