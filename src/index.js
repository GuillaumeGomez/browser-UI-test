#!/usr/bin/env node

const fs = require('fs');
const { PNG } = require('pngjs');
const parser = require('./parser.js');
const { COLOR_CHECK_ERROR, parseTest } = require('./commands.js');
const { innerParseScreenshot } = require('./commands/general.js');
const {
    print,
    add_warning,
    loadPuppeteer,
    getFileInfo,
    getFileInfoFromPath,
    extractFileNameWithoutExtension,
} = require('./utils.js');
const consts = require('./consts.js');
const { Options } = require('./options.js');
const { Logs } = require('./logs.js');
const { EOL } = require('os');
const process = require('process');
const path = require('path');
const Module = require('module');
const readline = require('readline-sync');

const CODE_WRAPPER = `module.exports.f = async function(pages, arg){
let page = pages[pages.length - 1];
if (page.contentFrame) {
    page = await page.contentFrame();
} else {
    page = page.mainFrame();
}`;

// TODO: Make it into a class to provide some utility methods like 'isFailure'.
const Status = {
    'Ok': 0,
    'Failure': 1,
    'MissingElementForScreenshot': 2,
    'ScreenshotComparisonFailed': 3,
    'ScreenshotNotFound': 4,
    'ExecutionError': 5,
};

class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigError';
    }
}

function loadContent(content) {
    const m = new Module();
    m.paths = [__dirname];
    m._compile(`${CODE_WRAPPER}
${content}
};`, __dirname);
    return m.exports.f;
}

function comparePixels(img1, img2, logs, currentFile) {
    const a = PNG.sync.read(fs.readFileSync(img1));
    const b = PNG.sync.read(fs.readFileSync(img2));

    if (a.height !== b.height || a.width !== b.width) {
        return false;
    }

    const aData = a.data;
    const bData = b.data;

    for (let i = 0; i < aData.length; i += 4) {
        // We don't compare the alpha channel (which comes after the blue).
        if (aData[i] !== bData[i] // red
            || aData[i + 1] !== bData[i + 1] // green
            || aData[i + 2] !== bData[i + 2] /* blue */ ) {
            const x = i % (a.width * 4);
            const y = (i - x) / (a.width * 4);
            logs.debug(currentFile, `comparePixels FAILED at position (${x}, ${y}), colors: ` +
                `[${aData[i]}, ${aData[i + 1]}, ${aData[i + 2]}] VS ` +
                `[${bData[i]}, ${bData[i + 1]}, ${bData[i + 2]}]`);
            return false;
        }
    }
    return true;
}

function save_failure(folderIn, failuresFolder, newImage) {
    if (fs.existsSync(failuresFolder) === false) {
        // We cannot save the failures...
        return false;
    }
    try {
        fs.renameSync(path.join(folderIn, newImage), path.join(failuresFolder, newImage));
    } catch (err) {
        add_warning(`Error while trying to move files: "${err.message}"`);
        // failed to move files...
        return false;
    }
    return true;
}

function getGlobalStyle(showText) {
    const css = [
        {'content': 'html {font-family: Arial,Helvetica Neue,Helvetica,sans-serif;}'},
    ];
    if (showText === false) {
        css.push({
            'content': consts.CSS_TEXT_HIDE,
            'id': consts.STYLE_HIDE_TEXT_ID,
        });
    }
    return css;
}

function createFolderIfNeeded(path) {
    if (path !== '' && fs.existsSync(path) === false) {
        try {
            fs.mkdirSync(path, { 'recursive': true });
        } catch (err) {
            print(`Cannot create folder \`${path}\`: ${err.message}`);
            return false;
        }
    }
    return true;
}

function checkFolders(options) {
    if (createFolderIfNeeded(options.getFailureFolder()) === false) {
        return false;
    }
    return createFolderIfNeeded(options.getImageFolder());
}

// Returns `false` if it failed.
async function screenshot(extras, filename, selector, pages, logs) {
    const data = innerParseScreenshot(extras, filename, selector);
    let screenshot_error = null;
    for (const instruction of data.instructions) {
        let loadedInstruction;
        try {
            loadedInstruction = loadContent(instruction);
        } catch (error) { // parsing error
            screenshot_error = error;
            break;
        }
        try {
            await loadedInstruction(pages, extras);
        } catch (err) { // execution error
            screenshot_error = err;
            break;
        }
    }

    const fileInfo = {'file': filename};
    if (screenshot_error !== null) {
        logs.failure(fileInfo, `Cannot take screenshot: element \
\`${extras.screenshotComparison}\` not found: ${screenshot_error}`);
        return false;
    }
    logs.info(fileInfo, data['infos']);
    return true;
}

function waitUntilEnterPressed(logs) {
    const last = logs.lastError();
    print('An error occurred: `' + last.message + '`');
    readline.question('Press ENTER to continue...');
}

async function runInstruction(loadedInstruction, pages, extras) {
    try {
        await loadedInstruction(pages, extras);
        return;
    } catch (err) { // execution error
        if (err.message && err.message.indexOf
            && err.message.indexOf('Execution context was destroyed') === 0) {
            // Puppeteer error so this time we wait until the document is ready before trying
            // again.
            await pages[0].waitForFunction('document.readyState === "complete"');
        } else {
            // Not a context error because of navigation, throwing it again.
            throw err;
        }
    }
    // We give it another chance...
    await loadedInstruction(pages, extras);
}

async function runAllCommands(loaded, logs, options, browser) {
    const context_parser = loaded['parser'];
    const currentFile = getFileInfo(context_parser);
    logs.startTest(loaded['file']);

    let notOk = false;
    let returnValue = Status.Ok;

    let page;
    try {
        page = await browser.newPage(options, currentFile, logs);
    } catch (e) {
        // try again after waiting a bit first to avoid "Session with given id not found" error...
        await new Promise(r => setTimeout(r, 100));
        page = await browser.newPage(options, currentFile, logs);
    }
    await browser.emulate(options, currentFile, page, logs);
    await browser.emulateMediaFeatures(options, currentFile, page, logs);
    try {
        const extras = {
            'screenshotComparison': options.screenshotComparison === true,
            'expectedToFail': false,
            'showText': options.showText,
            'puppeteer': browser.puppeteer,
            'browser': browser,
            'permissions': options.permissions,
            'logs': logs,
            // If the `--no-headless` option is set, we enable it by default.
            'pauseOnError': options.shouldPauseOnError(),
            'screenshotOnFailure': options.screenshotOnFailure,
            'getImageFolder': () => options.getImageFolder(),
            'failOnJsError': options.failOnJsError,
            'failOnRequestError': options.failOnRequestError,
            'jsErrors': [],
            'requestErrors': [],
            'variables': options.variables,
            'setVariable': (varName, value) => {
                if (typeof value === 'string') {
                    value = JSON.stringify(value).slice(1, -1);
                }
                extras.variables.set(varName, value);
            },
        };
        page.on('pageerror', message => {
            extras.jsErrors.push(message);
        });
        page.on('requestfailed', request => {
            if (request.failure().errorText.toLowerCase() === 'net::err_aborted') {
                // We ignore the requests that were aborted.
                return;
            }
            extras.requestErrors.push(
                `[${request.method()} ${request.url()}]: ${request.failure().errorText}`);
        });

        await page.exposeFunction('BrowserUiStyleInserter', () => {
            return getGlobalStyle(extras.showText);
        });
        await page.evaluateOnNewDocument(() => {
            window.addEventListener('DOMContentLoaded', async() => {
                window.browserUiCreateNewStyleElement = function(css, id) {
                    if (id !== undefined) {
                        const el = document.getElementById(id);
                        if (el) {
                            el.remove();
                        }
                    }
                    if (typeof css === 'undefined' || css.length === undefined) {
                        return;
                    }
                    const style = document.createElement('style');
                    style.type = 'text/css';
                    style.innerHTML = css;
                    style.id = id;
                    document.getElementsByTagName('head')[0].appendChild(style);
                };
                (await window.BrowserUiStyleInserter()).forEach(e => {
                    window.browserUiCreateNewStyleElement(e['content'], e['id']);
                });
            });
        });
        await options.onPageCreatedCallback(page, loaded['file']);
        // eslint-disable-next-line no-undef
        const script = fs.readFileSync(path.join(__dirname, 'helpers.js'), 'utf8');
        logs.debug(currentFile, `Injecting helpers script into page: "${script}"`);
        await page.evaluateOnNewDocument(script);
        const pages = [page];

        let line_number;

        // Defined here because we need `logs` to be updated without being returned.
        // `checkPageErrors` shouldn't be called directly.
        const checkPageErrors = (option, field, message) => {
            if (!extras[option] || extras[field].length === 0) {
                return false;
            }
            logs.error(getFileInfo(context_parser, line_number, false), `${message}: ` +
                extras[field].join(EOL));
            // We empty the errors to prevent having it duplicated.
            extras[field].splice(0, extras[field].length);
            return true;
        };
        const checkJsErrors = () => {
            return checkPageErrors('failOnJsError', 'jsErrors', 'JS errors occurred');
        };
        const checkRequestErrors = () => {
            return checkPageErrors('failOnRequestError', 'requestErrors', 'request failed');
        };

        let current_url = '';

        command_loop:
        for (let nb_commands = 0;; ++nb_commands) {
            const command = context_parser.get_next_command(pages);
            if (command === null) {
                if (nb_commands === 0) {
                    logs.failure(getFileInfo(context_parser), 'No command to execute');
                    return Status.Failure;
                }
                break;
            }
            // `line_number` is declared outside of the loop because it's used in the closures
            // above.
            line_number = command['line'];
            const fileInfo = getFileInfo(context_parser, line_number);
            if (command['warnings'] !== undefined) {
                for (const warning of command['warnings']) {
                    logs.warn(fileInfo, warning);
                }
            }
            // FIXME: This is ugly to have both 'error' and 'errors'. Clean that up!
            if (command['error'] !== undefined) {
                logs.error(fileInfo, command['error']);
                break;
            } else if (command['errors'] !== undefined && command['errors'].length > 0) {
                for (const error of command['errors']) {
                    logs.error(
                        getFileInfo(context_parser, error['line']),
                        error['message'],
                    );
                }
                break;
            }
            let failed = false;
            // In case we have some unrecoverable error which cannot be caught in
            // `expect-failure: true`, like color check when text isn't displayed.
            //
            // (It is needed because we cannot break from inside the `await.catch`.)
            let stopLoop = false;
            const instructions = command['instructions'];
            let stopInnerLoop = false;

            for (const instruction of instructions) {
                logs.debug(fileInfo, `EXECUTING (line ${line_number.line}) "${instruction}"`);
                let loadedInstruction;
                try {
                    loadedInstruction = loadContent(instruction);
                } catch (error) { // parsing error
                    logs.error(fileInfo, `output:${EOL}}${error.message}`);
                    logs.debug(
                        fileInfo,
                        `command \`${command['original']}\` failed on \`${instruction}\``,
                    );
                    break command_loop;
                }
                try {
                    await runInstruction(loadedInstruction, pages, extras);
                } catch (err) { // execution error
                    if (err === COLOR_CHECK_ERROR) {
                        logs.error(fileInfo, err);
                        stopLoop = true;
                    } else {
                        failed = true;
                        const s_err = err.toString();
                        if (extras.expectedToFail !== true) {
                            const original = command['original'];
                            logs.error(fileInfo, `${s_err}: for command \`${original}\``);
                            stopInnerLoop = true;
                            if (extras.screenshotOnFailure) {
                                stopLoop = true;
                            }
                        } else {
                            // it's an expected failure so no need to log it
                            logs.debug(fileInfo, `[EXPECTED FAILURE] ${s_err}`);
                        }
                    }
                }
                logs.debug(fileInfo, 'Done!');
                if (stopLoop || checkJsErrors() || checkRequestErrors()) {
                    break command_loop;
                } else if (stopInnerLoop) {
                    break;
                }
            }
            if (failed === false && command['callback']) {
                await command['callback']();
            }
            if (command['afterCallback']) {
                await command['afterCallback'](pages[pages.length - 1]);
            }
            if (failed === false
                && command['checkResult'] === true
                && extras.expectedToFail === true
            ) {
                logs.error(
                    fileInfo,
                    `command \`${command['original']}\` was supposed to fail but succeeded`,
                );
            }
            let shouldWait = false;
            if (failed === true && extras.expectedToFail === false) {
                if (command['fatal_error'] === true || extras.pauseOnError === true) {
                    break;
                }
            } else if (command['wait'] !== false) {
                shouldWait = true;
            }
            if (command['infos'] !== undefined) {
                logs.info(fileInfo, command['infos']);
            }
            if (shouldWait) {
                // We wait a bit between each command to be sure the browser can follow.
                await new Promise(r => setTimeout(r, 50));
            }
            // If the URL changed, we wait for the document to be fully loaded before running other
            // commands.
            const url = page.url();
            if (url !== current_url) {
                current_url = url;
                await page.waitForFunction('document.readyState === "complete"');
            }
            if (checkJsErrors() || checkRequestErrors()) {
                break command_loop;
            }
        }
        if (logs.lastError() !== null || checkJsErrors() || checkRequestErrors()) {
            logs.failure(currentFile, '');
            if (extras.pauseOnError === true) {
                waitUntilEnterPressed(logs);
            }
            if (extras.screenshotOnFailure === true) {
                await screenshot(
                    extras, `${loaded['file']}-failure`, null, pages, logs);
            }
            await page.close();
            return Status.Failure;
        }

        let selector = null;
        if (extras.screenshotComparison !== true) {
            if (extras.screenshotComparison === false) {
                logs.success(currentFile, 'OK');
                logs.debug(currentFile, '=> [NO SCREENSHOT COMPARISON]');
                await page.close();
                return Status.Ok;
            }
            selector = parser.getSelector(extras.screenshotComparison);
            if (selector.error !== undefined) {
                logs.failure(currentFile, `Cannot take screenshot: ${selector.error.join(EOL)}`);
                await page.close();
                return Status.MissingElementForScreenshot;
            }
        }

        if (!await screenshot(
            extras, `${loaded['file']}-${options.runId}`, selector, pages, logs)
        ) {
            await page.close();
            return Status.MissingElementForScreenshot;
        }

        const compare_s = options.generateImages === false ? 'COMPARISON' : 'GENERATION';
        logs.debug(currentFile, `=> [SCREENSHOT ${compare_s}]`);
        const p = path.join(options.getImageFolder(), loaded['file']);
        const newImage = `${p}-${options.runId}.png`;
        const originalImage = `${p}.png`;

        if (fs.existsSync(originalImage) === false) {
            if (options.generateImages === false) {
                logs.failure(
                    currentFile,
                    '"' + originalImage + '" not found, use "--generate-images" ' +
                    'if you want to generate it',
                );
                notOk = true;
                returnValue = Status.ScreenshotNotFound;
            } else {
                fs.renameSync(newImage, originalImage);
                logs.info(currentFile, 'generated');
                notOk = true; // To avoid displaying 'ok' at the end.
            }
        } else if (comparePixels(newImage, originalImage, logs, currentFile) === false) {
            const saved = save_failure(options.getImageFolder(), options.getFailureFolder(),
                loaded['file'] + `-${options.runId}.png`);
            returnValue = Status.ScreenshotComparisonFailed;
            if (saved === true) {
                const failedPath = path.join(
                    options.getFailureFolder(), `${loaded['file']}-${options.runId}.png`);
                logs.failure(
                    currentFile,
                    `images "${failedPath}" and "${originalImage}" are different`,
                );
            } else {
                logs.failure(
                    currentFile,
                    `images "${newImage}" and "${originalImage}" are different`,
                );
            }
            notOk = true;
        } else {
            // If everything worked as expected, we can remove the generated image.
            fs.unlinkSync(newImage);
        }
    } catch (err) {
        logs.failure(currentFile, '');
        let msg = `${loaded['file']} output:${EOL}${err.message}${EOL}`;
        if (err.stack !== undefined) {
            msg += `stack: ${err.stack}${EOL}`;
        }
        logs.error(currentFile, msg);
        notOk = true;
        returnValue = Status.ExecutionError;
    }
    await page.close();
    if (notOk === false) {
        logs.success(currentFile, 'OK');
    }
    return returnValue;
}

function filterTests(options, allFiles) {
    if (options.filter === null) {
        return 0;
    }

    let filteredOut = 0;
    for (let i = allFiles.length - 1; i >= 0; --i) {
        if (!path.basename(allFiles[i]).includes(options.filter)) {
            allFiles.splice(i, 1);
            filteredOut += 1;
        }
    }
    return filteredOut;
}

async function innerRunTests(logs, options, browser) {
    let successes = 0;
    let total = 0;
    const allFiles = [];

    if (options.testFolder.length > 0) {
        if (!fs.existsSync(options.testFolder) || !fs.lstatSync(options.testFolder).isDirectory()) {
            throw new ConfigError(`Folder \`${options.testFolder}\` not found`);
        }
        fs.readdirSync(options.testFolder).forEach(file => {
            const fullPath = path.join(options.testFolder, file);
            if (file.endsWith('.goml') && fs.lstatSync(fullPath).isFile()) {
                allFiles.push(path.resolve(fullPath));
            }
        });
    }
    for (const testFile of options.testFiles) {
        if (fs.existsSync(testFile) && fs.lstatSync(testFile).isFile()) {
            const fullPath = path.resolve(testFile);
            if (allFiles.indexOf(fullPath) === -1) {
                allFiles.push(fullPath);
            }
        } else {
            throw new ConfigError(
                `File \`${testFile}\` not found (passed with \`--test-files\` option)`);
        }
    }
    const filteredOut = filterTests(options, allFiles);

    if (allFiles.length === 0) {
        throw new ConfigError(
            'No files found. Check your `--test-folder` and `--test-files` options');
    }

    if (options.testFolder.length === 0
        && options.getFailureFolder() === ''
        && options.getImageFolder() === ''
    ) {
        print('[WARNING] No failure or image folder set, taking first test file\'s folder');
        options.testFolder = path.dirname(options.testFiles[0]);
    }
    if (checkFolders(options) === false) {
        return 1;
    }

    // A little sort on tests' name.
    allFiles.sort((a, b) => {
        a = path.basename(a);
        b = path.basename(b);
        if (a > b) {
            return 1;
        } else if (a < b) {
            return -1;
        }
        return 0;
    });

    logs.setNbTests(allFiles.length);

    process.setMaxListeners(options.nbThreads + 1);
    try {
        const needCloseBrowser = browser === null;
        if (browser === null) {
            browser = await loadPuppeteer(options);
        }
        const testsQueue = [];

        for (const file of allFiles) {
            total += 1;
            const testName = extractFileNameWithoutExtension(file);
            const optionsCopy = options.clone();

            // To make the Options type validation happy.
            optionsCopy.testFiles.push(file);
            optionsCopy.validate();

            const callback = innerRunTestCode(
                testName,
                file,
                optionsCopy,
                browser,
                false,
                false,
                { logs: logs.shallowClone() },
            ).then(out => {
                const [output, nbFailures] = out;
                logs.appendLogs(output);
                if (nbFailures === 0) {
                    successes += 1;
                }
            }).catch(err => {
                logs.error(getFileInfoFromPath(testName), err);
            }).finally(() => {
                // We now remove the promise from the testsQueue.
                testsQueue.splice(testsQueue.indexOf(callback), 1);
            });
            testsQueue.push(callback);
            if (testsQueue.length >= options.nbThreads) {
                await Promise.race(testsQueue);
            }
        }
        if (testsQueue.length > 0) {
            await Promise.all(testsQueue);
        }

        if (needCloseBrowser) {
            await browser.close();
        }

        let extra = '';
        if (!options.isJsonOutput()) {
            extra = EOL;
        }
        logs.conclude(
            `${extra}<= doc-ui tests done: ${successes} succeeded, ${total - successes} \
failed, ${filteredOut} filtered out${extra}`);
    } catch (error) {
        logs.conclude(`An exception occured: ${error.message}${EOL}== STACKTRACE ==${EOL}` +
            `${new Error().stack}${EOL}`);
        return 1;
    }

    return total - successes;
}

async function innerRunTestCode(
    testName,
    testPath,
    options,
    browser,
    showLogs,
    checkTestFolder,
    {
        content = null,
        logs = null,
    } = {},
) {
    if (logs === null) {
        logs = new Logs(showLogs, options);
    }

    if (checkTestFolder === true && options.testFolder.length > 0) {
        logs.warn({}, '`--test-folder` option will be ignored.');
    }

    try {
        const loaded = parseTest(testName, testPath, logs, options, content);
        if (loaded === null) {
            return [logs, 1];
        } else if (loaded.parser.get_parser_errors().length !== 0) {
            logs.startTest(testName);
            for (const error of loaded.parser.get_parser_errors()) {
                logs.error(
                    getFileInfo(loaded.parser, error.line),
                    error.message,
                );
            }
            logs.failure(getFileInfo(loaded.parser), '');
            return [logs, 1];
        }

        const needCloseBrowser = browser === null;
        if (browser === null) {
            browser = await loadPuppeteer(options);
        }
        const ret = await runAllCommands(loaded, logs, options, browser);

        if (needCloseBrowser) {
            await browser.close();
        }

        if (ret !== Status.Ok) {
            return [logs, 1];
        }
    } catch (error) {
        logs.error(
            {'file': testName},
            `An exception occured: ${error.message}${EOL}== STACKTRACE ==${EOL}${error.stack}`,
        );
        return [logs, 1];
    }

    return [logs, 0];
}

function checkExtras(extras) {
    if (extras === undefined || extras === null) {
        extras = Object.create(null);
    }
    let browser = null;
    if (extras['browser'] !== undefined) {
        browser = extras['browser'];
    }
    let options;
    if (extras['options'] === undefined || extras['options'] === null) {
        options = new Options();
    } else {
        options = extras['options'];
    }
    const showLogs = extras['showLogs'] !== undefined ? extras['showLogs'] : false;

    if (options.validate === undefined) {
        throw new ConfigError('`extras["options"]` must be an "Options" type!');
    } else if (browser !== null && (typeof browser !== 'object' || browser.newPage === undefined)) {
        throw new ConfigError('`extras["browser"]` must be created using `loadBrowser`!');
    } else if (typeof showLogs !== 'boolean') {
        throw new ConfigError('`extras["showLogs"]` must be a boolean!');
    }
    // "light" validation of the Options type.
    options.validateFields();

    return [browser, options, showLogs, extras];
}

// `extras` values are as follows:
//  * `options`: If not set, it'll be created with `new Options()`.
//  * `browser`: `null` by default, expected to be created from `loadBrowser` otherwise.
//  * `showLogs`: If not set, it'll be set to `false`.
async function runTestCode(testName, content, extras = null) {
    // content, browser = null, options = new Options(), showLogs = false
    if (typeof testName !== 'string') {
        const e = typeof testName;
        throw new ConfigError(
            `expected \`runTestCode\` first argument to be a string, found \`${e}\``);
    } else if (typeof content !== 'string') {
        const e = typeof content;
        throw new ConfigError(
            `expected \`runTestCode\` second argument to be a string, found \`${e}\``);
    } else if (testName.length === 0) {
        throw new ConfigError(
            '`runTestCode` first argument cannot be empty');
    }

    const [browser, options, showLogs] = checkExtras(extras);

    const [logs, exit_code] = await innerRunTestCode(
        testName, null, options, browser, showLogs, true, { content });
    return [logs.getLogsInExpectedFormat(), exit_code];
}

// `extras` values are as follows:
//  * `options`: If not set, it'll be created with `new Options()`.
//  * `browser`: `null` by default, expected to be created from `loadBrowser` otherwise.
//  * `showLogs`: If not set, it'll be set to `false`.
async function runTest(testPath, extras = null) {
    if (typeof testPath !== 'string' || typeof testPath === 'undefined') {
        throw new ConfigError('expected `runTest` first argument to be a string');
    } else if (!fs.existsSync(testPath) || !fs.lstatSync(testPath).isFile()) {
        throw new ConfigError(`No file found with path \`${testPath}\``);
    } else if (!testPath.endsWith('.goml')) {
        throw new ConfigError(`Expected a \`.goml\` script, found ${path.basename(testPath)}`);
    }

    const [browser, options, showLogs] = checkExtras(extras);

    // We need to clone the `options` variable to prevent modifying it in the caller!
    const optionsCopy = options.clone();

    // To make the Options type validation happy.
    optionsCopy.testFiles.push(testPath);
    optionsCopy.validate();

    const checkTestFolder = optionsCopy.testFolder.length !== 0;
    if (checkTestFolder === false) {
        optionsCopy.testFolder = path.dirname(testPath);
    }

    if (checkFolders(optionsCopy) === false) {
        return [options.isJsonOutput() ? [] : '', 1];
    }

    const [logs, exit_code] = await innerRunTestCode(
        extractFileNameWithoutExtension(testPath),
        testPath,
        optionsCopy,
        browser,
        showLogs,
        checkTestFolder,
    );
    return [logs.getLogsInExpectedFormat(), exit_code];
}

// `extras` values are as follows:
//  * `options`: If not set, it'll be created with `new Options()`.
//  * `browser`: `null` by default, expected to be created from `loadBrowser` otherwise.
//  * `showLogs`: If not set, it'll be set to `false`.
async function runTests(extras = null) {
    const [browser, options, showLogs, newExtras] = checkExtras(extras);
    options.validate();

    const logs = new Logs(showLogs, options);
    const s = options.nbThreads > 1 ? 's' : '';
    const extra =
        newExtras['showNbThreads'] !== false ? ` (on ${options.nbThreads} thread${s})` : '';

    logs.display(`=> Starting doc-ui tests${extra}...`);

    try {
        const exit_code = await innerRunTests(logs, options, browser);
        return [logs.getLogsInExpectedFormat(), exit_code];
    } catch (error) {
        if (error instanceof ConfigError) {
            logs.clear();
            logs.display(error.message);
        } else {
            logs.conclude(
                `An exception occured: ${error.message}${EOL}== STACKTRACE ==${EOL}` +
                `${new Error().stack}${EOL}`);
        }
        return [logs.getLogsInExpectedFormat(), 1];
    }
}

process.on('browser-ui-test-puppeter-failure', () => {
    console.error('ERROR: puppeteer failed when trying to create a new page.');
    process.exit(1);
});

if (require.main === module) {
    process.on('uncaughtException', function(err) {
        print(err.message);
        print(err.stack);
        process.exit(1);
    });
    const options = new Options();
    try {
        if (options.parseArguments(process.argv.slice(2)) === false) {
            process.exit(0);
        }
    } catch (err) {
        print(err.message);
        if (options.debug === true) {
            print(err.stack);
        }
        process.exit(1);
    }
    loadPuppeteer(options).then(browser => {
        runTests({'options': options, 'browser': browser, 'showLogs': true}).then(x => {
            const [_output, nb_failures] = x;
            process.exit(nb_failures);
        }).catch(err => {
            print(err.message);
            if (options.debug === true) {
                print(err.stack);
            }
            process.exit(1);
        });
    }).catch(err => {
        print(err);
        if (options.debug === true) {
            print(err.stack);
        }
        process.exit(1);
    });
} else {
    module.exports = {
        'runTest': runTest,
        'runTestCode': runTestCode,
        'runTests': runTests,
        'Options': Options,
        'loadBrowser': loadPuppeteer,
    };
    if (process.env.debug_tests === '1') {
        module.exports['CODE_WRAPPER'] = CODE_WRAPPER;
    }
}
