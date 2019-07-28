const puppeteer = require('puppeteer');
const fs = require('fs');
const execFileSync = require('child_process').execFileSync;
const PNG = require('png-js');
const parser = require('./parser.js');
const spawnSync = require('child_process').spawnSync;
const utils = require('./utils.js');
const add_warn = utils.add_warning;
const process = require('process');


function loadContent(content) {
    var Module = module.constructor;
    var m = new Module();
    m._compile(`async function f(page){ return ${content}; } module.exports.f = f;`, "tmp.js");
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
        } catch(err) {
            add_warn(`Error while trying to make folder "${failuresFolder + runId}": ${err}`);
            // Failed to create folder to save failures...
            return false;
        }
    }
    try {
        fs.renameSync(folderIn + newImage, failuresFolder + utils.addSlash(runId) + newImage);
    } catch(err) {
        add_warn(`Error while trying to move files: "${err}"`);
        // failed to move files...
        return false;
    }
    return true;
}

function helper() {
    console.log("tester");
    console.log("  --test-folder [PATH]    : path of the folder where `.gom` script files are");
    console.log("  --failure-folder [PATH] : path of the folder where failed tests image will");
    console.log("                            be placed");
    console.log("  --run-id [id]           : id to be used for failed images extension ('test'");
    console.log("                            by default)");
    console.log("  --generate-images       : if provided, it'll generate test images and won't");
    console.log("                            run comparison tests");
    console.log("  --doc-path [PATH]       : doc path to be used on `goto` local paths");
    console.log("  --no-headless           : Disable headless mode");
    console.log("  --help | -h             : Show this text");
}

async function runTests(argv, saveLogs = true) {
    var logs = "";

    var runId = "";
    var headless = true;
    var generateImages = false;
    var testFolderPath = "";
    var failuresFolderPath = "";
    var docPath = "/";

    for (var it = 2; it < argv.length; ++it) {
        if (argv[it] === "--run-id") {
            if (it + 1 < argv.length) {
                runId = argv[it + 1];
                it += 1;
            } else {
                return ["Missing id after '--run-id' option", 1];
            }
        } else if (argv[it] === "--generate-images") {
            generateImages = true;
        } else if (argv[it] === "--no-headless") {
            headless = false;
        } else if (argv[it] === "--help" || argv[it] === "-h") {
            helper();
            return ["", 0];
        } else if (argv[it] === "--test-folder") {
            if (it + 1 < argv.length) {
                testFolderPath = utils.addSlash(argv[it + 1]);
                it += 1;
            } else {
                return ["Missing path after '--test-folder' option", 1];
            }
        } else if (argv[it] === "--doc-path") {
            if (it + 1 < argv.length) {
                docPath = utils.addSlash(argv[it + 1]);
                it += 1;
            } else {
                return ["Missing path after '--doc-path' option", 1];
            }
        } else if (argv[it] === "--failure-folder") {
            if (it + 1 < argv.length) {
                failuresFolderPath = utils.addSlash(argv[it + 1]);
                it += 1;
            } else {
                return ["Missing path after '--failure-folder' option", 1];
            }
        } else {
            return [`Unknown option '${argv[it]}'\n` +
                    "Use '--help' if you want the list of the available commands", 1];
        }
    }

    if (testFolderPath.length === 0) {
        return ["You need to provide '--test-folder' option!", 1];
    } else if (failuresFolderPath.length === 0) {
        return ["You need to provide '--failure-folder' option!", 1];
    }

    // If no run id has been provided to the script, we create a little one so test files
    // don't have an ugly name.
    if (runId.length === 0) {
        runId = "test";
    } else if (runId.indexOf("/") !== -1) {
        return ["'--run-id' cannot contain '/' character!", 1];
    }

    logs = appendLog("", "=> Starting doc-ui tests...\n", saveLogs);

    var loaded = [];
    var failures = 0;
    var ignored = 0;
    var total = 0;
    fs.readdirSync(testFolderPath).forEach(function(file) {
        var fullPath = testFolderPath + file;
        if (file.endsWith(".gom") && fs.lstatSync(fullPath).isFile()) {
            total += 1;
            var commands = parser.parseContent(utils.readFile(fullPath), docPath);
            if (commands.hasOwnProperty("error")) {
                logs = appendLog(logs, file.substr(0, file.length - 4) + "... FAILED", saveLogs);
                logs = appendLog(logs,
                                 `[ERROR] line ${commands["line"]}: ${commands["error"]}`,
                                 saveLogs);
                failures += 1;
                return;
            }
            if (commands["instructions"].length === 0) {
                logs = appendLog(logs, file.substr(0, file.length - 4) + "... FAILED", saveLogs);
                logs = appendLog(logs, "No command to execute", saveLogs);
                failures += 1;
                return;
            }
            loaded.push({"file": file.substr(0, file.length - 4), "commands": commands["instructions"]});
        }
    });

    if (loaded.length === 0) {
        return [logs, failures];
    }

    var error_log;
    var options = {};
    if (headless === false) {
        options['headless'] = false;
    }
    const browser = await puppeteer.launch(options);
    for (var i = 0; i < loaded.length; ++i) {
        logs = appendLog(logs, loaded[i]["file"] + "... ", saveLogs);
        const page = await browser.newPage();
        try {
            error_log = "";
            const commands = loaded[i]["commands"];
            for (var x = 0; x < commands.length; ++x) {
                await loadContent(commands[x]['code'])(page).catch(err => {
                    error_log = `[ERROR] ${err.toString()}: for command "${commands[x]['original']}"`;
                });
                if (error_log.length > 0) {
                    break;
                }
                // We wait a bit between each command to be sure the browser can follow.
                await page.waitFor(100);
            }
            if (error_log.length > 0) {
                logs = appendLog(logs, 'FAILED', saveLogs, true);
                logs = appendLog(logs, error_log + '\n', saveLogs);
                failures += 1;
                continue;
            }

            var newImage = `${testFolderPath}${loaded[i]["file"]}-${runId}.png`;
            await page.screenshot({
                path: newImage,
                fullPage: true,
            });

            var originalImage = `${testFolderPath}${loaded[i]["file"]}.png`;
            if (fs.existsSync(originalImage) === false) {
                if (generateImages === false) {
                    ignored += 1;
                    logs = appendLog(logs, 'ignored ("' + originalImage + '" not found)', saveLogs,
                                     true);
                } else {
                    fs.renameSync(newImage, originalImage);
                    logs = appendLog(logs, 'generated', saveLogs, true);
                }
                continue;
            }
            if (comparePixels(PNG.load(newImage).imgData,
                              PNG.load(originalImage).imgData) === false) {
                failures += 1;
                let saved = save_failure(testFolderPath, failuresFolderPath,
                                         loaded[i]["file"] + `-${runId}.png`,
                                         loaded[i]["file"] + ".png", runId);
                if (saved === true) {
                    logs = appendLog(logs,
                                     'FAILED (images "' +
                                     `${loaded[i]["file"]}-${runId}.png` +
                                     '" and "' + loaded[i]["file"] + '.png' +
                                     '" are different)',
                                     saveLogs, true);
                } else {
                    logs = appendLog(logs,
                                     'FAILED (images "' + newImage + '" and "' +
                                     originalImage + '" are different)',
                                     saveLogs, true);
                }
                continue;
            }
            // If everything worked as expected, we can remove the generated image.
            fs.unlinkSync(newImage);
        } catch (err) {
            failures += 1;
            logs = appendLog(logs, 'FAILED', saveLogs, true);
            logs = appendLog(logs, loaded[i]["file"] + " output:\n" + err + '\n', saveLogs);
            continue;
        }
        await page.close();
        logs = appendLog(logs, 'ok', saveLogs, true);
    }
    await browser.close();

    logs = appendLog(logs,
                     "\n<= doc-ui tests done: " + (total - failures - ignored) +
                     " succeeded, " + ignored + " ignored, " + failures + " failed",
                     saveLogs);

    if (saveLogs !== true) {
        process.stdout.write("\n");
    }

    return [logs, failures];
}

if (require.main === module) {
    runTests(process.argv, false).then(x => {
        var [output, error_code] = x;
        process.exit(error_code);
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
} else {
    module.exports = {
        runTests: runTests,
    };
}
