const fs = require('fs');
const path = require('path');
const process = require('process');

const utils = require('../../src/utils.js');
utils.print = function print() {}; // overwriting the print function to avoid the print

const {runTests, Options} = require('../../src/index.js');
const {Assert, plural, print} = require('./utils.js');

async function wrapRunTests(options = new Options()) {
    options.noScreenshotComparison = true;
    return await runTests(options, false);
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
    for (let i = 0; i < filesToTest.length; ++i) {
        const file = filesToTest[i];
        const outputFile = file.replace('.goml', '.output');
        let output;

        try {
            output = fs.readFileSync(outputFile, 'utf8');
        } catch (_) {
            x.addError(`Cannot open file \`${outputFile}\``);
            continue;
        }

        const options = new Options();
        options.parseArguments(['--variable', 'DOC_PATH', 'tests/html_files',
            '--test-files', file]);

        await x.assertTry(
            wrapRunTests,
            [options],
            [output.replaceAll('$CURRENT_DIR', utils.getCurrentDir()), 1],
            file,
        );
    }
}

async function checkUi(x = new Assert()) {
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

    print('');
    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    const errors = x.getTotalErrors();
    x.endTestSuite(false);
    return errors;
}

if (require.main === module) {
    checkUi().then(nbErrors => {
        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkUi,
    };
}
