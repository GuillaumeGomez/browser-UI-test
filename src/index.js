#!/usr/bin/env node

const fs = require('fs');
const PNG = require('pngjs').PNG;
const parser = require('./commands.js');
const utils = require('./utils.js');
const Options = require('./options.js').Options;
const {Debug, Logs} = require('./logs.js');
const add_warn = utils.add_warning;
const process = require('process');
const print = utils.print;
const path = require('path');
const consts = require('./consts.js');
const Module = require('module');

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
    const filename = ''; // works fine as is...
    const m = new Module(filename);
    m.filename = filename; // because why not?
    m.paths = Module._nodeModulePaths(path.dirname(filename)); // not sure if very useful...
    m._compile(`async function f(page, arg){ ${content} } module.exports.f = f;`, filename);
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
        add_warn(`Error while trying to move files: "${err.message}"`);
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

function parseTest(testName, content, logs, options) {
    try {
        const commands = parser.parseContent(content, options);
        if (Object.prototype.hasOwnProperty.call(commands, 'error')) {
            logs.append(testName + '... FAILED');
            logs.append(`[ERROR] line ${commands['line']}: ${commands['error']}`);
            return null;
        }
        if (commands['instructions'].length === 0) {
            logs.append(testName + '... FAILED');
            logs.append('=> No command to execute');
            logs.warn(commands['warnings']);
            return null;
        }
        return {
            'file': testName,
            'commands': commands['instructions'],
            'warnings': commands['warnings'],
        };
    } catch (err) {
        logs.append(testName + '... FAILED (exception occured)');
        logs.append(`${err.message}\n${err.stack}`);
    }
    return null;
}

function parseTestFile(testPath, logs, options) {
    const fullPath = testPath;
    const basename = path.basename(fullPath);
    const testName = basename.substr(0, basename.length - 5);

    return parseTest(testName, utils.readFile(fullPath), logs, options);
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

async function runCommand(loaded, logs, options, browser) {
    let error_log;
    logs.append(loaded['file'] + '... ');

    let notOk = false;
    let returnValue = Status.Ok;
    const debug_log = new Debug(options.debug, logs);

    const page = await browser.newPage(options, debug_log);
    await browser.emulate(options, page, debug_log);
    try {
        const extras = {
            'takeScreenshot': options.noScreenshot === false,
            'expectedToFail': false,
            'showText': options.showText,
            'puppeteer': browser.puppeteer,
            'browser': browser,
            'permissions': options.permissions,
            'debug_log': debug_log,
        };
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
        const script = fs.readFileSync(path.join(__dirname, '/helpers.js'), 'utf8');
        debug_log.append(`Injecting helpers script into page: "${script}"`);
        await page.evaluateOnNewDocument(script);

        error_log = '';
        const commands = loaded['commands'];
        for (let x = 0; x < commands.length; ++x) {
            let failed = false;
            // In case we have some unrecoverable error which cannot be caught in `fail: true`, like
            // color check when text isn't displayed.
            let stopLoop = false;
            const command = commands[x];
            const line_number = command['line_number'];
            debug_log.append(`EXECUTING (line ${line_number}) "${command['code']}"`);
            try {
                await loadContent(command['code'])(page, extras).catch(err => {
                    if (err === parser.COLOR_CHECK_ERROR) {
                        error_log += `[ERROR] (line ${line_number}): ${err}`;
                        stopLoop = true;
                    } else {
                        failed = true;
                        const s_err = err.toString();
                        if (extras.expectedToFail !== true) {
                            const original = command['original'];
                            error_log = `[ERROR] (line ${line_number}) ${s_err}: for ` +
                                `command \`${original}\``;
                        } else {
                            // it's an expected failure so no need to log it
                            debug_log.append(`[EXPECTED FAILURE] (line ${line_number}): ${s_err}`);
                        }
                    }
                });
                if (stopLoop) {
                    break;
                }
            } catch (error) { // parsing error
                error_log = `(line ${line_number}) output:\n${error.message}\n`;
                if (options.debug === true) {
                    error_log += `command \`${command['original']}\` failed on ` +
                        `\`${command['code']}\``;
                }
            }
            debug_log.append('Done!');
            if (error_log.length > 0) {
                break;
            }
            if (failed === false
                && command['checkResult'] === true
                && extras.expectedToFail === true) {
                error_log += `(line ${line_number}) command \`${command['original']}\` was ` +
                    'supposed to fail but succeeded';
                break;
            }
            if (command['wait'] !== false) {
                // We wait a bit between each command to be sure the browser can follow.
                await page.waitFor(100);
            }
        }
        if (error_log.length > 0) {
            logs.append('FAILED', true);
            logs.warn(loaded['warnings']);
            logs.append(error_log + '\n');
            await page.close();
            return Status.Failure;
        }

        let elem = page;
        if (extras.takeScreenshot !== true) {
            if (extras.takeScreenshot === false) {
                logs.append('ok', true);
                debug_log.append('=> [NO SCREENSHOT COMPARISON]');
                logs.warn(loaded['warnings']);
                await page.close();
                return Status.Ok;
            }
            if (extras.takeScreenshot.startsWith('//')) {
                // This is an XPath.
                elem = await page.$x(extras.takeScreenshot);
                if (elem.length === 0) {
                    elem = null;
                } else {
                    elem = elem[0];
                }
            } else {
                // This is a CSS selector.
                elem = await page.$(extras.takeScreenshot);
            }
            if (elem === null) {
                logs.append('FAILED', true);
                logs.append(`Cannot take screenshot: element \`${extras.takeScreenshot}\`` +
                    ' not found');
                logs.warn(loaded['warnings']);
                await page.close();
                return Status.MissingElementForScreenshot;
            }
        }

        const compare_s = options.generateImages === false ? 'COMPARISON' : 'GENERATION';
        debug_log.append(`=> [SCREENSHOT ${compare_s}]`);
        const p = path.join(options.getImageFolder(), loaded['file']);
        const newImage = `${p}-${options.runId}.png`;
        await elem.screenshot({
            'path': newImage,
            'fullPage': extras.takeScreenshot === true ? true : undefined,
        });

        const originalImage = `${path.join(options.getImageFolder(), loaded['file'])}.png`;
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
                    `FAILED (images "${failedPath}" and "${loaded['file']}" are different)`,
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
        logs.append(loaded['file'] + ' output:\n' + err.message + '\n');
        notOk = true;
        returnValue = Status.ExecutionError;
    }
    await page.close();
    if (notOk === false) {
        logs.append('ok', true);
    }
    return returnValue;
}

async function innerRunTests(logs, options) {
    let failures = 0;
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
    for (let i = 0; i < options.testFiles.length; ++i) {
        if (fs.existsSync(options.testFiles[i]) && fs.lstatSync(options.testFiles[i]).isFile()) {
            const fullPath = path.resolve(options.testFiles[i]);
            if (allFiles.indexOf(fullPath) === -1) {
                allFiles.push(fullPath);
            }
        } else {
            throw new Error(`File \`${options.testFiles[i]}\` not found (passed with ` +
                '`--test-files` option)');
        }
    }

    if (allFiles.length === 0) {
        throw new Error('No files found. Check your `--test-folder` and `--test-files` options');
    }

    if (options.testFolder.length === 0
        && options.getFailureFolder() === ''
        && options.getImageFolder() === '') {
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

    const loaded = [];
    for (let i = 0; i < allFiles.length; ++i) {
        total += 1;

        const load = parseTestFile(allFiles[i], logs, options);
        if (load === null) {
            failures += 1;
        } else {
            loaded.push(load);
        }
    }

    if (loaded.length === 0) {
        logs.append('');
        return [logs.logs, failures];
    }

    const browser = await utils.loadPuppeteer(options);
    for (let i = 0; i < loaded.length; ++i) {
        const ret = await runCommand(loaded[i], logs, options, browser);
        if (ret !== Status.Ok) {
            failures += 1;
        }
    }
    await browser.close();

    logs.append(
        '\n<= doc-ui tests done: ' + (total - failures) + ' succeeded, ' + failures + ' failed');

    if (logs.showLogs === true) {
        logs.append('');
    }

    return [logs.logs, failures];
}

async function innerRunTestCode(testName, content, options, showLogs, checkTestFolder) {
    const logs = new Logs(showLogs);

    if (checkTestFolder === true && options.testFolder.length > 0) {
        logs.append('[WARNING] `--test-folder` option will be ignored.\n');
    }

    try {
        const load = parseTest(path.normalize(testName), content, logs, options);
        if (load === null) {
            return [logs.logs, 1];
        }

        const browser = await utils.loadPuppeteer(options);
        const ret = await runCommand(load, logs, options, browser);

        await browser.close();

        if (ret !== Status.Ok) {
            return [logs.logs, 1];
        }

        return [logs.logs, 0];
    } catch (error) {
        logs.append(`An exception occured: ${error.message}\n== STACKTRACE ==\n` +
            `${new Error().stack}`);
        return [logs.logs, 1];
    }
}

async function runTestCode(testName, content, options = new Options(), showLogs = false) {
    if (typeof testName !== 'string' || typeof testName === 'undefined') {
        throw new Error('expected `runTestCode` first argument to be a string');
    } else if (typeof content !== 'string' || typeof content === 'undefined') {
        throw new Error('expected `runTestCode` second argument to be a string');
    } else if (testName.length === 0) {
        throw new Error('test name (first argument) cannot be empty');
    } else if (!options || options.validate === undefined) {
        throw new Error('Options must be an "Options" type!');
    }
    // "light" validation of the Options type.
    options.validateFields();

    return await innerRunTestCode(testName, content, options, showLogs, true);
}

async function runTest(testPath, options = new Options(), showLogs = false) {
    if (typeof testPath !== 'string' || typeof testPath === 'undefined') {
        throw new Error('expected `runTest` first argument to be a string');
    } else if (!options || options.validate === undefined) {
        throw new Error('Options must be an "Options" type!');
    } else if (!fs.existsSync(testPath) || !fs.lstatSync(testPath).isFile()) {
        throw new Error(`No file found with path \`${testPath}\``);
    } else if (!testPath.endsWith('.goml')) {
        throw new Error(`Expected a \`.goml\` script, found ${path.basename(testPath)}`);
    }

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

    const basename = path.basename(testPath);
    return innerRunTestCode(basename.substr(0, basename.length - 5), utils.readFile(testPath),
        optionsCopy, showLogs, checkTestFolder);
}

async function runTests(options, showLogs = false) {
    if (!options || options.validate === undefined) {
        throw new Error('Options must be an "Options" type!');
    }
    options.validate();

    const logs = new Logs(showLogs);

    logs.append('=> Starting doc-ui tests...\n');

    try {
        return innerRunTests(logs, options);
    } catch (error) {
        logs.append(`An exception occured: ${error.message}\n== STACKTRACE ==\n` +
            `${new Error().stack}`);
        return [logs.logs, 1];
    }
}

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
    runTests(options, true).then(x => {
        const [_output, nb_failures] = x;
        process.exit(nb_failures);
    }).catch(err => {
        print(err.message);
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
    };
}
