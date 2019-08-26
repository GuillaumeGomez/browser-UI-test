const process = require('process');

const utils = require('../../src/utils.js');
utils.print = function() {}; // overwriting the print function to avoid the print

const {runTestCode, runTest, runTests, Options} = require('../../src/index.js');
const {Assert, plural, print} = require('./utils.js');


async function wrapRunTests(options = new Options()) {
    options.noScreenshot = true;
    return await runTests(options, false);
}
async function wrapRunTest(testPath, options = new Options()) {
    options.noScreenshot = true;
    return await runTest(testPath, options, false);
}
async function wrapRunTestCode(testName, content, options = new Options()) {
    options.noScreenshot = true;
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
    const res = await func('./tests/scripts/fail.goml');
    x.assert(res[0],
        'fail... FAILED\n[ERROR] line 2: variable `null` not found in options nor environment');
    x.assert(res[1], 1);

    // everything is supposed to work
    let options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files']);
    await x.assertTry(func, ['./tests/scripts/fail.goml', options], ['fail... ok', 0]);

    // check if test-folder option is ignored
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files', '--test-folder', 'yolo']);
    await x.assertTry(func, ['./tests/scripts/fail.goml', options],
        ['[WARNING] `--test-folder` option will be ignored.\n\nfail... ok', 0]);

    // with just one file through "--test-files" options (the extra file should be ignored)
    options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-files', './tests/scripts/fail.goml']);
    await x.assertTry(func, ['./tests/scripts/fail.goml', options], ['fail... ok', 0]);
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
        ['test... FAILED\n[ERROR] line 0: Unknown command "let x = true;"', 1]);

    // Check a failing code
    await x.assertTry(func, ['test',
        'fail: true\ngoto: file://{current-dir}/tests/scripts/basic.html\n' +
        'assert: ("#button", "Go somewhere else!")'], ['test... ok', 0]);

    // check if test-folder option is ignored
    const options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-folder', 'yolo']);
    await x.assertTry(func, ['test', 'fail: false', options],
        ['[WARNING] `--test-folder` option will be ignored.\n\ntest... ok', 0]);

    // Check a working code
    await x.assertTry(func, ['test',
        'fail: true\ngoto: file://{current-dir}/tests/scripts/basic.html\n' +
        'assert: ("#button", "tadam!")'], ['test... ok', 0]);
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
        '--test-files', './tests/scripts/fail.goml']);
    await x.assertTry(func, [options],
        ['=> Starting doc-ui tests...\n\nfail... ok\n\n<= doc-ui tests done: 1 succeeded, 0 failed',
            0]);

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

    options.parseArguments(['--test-files', 'osef']);
    await x.assertTry(() => options.validate(), [],
        'You need to provide `--failure-folder` option if `--no-screenshot` isn\'t used!');

    options.parseArguments(['--no-screenshot']);
    await x.assertTry(() => options.validate(), [],
        'Only `.goml` script files are allowed in the `--test-files` option, got `osef`');

    await x.assertTry(() => options.parseArguments(['--run-id']), [],
        'Missing id after `--run-id` option');
    await x.assertTry(() => options.parseArguments(['--run-id', 'he/lo']), [],
        '`--run-id` cannot contain `/` character!');
    await x.assertTry(() => options.parseArguments(['--run-id', 'hello']), [], true);
    x.assert(options.runId, 'hello');

    await x.assertTry(() => options.parseArguments(['--test-folder']), [],
        'Missing path after `--test-folder` option');
    await x.assertTry(() => options.parseArguments(['--test-folder', 'folder']), [], true);
    x.assert(options.testFolder, 'folder');

    await x.assertTry(() => options.parseArguments(['--failure-folder']), [],
        'Missing path after `--failure-folder` option');
    await x.assertTry(() => options.parseArguments(['--failure-folder', 'failure']), [], true);
    x.assert(options.failureFolder, 'failure/');
    await x.assertTry(() => options.parseArguments(['--failure-folder', 'failure/']), [], true);
    x.assert(options.failureFolder, 'failure/');

    options.clear();
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

    x.assert(options.parseArguments(['--help']), false);
    x.assert(options.parseArguments(['-h']), false);

    options.clear();
    await x.assertTry(() => options.parseArguments(['--generate-images']), [], true);
    await x.assert(options.generateImages, true);
    await x.assertTry(() => options.parseArguments(['--no-headless']), [], true);
    await x.assert(options.headless, false);
    await x.assertTry(() => options.parseArguments(['--show-text']), [], true);
    await x.assert(options.showText, true);
    await x.assertTry(() => options.parseArguments(['--debug']), [], true);
    await x.assert(options.debug, true);
    await x.assertTry(() => options.parseArguments(['--no-screenshot']), [], true);
    await x.assert(options.noScreenshot, true);

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
    options7.noScreenshot = '';
    await x.assertTry(() => options7.validateFields(), [],
        '`Options.noScreenshot` field is supposed to be a boolean!');

    const options8 = new Options();
    options8.testFiles = '';
    await x.assertTry(() => options8.validateFields(), [],
        '`Options.files` field is supposed to be an array!');

    const options9 = new Options();
    options9.variables = '';
    await x.assertTry(() => options9.validateFields(), [],
        '`Options.variables` field is supposed to be a dictionary-like!');
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
            x.endTestSuite(false);
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
        process.exit(nbErrors);
    });
} else {
    module.exports = {
        'check': checkExportedItems,
    };
}
