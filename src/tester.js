const puppeteer = require('puppeteer');
const fs = require('fs');
const PNG = require('png-js');
const parser = require('./parser.js');
const utils = require('./utils.js');
const add_warn = utils.add_warning;
const process = require('process');
const print = utils.print;


function loadContent(content) {
    const Module = module.constructor;
    const m = new Module();
    m._compile(`async function f(page){ return ${content}; } module.exports.f = f;`, 'tmp.js');
    return m.exports.f;
}

function comparePixels(img1, img2) {
    return img1.equals(img2);
}

function appendLog(logs, newLog, saveLogs, noBackline) {
    if (logs.length === 0 || noBackline === true) {
        if (saveLogs !== true) {
            process.stdout.write(`${newLog}`);
        }
        return `${logs}${newLog}`;
    }
    if (saveLogs !== true) {
        process.stdout.write(`\n${newLog}`);
    }
    return `${logs}\n${newLog}`;
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

function helper() {
    print('tester');
    print('  --test-folder [PATH]    : path of the folder where `.gom` script files are');
    print('  --failure-folder [PATH] : path of the folder where failed tests image will');
    print('                            be placed');
    print('  --run-id [id]           : id to be used for failed images extension (\'test\'');
    print('                            by default)');
    print('  --generate-images       : If provided, it\'ll generate test images and won\'t');
    print('                            run comparison tests');
    print('  --doc-path [PATH]       : doc path to be used on `goto` local paths');
    print('  --no-headless           : Disable headless mode');
    print('  --show-text             : Disable text invisibility (be careful when using it!)');
    print('  --help | -h             : Show this text');
}

class Options {
    constructor() {
        this.runId = 'test';
        this.generateImages = false;
        this.headless = true;
        this.testFolderPath = '';
        this.docPath = '/';
        this.failuresFolderPath = '';
        this.showText = false;
    }

    parseArguments(args = []) {
        for (let it = 0; it < args.length; ++it) {
            if (args[it] === '--run-id') {
                if (it + 1 < args.length) {
                    this.runId = args[it + 1];
                    if (this.runId.indexOf('/') !== -1) {
                        throw '\'--run-id\' cannot contain \'/\' character!';
                    }
                    it += 1;
                } else {
                    throw 'Missing id after \'--run-id\' option';
                }
            } else if (args[it] === '--generate-images') {
                this.generateImages = true;
            } else if (args[it] === '--no-headless') {
                this.headless = false;
            } else if (args[it] === '--show-text') {
                this.showText = true;
            } else if (args[it] === '--help' || args[it] === '-h') {
                helper();
                return false;
            } else if (args[it] === '--test-folder') {
                if (it + 1 < args.length) {
                    this.testFolderPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw 'Missing path after \'--test-folder\' option';
                }
            } else if (args[it] === '--doc-path') {
                if (it + 1 < args.length) {
                    this.docPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw 'Missing path after \'--doc-path\' option';
                }
            } else if (args[it] === '--failure-folder') {
                if (it + 1 < args.length) {
                    this.failuresFolderPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw 'Missing path after \'--failure-folder\' option';
                }
            } else {
                throw `Unknown option '${args[it]}'\n` +
                        'Use \'--help\' if you want the list of the available commands';
            }
        }
        return true;
    }

    validate() {
        if (this.testFolderPath.length === 0) {
            throw 'You need to provide \'--test-folder\' option!';
        } else if (this.failuresFolderPath.length === 0) {
            throw 'You need to provide \'--failure-folder\' option!';
        }
    }
}

function getGlobalStyle(textHiding) {
    return `html {font-family: Arial,Helvetica Neue,Helvetica,sans-serif;}${textHiding}`;
}

async function runTests(options, saveLogs = true) {
    if (!options || options.validate === undefined) {
        throw 'Options must be an "Options" type!';
    }
    options.validate();

    let logs = '';
    const textHiding = options.showText === true ? '' : '* { color: rgba(0,0,0,0) !important; }';

    logs = appendLog('', '=> Starting doc-ui tests...\n', saveLogs);

    const loaded = [];
    let failures = 0;
    let ignored = 0;
    let total = 0;
    fs.readdirSync(options.testFolderPath).forEach(function(file) {
        const fullPath = options.testFolderPath + file;
        if (file.endsWith('.gom') && fs.lstatSync(fullPath).isFile()) {
            total += 1;
            const commands = parser.parseContent(utils.readFile(fullPath), options.docPath);
            if (Object.prototype.hasOwnProperty.call(commands, 'error')) {
                logs = appendLog(logs, file.substr(0, file.length - 4) + '... FAILED', saveLogs);
                logs = appendLog(logs,
                    `[ERROR] line ${commands['line']}: ${commands['error']}`,
                    saveLogs);
                failures += 1;
                return;
            }
            if (commands['instructions'].length === 0) {
                logs = appendLog(logs, file.substr(0, file.length - 4) + '... FAILED', saveLogs);
                logs = appendLog(logs, 'No command to execute', saveLogs);
                failures += 1;
                return;
            }
            loaded.push({
                'file': file.substr(0, file.length - 4),
                'commands': commands['instructions'],
            });
        }
    });

    if (loaded.length === 0) {
        return [logs, failures];
    }

    let error_log;
    const puppeteer_options = {'args': ['--font-render-hinting=none']};
    if (options.headless === false) {
        puppeteer_options['headless'] = false;
    }
    const browser = await puppeteer.launch(puppeteer_options);
    for (let i = 0; i < loaded.length; ++i) {
        logs = appendLog(logs, loaded[i]['file'] + '... ', saveLogs);
        const page = await browser.newPage();
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
            for (let x = 0; x < commands.length; ++x) {
                await loadContent(commands[x]['code'])(page).catch(err => {
                    const s_err = err.toString();
                    error_log = `[ERROR] ${s_err}: for command "${commands[x]['original']}"`;
                });
                if (error_log.length > 0) {
                    break;
                }
                // We wait a bit between each command to be sure the browser can follow.
                await page.waitFor(100);
            }
            if (error_log.length > 0) {
                logs = appendLog(logs, 'FAILED', saveLogs, true); // eslint-disable-line
                logs = appendLog(logs, error_log + '\n', saveLogs); // eslint-disable-line
                failures += 1;
                continue;
            }

            const newImage = `${options.testFolderPath}${loaded[i]['file']}-${options.runId}.png`;
            await page.screenshot({
                path: newImage,
                fullPage: true,
            });

            const originalImage = `${options.testFolderPath}${loaded[i]['file']}.png`;
            if (fs.existsSync(originalImage) === false) {
                if (options.generateImages === false) {
                    ignored += 1;
                    // eslint-disable-next-line
                    logs = appendLog(logs,
                        'ignored ("' + originalImage + '" not found)',
                        saveLogs,
                        true);
                } else {
                    fs.renameSync(newImage, originalImage);
                    logs = appendLog(logs, 'generated', saveLogs, true); // eslint-disable-line
                }
                continue;
            }
            if (comparePixels(PNG.load(newImage).imgData,
                PNG.load(originalImage).imgData) === false) {
                failures += 1;
                const saved = save_failure(options.testFolderPath, options.failuresFolderPath,
                    loaded[i]['file'] + `-${options.runId}.png`,
                    loaded[i]['file'] + '.png', options.runId);
                if (saved === true) {
                    // eslint-disable-next-line
                    logs = appendLog(logs,
                        `FAILED (images "${loaded[i]['file']}-${options.runId}.png" and ` +
                        `"${loaded[i]['file']}" are different)`,
                        saveLogs,
                        true);
                } else {
                    // eslint-disable-next-line
                    logs = appendLog(logs,
                        `FAILED (images "${newImage}" and "${originalImage}" are different)`,
                        saveLogs,
                        true);
                }
                continue;
            }
            // If everything worked as expected, we can remove the generated image.
            fs.unlinkSync(newImage);
        } catch (err) {
            failures += 1;
            logs = appendLog(logs, 'FAILED', saveLogs, true); // eslint-disable-line
            // eslint-disable-next-line
            logs = appendLog(logs, loaded[i]['file'] + ' output:\n' + err + '\n', saveLogs);
            continue;
        }
        await page.close();
        logs = appendLog(logs, 'ok', saveLogs, true); // eslint-disable-line
    }
    await browser.close();

    logs = appendLog(logs,
        '\n<= doc-ui tests done: ' + (total - failures - ignored) +
                     ' succeeded, ' + ignored + ' ignored, ' + failures + ' failed',
        saveLogs);

    if (saveLogs !== true) {
        process.stdout.write('\n');
    }

    return [logs, failures];
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
