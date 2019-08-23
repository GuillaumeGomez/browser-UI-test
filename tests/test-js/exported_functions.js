const process = require('process');
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
    await x.assertTry(func, ['./tests/scripts/fail.goml'],
        ['fail... FAILED\n[ERROR] Error: net::ERR_FILE_NOT_FOUND at file:///media/imperio/rust/' +
            'browser-UI-test//basic.html: for command `goto: file://{current-dir}/{doc-path}/' +
            'basic.html`\n', 1]);

    // everything is supposed to work
    let options = new Options();
    options.parseArguments(['--doc-path', 'tests/html_files/']);
    await x.assertTry(func, ['./tests/scripts/fail.goml', options], ['fail... ok', 0]);

    // with just one file through "--test-files" options (the extra file should be ignored)
    options = new Options();
    options.parseArguments(['--doc-path', 'tests/html_files/',
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

    // Check a working code
    await x.assertTry(func, ['test',
        'fail: true\ngoto: file://{current-dir}/tests/scripts/basic.html\n' +
        'assert: ("#button", "tadam!")'], ['test... ok', 0]);
}

async function checkRunTests(x, func) {
    // empty options
    await x.assertTry(func, [], 'You need to provide \'--test-folder\' option or at least one ' +
        'file to test with \'--test-files\' option!');

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
    options.parseArguments(['--doc-path', 'tests/html_files/',
        '--test-files', './tests/scripts/fail.goml']);
    await x.assertTry(func, [options],
        ['=> Starting doc-ui tests...\n\nfail... ok\n\n<= doc-ui tests done: 1 succeeded, 0 failed',
            0]);

    // with the usual folder full of examples
    // options = new Options();
    // options.parseArguments(['--test-folder', './tests/scripts',
    //     '--doc-path', 'tests/html_files']);
    // await x.assertTry(func, [options], [null, 1]);
}

const TO_CHECK = [
    {'name': 'runTest', 'func': checkRunTest, 'toCall': wrapRunTest},
    {'name': 'runTestCode', 'func': checkRunTestCode, 'toCall': wrapRunTestCode},
    {'name': 'runTests', 'func': checkRunTests, 'toCall': wrapRunTests},
];

async function checkExportedFunctions() {
    const x = new Assert();

    print('=> Starting EXPORTED FUNCTIONS tests...');
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
    print(`<= Ending ${x.totalRanTests} ${plural('test', x.totalRanTests)} with ` +
        `${x.totalErrors} ${plural('error', x.totalErrors)}`);

    return x.totalErrors;
}

if (require.main === module) {
    checkExportedFunctions().then(nbErrors => {
        process.exit(nbErrors);
    });
} else {
    print('Cannot be used as module!', console.error);
    process.exit(1);
}
