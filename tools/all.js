const process = require('process');
const fs = require('fs');
const path = require('path');
const {Assert, print} = require('./utils.js');

const utils = require('../src/utils.js');
utils.print = function() {}; // overwriting the print function to avoid the print

async function runAllTests() {
    const files = [];
    const x = new Assert();
    x.blessEnabled = process.argv.findIndex(arg => arg === '--bless') !== -1;
    if (!x.blessEnabled) {
        x.blessEnabled = process.env.npm_config_bless === 'true';
    }

    return await x.startTestSuite('all', false, async() => {
        print('> Starting all tests...');
        print('');

        fs.readdirSync(__dirname).forEach(function(file) {
            const fullPath = path.join(__dirname, file);
            if (file.endsWith('.js') && file !== 'all.js' && fs.lstatSync(fullPath).isFile()) {
                files.push(fullPath);
            }
        });
        files.sort();
        let tmp;
        for (let i = 0; i < files.length; ++i) {
            try {
                tmp = require(files[i]);
                if (tmp['check'] === undefined) {
                    continue;
                }
            } catch (err) {
                x.addError(`failed to load \`${files[i]}\`: ${err}`);
            }

            try {
                await tmp['check'](x);
            } catch (err) {
                x.addError(`\`${files[i]}\` failed: ${err}\n${err.stack}`);
            }
        }
    });
}

if (require.main === module) {
    runAllTests().then(({totalErrors}) => {
        process.exit(totalErrors !== 0 ? 1 : 0);
    });
} else {
    print('Cannot be used as module!', console.error);
    process.exit(1);
}
