// List all functions to parse commands.

const assert = require('./assert.js');
const compare = require('./compare.js');
const context_setters = require('./context_setters.js');
const dom_modifiers = require('./dom_modifiers.js');
const emulation = require('./emulation.js');
const functions = require('./functions.js');
const general = require('./general.js');
const input = require('./input.js');
const navigation = require('./navigation.js');
const store = require('./store.js');
const wait = require('./wait.js');

module.exports = {
    'parseAssert': assert.parseAssert,
    'parseAssertFalse': assert.parseAssertFalse,
    'parseAssertAttribute': assert.parseAssertAttribute,
    'parseAssertAttributeFalse': assert.parseAssertAttributeFalse,
    'parseAssertCount': assert.parseAssertCount,
    'parseAssertCountFalse': assert.parseAssertCountFalse,
    'parseAssertCss': assert.parseAssertCss,
    'parseAssertCssFalse': assert.parseAssertCssFalse,
    'parseAssertDocumentProperty': assert.parseAssertDocumentProperty,
    'parseAssertDocumentPropertyFalse': assert.parseAssertDocumentPropertyFalse,
    'parseAssertLocalStorage': assert.parseAssertLocalStorage,
    'parseAssertLocalStorageFalse': assert.parseAssertLocalStorageFalse,
    'parseAssertPosition': assert.parseAssertPosition,
    'parseAssertPositionFalse': assert.parseAssertPositionFalse,
    'parseAssertProperty': assert.parseAssertProperty,
    'parseAssertPropertyFalse': assert.parseAssertPropertyFalse,
    'parseAssertSize': assert.parseAssertSize,
    'parseAssertSizeFalse': assert.parseAssertSizeFalse,
    'parseAssertText': assert.parseAssertText,
    'parseAssertTextFalse': assert.parseAssertTextFalse,
    'parseAssertVariable': assert.parseAssertVariable,
    'parseAssertVariableFalse': assert.parseAssertVariableFalse,
    'parseAssertWindowProperty': assert.parseAssertWindowProperty,
    'parseAssertWindowPropertyFalse': assert.parseAssertWindowPropertyFalse,
    'parseCallFunction': functions.parseCallFunction,
    'parseClick': input.parseClick,
    'parseClickWithOffset': input.parseClickWithOffset,
    'parseCompareElementsAttribute': compare.parseCompareElementsAttribute,
    'parseCompareElementsAttributeFalse': compare.parseCompareElementsAttributeFalse,
    'parseCompareElementsCss': compare.parseCompareElementsCss,
    'parseCompareElementsCssFalse': compare.parseCompareElementsCssFalse,
    'parseCompareElementsPosition': compare.parseCompareElementsPosition,
    'parseCompareElementsPositionFalse': compare.parseCompareElementsPositionFalse,
    'parseCompareElementsPositionNear': compare.parseCompareElementsPositionNear,
    'parseCompareElementsPositionNearFalse': compare.parseCompareElementsPositionNearFalse,
    'parseCompareElementsProperty': compare.parseCompareElementsProperty,
    'parseCompareElementsPropertyFalse': compare.parseCompareElementsPropertyFalse,
    'parseCompareElementsSize': compare.parseCompareElementsSize,
    'parseCompareElementsSizeFalse': compare.parseCompareElementsSizeFalse,
    'parseCompareElementsSizeNear': compare.parseCompareElementsSizeNear,
    'parseCompareElementsSizeNearFalse': compare.parseCompareElementsSizeNearFalse,
    'parseCompareElementsText': compare.parseCompareElementsText,
    'parseCompareElementsTextFalse': compare.parseCompareElementsTextFalse,
    'parseDebug': context_setters.parseDebug,
    'parseDefineFunction': functions.parseDefineFunction,
    'parseDragAndDrop': input.parseDragAndDrop,
    'parseEmulate': emulation.parseEmulate,
    'parseExpectFailure': context_setters.parseExpectFailure,
    'parseFailOnJsError': context_setters.parseFailOnJsError,
    'parseFailOnRequestError': context_setters.parseFailOnRequestError,
    'parseFocus': input.parseFocus,
    'parseGeolocation': emulation.parseGeolocation,
    'parseGoTo': navigation.parseGoTo,
    'parseHistoryGoBack': navigation.parseHistoryGoBack,
    'parseHistoryGoForward': navigation.parseHistoryGoForward,
    'parseInclude': general.parseInclude,
    'parseJavascript': emulation.parseJavascript,
    'parseMoveCursorTo': input.parseMoveCursorTo,
    'parsePauseOnError': context_setters.parsePauseOnError,
    'parsePermissions': emulation.parsePermissions,
    'parsePressKey': input.parsePressKey,
    'parseReload': navigation.parseReload,
    'parseScreenshot': general.parseScreenshot,
    'parseScreenshotComparison': context_setters.parseScreenshotComparison,
    'parseScreenshotOnFailure': context_setters.parseScreenshotOnFailure,
    'parseScrollTo': input.parseScrollTo,
    'parseSetAttribute': dom_modifiers.parseSetAttribute,
    'parseSetCss': dom_modifiers.parseSetCss,
    'parseSetDevicePixelRatio': emulation.parseSetDevicePixelRatio,
    'parseSetDocumentProperty': general.parseSetDocumentProperty,
    'parseSetFontSize': emulation.parseSetFontSize,
    'parseSetLocalStorage': general.parseSetLocalStorage,
    'parseSetProperty': dom_modifiers.parseSetProperty,
    'parseSetWindowSize': emulation.parseSetWindowSize,
    'parseSetText': dom_modifiers.parseSetText,
    'parseSetTimeout': context_setters.parseSetTimeout,
    'parseSetWindowProperty': general.parseSetWindowProperty,
    'parseShowText': context_setters.parseShowText,
    'parseStoreAttribute': store.parseStoreAttribute,
    'parseStoreCss': store.parseStoreCss,
    'parseStoreDocumentProperty': store.parseStoreDocumentProperty,
    'parseStoreLocalStorage': store.parseStoreLocalStorage,
    'parseStorePosition': store.parseStorePosition,
    'parseStoreProperty': store.parseStoreProperty,
    'parseStoreSize': store.parseStoreSize,
    'parseStoreText': store.parseStoreText,
    'parseStoreValue': store.parseStoreValue,
    'parseStoreWindowProperty': store.parseStoreWindowProperty,
    'parseWaitFor': wait.parseWaitFor,
    'parseWaitForAttribute': wait.parseWaitForAttribute,
    'parseWaitForCss': wait.parseWaitForCss,
    'parseWaitForCount': wait.parseWaitForCount,
    'parseWaitForDocumentProperty': wait.parseWaitForDocumentProperty,
    'parseWaitForLocalStorage': wait.parseWaitForLocalStorage,
    'parseWaitForPosition': wait.parseWaitForPosition,
    'parseWaitForProperty': wait.parseWaitForProperty,
    'parseWaitForSize': wait.parseWaitForSize,
    'parseWaitForText': wait.parseWaitForText,
    'parseWaitForWindowProperty': wait.parseWaitForWindowProperty,
    'parseWrite': input.parseWrite,
    'parseWriteInto': input.parseWriteInto,
};
