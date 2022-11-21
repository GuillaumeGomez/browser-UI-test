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
    'parseAssertText': assert.parseAssertText,
    'parseAssertTextFalse': assert.parseAssertTextFalse,
    'parseAssertVariable': assert.parseAssertVariable,
    'parseAssertVariableFalse': assert.parseAssertVariableFalse,
    'parseAssertWindowProperty': assert.parseAssertWindowProperty,
    'parseAssertWindowPropertyFalse': assert.parseAssertWindowPropertyFalse,
    'parseAttribute': dom_modifiers.parseAttribute,
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
    'parseCompareElementsText': compare.parseCompareElementsText,
    'parseCompareElementsTextFalse': compare.parseCompareElementsTextFalse,
    'parseCss': dom_modifiers.parseCss,
    'parseDebug': context_setters.parseDebug,
    'parseDefineFunction': functions.parseDefineFunction,
    'parseDevicePixelRatio': emulation.parseDevicePixelRatio,
    'parseDragAndDrop': input.parseDragAndDrop,
    'parseEmulate': emulation.parseEmulate,
    'parseFail': context_setters.parseFail,
    'parseFailOnJsError': context_setters.parseFailOnJsError,
    'parseFailOnRequestError': context_setters.parseFailOnRequestError,
    'parseFocus': input.parseFocus,
    'parseFontSize': emulation.parseFontSize,
    'parseGeolocation': emulation.parseGeolocation,
    'parseGoTo': navigation.parseGoTo,
    'parseHistoryGoBack': navigation.parseHistoryGoBack,
    'parseHistoryGoForward': navigation.parseHistoryGoForward,
    'parseJavascript': emulation.parseJavascript,
    'parseLocalStorage': general.parseLocalStorage,
    'parseMoveCursorTo': input.parseMoveCursorTo,
    'parsePauseOnError': context_setters.parsePauseOnError,
    'parsePermissions': emulation.parsePermissions,
    'parsePressKey': input.parsePressKey,
    'parseReload': navigation.parseReload,
    'parseScreenshot': general.parseScreenshot,
    'parseScreenshotComparison': context_setters.parseScreenshotComparison,
    'parseScrollTo': input.parseScrollTo,
    'parseShowText': context_setters.parseShowText,
    'parseSize': emulation.parseSize,
    'parseStoreAttribute': store.parseStoreAttribute,
    'parseStoreCss': store.parseStoreCss,
    'parseStoreDocumentProperty': store.parseStoreDocumentProperty,
    'parseStoreLocalStorage': store.parseStoreLocalStorage,
    'parseStoreProperty': store.parseStoreProperty,
    'parseStoreText': store.parseStoreText,
    'parseStoreValue': store.parseStoreValue,
    'parseStoreWindowProperty': store.parseStoreWindowProperty,
    'parseText': dom_modifiers.parseText,
    'parseTimeout': context_setters.parseTimeout,
    'parseWaitFor': general.parseWaitFor,
    'parseWaitForAttribute': general.parseWaitForAttribute,
    'parseWaitForCss': general.parseWaitForCss,
    'parseWaitForCount': general.parseWaitForCount,
    'parseWaitForText': general.parseWaitForText,
    'parseWrite': input.parseWrite,
};
