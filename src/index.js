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
    extractFileNameWithoutExtension,
} = require('./utils.js');
const { Options } = require('./options.js');
const {Debug, Logs} = require('./logs.js');
const process = require('process');
const path = require('path');
const consts = require('./consts.js');
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

function loadContent(content) {
    const m = new Module();
    m.paths = [__dirname];
    m._compile(`${CODE_WRAPPER}
${content}
};`, __dirname);
    return m.exports.f;
}

function comparePixels(img1, img2, debug_log) {
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
            debug_log.append(`comparePixels FAILED at position (${x}, ${y}), colors: ` +
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
async function screenshot(extras, filename, selector, pages, logs, commandLogs, warnings) {
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

    if (screenshot_error !== null) {
        logs.append(`FAILED (Cannot take screenshot: element \`${extras.screenshotComparison}\` \
not found: ${screenshot_error})`, true);
        logs.appendLogs(commandLogs);
        logs.warn(warnings);
        return false;
    }
    commandLogs.info(data['infos']);
    return true;
}

function waitUntilEnterPressed(error_log) {
    print('An error occurred: `' + error_log + '`');
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
    const commandLogs = new Logs(false);
    logs.append(loaded['file'] + '... ');
    const context_parser = loaded['parser'];

    let notOk = false;
    let returnValue = Status.Ok;
    const debug_log = new Debug(options.debug, logs);
    const warnings = [];

    let page;
    try {
        page = await browser.newPage(options, debug_log);
    } catch (e) {
        // try again after waiting a bit first to avoid "Session with given id not found" error...
        await new Promise(r => setTimeout(r, 100));
        page = await browser.newPage(options, debug_log);
    }
    await browser.emulate(options, page, debug_log);
    try {
        const extras = {
            'screenshotComparison': options.screenshotComparison === true,
            'expectedToFail': false,
            'showText': options.showText,
            'puppeteer': browser.puppeteer,
            'browser': browser,
            'permissions': options.permissions,
            'debug_log': debug_log,
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
                extras.variables[varName] = value;
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
        debug_log.append(`Injecting helpers script into page: "${script}"`);
        await page.evaluateOnNewDocument(script);
        const pages = [page];

        let line_number;

        // Defined here because we need `error_log` to be updated without being returned.
        // `checkPageErrors` shouldn't be called directly.
        const checkPageErrors = (option, field, message) => {
            if (!extras[option] || extras[field].length === 0) {
                return false;
            }
            const info = getFileInfo(context_parser, line_number, false);
            error_log += `[ERROR] ${info}: ${message}: ` + extras[field].join('\n');
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

        let error_log = '';
        let current_url = '';

        command_loop:
        for (let nb_commands = 0;; ++nb_commands) {
            const command = context_parser.get_next_command(pages);
            if (command === null) {
                if (nb_commands === 0) {
                    logs.append('FAILED (No command to execute)', true);
                    logs.appendLogs(commandLogs);
                    return Status.Failure;
                }
                break;
            }
            if (command['warnings'] !== undefined) {
                for (const warning of command['warnings']) {
                    warnings.push(`${getFileInfo(context_parser, command['line'])}: ${warning}`);
                }
            }
            // FIXME: This is ugly to have both 'error' and 'errors'. Clean that up!
            if (command['error'] !== undefined) {
                error_log += `[ERROR] ${getFileInfo(context_parser, command['line'])}: \
${command['error']}`;
                break;
            } else if (command['errors'] !== undefined && command['errors'].length > 0) {
                error_log += command['errors'].map(e => {
                    return `[ERROR] ${getFileInfo(context_parser, e['line'])}: ${e['message']}`;
                }).join('\n');
                break;
            }
            let failed = false;
            // In case we have some unrecoverable error which cannot be caught in
            // `expect-failure: true`, like color check when text isn't displayed.
            //
            // (It is needed because we cannot break from inside the `await.catch`.)
            let stopLoop = false;
            line_number = command['line'];
            const instructions = command['instructions'];
            let stopInnerLoop = false;

            for (const instruction of instructions) {
                debug_log.append(`EXECUTING (line ${line_number}) "${instruction}"`);
                let loadedInstruction;
                try {
                    loadedInstruction = loadContent(instruction);
                } catch (error) { // parsing error
                    error_log += `${getFileInfo(context_parser, line_number)} output:\n\
${error.message}\n`;
                    if (debug_log.isEnabled()) {
                        error_log += `command \`${command['original']}\` failed on ` +
                            `\`${instruction}\`\n`;
                    }
                    break command_loop;
                }
                try {
                    await runInstruction(loadedInstruction, pages, extras);
                } catch (err) { // execution error
                    if (err === COLOR_CHECK_ERROR) {
                        error_log += `[ERROR] ${getFileInfo(context_parser, line_number)}: \
${err}\n`;
                        stopLoop = true;
                    } else {
                        failed = true;
                        const s_err = err.toString();
                        if (extras.expectedToFail !== true) {
                            const original = command['original'];
                            error_log += `[ERROR] ${getFileInfo(context_parser, line_number)}: \
${s_err}: for command \`${original}\`\n`;
                            stopInnerLoop = true;
                            if (extras.screenshotOnFailure) {
                                stopLoop = true;
                            }
                        } else {
                            // it's an expected failure so no need to log it
                            debug_log.append(
                                `[EXPECTED FAILURE] ${getFileInfo(context_parser, line_number)}: \
${s_err}`);
                        }
                    }
                }
                debug_log.append('Done!');
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
                error_log += `${getFileInfo(context_parser, line_number)}: command \
\`${command['original']}\` was supposed to fail but succeeded\n`;
            }
            let shouldWait = false;
            if (failed === true && extras.expectedToFail === false) {
                if (command['fatal_error'] === true || extras.pauseOnError === true) {
                    break;
                }
            } else if (command['wait'] !== false) {
                shouldWait = true;
            }
            commandLogs.info(command['infos']);
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
        if (error_log.length > 0 || checkJsErrors() || checkRequestErrors()) {
            logs.append('FAILED', true);
            logs.appendLogs(commandLogs);
            logs.warn(warnings);
            logs.append(error_log);
            if (extras.pauseOnError === true) {
                waitUntilEnterPressed(error_log);
            }
            if (extras.screenshotOnFailure === true) {
                await screenshot(
                    extras, `${loaded['file']}-failure`, null, pages, logs, commandLogs, warnings);
            }
            await page.close();
            return Status.Failure;
        }

        let selector = null;
        if (extras.screenshotComparison !== true) {
            if (extras.screenshotComparison === false) {
                logs.append('OK', true);
                logs.appendLogs(commandLogs);
                debug_log.append('=> [NO SCREENSHOT COMPARISON]');
                logs.warn(warnings);
                await page.close();
                return Status.Ok;
            }
            selector = parser.getSelector(extras.screenshotComparison);
            if (selector.error !== undefined) {
                logs.append(`FAILED (Cannot take screenshot: ${selector.error.join('\n')})`, true);
                logs.appendLogs(commandLogs);
                logs.warn(warnings);
                await page.close();
                return Status.MissingElementForScreenshot;
            }
        }

        if (!await screenshot(
            extras, `${loaded['file']}-${options.runId}`, selector, pages, logs, commandLogs,
            warnings)
        ) {
            await page.close();
            return Status.MissingElementForScreenshot;
        }

        const compare_s = options.generateImages === false ? 'COMPARISON' : 'GENERATION';
        debug_log.append(`=> [SCREENSHOT ${compare_s}]`);
        const p = path.join(options.getImageFolder(), loaded['file']);
        const newImage = `${p}-${options.runId}.png`;
        const originalImage = `${p}.png`;

        if (fs.existsSync(originalImage) === false) {
            if (options.generateImages === false) {
                logs.append('FAILED ("' + originalImage + '" not found, use "--generate-images" ' +
                    'if you want to generate it)', true);
                notOk = true;
                returnValue = Status.ScreenshotNotFound;
            } else {
                fs.renameSync(newImage, originalImage);
                logs.append('generated', true);
                notOk = true; // To avoid displaying 'ok' at the end.
            }
        } else if (comparePixels(newImage, originalImage, debug_log) === false) {
            const saved = save_failure(options.getImageFolder(), options.getFailureFolder(),
                loaded['file'] + `-${options.runId}.png`);
            returnValue = Status.ScreenshotComparisonFailed;
            if (saved === true) {
                const failedPath = path.join(
                    options.getFailureFolder(), `${loaded['file']}-${options.runId}.png`);
                logs.append(
                    `FAILED (images "${failedPath}" and "${originalImage}" are different)`,
                    true);
            } else {
                logs.append(
                    `FAILED (images "${newImage}" and "${originalImage}" are different)`,
                    true);
            }
            notOk = true;
        } else {
            // If everything worked as expected, we can remove the generated image.
            fs.unlinkSync(newImage);
        }
    } catch (err) {
        logs.append('FAILED', true);
        let msg = loaded['file'] + ' output:\n' + err.message + '\n';
        if (err.stack !== undefined) {
            msg += `stack: ${err.stack}\n`;
        }
        logs.append(msg);
        notOk = true;
        returnValue = Status.ExecutionError;
    }
    await page.close();
    if (notOk === false) {
        logs.append('ok', true);
    }
    logs.appendLogs(commandLogs);
    logs.warn(warnings);
    return returnValue;
}

async function innerRunTests(logs, options, browser) {
    let successes = 0;
    let total = 0;
    const allFiles = [];

    if (options.testFolder.length > 0) {
        if (!fs.existsSync(options.testFolder) || !fs.lstatSync(options.testFolder).isDirectory()) {
            throw new Error(`Folder \`${options.testFolder}\` not found`);
        }
        fs.readdirSync(options.testFolder).forEach(function(file) {
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
            throw new Error(`File \`${testFile}\` not found (passed with \`--test-files\` option)`);
        }
    }

    if (allFiles.length === 0) {
        throw new Error('No files found. Check your `--test-folder` and `--test-files` options');
    }

    if (options.testFolder.length === 0
        && options.getFailureFolder() === ''
        && options.getImageFolder() === ''
    ) {
        print('[WARNING] No failure or image folder set, taking first test file\'s folder');
        options.testFolder = path.dirname(options.testFiles[0]);
    }
    if (checkFolders(options) === false) {
        return ['', 1];
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
            ).then(out => {
                const [output, nbFailures] = out;
                logs.append(output);
                if (nbFailures === 0) {
                    successes += 1;
                }
            }).catch(err => {
                logs.append(err);
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

        logs.append(`\n<= doc-ui tests done: ${successes} succeeded, ${total - successes} failed`);

        if (logs.showLogs === true) {
            logs.append('');
        }
    } catch (error) {
        logs.append(`An exception occured: ${error.message}\n== STACKTRACE ==\n` +
            `${new Error().stack}`);
        return [logs.logs, 1];
    }

    return [logs.logs, total - successes];
}

async function innerRunTestCode(
    testName,
    testPath,
    options,
    browser,
    showLogs,
    checkTestFolder,
    content = null,
) {
    const logs = new Logs(showLogs);

    if (checkTestFolder === true && options.testFolder.length > 0) {
        logs.append('[WARNING] `--test-folder` option will be ignored.\n');
    }

    try {
        const loaded = parseTest(testName, testPath, logs, options, content);
        if (loaded === null) {
            return [logs.logs, 1];
        } else if (loaded.parser.get_parser_errors().length !== 0) {
            const errors = loaded.parser.get_parser_errors()
                .map(e => `${getFileInfo(loaded.parser, e.line)}: ${e.message}`)
                .join('\n');
            logs.append(testName + '... FAILED');
            logs.append(`Syntax errors:\n${errors}`);
            return [logs.logs, 1];
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
            return [logs.logs, 1];
        }
    } catch (error) {
        logs.append(`An exception occured: ${error.message}\n== STACKTRACE ==\n` +
            `${error.stack}`);
        return [logs.logs, 1];
    }

    return [logs.logs, 0];
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
        throw new Error('`extras["options"]` must be an "Options" type!');
    } else if (browser !== null && (typeof browser !== 'object' || browser.newPage === undefined)) {
        throw new Error('`extras["browser"]` must be created using `loadBrowser`!');
    } else if (typeof showLogs !== 'boolean') {
        throw new Error('`extras["showLogs"]` must be a boolean!');
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
        throw new Error(`expected \`runTestCode\` first argument to be a string, found \`${e}\``);
    } else if (typeof content !== 'string') {
        const e = typeof content;
        throw new Error(`expected \`runTestCode\` second argument to be a string, found \`${e}\``);
    } else if (testName.length === 0) {
        throw new Error('`runTestCode` first argument cannot be empty');
    }

    const [browser, options, showLogs] = checkExtras(extras);

    return await innerRunTestCode(testName, '', options, browser, showLogs, true, content);
}

// `extras` values are as follows:
//  * `options`: If not set, it'll be created with `new Options()`.
//  * `browser`: `null` by default, expected to be created from `loadBrowser` otherwise.
//  * `showLogs`: If not set, it'll be set to `false`.
async function runTest(testPath, extras = null) {
    if (typeof testPath !== 'string' || typeof testPath === 'undefined') {
        throw new Error('expected `runTest` first argument to be a string');
    } else if (!fs.existsSync(testPath) || !fs.lstatSync(testPath).isFile()) {
        throw new Error(`No file found with path \`${testPath}\``);
    } else if (!testPath.endsWith('.goml')) {
        throw new Error(`Expected a \`.goml\` script, found ${path.basename(testPath)}`);
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
        return ['', 1];
    }

    return innerRunTestCode(
        extractFileNameWithoutExtension(testPath),
        testPath,
        optionsCopy,
        browser,
        showLogs,
        checkTestFolder,
    );
}

// `extras` values are as follows:
//  * `options`: If not set, it'll be created with `new Options()`.
//  * `browser`: `null` by default, expected to be created from `loadBrowser` otherwise.
//  * `showLogs`: If not set, it'll be set to `false`.
async function runTests(extras = null) {
    const [browser, options, showLogs, newExtras] = checkExtras(extras);
    options.validate();

    const logs = new Logs(showLogs);
    const s = options.nbThreads > 1 ? 's' : '';
    const extra =
        newExtras['showNbThreads'] !== false ? ` (on ${options.nbThreads} thread${s})` : '';

    logs.append(`=> Starting doc-ui tests${extra}...\n`);

    try {
        return innerRunTests(logs, options, browser);
    } catch (error) {
        logs.append(
            `An exception occured: ${error.message}\n== STACKTRACE ==\n${new Error().stack}`);
        return [logs.logs, 1];
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
