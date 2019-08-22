const puppeteer = require('puppeteer');
const fs = require('fs');
const PNG = require('png-js');
const parser = require('./commands.js');
const utils = require('./utils.js');
const Options = require('./options.js').Options;
const {Debug, Logs} = require('./logs.js');
const add_warn = utils.add_warning;
const process = require('process');
const print = utils.print;
const path = require('path');
const consts = require('./consts.js');


// Make it into a class to provide some utility methods like 'isFailure'.
const Status = {
    'Ok': 0,
    'Failure': 1,
    'MissingElementForScreenshot': 2,
    'ScreenshotComparisonFailed': 3,
    'ScreenshotNotFound': 4,
    'ExecutionError': 5,
};

function loadContent(content) {
    const Module = module.constructor;
    const m = new Module();
    m._compile(`async function f(page, arg){ ${content} } module.exports.f = f;`, 'tmp.js');
    return m.exports.f;
}

function comparePixels(img1, img2) {
    return img1.equals(img2);
}

function save_failure(folderIn, failuresFolder, newImage, originalImage, runId) {
    if (fs.existsSync(failuresFolder) === false) {
        // We cannot save the failures...
        return false;
    }
    const fullPath = path.join(failuresFolder, runId);
    if (fs.existsSync(fullPath) === false) {
        try {
            fs.mkdirSync(failuresFolder + runId);
        } catch (err) {
            add_warn(`Error while trying to make folder "${fullPath}": ${err}`);
            // Failed to create folder to save failures...
            return false;
        }
    }
    try {
        fs.renameSync(path.join(folderIn, newImage), path.join(fullPath, newImage));
    } catch (err) {
        add_warn(`Error while trying to move files: "${err}"`);
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

function parseTest(testPath, logs, options) {
    const fullPath = testPath;
    const basename = path.basename(fullPath);
    const testName = basename.substr(0, basename.length - 5);
    try {
        const commands = parser.parseContent(utils.readFile(fullPath), options);
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
        logs.append(`${err}\n${err.stack}`);
    }
    return null;
}

async function runCommand(loaded, logs, options, browser) {
    let error_log;
    logs.append(loaded['file'] + '... ');

    let notOk = false;
    let returnValue = Status.Ok;
    const debug_log = new Debug(options.debug);
    const page = await browser.newPage();
    try {
        const extras = {
            'takeScreenshot': options.noScreenshot === false,
            'expectedToFail': false,
            'showText': options.showText,
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
        error_log = '';
        const commands = loaded['commands'];
        for (let x = 0; x < commands.length; ++x) {
            debug_log.append(`EXECUTING "${commands[x]['code']}"`);
            try {
                await loadContent(commands[x]['code'])(page, extras).catch(err => {
                    const s_err = err.toString();
                    if (extras.expectedToFail !== true) {
                        const original = commands[x]['original'];
                        error_log = `[ERROR] ${s_err}: for command "${original}"`;
                    } else {
                        // it's an expected failure so no need to log it
                        debug_log.append(`[EXPECTED FAILURE]: ${s_err}`);
                    }
                });
            } catch (error) { // parsing error
                error_log = 'output:\n' + error + '\n';
                if (options.debug === true) {
                    error_log += `command "${x}" failed: ${commands[x]['code']}\n`;
                }
            }
            if (error_log.length > 0) {
                break;
            }
            if (commands[x].wait !== false) {
                // We wait a bit between each command to be sure the browser can follow.
                await page.waitFor(100);
            }
        }
        if (error_log.length > 0) {
            logs.append('FAILED', true);
            logs.warn(loaded['warnings']);
            logs.append(error_log + '\n');
            debug_log.show(logs);
            await page.close();
            return Status.Failure;
        }

        let elem = page;
        if (extras.takeScreenshot !== true) {
            if (extras.takeScreenshot === false) {
                logs.append('ok', true);
                debug_log.append('=> [NO SCREENSHOT COMPARISON]');
                logs.warn(loaded['warnings']);
                debug_log.show(logs);
                await page.close();
                return Status.Ok;
            }
            elem = await page.$(extras.takeScreenshot);
            if (elem === null) {
                logs.append('FAILED', true);
                logs.append(`Cannot take screenshot: element \`${extras.takeScreenshot}\`` +
                    ' not found');
                logs.warn(loaded['warnings']);
                debug_log.show(logs);
                await page.close();
                return Status.MissingElementForScreenshot;
            }
        }

        const compare_s = options.generateImages === false ? 'COMPARISON' : 'GENERATION';
        debug_log.append(`=> [SCREENSHOT ${compare_s}]`);
        const p = path.join(options.testFolderPath, loaded['file']);
        const newImage = `${p}-${options.runId}.png`;
        await elem.screenshot({
            'path': newImage,
            'fullPage': extras.takeScreenshot === true ? true : undefined,
        });

        const originalImage = `${path.join(options.testFolderPath, loaded['file'])}.png`;
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
        } else if (comparePixels(PNG.load(newImage).imgData,
            PNG.load(originalImage).imgData) === false) {
            const saved = save_failure(options.testFolderPath, options.failuresFolderPath,
                loaded['file'] + `-${options.runId}.png`,
                loaded['file'] + '.png', options.runId);
            returnValue = Status.ScreenshotComparisonFailed;
            if (saved === true) {
                logs.append(
                    `FAILED (images "${loaded['file']}-${options.runId}.png" and ` +
                    `"${loaded['file']}" are different)`,
                    true);
            } else {
                logs.append(
                    `FAILED (images "${newImage}" and "${originalImage}" are different)`,
                    true);
                notOk = true;
            }
        } else {
            // If everything worked as expected, we can remove the generated image.
            fs.unlinkSync(newImage);
        }
    } catch (err) {
        logs.append('FAILED', true);
        logs.append(loaded['file'] + ' output:\n' + err + '\n');
        notOk = true;
        returnValue = Status.ExecutionError;
    }
    await page.close();
    if (notOk === false) {
        logs.append('ok', true);
    }
    debug_log.show(logs);
    return returnValue;
}

async function innerRunTests(logs, options) {
    let failures = 0;
    let total = 0;
    const allFiles = [];

    fs.readdirSync(options.testFolderPath).forEach(function(file) {
        const fullPath = path.join(options.testFolderPath, file);
        if (file.endsWith('.goml') && fs.lstatSync(fullPath).isFile()) {
            allFiles.push(path.resolve(fullPath));
        }
    });
    let needBlankLine = false;
    for (let i = 0; i < options.testFiles.length; ++i) {
        if (fs.existsSync(options.testFiles[i]) && fs.lstatSync(options.testFiles[i]).isFile()) {
            const fullPath = path.resolve(options.testFiles[i]);
            if (allFiles.indexOf(fullPath) === -1) {
                allFiles.push(fullPath);
            }
        } else {
            logs.append(`/!\\ Ignoring file "${options.testFiles[i]}".`);
            needBlankLine = true;
        }
    }
    if (needBlankLine === true) {
        logs.append('');
    }
    // A little sort on tests' name.
    allFiles.sort((a, b) => path.basename(a) > path.basename(b));

    const loaded = [];
    for (let i = 0; i < allFiles.length; ++i) {
        total += 1;

        const load = parseTest(allFiles[i], logs, options);
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

    const puppeteer_options = {'args': ['--font-render-hinting=none']};
    if (options.headless === false) {
        puppeteer_options['headless'] = false;
    }
    const browser = await puppeteer.launch(puppeteer_options);
    for (let i = 0; i < loaded.length; ++i) {
        const ret = await runCommand(loaded[i], logs, options, browser);
        if (ret !== Status.Ok) {
            failures += 1;
        }
    }
    await browser.close();

    logs.append(
        '\n<= doc-ui tests done: ' + (total - failures) + ' succeeded, ' + failures + ' failed');

    if (logs.saveLogs !== true) {
        logs.append('');
    }

    return [logs.logs, failures];
}

async function runTest(testPath, options = new Options(), saveLogs = true) {
    if (!options || options.validate === undefined) {
        throw 'Options must be an "Options" type!';
    }
    // To make the Options type validation happy.
    options.testFiles.push(testPath);
    if (options.failuresFolderPath.length === 0 && options.noScreenshot === false) {
        // Then we use the same folder as where the test is.
        options.failuresFolderPath = path.dirname(testPath);
    }

    options.validate();

    const logs = new Logs(saveLogs);

    try {
        const load = parseTest(testPath, logs, options);
        if (load === null) {
            return [logs.logs, 1];
        }

        const puppeteer_options = {'args': ['--font-render-hinting=none']};
        if (options.headless === false) {
            puppeteer_options['headless'] = false;
        }
        const browser = await puppeteer.launch(puppeteer_options);
        const ret = await runCommand(load, logs, options, browser);

        await browser.close();

        if (ret !== Status.Ok) {
            return [logs.logs, 1];
        }

        return [logs.logs, 0];
    } catch (error) {
        logs.append(`An exception occured: ${error}\n== STACKTRACE ==\n${new Error().stack}`);
        return [logs.logs, 1];
    }
}

async function runTests(options, saveLogs = true) {
    if (!options || options.validate === undefined) {
        throw 'Options must be an "Options" type!';
    }
    options.validate();

    const logs = new Logs(saveLogs);

    logs.append('=> Starting doc-ui tests...\n');

    try {
        return innerRunTests(logs, options);
    } catch (error) {
        logs.append(`An exception occured: ${error}\n== STACKTRACE ==\n${new Error().stack}`);
        return [logs.logs, 1];
    }
}

if (require.main === module) {
    const options = new Options();
    try {
        if (options.parseArguments(process.argv.slice(2)) === false) {
            process.exit(0);
        }
    } catch (err) {
        print(err);
        process.exit(1);
    }
    runTests(options, false).then(x => {
        const [_output, nb_failures] = x;
        process.exit(nb_failures);
    }).catch(err => {
        print(err);
        process.exit(1);
    });
} else {
    module.exports = {
        'runTest': runTest,
        'runTests': runTests,
        'Options': Options,
    };
}
