const fs = require('fs');
const path = require('path');
const os = require('os');
const process = require('process');

const utils = require('../src/utils.js');
utils.print = function print() {}; // overwriting the print function to avoid the print

const {runTests, Options} = require('../src/index.js');
const {Assert, print} = require('./utils.js');

async function wrapRunTests(options) {
    options.screenshotComparison = false;
    const ret = await runTests({
        'options': options,
        'showLogs': false,
        'showNbThreads': false,
    });
    return ret[0];
}

function runAsyncUiTest(x, file, output, tests_queue) {
    const args = [
        '--variable', 'DOC_PATH', 'tests/html_files',
        '--variable', 'WINDOWS_PATH', 'C:\\a\\b',
        '--message-format', 'json',
        '--test-file', file,
    ];
    if (x.extraArgs.indexOf('--no-headless') !== -1) {
        args.push('--no-headless');
    }

    const options = new Options();
    options.parseArguments(args);

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
    if (x.extraArgs.indexOf('--no-headless') !== -1) {
        cpuCount = 1;
    }
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
        } else if (x.getTotalErrors() !== 0) {
            print(`\`failed-test-name\` failed, full output:\n${output}`);
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

// It's very important that files are correctly rendered so this test ensures that the backtrace is
// actually correct.
async function checkBacktrace(x) {
    const options = getOptionsWithFilter('failure-from-include-2.goml');
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
        // We skip the two first lines.
        const lines = output.split('\n');
        const expected = [
            ['', '4'],
            ['tests/ui/auxiliary/utils2.goml', '7'],
            ['tests/ui/auxiliary/utils.goml', '6'],
        ];
        let pos = 0;
        let i = 0;
        while (i < lines.length) {
            if (lines[i].startsWith('[ERROR]')) {
                break;
            }
            ++i;
        }
        if (lines[i].startsWith('[ERROR]')) {
            // The first line doesn't display the file name since it's supposed to be the same.
            lines[i++].split('[ERROR] line ')[1] = expected[pos++][1];
        } else {
            x.addError(`Missing line with just the line error, output:\n${output}`);
            return;
        }
        for (; i < lines.length; ++i) {
            const line = lines[i];
            if (line.includes(' line ')) {
                if (pos >= expected.length) {
                    x.addError(`Found an expected error: \`${line}\``);
                    continue;
                }
                const file = line.split(' at `')[1].split('`')[0];
                let nb = line.split(' line ')[1];
                if (nb.includes(':')) {
                    nb = nb.split(':')[0];
                }

                if (file !== expected[pos][0] || nb !== expected[pos][1]) {
                    x.addError(`Expected "at \`${expected[pos][0]}\` line ${expected[pos][1]}", \
found "at \`${file}\` line ${nb}"`);
                }
                pos += 1;
            } else if (line.trim().includes(' at <')) {
                // reached the URL, can stop here.
                break;
            }
        }
        if (pos < expected.length) {
            x.addError(`Some expected errors were not found, output:\n${output}`);
        }
        if (x.getTotalErrors() === 0) {
            x.addSuccess();
        } else {
            print(`test failed, output:\n${output}`);
        }
    }
}

async function runIfMatches(x, testName, callback) {
    if (matchesFilter(x, testName)) {
        await x.startTestSuite(testName, true, async() => {
            await callback(x);
        });
    } else {
        print(`\`${testName}\` test filtered out`);
    }
}

async function checkUi(x) {
    return await x.startTestSuite('ui items', false, async() => {
        await x.startTestSuite('ui-test', true, async(_level, _suiteName) => {
            await compareOutput(x);
        });

        checkImageFileForTest(x, 'tests/ui/tadam.png', 'screenshot-info.goml');
        checkImageFileForTest(
            x, 'tests/ui/screenshot-on-failure-failure.png', 'screenshot-on-failure.goml');

        await runIfMatches(x, 'compact-display-format', checkCompactDisplayFormat);
        await runIfMatches(x, 'failed-test-name', checkFailedTestName);
        await runIfMatches(x, 'backtrace', checkBacktrace);
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
    if (process.env.npm_config_headless === '') {
        x.extraArgs.push('--no-headless');
    }
    checkUi(x).then(({totalErrors}) => {
        process.exit(totalErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkUi,
    };
}
