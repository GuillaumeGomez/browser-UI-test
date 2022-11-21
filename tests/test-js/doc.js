const fs = require('fs');
const path = require('path');
const { ORDERS } = require('../../src/commands.js');
const docFile = path.join(__dirname, '../../goml-script.md');

const {Assert, print} = require('./utils.js');

function compareCommands(x, commands) {
    print(`Checking ${commands.length} commands from documentation (\
${Object.keys(ORDERS).length} in the code)`);

    for (const key of Object.keys(ORDERS)) {
        x._addTest();
        if (commands.indexOf(key) === -1) {
            x.addError(`\`${key}\` missing from the documentation in \`${docFile}\``);
        }
    }
    for (const key of commands) {
        x._addTest();
        if (!Object.prototype.hasOwnProperty.call(ORDERS, key)) {
            x.addError(`\`${key}\` present in \`${docFile}\` but doesn't exist`);
        }
    }
}

function checkDoc(x = new Assert()) {
    x.startTestSuite('doc items', false);
    print('=> Starting doc tests...');
    print('');

    let output;
    try {
        output = fs.readFileSync(docFile, 'utf8');
    } catch (_) {
        x.addError(`Cannot open file \`${docFile}\``);
        return 1;
    }

    const lines = output.split('\n');
    let pos = 0;
    const commands = [];

    while (pos < lines.length) {
        if (lines[pos].endsWith('# Command list')) {
            while (pos < lines.length && !lines[pos].trim().startsWith('* [`')) {
                pos += 1;
            }
            while (pos < lines.length) {
                const line = lines[pos].trim();
                if (!line.startsWith('* [`')) {
                    break;
                }
                commands.push(line.split('`')[1]);
                pos += 1;
            }
            compareCommands(x, commands);
            // Now checking that all items have a section and that all sections have an item.
            while (pos < lines.length) {
                const line = lines[pos].trim();
                if (line.startsWith('####')) {
                    const parts = line.split('#');
                    const command = parts[parts.length - 1].trim();
                    const index = commands.indexOf(command);
                    if (index === -1) {
                        x.addError(`Section \`${command}\` isn't listed in the command list`);
                    } else {
                        x._addTest();
                        commands.splice(index, 1);
                    }
                }
                pos += 1;
            }
            for (const command of commands) {
                x.addError(`Listed command \`${command}\` doesn't have a section`);
            }
            break;
        }
        pos += 1;
    }
    if (x.getTotalRanTests() === 0) {
        x.addError('No commands found in doc...');
    }
    const errors = x.getTotalErrors();
    x.endTestSuite(false);
    return errors;
}

if (require.main === module) {
    process.exit(checkDoc() !== 0 ? 1 : 0);
} else {
    module.exports = {
        'check': checkDoc,
    };
}
