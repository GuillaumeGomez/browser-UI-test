const process = require('process');
process.env.debug_tests = '1'; // We enable this to get all items from `commands.js`.

const {Assert, plural, print} = require('./utils.js');
const { getFileInfo } = require('../src/utils.js');
const { parseTest, BEFORE_GOTO } = require('../src/commands.js');
const { Options } = require('../src/options.js');
const { Logs } = require('../src/logs.js');
const fs = require('fs');
const path = require('path');

function getAllFiles(folderPath, level) {
    const files = [];

    if (level > 1) {
        return files;
    }
    fs.readdirSync(folderPath).forEach(function(file) {
        const fullPath = path.join(folderPath, file);
        const stat = fs.lstatSync(fullPath);
        if (stat.isFile()) {
            if (file.endsWith('.md')) {
                files.push(fullPath);
            }
        } else if (stat.isDirectory()) {
            files.push(...getAllFiles(fullPath, level + 1));
        }
    });
    return files;
}

function checkContent(x, example, file, line, firstCommand) {
    const logs = new Logs(false);
    const fileAndLine = `${file}:${line}`;
    const extra = BEFORE_GOTO.includes(firstCommand) ? '' : 'go-to: "/a"\n';

    try {
        const loaded = parseTest(fileAndLine, file, logs, new Options(), extra + example);
        // FIXME: it's the same code as inside `src/index.js`. Better make a common function!
        if (loaded === null) {
            x.addError(`${fileAndLine}: Failed to parse example: ${logs.logs}`);
            return;
        } else if (loaded.parser.get_parser_errors().length !== 0) {
            const errors = loaded.parser.get_parser_errors()
                .map(e => `${getFileInfo(loaded.parser, e.line)}: ${e.message}`)
                .join('\n');
            x.addError(`${fileAndLine}: Syntax errors: ${errors}`);
            return;
        }
        const context_parser = loaded['parser'];
        // Variables used in some examples.
        context_parser.variables['variable'] = 1;
        context_parser.variables['class_var'] = 1;
        context_parser.variables['window_height'] = 1;
        context_parser.variables['width'] = 1;
        context_parser.variables['height'] = 1;
        context_parser.variables['A_VARIABLE'] = 'a';
        context_parser.variables['DOC_PATH'] = './a';
        // Needed for `within-iframe` commands.
        const pages = [0, 0, 0, 0, 0];

        for (let nb_commands = 0;; ++nb_commands) {
            const command = context_parser.get_next_command(pages);
            if (command === null) {
                if (nb_commands === 0) {
                    x.addError(`${fileAndLine}: FAILED (No command to execute)`);
                    return;
                }
                break;
            }
            // FIXME: it's the same code as inside `src/index.js`. Better make a common function!
            if (command['error'] !== undefined) {
                x.addError(
                    `${fileAndLine}: [ERROR] ${getFileInfo(context_parser, command['line'])}: \
${command['error']}`);
                return;
            } else if (command['errors'] !== undefined && command['errors'].length > 0) {
                const error = command['errors'].map(e => {
                    return `[ERROR] ${getFileInfo(context_parser, e['line'])}: ${e['message']}`;
                }).join('\n');
                x.addError(`${fileAndLine}: ${error}`);
                return;
            } else if (command['callback']) {
                command['callback']();
            }
        }
    } catch (err) {
        x.addError(`${fileAndLine}: ${err}`);
        return;
    }
    x.addSuccess();
}

function checkFileExamples(x, filePath) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');

    for (let i = 0, len = lines.length; i < len; ++i) {
        const line = lines[i];

        if (line.startsWith('```')) {
            const lineStart = i + 1;
            const block = [];
            i += 1;
            let command = null;
            for (; i < len; ++i) {
                if (lines[i].startsWith('```')) {
                    break;
                } else if (command === null && lines[i].trim().length > 0) {
                    const c = lines[i].trim()[0];
                    if (c >= 'a' && c <= 'z') {
                        command = lines[i].split(':')[0];
                    }
                }
                block.push(lines[i]);
            }
            if (line === '```' || line === '```goml') {
                checkContent(x, block.join('\n'), filePath, lineStart, command);
            }
        }
    }
}

async function checkExamples(x) {
    x.startTestSuite('examples', false);
    print('=> Starting code examples checks...');
    print('');

    const files = getAllFiles(path.join(__dirname, '..'), 0);
    for (const file of files) {
        x.startTestSuite(file);
        try {
            checkFileExamples(x, file);
            x.endTestSuite();
        } catch (err) {
            x.endTestSuite(false, true);
        }
    }

    print('');
    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    return x.getTotalErrors();
}

if (require.main === module) {
    const x = new Assert();
    checkExamples(x).then(nbErrors => {
        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkExamples,
    };
}
