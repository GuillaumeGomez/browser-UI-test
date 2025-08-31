const { AstLoader } = require('./ast.js');
const process = require('process');
const commands = require('./commands/all.js');
const consts = require('./consts.js');
const { stripCommonPathsPrefix } = require('./utils.js');

const ORDERS = {
    'assert': commands.parseAssert,
    'assert-false': commands.parseAssertFalse,
    'assert-attribute': commands.parseAssertAttribute,
    'assert-attribute-false': commands.parseAssertAttributeFalse,
    'assert-clipboard': commands.parseAssertClipboard,
    'assert-clipboard-false': commands.parseAssertClipboardFalse,
    'assert-count': commands.parseAssertCount,
    'assert-count-false': commands.parseAssertCountFalse,
    'assert-css': commands.parseAssertCss,
    'assert-css-false': commands.parseAssertCssFalse,
    'assert-document-property': commands.parseAssertDocumentProperty,
    'assert-document-property-false': commands.parseAssertDocumentPropertyFalse,
    'assert-find-text': commands.parseAssertFindText,
    'assert-find-text-false': commands.parseAssertFindTextFalse,
    'assert-local-storage': commands.parseAssertLocalStorage,
    'assert-local-storage-false': commands.parseAssertLocalStorageFalse,
    'assert-position': commands.parseAssertPosition,
    'assert-position-false': commands.parseAssertPositionFalse,
    'assert-property': commands.parseAssertProperty,
    'assert-property-false': commands.parseAssertPropertyFalse,
    'assert-size': commands.parseAssertSize,
    'assert-size-false': commands.parseAssertSizeFalse,
    'assert-text': commands.parseAssertText,
    'assert-text-false': commands.parseAssertTextFalse,
    'assert-variable': commands.parseAssertVariable,
    'assert-variable-false': commands.parseAssertVariableFalse,
    'assert-window-property': commands.parseAssertWindowProperty,
    'assert-window-property-false': commands.parseAssertWindowPropertyFalse,
    'block-network-request': commands.parseBlockNetworkRequest,
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
    'compare-elements-size': commands.parseCompareElementsSize,
    'compare-elements-size-false': commands.parseCompareElementsSizeFalse,
    'compare-elements-size-near': commands.parseCompareElementsSizeNear,
    'compare-elements-size-near-false': commands.parseCompareElementsSizeNearFalse,
    'compare-elements-text': commands.parseCompareElementsText,
    'compare-elements-text-false': commands.parseCompareElementsTextFalse,
    'debug': commands.parseDebug,
    'define-function': commands.parseDefineFunction,
    'drag-and-drop': commands.parseDragAndDrop,
    'emulate': commands.parseEmulate,
    'emulate-media-features': commands.parseEmulateMediaFeatures,
    'expect-failure': commands.parseExpectFailure,
    'fail-on-js-error': commands.parseFailOnJsError,
    'fail-on-request-error': commands.parseFailOnRequestError,
    'focus': commands.parseFocus,
    'geolocation': commands.parseGeolocation,
    'go-to': commands.parseGoTo,
    'history-go-back': commands.parseHistoryGoBack,
    'history-go-forward': commands.parseHistoryGoForward,
    'include': commands.parseInclude,
    'javascript': commands.parseJavascript,
    'move-cursor-to': commands.parseMoveCursorTo,
    'pause-on-error': commands.parsePauseOnError,
    'permissions': commands.parsePermissions,
    'press-key': commands.parsePressKey,
    'reload': commands.parseReload,
    'screenshot': commands.parseScreenshot,
    'screenshot-comparison': commands.parseScreenshotComparison,
    'screenshot-on-failure': commands.parseScreenshotOnFailure,
    'scroll-element-to': commands.parseScrollElementTo,
    'scroll-to': commands.parseScrollTo,
    'set-attribute': commands.parseSetAttribute,
    'set-css': commands.parseSetCss,
    'set-device-pixel-ratio': commands.parseSetDevicePixelRatio,
    'set-document-property': commands.parseSetDocumentProperty,
    'set-font-size': commands.parseSetFontSize,
    'set-local-storage': commands.parseSetLocalStorage,
    'set-property': commands.parseSetProperty,
    'set-text': commands.parseSetText,
    'set-timeout': commands.parseSetTimeout,
    'set-window-property': commands.parseSetWindowProperty,
    'set-window-size': commands.parseSetWindowSize,
    'show-text': commands.parseShowText,
    'store-attribute': commands.parseStoreAttribute,
    'store-clipboard': commands.parseStoreClipboard,
    'store-css': commands.parseStoreCss,
    'store-document-property': commands.parseStoreDocumentProperty,
    'store-local-storage': commands.parseStoreLocalStorage,
    'store-position': commands.parseStorePosition,
    'store-property': commands.parseStoreProperty,
    'store-size': commands.parseStoreSize,
    'store-text': commands.parseStoreText,
    'store-value': commands.parseStoreValue,
    'store-window-property': commands.parseStoreWindowProperty,
    'wait-for': commands.parseWaitFor,
    'wait-for-false': commands.parseWaitForFalse,
    'wait-for-attribute': commands.parseWaitForAttribute,
    'wait-for-attribute-false': commands.parseWaitForAttributeFalse,
    'wait-for-clipboard': commands.parseWaitForClipboard,
    'wait-for-clipboard-false': commands.parseWaitForClipboardFalse,
    'wait-for-css': commands.parseWaitForCss,
    'wait-for-css-false': commands.parseWaitForCssFalse,
    'wait-for-count': commands.parseWaitForCount,
    'wait-for-count-false': commands.parseWaitForCountFalse,
    'wait-for-document-property': commands.parseWaitForDocumentProperty,
    'wait-for-document-property-false': commands.parseWaitForDocumentPropertyFalse,
    'wait-for-local-storage': commands.parseWaitForLocalStorage,
    'wait-for-local-storage-false': commands.parseWaitForLocalStorageFalse,
    'wait-for-position': commands.parseWaitForPosition,
    'wait-for-position-false': commands.parseWaitForPositionFalse,
    'wait-for-property': commands.parseWaitForProperty,
    'wait-for-property-false': commands.parseWaitForPropertyFalse,
    'wait-for-size': commands.parseWaitForSize,
    'wait-for-size-false': commands.parseWaitForSizeFalse,
    'wait-for-text': commands.parseWaitForText,
    'wait-for-text-false': commands.parseWaitForTextFalse,
    'wait-for-window-property': commands.parseWaitForWindowProperty,
    'wait-for-window-property-false': commands.parseWaitForWindowPropertyFalse,
    'within-iframe': commands.parseWithinIFrame,
    'write': commands.parseWrite,
    'write-into': commands.parseWriteInto,
};

// If the command fails, the script should stop right away because everything coming after will
// very likely be broken.
const FATAL_ERROR_COMMANDS = [
    // If calling a function fails, no need to go any further as it could have contained many
    // important things.
    'call-function',
    'click',
    'drag-and-drop',
    'emulate',
    'emulate-media-features',
    'focus',
    'go-to',
    'include',
    'move-cursor-to',
    'screenshot',
    'scroll-to',
    'set-attribute',
    'set-css',
    'set-device-pixel-ratio',
    'set-local-storage',
    'set-text',
    'set-window-size',
    'store-attribute',
    'store-css',
    'store-document-property',
    'store-local-storage',
    'store-position',
    'store-property',
    'store-size',
    'store-text',
    'store-value',
    'store-window-property',
    'wait-for',
    'wait-for-clipboard',
    'wait-for-clipboard-false',
    'wait-for-false',
    'wait-for-attribute',
    'wait-for-attribute-false',
    'wait-for-css',
    'wait-for-css-false',
    'wait-for-count',
    'wait-for-count-false',
    'wait-for-property',
    'wait-for-property-false',
    'wait-for-text',
    'wait-for-text-false',
    'within-iframe',
    'write',
    'write-into',
];

// Commands which do not run JS commands but change the behavior of the commands following.
const NO_INTERACTION_COMMANDS = [
    'assert-variable',
    'assert-variable-false',
    'call-function', // Calling this instruction itself doesn't do anything so we can put it here.
    'debug',
    'define-function',
    'emulate',
    'emulate-media-features',
    'expect-failure',
    'fail-on-js-error',
    'fail-on-request-error',
    'include',
    'javascript',
    'screenshot-comparison',
    'screenshot-on-failure',
    'store-value',
    'set-timeout',
    'set-window-size',
];

// Commands which can only be used before the first `goto` command.
const BEFORE_GOTO = [
    'emulate',
    'emulate-media-features',
];

class ParserWithContext {
    constructor(filePath, options, content = null) {
        const ast = new AstLoader(filePath, null, content);
        this.firstGotoParsed = false;
        this.options = options;
        this.callingFunc = [];
        this.variables = options.variables;
        this.definedFunctions = new Map();
        this.contexts = [
            {
                'ast': ast,
                'commands': ast.commands,
                'currentCommand': 0,
                'functionArgs': new Map(),
            },
        ];
    }

    get_parser_errors() {
        const context = this.get_current_context();
        if (context === null) {
            return null;
        }
        return context.ast.errors;
    }

    get_current_context() {
        if (this.contexts.length === 0) {
            return null;
        }
        return this.contexts[this.contexts.length - 1];
    }

    get_current_command() {
        const context = this.get_current_context();
        if (context !== null) {
            return context.commands[context.currentCommand];
        }
        return null;
    }

    increase_context_pos() {
        const c = this.get_current_context();
        if (c !== null) {
            c.currentCommand += 1;
        }
    }

    get_current_command_line() {
        const command = this.get_current_command();
        const backtrace = [];
        for (let i = this.contexts.length - 2; i >= 0; --i) {
            const c = this.contexts[i];
            const shortPath = stripCommonPathsPrefix(c.ast.absolutePath);
            backtrace.push({
                'file': shortPath,
                'line': c.commands[c.currentCommand].line,
            });
        }
        const lineInfo = {
            'line': command.line,
        };
        if (backtrace.length !== 0) {
            lineInfo.backtrace = backtrace;
        }
        return lineInfo;
    }

    pushNewContext(context) {
        this.contexts.push(context);
        if (this.contexts.length > 100) {
            return {
                'error': 'reached maximum recursion size (100)',
                'line': this.get_current_command_line(),
                'fatal_error': true,
            };
        }
    }

    getCurrentFile() {
        const context = this.get_current_context();
        if (context === null) {
            return '';
        } else if (context.filePath !== undefined) {
            return context.filePath;
        }
        return context.ast.absolutePath;
    }

    run_order(pages, order, ast) {
        // This is needed because for now, all commands get access to the ast
        // through `ParserWithContext`.
        this.elems = ast;

        if (!Object.prototype.hasOwnProperty.call(ORDERS, order)) {
            return {'error': `Unknown command "${order}"`, 'line': this.get_current_command_line()};
        }
        if (this.firstGotoParsed === false) {
            if (order !== 'go-to' && NO_INTERACTION_COMMANDS.indexOf(order) === -1) {
                const cmds = NO_INTERACTION_COMMANDS.map(x => `\`${x}\``);
                const last = cmds.pop();
                const text = cmds.join(', ') + ` or ${last}`;
                return {
                    'error': `First command must be \`go-to\` (${text} can be used before)!`,
                    'line': this.get_current_command_line(),
                };
            }
            this.firstGotoParsed = order === 'go-to';
        } else if (BEFORE_GOTO.indexOf(order) !== -1) {
            return {
                'error': `Command \`${order}\` must be used before first \`go-to\`!`,
                'line': this.get_current_command_line(),
            };
        }

        const res = ORDERS[order](this, this.options);
        if (res.error !== undefined) {
            res.line = this.get_current_command_line();
            if (this.elems.length !== 0) {
                res.error += ` (from command \`${order}: ${this.elems[0].getErrorText()}\`)`;
            }
            return res;
        }
        if (res.skipInstructions) {
            // We disable the `increasePos` in the context to prevent it to be done twice.
            return this.get_next_command(pages, false);
        }

        return {
            'fatal_error': FATAL_ERROR_COMMANDS.indexOf(order) !== -1,
            'wait': res['wait'],
            'checkResult': res['checkResult'],
            'original': this.getOriginalCommand(),
            'line': this.get_current_command_line(),
            'instructions': res['instructions'],
            'infos': res['infos'],
            'warnings': res['warnings'],
            'callback': res['callback'],
            'noPosIncrease': res['noPosIncrease'],
        };
    }

    get_next_command(pages, increasePos = true) {
        let context = this.get_current_context();
        while (context !== null && context.currentCommand >= context.commands.length) {
            const prevContext = this.contexts.pop();
            if (prevContext.dropCallback !== undefined) {
                prevContext.dropCallback(pages);
            }
            context = this.get_current_context();
            if (context !== null) {
                context.currentCommand += 1;
            }
        }
        if (context === null) {
            return null;
        }
        const command = context.commands[context.currentCommand];
        const inferred = command.getInferredAst(this.variables, context.functionArgs);
        if (inferred.errors.length !== 0) {
            return {
                'filePath': context.ast.absolutePath,
                'line': command.line,
                'errors': inferred.errors,
            };
        }
        const ret = this.run_order(pages, command.commandName, inferred.ast);
        if (increasePos && !ret['noPosIncrease']) {
            this.increase_context_pos();
        }
        return ret;
    }

    getRawArgs() {
        const command = this.get_current_command();
        if (command === null) {
            return '';
        }
        if (command.argsEnd - command.argsStart > 100) {
            return command.text.slice(command.argsStart, command.argsStart + 100) + '…';
        }
        return command.text.slice(command.argsStart, command.argsEnd);
    }

    getOriginalCommand() {
        const command = this.get_current_command();
        if (command === null) {
            return '';
        }
        return command.getOriginalCommand();
    }
}

function parseTest(testName, testPath, logs, options, content) {
    try {
        const parser = new ParserWithContext(testPath, options, content);
        return {
            'file': testName,
            'parser': parser,
        };
    } catch (err) {
        logs.append(testName + '... FAILED (exception occured)');
        logs.append(`${err.message}\n${err.stack}`);
    }
    return null;
}

const EXPORTS = {
    'ParserWithContext': ParserWithContext,
    'COLOR_CHECK_ERROR': consts.COLOR_CHECK_ERROR,
    'ORDERS': ORDERS,
    'parseTest': parseTest,
};

for (const func of Object.values(ORDERS)) {
    EXPORTS[func.name] = func;
}

if (process.env.debug_tests === '1') {
    EXPORTS['FATAL_ERROR_COMMANDS'] = FATAL_ERROR_COMMANDS;
    EXPORTS['NO_INTERACTION_COMMANDS'] = NO_INTERACTION_COMMANDS;
    EXPORTS['BEFORE_GOTO'] = BEFORE_GOTO;
}

// Those functions shouldn't be used directly!
module.exports = EXPORTS;
