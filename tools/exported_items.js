const process = require('process');
const os = require('os');

const utils = require('../src/utils.js');
utils.print = function print() {}; // overwriting the print function to avoid the print

const {runTestCode, runTest, runTests, Options} = require('../src/index.js');
const {Assert, plural, print, removeFolder} = require('./utils.js');

async function wrapRunTests(options = new Options()) {
    options.screenshotComparison = false;
    return await runTests({'options': options, 'showLogs': false});
}
async function wrapRunTest(testPath, options = new Options()) {
    options.screenshotComparison = false;
    return await runTest(testPath, {'options': options, 'showLogs': false});
}
async function wrapRunTestCode(testName, content, options = new Options()) {
    options.screenshotComparison = false;
    return await runTestCode(
        testName,
        content,
        {'options': options, 'showLogs': false},
    );
}

async function checkRunTest(x, func) {
    // no arguments check
    await x.assertTry(func, [], 'expected `runTest` first argument to be a string');

    // invalid Options type
    await x.assertTry(func, ['./tests/full-check/basic.goml', {'test': false}],
        '`extras["options"]` must be an "Options" type!');

    // non-existent file
    await x.assertTry(func, ['./tests/fail.goml'], 'No file found with path `./tests/fail.goml`');

    // empty options
    const res = await func('./tests/full-check/basic.goml');
    x.assert(res[0],
        'basic... FAILED\n[ERROR] `tests/full-check/basic.goml` line 1: variable `DOC_PATH` not ' +
        'found in options nor environment\n');
    x.assert(res[1], 1);

    // everything is supposed to work
    let options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files']);

    // We need to check that our `options` variable isn't modified by the `runTest` function.
    await x.assert(options.testFiles, []);
    await x.assert(options.testFolder, '');
    await x.assertTry(func, ['./tests/full-check/basic.goml', options], ['basic... OK\n', 0]);
    // We need to check that our `options` variable isn't modified by the `runTest` function.
    await x.assert(options.testFiles, []);
    await x.assert(options.testFolder, '');

    // check if test-folder option is ignored
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files', '--test-folder', 'yolo']);
    await x.assertTry(func, ['./tests/full-check/basic.goml', options],
        ['[WARNING] `--test-folder` option will be ignored.\nbasic... OK\n', 0]);
    removeFolder('yolo'); // The folder is generated because failure and image folders use it.

    // with just one file through "--test-files" options (the extra file should be ignored)
    options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-files', './tests/full-check/basic.goml']);
    await x.assertTry(func, ['./tests/full-check/basic.goml', options], ['basic... OK\n', 0]);
}

async function checkRunTestCode(x, func) {
    // no arguments check
    await x.assertTry(
        func, [], 'expected `runTestCode` first argument to be a string, found `undefined`');

    // no arguments check
    await x.assertTry(
        func, [''], 'expected `runTestCode` second argument to be a string, found `undefined`');

    // no arguments check
    await x.assertTry(func, ['', ''], '`runTestCode` first argument cannot be empty');

    // no options
    await x.assertTry(func, ['test', ''], ['test... FAILED (No command to execute)\n', 1]);

    // invalid Options type
    await x.assertTry(
        func, ['test', '', {'test': false}], '`extras["options"]` must be an "Options" type!');

    // invalid content
    await x.assertTry(func, ['test', {'test': 'test'}],
        'expected `runTestCode` second argument to be a string, found `object`');

    // what about some js?
    await x.assertTry(
        func,
        ['test', 'let x = true;'],
        ['test... FAILED\n[ERROR] line 1: Unexpected `x` when parsing command (after `let`)\n', 1],
    );

    // Check a failing code
    await x.assertTry(func, ['test',
        `\
expect-failure: true
go-to: "file://" + |CURRENT_DIR| + "/tests/html_files/basic.html"
assert-text: ("#button", "Go somewhere els!")`,
    ], ['test... OK\n', 0]);

    // check if test-folder option is ignored
    const options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-folder', 'yolo']);
    await x.assertTry(func, ['test', 'expect-failure: false', options],
        ['[WARNING] `--test-folder` option will be ignored.\ntest... OK\n', 0]);

    // Check a working code
    await x.assertTry(func, ['test',
        'go-to: "file://" + |CURRENT_DIR| + "/tests/html_files/basic.html"\n' +
        'assert-text: ("#button", "Go somewhere else!")'], ['test... OK\n', 0]);

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
        'go-to: "file://" + |CURRENT_DIR| + "/tests/html_files/basic.html"\n' +
        'click: "#button"\n' +
        'assert-text: ("body > header", "Basic test!")', options2], ['hoho... OK\n', 0]);
}

async function checkRunTests(x, func) {
    // empty options
    await x.assertTry(func, [],
        'You need to provide `--test-folder` option or at least one file to test with ' +
        '`--test-files` option!');

    // invalid Options type
    await x.assertTry(func, [{'test': false}], '`extras["options"]` must be an "Options" type!');

    // non-existent folder
    let options = new Options();
    options.parseArguments(['--test-folder', './yolo']);
    await x.assertTry(func, [options], ['Folder `./yolo` not found\n', 1]);

    // "empty" folder (e.g. no .goml files)
    options = new Options();
    options.parseArguments(['--test-folder', './']);
    await x.assertTry(func, [options],
        ['No files found. Check your `--test-folder` and `--test-files` options\n', 1]);

    // with just one non-existent file through "--test-files" options
    options = new Options();
    options.parseArguments(['--test-files', './tests/fail.goml']);
    await x.assertTry(func, [options],
        ['File `./tests/fail.goml` not found (passed with `--test-files` option)\n', 1]);

    // with just one file through "--test-files" options
    options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-files', './tests/full-check/basic.goml']);
    const nbThreads = os.cpus().length;
    await x.assertTry(func, [options],
        [`=> Starting doc-ui tests (on ${nbThreads} threads)...
basic... OK

<= doc-ui tests done: 1 succeeded, 0 failed, 0 filtered out

`, 0]);

    // with the usual folder full of examples
    // options = new Options();
    // options.parseArguments(['--test-folder', './tests/full-check',
    //     '--variable', 'DOC_PATH', 'tests/html_files']);
    // await x.assertTry(func, [options], [null, 1]);
}

async function checkOptions(x) {
    let options = new Options();

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
        '`--run-id` cannot contain `/` or `\\` characters!');
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
        '`--browser` option only accepts `chrome` or `firefox` as value, found `test`');
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
    await x.assert(options.incognito, false);
    await x.assertTry(() => options.parseArguments(['--incognito']), [], true);
    await x.assert(options.incognito, true);
    await x.assert(options.failOnJsError, true);
    await x.assertTry(() => options.parseArguments(['--disable-fail-on-js-error']), [], true);
    await x.assert(options.failOnJsError, false);
    await x.assert(options.failOnRequestError, true);
    await x.assertTry(() => options.parseArguments(['--disable-fail-on-request-error']), [], true);
    await x.assert(options.failOnRequestError, false);
    await x.assert(options.allowFileAccessFromFiles, false);
    await x.assertTry(() => options.parseArguments(['--allow-file-access-from-files']), [], true);
    await x.assert(options.allowFileAccessFromFiles, true);
    await x.assert(options.screenshotOnFailure, false);
    await x.assertTry(() => options.parseArguments(['--screenshot-on-failure']), [], true);
    await x.assert(options.screenshotOnFailure, true);

    await x.assertTry(() => options.parseArguments(['--browser']), [],
        'Missing browser name after `--browser` option');
    await x.assertTry(() => options.parseArguments(['--browser', 'opera']), [],
        '`--browser` option only accepts `chrome` or `firefox` as value, found `opera`');
    await x.assertTry(() => options.parseArguments(['--browser', 'firefox']), [], true);
    await x.assert(options.browser, 'firefox');
    await x.assertTry(() => options.parseArguments(['--browser', 'chrome  ']), [], true);
    await x.assert(options.browser, 'chrome');

    await x.assertTry(() => options.parseArguments(['--executable-path']), [],
        'Missing executable path after `--executable-path` option');
    await x.assertTry(() => options.parseArguments(['--executable-path', 'a']), [], true);
    await x.assert(options.executablePath, 'a');

    await x.assertTry(() => options.parseArguments(['--jobs']), [],
        'Missing number after `--jobs` option');
    await x.assertTry(() => options.parseArguments(['--jobs', 'a']), [],
        'Expected a number after `--jobs` option, found `a`');
    await x.assertTry(() => options.parseArguments(['--jobs', '8']), [], true);
    await x.assert(options.nbThreads, 8);

    await x.assertTry(() => options.parseArguments(['--emulate-media-feature'], [],
        'Missing media feature name and value after `--emulate-media-feature` option'));
    await x.assertTry(() => options.parseArguments(['--emulate-media-feature', 'a'], [],
        'Missing media feature value after `--emulate-media-feature` option'));
    await x.assertTry(() => options.parseArguments(['--emulate-media-feature', 'a', 'b'], [],
        'Unknown key `a` in `--emulate-media-feature`'));
    await x.assertTry(() => options.parseArguments(
        ['--emulate-media-feature', 'prefers-color-scheme', 'light'],
    ), [], true);
    await x.assert(
        Object.fromEntries(options.emulateMediaFeatures.entries()),
        {'prefers-color-scheme': 'light'},
    );

    options = new Options();
    options.runId = true;
    await x.assertTry(() => options.validateFields(), [],
        '`Options.runId` field is supposed to be a string! (Type is boolean)');

    options = new Options();
    options.generateImages = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.generateImages` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.headless = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.headless` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.testFolder = 1;
    await x.assertTry(() => options.validateFields(), [],
        '`Options.testFolder` field is supposed to be a string! (Type is number)');

    options = new Options();
    options.failureFolder = 1;
    await x.assertTry(() => options.validateFields(), [],
        '`Options.failureFolder` field is supposed to be a string! (Type is number)');

    options = new Options();
    options.showText = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.showText` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.debug = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.debug` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.screenshotComparison = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.screenshotComparison` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.testFiles = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.testFiles` field is supposed to be an array! (Type is string)');

    options = new Options();
    options.variables = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.variables` field is supposed to be a `Map`! (Type is string)');

    options = new Options();
    options.browser = 12;
    await x.assertTry(() => options.validateFields(), [],
        '`Options.browser` field is supposed to be a string! (Type is number)');

    options = new Options();
    options.incognito = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.incognito` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.emulate = 12;
    await x.assertTry(() => options.validateFields(), [],
        '`Options.emulate` field is supposed to be a string! (Type is number)');

    options = new Options();
    options.timeout = 'a';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.timeout` field is supposed to be a number! (Type is string)');

    options = new Options();
    options.timeout = -1;
    await x.assertTry(() => options.validateFields(), [],
        '`Options.timeout` field cannot be < 0');

    options = new Options();
    options.permissions = 'la';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.permissions` field is supposed to be an array! (Type is string)');

    options = new Options();
    options.onPageCreatedCallback = 'la';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.onPageCreatedCallback` field is supposed to be a function! (Type is string)');

    options = new Options();
    options.onPageCreatedCallback = () => {};
    await x.assert(() => options.validateFields());

    options = new Options();
    options.onPageCreatedCallback = function() {};
    await x.assert(() => options.validateFields());

    options = new Options();
    options.onPageCreatedCallback = async function() {};
    await x.assert(() => options.validateFields());

    options = new Options();
    options.onPageCreatedCallback = async() => {};
    await x.assert(() => options.validateFields());

    options = new Options();
    options.failOnJsError = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.failOnJsError` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.failOnRequestError = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.failOnRequestError` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.allowFileAccessFromFiles = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.allowFileAccessFromFiles` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.screenshotOnFailure = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.screenshotOnFailure` field is supposed to be a boolean! (Type is string)');

    options = new Options();
    options.nbThreads = '';
    await x.assertTry(() => options.validateFields(), [],
        '`Options.nbThreads` field is supposed to be a number! (Type is string)');

    options = new Options();
    options.emulateMediaFeatures = {};
    await x.assertTry(() => options.validateFields(), [],
        '`Options.emulateMediaFeatures` field is supposed to be a `Map`! (Type is object)');
    options.emulateMediaFeatures = new Map();
    options.emulateMediaFeatures.set('a', 'b');
    await x.assertTry(() => options.validateFields(), [],
        'Unknown key `a` in `Options.emulateMediaFeatures` field');
}

const TO_CHECK = [
    {'name': 'Options', 'func': checkOptions},
    {'name': 'runTest', 'func': checkRunTest, 'toCall': wrapRunTest},
    {'name': 'runTestCode', 'func': checkRunTestCode, 'toCall': wrapRunTestCode},
    {'name': 'runTests', 'func': checkRunTests, 'toCall': wrapRunTests},
];

async function checkExportedItems(x = new Assert()) {
    return await x.startTestSuite('exported items', false, async() => {
        print('=> Starting EXPORTED ITEMS tests...');
        print('');

        for (let i = 0; i < TO_CHECK.length; ++i) {
            await x.startTestSuite(TO_CHECK[i].name, true, async(level, suiteName) => {
                try {
                    await TO_CHECK[i].func(x, TO_CHECK[i].toCall);
                    print(`<${'='.repeat(level + 1)} "${suiteName}": ${x.getTotalErrors()} ` +
                        `${plural('error', x.getTotalErrors())} (in ${x.getTotalRanTests()} ` +
                        `${plural('test', x.getTotalRanTests())})`);
                } catch (err) {
                    print(`<== "${TO_CHECK[i].name}" failed: ${err}\n${err.stack}`);
                    return false;
                }
            });
        }

        print('');
        print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
            `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);
    });
}

if (require.main === module) {
    checkExportedItems().then(({totalErrors}) => {
        process.exit(totalErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkExportedItems,
    };
}
