const process = require('process');
const fs = require('fs');
const path = require('path');
const {Assert, plural, print} = require('./utils.js');

const utils = require('../../src/utils.js');
utils.print = function() {}; // overwriting the print function to avoid the print


async function runAllTests() {
    const files = [];
    const x = new Assert();

    x.startTestSuite('all', false);
    print('> Starting all tests...');
    print('');

    fs.readdirSync(__dirname).forEach(function(file) {
        const fullPath = path.join(__dirname, file);
        if (file.endsWith('.js') && fs.lstatSync(fullPath).isFile()) {
            files.push(fullPath);
        }
    });
    files.sort();
    for (let i = 0; i < files.length; ++i) {
        try {
            const tmp = require(files[i]);
            if (tmp['check'] === undefined) {
                continue;
            }
            await tmp['check'](x);
        } catch (err) {
            print(`failed to load \`${files[i]}\`, ignoring it...`);
        }
        print('');
    }

    print('');
    print(`< Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    const errors = x.getTotalErrors();
    x.endTestSuite(false);
    return errors;
}

if (require.main === module) {
    runAllTests().then(nbErrors => {
        process.exit(nbErrors);
    });
} else {
    print('Cannot be used as module!', console.error);
    process.exit(1);
}
