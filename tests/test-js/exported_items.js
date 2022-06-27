const process = require('process');

const utils = require('../../src/utils.js');
utils.print = function print() {}; // overwriting the print function to avoid the print

const {runTestCode, runTest, runTests, Options} = require('../../src/index.js');
const {Assert, plural, print, removeFolder} = require('./utils.js');


async function wrapRunTests(options = new Options()) {
    options.screenshotComparison = false;
    options.noSandbox = true;
    return await runTests(options, false);
}
async function wrapRunTest(testPath, options = new Options()) {
    options.screenshotComparison = false;
    options.noSandbox = true;
    return await runTest(testPath, options, false);
}
async function wrapRunTestCode(testName, content, options = new Options()) {
    options.screenshotComparison = false;
    options.noSandbox = true;
    return await runTestCode(testName, content, options, false);
}

async function checkRunTest(x, func) {
    // no arguments check
    await x.assertTry(func, [], 'expected `runTest` first argument to be a string');

    // invalid Options type
    await x.assertTry(func, ['../scripts/fail.goml', {'test': false}],
        'Options must be an "Options" type!');

    // non-existent file
    await x.assertTry(func, ['./tests/fail.goml'], 'No file found with path `./tests/fail.goml`');

    // empty options
    const res = await func('./tests/scripts/basic.goml');
    x.assert(res[0],
        'basic... FAILED\n[ERROR] line 1: variable `DOC_PATH` not found in options ' +
        'nor environment');
    x.assert(res[1], 1);

    // everything is supposed to work
    let options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files']);

    // We need to check that our `options` variable isn't modified by the `runTest` function.
    await x.assert(options.testFiles, []);
    await x.assert(options.testFolder, '');
    await x.assertTry(func, ['./tests/scripts/basic.goml', options], ['basic... ok', 0]);
    // We need to check that our `options` variable isn't modified by the `runTest` function.
    await x.assert(options.testFiles, []);
    await x.assert(options.testFolder, '');

    // check if test-folder option is ignored
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files', '--test-folder', 'yolo']);
    await x.assertTry(func, ['./tests/scripts/basic.goml', options],
        ['[WARNING] `--test-folder` option will be ignored.\n\nbasic... ok', 0]);
    removeFolder('yolo'); // The folder is generated because failure and image folders use it.

    // with just one file through "--test-files" options (the extra file should be ignored)
    options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-files', './tests/scripts/basic.goml']);
    await x.assertTry(func, ['./tests/scripts/basic.goml', options], ['basic... ok', 0]);
}

async function checkRunTestCode(x, func) {
    // no arguments check
    await x.assertTry(func, [], 'expected `runTestCode` first argument to be a string');

    // no arguments check
    await x.assertTry(func, [''], 'expected `runTestCode` second argument to be a string');

    // no arguments check
    await x.assertTry(func, ['', ''], 'test name (first argument) cannot be empty');

    // no options
    await x.assertTry(func, ['test', ''], ['test... FAILED\n=> No command to execute', 1]);

    // invalid Options type
    await x.assertTry(func, ['test', '', {'test': false}], 'Options must be an "Options" type!');

    // invalid content
    await x.assertTry(func, ['test', {'test': 'test'}],
        'expected `runTestCode` second argument to be a string');

    // what about some js?
    await x.assertTry(func, ['test', 'let x = true;'],
        ['test... FAILED\n[ERROR] line 1: Unexpected `x` when parsing command (after `let`)', 1]);

    // Check a failing code
    await x.assertTry(func, ['test',
        'fail: true\ngoto: file://|CURRENT_DIR|/tests/scripts/basic.html\n' +
        'assert-text: ("#button", "Go somewhere else!")'], ['test... ok', 0]);

    // check if test-folder option is ignored
    const options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-folder', 'yolo']);
    await x.assertTry(func, ['test', 'fail: false', options],
        ['[WARNING] `--test-folder` option will be ignored.\n\ntest... ok', 0]);

    // Check a working code
    await x.assertTry(func, ['test',
        'goto: file://|CURRENT_DIR|/tests/html_files/basic.html\n' +
        'assert-text: ("#button", "Go somewhere else!")'], ['test... ok', 0]);

    // Check callback
    const options2 = new Options();
    options2.onPageCreatedCallback = async(page, test_name) => {
        x.assert(test_name, 'hoho');
        await page.setRequestInterception(true);
        page.on('request', async request => {
            if (!request.url().endsWith('basic.html')) {
                request.headers['Content-Type'] = 'text/html; charset=utf-8';
                await request.respond({
                    'status': 200,
                    'body': '<html><body><header>Basic test!</header></body></html>',
                    'headers': request.headers,
                });
            } else {
                request.continue();
            }
        }); // if we receive a request, we don't process it.
    };
    await x.assertTry(func, ['hoho',
        'goto: file://|CURRENT_DIR|/tests/html_files/basic.html\n' +
        'click: "#button"\n' +
        'assert-text: ("body > header", "Basic test!")', options2], ['hoho... ok', 0]);
}

async function checkRunTests(x, func) {
    // empty options
    await x.assertTry(func, [],
        'You need to provide `--test-folder` option or at least one file to test with ' +
        '`--test-files` option!');

    // invalid Options type
    await x.assertTry(func, [{'test': false}], 'Options must be an "Options" type!');

    // non-existent folder
    let options = new Options();
    options.parseArguments(['--test-folder', './yolo']);
    await x.assertTry(func, [options], 'Folder `./yolo` not found');

    // "empty" folder (e.g. no .goml files)
    options = new Options();
    options.parseArguments(['--test-folder', './']);
    await x.assertTry(func, [options],
        'No files found. Check your `--test-folder` and `--test-files` options');

    // with just one non-existent file through "--test-files" options
    options = new Options();
    options.parseArguments(['--test-files', './tests/fail.goml']);
    await x.assertTry(func, [options],
        'File `./tests/fail.goml` not found (passed with `--test-files` option)');

    // with just one file through "--test-files" options
    options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-files', './tests/scripts/basic.goml']);
    await x.assertTry(func, [options],
        ['=> Starting doc-ui tests...\n\nbasic... ok\n\n<= doc-ui tests done: 1 ' +
         'succeeded, 0 failed', 0]);

    // with the usual folder full of examples
    // options = new Options();
    // options.parseArguments(['--test-folder', './tests/scripts',
    //     '--variable', 'DOC_PATH', 'tests/html_files']);
    // await x.assertTry(func, [options], [null, 1]);
}

async function checkOptions(x) {
    const options = new Options();

    await x.assertTry(() => options.validate(), [],
        'You need to provide `--test-folder` option or at least one file to test with ' +
        '`--test-files` option!');

    options.parseArguments(['--enable-screenshot-comparison', '--test-files', 'osef']);
    await x.assertTry(() => options.validate(), [],
        'You need to provide `--failure-folder` or `--test-folder` option if ' +
        '`--enable-screenshot-comparison` option is used!');
    await x.assert(options.screenshotComparison, true);

    options.screenshotComparison = false;
    options.parseArguments([]);
    await x.assertTry(() => options.validate(), [],
        'Only `.goml` script files are allowed in the `--test-files` option, got `osef`');

    x.assert(options.runId, 'test');
    await x.assertTry(() => options.parseArguments(['--run-id']), [],
        'Missing id after `--run-id` option');
    await x.assertTry(() => options.parseArguments(['--run-id', 'he/lo']), [],
        '`--run-id` cannot contain `/` character!');
    await x.assertTry(() => options.parseArguments(['--run-id', 'hello']), [], true);
    x.assert(options.runId, 'hello');

    x.assert(options.testFolder, '');
    await x.assertTry(() => options.parseArguments(['--test-folder']), [],
        'Missing path after `--test-folder` option');
    await x.assertTry(() => options.parseArguments(['--test-folder', 'folder']), [], true);
    x.assert(options.testFolder, 'folder');

    x.assert(options.failureFolder, '');
    await x.assertTry(() => options.parseArguments(['--failure-folder']), [],
        'Missing path after `--failure-folder` option');
    await x.assertTry(() => options.parseArguments(['--failure-folder', 'failure']), [], true);
    x.assert(options.failureFolder, 'failure');
    await x.assertTry(() => options.parseArguments(['--failure-folder', 'failure/']), [], true);
    x.assert(options.failureFolder, 'failure/');

    x.assert(options.emulate, '');
    await x.assertTry(() => options.parseArguments(['--emulate']), [],
        'Missing device name after `--emulate` option');
    await x.assertTry(() => options.parseArguments(['--emulate', 'hoho']), [], true);
    x.assert(options.emulate, 'hoho');
    await x.assertTry(() => options.parseArguments(['--emulate', 'new one?']), [], true);
    x.assert(options.emulate, 'new one?');

    x.assert(options.timeout, 30000);
    await x.assertTry(() => options.parseArguments(['--timeout']), [],
        'Missing number of milliseconds after `--timeout` option');
    await x.assertTry(() => options.parseArguments(['--timeout', 'hoho']), [],
        '`--timeout` expected an integer, found `hoho`');
    await x.assertTry(() => options.parseArguments(['--timeout', '-1']), [],
        'Number of milliseconds for `timeout` cannot be < 0!');
    await x.assertTry(() => options.parseArguments(['--timeout', '10']), [], true);
    x.assert(options.timeout, 10);

    x.assert(options.permissions, []);
    await x.assertTry(() => options.parseArguments(['--permission']), [],
        'Missing permission name after `--permission` option');
    await x.assertTry(() => options.parseArguments(['--permission', 'hoho']), [], true);
    await x.assertTry(() => options.parseArguments(['--permission', 'hoho']), [], true);
    await x.assertTry(() => options.parseArguments(['--permission', 'trololo']), [], true);
    x.assert(options.permissions, ['hoho', 'trololo']);

    options.clear();
    x.assert(options.testFiles, []);
    await x.assertTry(() => options.parseArguments(['--test-files']), [],
        'Expected at least one path for `--test-files` option');
    await x.assertTry(() => options.parseArguments(['--test-files', 'hello']), [], true);
    x.assert(options.testFiles, ['hello']);
    await x.assertTry(() => options.parseArguments(['--test-files', 'hello2', '--test-folder']), [],
        true);
    x.assert(options.testFiles, ['hello', 'hello2', '--test-folder']);
    await x.assertTry(() => options.parseArguments(['--test-files', 'hello']), [], true);
    x.assert(options.testFiles, ['hello', 'hello2', '--test-folder']);

    await x.assertTry(() => options.parseArguments(['--doesnt-exist']), [],
        'Unknown option `--doesnt-exist`\nUse `--help` if you want the list of the available ' +
        'commands');
    await x.assertTry(() => options.parseArguments(['a']), [],
        'Unknown option `a`\nUse `--help` if you want the list of the available commands');

    options.clear();
    await x.assert(options.browser, 'chrome');
    await x.assertTry(() => options.parseArguments(['--browser']), [],
        'Missing browser name after `--browser` option');
    await x.assertTry(() => options.parseArguments(['--browser', 'test']), [],
        '`--browser` option only accepts "chrome" or "firefox" as values, found `test`');
    await x.assertTry(() => options.parseArguments(['--browser', 'firefox']), [], true);
    await x.assert(options.browser, 'firefox');
    await x.assertTry(() => options.parseArguments(['--browser', 'chrome']), [], true);
    await x.assert(options.browser, 'chrome');

    // different check in the validate
    const opt = new Options();
    opt.browser = 'test';
    await x.assertTry(() => opt.parseArguments(['--test-folder', 'a']), [], true);
    await x.assertTry(() => opt.validate(), [],
        '`Options.browser` field only accepts "chrome" or "firefox" as values, found test');

    x.assert(options.parseArguments(['--help']), false);
    x.assert(options.parseArguments(['-h']), false);
    x.assert(options.parseArguments(['--show-devices']), false);
    x.assert(options.parseArguments(['--show-permissions']), false);

    options.clear();
    await x.assert(options.generateImages, false);
    await x.assertTry(() => options.parseArguments(['--generate-images']), [], true);
    await x.assert(options.generateImages, true);
    await x.assert(options.headless, true);
    await x.assertTry(() => options.parseArguments(['--no-headless']), [], true);
    await x.assert(options.headless, false);
    await x.assert(options.showText, false);
    await x.assertTry(() => options.parseArguments(['--show-text']), [], true);
    await x.assert(options.showText, true);
    await x.assert(options.debug, false);
    await x.assertTry(() => options.parseArguments(['--debug']), [], true);
    await x.assert(options.debug, true);
    await x.assert(options.screenshotComparison, false);
    await x.assertTry(() => options.parseArguments(['--enable-screenshot-comparison']), [], true);
    await x.assert(options.screenshotComparison, true);
    await x.assert(options.noSandbox, false);
    await x.assertTry(() => options.parseArguments(['--no-sandbox']), [], true);
    await x.assert(options.noSandbox, true);
    await x.assert(options.incognito, false);
    await x.assertTry(() => options.parseArguments(['--incognito']), [], true);
    await x.assert(options.incognito, true);
    await x.assertTry(() => options.parseArguments(['--enable-fail-on-js-error']), [], true);
    await x.assert(options.failOnJsError, true);

    await x.assertTry(() => options.parseArguments(['--browser']), [],
        'Missing browser name after `--browser` option');
    await x.assertTry(() => options.parseArguments(['--browser', 'opera']), [],
        '`--browser` option only accepts "chrome" or "firefox" as values, found `opera`');
    await x.assertTry(() => options.parseArguments(['--browser', 'firefox']), [], true);
    await x.assert(options.browser, 'firefox');
    await x.assertTry(() => options.parseArguments(['--browser', 'chrome  ']), [], true);
    await x.assert(options.browser, 'chrome');

    await x.assertTry(() => options.parseArguments(['--executable-path']), [],
        'Missing executable path after `--executable-path` option');
    await x.assertTry(() => options.parseArguments(['--executable-path', 'a']), [], true);
    await x.assert(options.executablePath, 'a');

    const options0 = new Options();
    options0.runId = true;
    await x.assertTry(() => options0.validateFields(), [],
        '`Options.runId` field is supposed to be a string!');

    const options1 = new Options();
    options1.generateImages = '';
    await x.assertTry(() => options1.validateFields(), [],
        '`Options.generateImages` field is supposed to be a boolean!');

    const options2 = new Options();
    options2.headless = '';
    await x.assertTry(() => options2.validateFields(), [],
        '`Options.headless` field is supposed to be a boolean!');

    const options3 = new Options();
    options3.testFolder = 1;
    await x.assertTry(() => options3.validateFields(), [],
        '`Options.testFolder` field is supposed to be a string!');

    const options4 = new Options();
    options4.failureFolder = 1;
    await x.assertTry(() => options4.validateFields(), [],
        '`Options.failureFolder` field is supposed to be a string!');

    const options5 = new Options();
    options5.showText = '';
    await x.assertTry(() => options5.validateFields(), [],
        '`Options.showText` field is supposed to be a boolean!');

    const options6 = new Options();
    options6.debug = '';
    await x.assertTry(() => options6.validateFields(), [],
        '`Options.debug` field is supposed to be a boolean!');

    const options7 = new Options();
    options7.screenshotComparison = '';
    await x.assertTry(() => options7.validateFields(), [],
        '`Options.screenshotComparison` field is supposed to be a boolean!');

    const options8 = new Options();
    options8.testFiles = '';
    await x.assertTry(() => options8.validateFields(), [],
        '`Options.testFiles` field is supposed to be an array!');

    const options9 = new Options();
    options9.variables = '';
    await x.assertTry(() => options9.validateFields(), [],
        '`Options.variables` field is supposed to be a dictionary-like!');

    const options10 = new Options();
    options10.browser = 12;
    await x.assertTry(() => options10.validateFields(), [],
        '`Options.browser` field is supposed to be a string!');

    const options11 = new Options();
    options11.incognito = '';
    await x.assertTry(() => options11.validateFields(), [],
        '`Options.incognito` field is supposed to be a boolean!');

    const options12 = new Options();
    options12.emulate = 12;
    await x.assertTry(() => options12.validateFields(), [],
        '`Options.emulate` field is supposed to be a string!');

    const options13 = new Options();
    options13.timeout = 'a';
    await x.assertTry(() => options13.validateFields(), [],
        '`Options.timeout` field is supposed to be a number!');

    const options14 = new Options();
    options14.timeout = -1;
    await x.assertTry(() => options14.validateFields(), [],
        '`Options.timeout` field cannot be < 0');

    const options15 = new Options();
    options15.permissions = 'la';
    await x.assertTry(() => options15.validateFields(), [],
        '`Options.permissions` field is supposed to be an array!');

    const options16 = new Options();
    options16.onPageCreatedCallback = 'la';
    await x.assertTry(() => options16.validateFields(), [],
        '`Options.onPageCreatedCallback` field is supposed to be a function!');

    const options17 = new Options();
    options17.onPageCreatedCallback = () => {};
    await x.assert(() => options17.validateFields());

    const options18 = new Options();
    options18.onPageCreatedCallback = function() {};
    await x.assert(() => options18.validateFields());

    const options19 = new Options();
    options19.onPageCreatedCallback = async function() {};
    await x.assert(() => options19.validateFields());

    const options20 = new Options();
    options20.onPageCreatedCallback = async() => {};
    await x.assert(() => options20.validateFields());

    const options21 = new Options();
    options21.failOnJsError = '';
    await x.assertTry(() => options21.validateFields(), [],
        '`Options.failOnJsError` field is supposed to be a boolean!');
}

const TO_CHECK = [
    {'name': 'Options', 'func': checkOptions},
    {'name': 'runTest', 'func': checkRunTest, 'toCall': wrapRunTest},
    {'name': 'runTestCode', 'func': checkRunTestCode, 'toCall': wrapRunTestCode},
    {'name': 'runTests', 'func': checkRunTests, 'toCall': wrapRunTests},
];

async function checkExportedItems(x = new Assert()) {
    x.startTestSuite('exported items', false);
    print('=> Starting EXPORTED ITEMS tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        x.startTestSuite(TO_CHECK[i].name);
        try {
            await TO_CHECK[i].func(x, TO_CHECK[i].toCall);
            x.endTestSuite();
        } catch (err) {
            x.endTestSuite(false, true);
            print(`<== "${TO_CHECK[i].name}" failed: ${err}\n${err.stack}`);
        }
    }

    print('');
    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    const errors = x.getTotalErrors();
    x.endTestSuite(false);
    return errors;
}

if (require.main === module) {
    checkExportedItems().then(nbErrors => {
        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkExportedItems,
    };
}
