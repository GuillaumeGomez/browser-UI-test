const { Parser } = require('./parser.js');
const process = require('process');
const commands = require('./commands/all.js');
const consts = require('./consts.js');

const ORDERS = {
    'assert': commands.parseAssert,
    'assert-false': commands.parseAssertFalse,
    'assert-attribute': commands.parseAssertAttribute,
    'assert-attribute-false': commands.parseAssertAttributeFalse,
    'assert-count': commands.parseAssertCount,
    'assert-count-false': commands.parseAssertCountFalse,
    'assert-css': commands.parseAssertCss,
    'assert-css-false': commands.parseAssertCssFalse,
    'assert-document-property': commands.parseAssertDocumentProperty,
    'assert-document-property-false': commands.parseAssertDocumentPropertyFalse,
    'assert-local-storage': commands.parseAssertLocalStorage,
    'assert-local-storage-false': commands.parseAssertLocalStorageFalse,
    'assert-position': commands.parseAssertPosition,
    'assert-position-false': commands.parseAssertPositionFalse,
    'assert-property': commands.parseAssertProperty,
    'assert-property-false': commands.parseAssertPropertyFalse,
    'assert-text': commands.parseAssertText,
    'assert-text-false': commands.parseAssertTextFalse,
    'assert-variable': commands.parseAssertVariable,
    'assert-variable-false': commands.parseAssertVariableFalse,
    'assert-window-property': commands.parseAssertWindowProperty,
    'assert-window-property-false': commands.parseAssertWindowPropertyFalse,
    'attribute': commands.parseAttribute,
    'click': commands.parseClick,
    'click-with-offset': commands.parseClickWithOffset,
    'call-function': commands.parseCallFunction,
    'compare-elements-attribute': commands.parseCompareElementsAttribute,
    'compare-elements-attribute-false': commands.parseCompareElementsAttributeFalse,
    'compare-elements-css': commands.parseCompareElementsCss,
    'compare-elements-css-false': commands.parseCompareElementsCssFalse,
    'compare-elements-position': commands.parseCompareElementsPosition,
    'compare-elements-position-false': commands.parseCompareElementsPositionFalse,
    'compare-elements-position-near': commands.parseCompareElementsPositionNear,
    'compare-elements-position-near-false': commands.parseCompareElementsPositionNearFalse,
    'compare-elements-property': commands.parseCompareElementsProperty,
    'compare-elements-property-false': commands.parseCompareElementsPropertyFalse,
    'compare-elements-text': commands.parseCompareElementsText,
    'compare-elements-text-false': commands.parseCompareElementsTextFalse,
    'css': commands.parseCss,
    'debug': commands.parseDebug,
    'define-function': commands.parseDefineFunction,
    'drag-and-drop': commands.parseDragAndDrop,
    'emulate': commands.parseEmulate,
    'fail': commands.parseFail,
    'fail-on-js-error': commands.parseFailOnJsError,
    'focus': commands.parseFocus,
    'font-size': commands.parseFontSize,
    'geolocation': commands.parseGeolocation,
    'goto': commands.parseGoTo,
    'history-go-back': commands.parseHistoryGoBack,
    'history-go-forward': commands.parseHistoryGoForward,
    'javascript': commands.parseJavascript,
    'local-storage': commands.parseLocalStorage,
    'move-cursor-to': commands.parseMoveCursorTo,
    'pause-on-error': commands.parsePauseOnError,
    'permissions': commands.parsePermissions,
    'press-key': commands.parsePressKey,
    'reload': commands.parseReload,
    'screenshot': commands.parseScreenshot,
    'screenshot-comparison': commands.parseScreenshotComparison,
    'scroll-to': commands.parseScrollTo,
    'show-text': commands.parseShowText,
    'size': commands.parseSize,
    'store-attribute': commands.parseStoreAttribute,
    'store-css': commands.parseStoreCss,
    'store-local-storage': commands.parseStoreLocalStorage,
    'store-property': commands.parseStoreProperty,
    'store-text': commands.parseStoreText,
    'store-value': commands.parseStoreValue,
    'text': commands.parseText,
    'timeout': commands.parseTimeout,
    'wait-for': commands.parseWaitFor,
    'wait-for-attribute': commands.parseWaitForAttribute,
    'wait-for-css': commands.parseWaitForCss,
    'wait-for-text': commands.parseWaitForText,
    'write': commands.parseWrite,
};

// If the command fails, the script should stop right away because everything coming after will
// very likely be broken.
const FATAL_ERROR_COMMANDS = [
    'attribute',
    'click',
    'css',
    'drag-and-drop',
    'emulate',
    'focus',
    'goto',
    'local-storage',
    'move-cursor-to',
    'screenshot',
    'scroll-to',
    'store-property',
    'store-value',
    'text',
    'wait-for',
    'wait-for-attribute',
    'wait-for-css',
    'wait-for-text',
    'write',
];

// Commands which do not run JS commands but change the behavior of the commands following.
const NO_INTERACTION_COMMANDS = [
    'assert-variable',
    'assert-variable-false',
    'debug',
    'define-function',
    'emulate',
    'fail',
    'fail-on-js-error',
    'javascript',
    'screenshot-comparison',
    'store-value',
    'timeout',
];

// Commands which can only be used before the first `goto` command.
const BEFORE_GOTO = [
    'emulate',
];

class ParserWithContext {
    constructor(content, options) {
        this.parser = new Parser(content, options.variables);
        this.firstGotoParsed = false;
        this.options = options;
        this.callingFunc = [];
    }

    variables() {
        return this.parser.variables;
    }

    get_current_line() {
        if (this.callingFunc.length === 0) {
            return this.parser.currentLine;
        }
        const last = this.callingFunc[this.callingFunc.length - 1];
        return `${last.currentLine} from ${this.parser.currentLine}`;
    }

    get_current_command_line() {
        if (this.callingFunc.length === 0) {
            return this.parser.command.line;
        }
        const last = this.callingFunc[this.callingFunc.length - 1];
        return `${last.command.line} from ${this.parser.command.line}`;
    }

    setup_user_function_call() {
        const ret = commands.parseCallFunction(this.parser);
        if (ret.error !== undefined) {
            return ret;
        }
        const args = Object.create(null);
        const func = this.parser.definedFunctions[ret['function']];
        for (let i = 0; i < ret['args'].length; ++i) {
            args[func['arguments'][i]] = ret['args'][i];
        }
        this.callingFunc.push(new Parser(func['content'], this.options.variables, args));
        // FIXME: allow to change max call stack?
        if (this.callingFunc.length > 100) {
            return {'error': 'reached maximum stack size (100)'};
        }
        return this.handle_user_function_call();
    }

    run_order(order) {
        if (order === 'call-function') {
            // We need to special-case `call-function` since it needs to be interpreted when called.
            return this.setup_user_function_call();
        } else if (!Object.prototype.hasOwnProperty.call(ORDERS, order)) {
            return {'error': `Unknown command "${order}"`, 'line': this.get_current_line()};
        }
        if (this.firstGotoParsed === false) {
            if (order !== 'goto' && NO_INTERACTION_COMMANDS.indexOf(order) === -1) {
                const cmds = NO_INTERACTION_COMMANDS.map(x => `\`${x}\``);
                const last = cmds.pop();
                const text = cmds.join(', ') + ` or ${last}`;
                return {
                    'error': `First command must be \`goto\` (${text} can be used before)!`,
                    'line': this.get_current_line(),
                };
            }
            this.firstGotoParsed = order === 'goto';
        } else if (BEFORE_GOTO.indexOf(order) !== -1) {
            return {
                'error': `Command ${order} must be used before first goto!`,
                'line': this.get_current_line(),
            };
        }
        const res = ORDERS[order](this.parser, this.options);
        if (res.error !== undefined) {
            res.line = this.parser.currentLine;
            return res;
        }
        return {
            'fatal_error': FATAL_ERROR_COMMANDS.indexOf(order) !== -1,
            'wait': res['wait'],
            'checkResult': res['checkResult'],
            'original': this.parser.getOriginalCommand(),
            'line_number': this.get_current_command_line(),
            'instructions': res['instructions'],
            'infos': res['infos'],
            'warnings': res['warnings'],
        };
    }

    get_current_parser() {
        if (this.callingFunc.length === 0) {
            return this.parser;
        }
        return this.callingFunc[this.callingFunc.length - 1];
    }

    get_next_command() {
        const parser = this.get_current_parser();
        if (!parser.parseNextCommand()) {
            if (parser.error) {
                return {
                    'error': parser.error,
                    'line': this.get_current_line(),
                };
            }
            if (this.callingFunc.length !== 0) {
                // We reached the end of this function!
                this.callingFunc.pop();
                return this.get_next_command();
            } else {
                // We reached the end of the file!
                return null;
            }
        }
        return this.run_order(parser.command.getRaw().toLowerCase());
    }
}

const EXPORTS = {
    'ParserWithContext': ParserWithContext,
    'COLOR_CHECK_ERROR': consts.COLOR_CHECK_ERROR,
};

for (const func of Object.values(ORDERS)) {
    EXPORTS[func.name] = func;
}

if (process.env.debug_tests === '1') {
    EXPORTS['ORDERS'] = ORDERS;
    EXPORTS['FATAL_ERROR_COMMANDS'] = FATAL_ERROR_COMMANDS;
    EXPORTS['NO_INTERACTION_COMMANDS'] = NO_INTERACTION_COMMANDS;
    EXPORTS['BEFORE_GOTO'] = BEFORE_GOTO;
}

// Those functions shouldn't be used directly!
module.exports = EXPORTS;
