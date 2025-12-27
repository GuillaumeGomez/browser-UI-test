const fs = require('fs');
const path = require('path');
const os = require('os');
const process = require('process');

const utils = require('../src/utils.js');
utils.print = function print() {}; // overwriting the print function to avoid the print

const {runTests, Options} = require('../src/index.js');
const {Assert, plural, print} = require('./utils.js');

async function wrapRunTests(browser, options = new Options()) {
    options.screenshotComparison = false;
    const ret = await runTests({
        'options': options,
        'browser': browser,
        'showLogs': false,
        'showNbThreads': false,
    });
    return ret[0];
}

function runAsyncUiTest(x, file, output, tests_queue, browser) {
    const options = new Options();
    options.parseArguments([
        '--variable', 'DOC_PATH', 'tests/html_files',
        '--variable', 'WINDOWS_PATH', 'C:\\a\\b',
        '--message-format', 'json',
        '--test-file', file,
    ]);
    let testOutput = '';

    const callback = x.assertTryUi(
        wrapRunTests,
        [browser, options],
        output.replaceAll('$CURRENT_DIR', utils.getCurrentDir()),
        file,
        false,
        s => testOutput += s + '\n',
        (value1, _) => {
            const filePath = file.replace('.goml', '.output');
            fs.writeFileSync(
                filePath,
                value1.replaceAll(`file://${utils.getCurrentDir()}`, 'file://$CURRENT_DIR')
                    .replaceAll(`\`${utils.getCurrentDir()}`, '`$CURRENT_DIR'),
            );
            print(`Blessed \`${filePath}\``);
        },
    );
    callback._currentTest = file;
    callback.finally(() => {
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
    const testFolder = 'tests/ui';
    fs.readdirSync(testFolder).forEach(file => {
        const curPath = path.join(testFolder, file);
        if (fs.lstatSync(curPath).isDirectory() || !curPath.endsWith('.goml')) {
            return;
        }
        if (!matchesFilter(x, file)) {
            // We filter out arguments since we only want to run a few of them...
            return;
        }
        filesToTest.push(curPath.toString());
    });
    if (filesToTest.length === 0) {
        print('All UI tests filtered out, moving to next tests');
        return;
    }

    let cpuCount = os.cpus().length / 2 + 1;
    if (cpuCount < 1) {
        cpuCount = 1;
    }
    process.setMaxListeners(cpuCount);
    const tests_queue = [];
    const options = new Options();
    const browser = await utils.loadPuppeteer(options);

    for (const file of filesToTest) {
        const outputFile = file.replace('.goml', '.output');
        let output;

        try {
            output = fs.readFileSync(outputFile, 'utf8');
        } catch (_) {
            output = `Cannot open file \`${outputFile}\``;
        }

        runAsyncUiTest(x, file, output, tests_queue, browser);
        if (tests_queue.length >= cpuCount) {
            await Promise.race(tests_queue);
        }
    }
    while (tests_queue.length > 0) {
        await Promise.race([...tests_queue, new Promise((resolve, reject) => {
            // Reject after 20 seconds
            setTimeout(() => {
                const runningTests = tests_queue.map(x => x._currentTest);
                const err = new Error('The following tests take too long to run: ' + runningTests);
                reject(err);
            }, 20_000);
        })]);
    }
    await browser.close();
}

function matchesFilter(x, filter) {
    return x.extraArgs.length === 0 ||
        x.extraArgs.findIndex(arg => filter.indexOf(arg) !== -1) !== -1;
}

function checkImageFileForTest(x, screenshotFile, testName) {
    if (!matchesFilter(x, testName)) {
        // This test was not run so nothing to do in here...
        return;
    }
    if (fs.existsSync(screenshotFile) === false) {
        x.addError(`\`${testName}\` should have generated a \`${screenshotFile}\` file!`);
    } else {
        fs.unlinkSync(screenshotFile);
    }
}

function getOptionsWithFilter(filter) {
    const options = new Options();
    options.parseArguments([
        '--test-folder', 'tests/ui/',
        '--variable', 'DOC_PATH', 'tests/html_files',
        '--display-format', 'compact',
        '--filter', filter,
    ]);
    options.screenshotComparison = false;
    return options;
}

async function checkFailedTestName(x) {
    // We ensure that only `failure-from-include` files are listed as failing tests.
    const options = getOptionsWithFilter('failure-from-include');
    const browser = await utils.loadPuppeteer(options);

    // We replace stdout and stderr.
    let output = '';
    function write(arg) {
        output += arg;
    }
    const oldStdout = process.stdout.write;
    process.stdout.write = write;
    const oldStderr = process.stderr.write;
    process.stderr.write = write;

    let err = null;
    try {
        await runTests({
            'options': options,
            'browser': browser,
            'showLogs': true,
            'showNbThreads': false,
        });
    } catch (exc) {
        err = exc;
    }

    process.stdout.write = oldStdout;
    process.stderr.write = oldStderr;

    if (err !== null) {
        x.addError(`${err}\n\nOutput: ${output}`);
    } else {
        let nbFailures = 0;
        for (const line of output.split('\n')) {
            if (!line.startsWith('======== ')) {
                continue;
            }
            nbFailures += 1;
            const testName = line.split('========')[1].trim();
            if (!testName.endsWith('failure-from-include-2.goml')
                && !testName.endsWith('failure-from-include.goml')
            ) {
                x.addError(`Unexpected test name: \`${testName}\``);
            } else {
                x.addSuccess();
            }
        }
        if (nbFailures < 1) {
            x.addError(`No failed tests found in \`failed-test-name\`, full output:\n${output}`);
        }
    }

    try {
        await browser.close();
    } catch (exc) {
        print(`Failed to close browser: ${exc}`);
    }
}

async function checkCompactDisplayFormat(x) {
    const options = getOptionsWithFilter('assert-c');
    const browser = await utils.loadPuppeteer(options);

    // We replace stdout and stderr.
    let output = '';
    function write(arg) {
        output += arg;
    }
    const oldStdout = process.stdout.write;
    process.stdout.write = write;
    const oldStderr = process.stderr.write;
    process.stderr.write = write;

    let err = null;
    try {
        await runTests({
            'options': options,
            'browser': browser,
            'showLogs': true,
            'showNbThreads': false,
        });
    } catch (exc) {
        err = exc;
    }

    process.stdout.write = oldStdout;
    process.stderr.write = oldStderr;

    if (err !== null) {
        x.addError(`${err}\n\nOutput: ${output}`);
    } else {
        x.assertOrBlessIntoFile(
            output.replaceAll(`file://${utils.getCurrentDir()}`, 'file://$CURRENT_DIR'),
            'tests/compact-display/compact-display.output',
        );
    }

    try {
        await browser.close();
    } catch (exc) {
        print(`Failed to close browser: ${exc}`);
    }
}

async function checkUi(x) {
    return await x.startTestSuite('ui items', false, async() => {
        print('=> Starting UI tests...');
        print('');

        await x.startTestSuite('ui-test', true, async(level, suiteName) => {
            try {
                await compareOutput(x);
                print(`<${'='.repeat(level + 1)} "${suiteName}": ${x.getTotalErrors()} ` +
                    `${plural('error', x.getTotalErrors())} (in ${x.getTotalRanTests()} ` +
                    `${plural('test', x.getTotalRanTests())})`);
            } catch (err) {
                print(`<== "ui-test" failed: ${err}\n${err.stack}`);
                return false;
            }
        });

        checkImageFileForTest(x, 'tests/ui/tadam.png', 'screenshot-info.goml');
        checkImageFileForTest(
            x, 'tests/ui/screenshot-on-failure-failure.png', 'screenshot-on-failure.goml');

        if (matchesFilter(x, 'compact-display-format')) {
            await x.startTestSuite('compact display-format', true, async() => {
                await checkCompactDisplayFormat(x);
            });
        } else {
            print('`compact-display-format` test filtered out');
        }
        if (matchesFilter(x, 'failed-test-name')) {
            await x.startTestSuite('failed-test-name', true, async() => {
                await checkFailedTestName(x);
            });
        } else {
            print('`failed-test-name` test filtered out');
        }

        const errors = x.getTotalErrors();
        print('');
        print(`<= Ending ${x.getTotalRanTests()} ui ${plural('test', x.getTotalRanTests())} with ` +
            `${x.getTotalErrors()} ${plural('error', errors)}`);
    });
}

if (require.main === module) {
    const x = new Assert();
    for (const arg of process.argv.slice(2)) {
        if (arg === '--bless') {
            x.blessEnabled = true;
        } else {
            x.extraArgs.push(arg);
        }
    }
    if (!x.blessEnabled) {
        x.blessEnabled = process.env.npm_config_bless === 'true';
    }
    checkUi(x).then(({totalErrors}) => {
        process.exit(totalErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkUi,
    };
}
