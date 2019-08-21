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
    if (fs.existsSync(failuresFolder + runId) === false) {
        try {
            fs.mkdirSync(failuresFolder + runId);
        } catch (err) {
            add_warn(`Error while trying to make folder "${failuresFolder + runId}": ${err}`);
            // Failed to create folder to save failures...
            return false;
        }
    }
    try {
        fs.renameSync(folderIn + newImage, failuresFolder + utils.addSlash(runId) + newImage);
    } catch (err) {
        add_warn(`Error while trying to move files: "${err}"`);
        // failed to move files...
        return false;
    }
    return true;
}

function getGlobalStyle(textHiding) {
    return `html {font-family: Arial,Helvetica Neue,Helvetica,sans-serif;}${textHiding}`;
}

async function innerRunTests(logs, options) {
    const textHiding = options.showText === true ? '' : '* { color: rgba(0,0,0,0) !important; }';
    const loaded = [];
    let failures = 0;
    let ignored = 0;
    let total = 0;
    const allFiles = [];

    fs.readdirSync(options.testFolderPath).forEach(function(file) {
        const fullPath = options.testFolderPath + file;
        if (file.endsWith('.goml') && fs.lstatSync(fullPath).isFile()) {
            allFiles.push(path.resolve(fullPath));
        }
    });
    for (let i = 0; i < options.testFiles.length; ++i) {
        if (fs.lstatSync(options.testFiles[i]).isFile()) {
            const fullPath = path.resolve(options.testFiles[i]);
            if (allFiles.indexOf(fullPath) === -1) {
                allFiles.push(fullPath);
            }
        }
    }
    // A little sort on tests' name.
    allFiles.sort((a, b) => path.basename(a) > path.basename(b));

    for (let i = 0; i < allFiles.length; ++i) {
        const fullPath = allFiles[i];
        const basename = path.basename(fullPath);
        const testName = basename.substr(0, basename.length - 5);
        try {
            total += 1;
            const commands = parser.parseContent(utils.readFile(fullPath), options);
            if (Object.prototype.hasOwnProperty.call(commands, 'error')) {
                logs.append(testName + '... FAILED');
                logs.append(`[ERROR] line ${commands['line']}: ${commands['error']}`);
                failures += 1;
                continue;
            }
            if (commands['instructions'].length === 0) {
                logs.append(testName + '... FAILED');
                logs.append('=> No command to execute');
                logs.warn(commands['warnings']);
                failures += 1;
                continue;
            }
            loaded.push({
                'file': testName,
                'commands': commands['instructions'],
                'warnings': commands['warnings'],
            });
        } catch (err) {
            failures += 1;
            logs.append(testName + '... FAILED (exception occured)');
            logs.append(`${err}\n${err.stack}`);
        }
    }

    if (loaded.length === 0) {
        logs.append('');
        return [logs.logs, failures];
    }

    let error_log;
    const puppeteer_options = {'args': ['--font-render-hinting=none']};
    if (options.headless === false) {
        puppeteer_options['headless'] = false;
    }
    const browser = await puppeteer.launch(puppeteer_options);
    for (let i = 0; i < loaded.length; ++i) {
        logs.append(loaded[i]['file'] + '... ');
        const page = await browser.newPage();
        let notOk = false;
        const debug_log = new Debug(options.debug);
        try {
            await page.evaluateOnNewDocument(s => {
                window.addEventListener('DOMContentLoaded', () => {
                    const style = document.createElement('style');
                    style.type = 'text/css';
                    style.innerHTML = s;
                    document.getElementsByTagName('head')[0].appendChild(style);
                });
            }, getGlobalStyle(textHiding));
            error_log = '';
            const commands = loaded[i]['commands'];
            const extras = {
                'takeScreenshot': options.noScreenshot === false,
                'expectedToFail': false,
            };
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
                logs.warn(loaded[i]['warnings']);
                logs.append(error_log + '\n');
                debug_log.show(logs);
                failures += 1;
                await page.close();
                continue;
            }

            let elem = page;
            if (extras.takeScreenshot !== true) {
                if (extras.takeScreenshot === false) {
                    logs.append('ok', true);
                    debug_log.append('=> [NO SCREENSHOT COMPARISON]');
                    logs.warn(loaded[i]['warnings']);
                    debug_log.show(logs);
                    await page.close();
                    continue;
                }
                elem = await page.$(extras.takeScreenshot);
                if (elem === null) {
                    logs.append('FAILED', true);
                    logs.append(`Cannot take screenshot: element \`${extras.takeScreenshot}\`` +
                        ' not found');
                    logs.warn(loaded[i]['warnings']);
                    debug_log.show(logs);
                    await page.close();
                    continue;
                }
            }

            const compare_s = options.generateImages === false ? 'COMPARISON' : 'GENERATION';
            debug_log.append(`=> [SCREENSHOT ${compare_s}]`);
            const newImage = `${options.testFolderPath}${loaded[i]['file']}-${options.runId}.png`;
            await elem.screenshot({
                'path': newImage,
                'fullPage': extras.takeScreenshot === true ? true : undefined,
            });

            const originalImage = `${options.testFolderPath}${loaded[i]['file']}.png`;
            if (fs.existsSync(originalImage) === false) {
                if (options.generateImages === false) {
                    ignored += 1;
                    logs.append('ignored ("' + originalImage + '" not found)', true);
                    notOk = true;
                } else {
                    fs.renameSync(newImage, originalImage);
                    logs.append('generated', true);
                    notOk = true;
                }
            } else if (comparePixels(PNG.load(newImage).imgData,
                PNG.load(originalImage).imgData) === false) {
                failures += 1;
                const saved = save_failure(options.testFolderPath, options.failuresFolderPath,
                    loaded[i]['file'] + `-${options.runId}.png`,
                    loaded[i]['file'] + '.png', options.runId);
                if (saved === true) {
                    logs.append(
                        `FAILED (images "${loaded[i]['file']}-${options.runId}.png" and ` +
                        `"${loaded[i]['file']}" are different)`,
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
            failures += 1;
            logs.append('FAILED', true);
            logs.append(loaded[i]['file'] + ' output:\n' + err + '\n');
            notOk = true;
        }
        await page.close();
        if (notOk === false) {
            logs.append('ok', true);
        }
        debug_log.show(logs);
    }
    await browser.close();

    logs.append(
        '\n<= doc-ui tests done: ' + (total - failures - ignored) +
        ' succeeded, ' + ignored + ' ignored, ' + failures + ' failed');

    if (logs.saveLogs !== true) {
        process.stdout.write('\n');
    }

    return [logs.logs, failures];
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
        runTests: runTests,
        Options: Options,
    };
}
