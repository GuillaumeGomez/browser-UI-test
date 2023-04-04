const fs = require('fs');
const path = require('path');
const os = require('os');
const process = require('process');

const utils = require('../../src/utils.js');
utils.print = function print() {}; // overwriting the print function to avoid the print

const {runTests, Options} = require('../../src/index.js');
const {Assert, plural, print} = require('./utils.js');

async function wrapRunTests(options = new Options()) {
    options.screenshotComparison = false;
    options.noSandbox = true;
    const ret = await runTests(options, false);
    return ret[0];
}

function runAsyncUiTest(x, file, output, tests_queue) {
    const options = new Options();
    options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
        '--test-files', file]);
    let testOutput = '';

    const callback = x.assertTryUi(
        wrapRunTests,
        [options],
        output.replaceAll('$CURRENT_DIR', utils.getCurrentDir()),
        file,
        false,
        s => testOutput += s + '\n',
        (value1, _) => {
            const filePath = file.replace('.goml', '.output');
            fs.writeFileSync(filePath, value1);
            print(`Blessed \`${filePath}\``);
        },
    ).finally(() => {
        print(`Finished testing "${file}"`);
        if (testOutput.length > 0) {
            print(testOutput);
        }
        // We now remove the promise from the tests_queue.
        tests_queue.splice(tests_queue.indexOf(callback), 1);
    });
    tests_queue.push(callback);
}

// This test ensures that the outputs looks as expected.
async function compareOutput(x) {
    const filesToTest = [];
    const testFolder = 'tests/ui-tests';
    fs.readdirSync(testFolder).forEach(file => {
        const curPath = path.join(testFolder, file);
        if (fs.lstatSync(curPath).isDirectory() || !curPath.endsWith('.goml')) {
            return;
        }
        filesToTest.push(curPath.toString());
    });

    const cpuCount = os.cpus().length / 2 + 1;
    process.setMaxListeners(cpuCount);
    const tests_queue = [];

    for (const file of filesToTest) {
        const outputFile = file.replace('.goml', '.output');
        let output;

        try {
            output = fs.readFileSync(outputFile, 'utf8');
        } catch (_) {
            output = `Cannot open file \`${outputFile}\``;
        }

        runAsyncUiTest(x, file, output, tests_queue);
        if (tests_queue.length >= cpuCount) {
            await Promise.race(tests_queue);
        }
    }
    if (tests_queue.length > 0) {
        await Promise.all(tests_queue);
    }
}

function checkImageFileForTest(x, screenshotFile, testName) {
    if (fs.existsSync(screenshotFile) === false) {
        x.addError(`\`${testName}\` should have generated a \`${screenshotFile}\` file!`);
    } else {
        fs.unlinkSync(screenshotFile);
    }
}

async function checkUi(x) {
    x.startTestSuite('ui items', false);
    print('=> Starting UI tests...');
    print('');

    x.startTestSuite('ui-test');
    try {
        await compareOutput(x);
        x.endTestSuite();
    } catch (err) {
        x.endTestSuite(false, true);
        print(`<== "ui-test" failed: ${err}\n${err.stack}`);
    }

    checkImageFileForTest(x, 'tests/ui-tests/tadam.png', 'screenshot-info.goml');
    checkImageFileForTest(
        x, 'tests/ui-tests/screenshot-on-failure-failure.png', 'screenshot-on-failure.goml');

    print('');
    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    const errors = x.getTotalErrors();
    x.endTestSuite(false);
    return errors;
}

if (require.main === module) {
    const x = new Assert();
    x.blessEnabled = process.argv.findIndex(arg => arg === '--bless') !== -1;
    checkUi(x).then(nbErrors => {
        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkUi,
    };
}
