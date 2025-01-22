const {
    Assert,
    print,
    plural,
    API_OUTPUT,
    getAllFiles,
} = require('./utils.js');
const path = require('path');
const fs = require('fs');
const toml = require('@iarna/toml');
const {getCurrentDir, stripCommonPathsPrefix} = require('../src/utils.js');
process.env.debug_tests = '1'; // We enable this to get CODE_WRAPPER from `src/index.js`.
const { CODE_WRAPPER } = require('../src/index.js');

async function checkGeneratedJs(x) {
    const { ESLint } = require('eslint');
    const srcPath = path.join(__dirname, '../src');
    const script = fs.readFileSync(path.join(srcPath, 'helpers.js'), 'utf8');
    const currentDir = getCurrentDir();

    for (const file of getAllFiles(API_OUTPUT)) {
        if (!file.endsWith('.toml')) {
            continue;
        }
        const filePrint = stripCommonPathsPrefix(file, currentDir);
        print(`-> Checking \`${filePrint}\`...`);

        let content;
        try {
            content = toml.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {
            x.addError(`[${filePrint}] Invalid toml: ${e}`);
            continue;
        }
        if (content['instructions'] === undefined) {
            // We add an extra "success" and then we continue.
            x.assert(true);
            continue;
        }
        const full = `\
${script}

${CODE_WRAPPER}

// Start of code.
${content['instructions'].join('\n// ----------\n')}
// End of code.
};`;

        const eslint = new ESLint({
            useEslintrc: false,
            overrideConfig: {
                extends: ['eslint:recommended'],
                parserOptions: {
                    sourceType: 'module',
                    ecmaVersion: '2018',
                },
                env: {
                    node: true,
                    browser: true,
                    es6: true,
                },
                rules: {
                    'no-unused-vars': 'off',
                    'no-useless-escape': 'off',
                    'no-inner-declarations': 'off',
                    'no-constant-condition': ['error', { 'checkLoops': false }],
                },
            },
        });

        const results = await eslint.lintText(full);
        if (results[0].errorCount !== 0 || results[0].fatalErrorCount !== 0) {
            results[0].source = undefined;
            x.addError(`[${file}] Invalid JS: ${JSON.stringify(results[0], null, 2)}

from:
\`\`\`
${full}
\`\`\``);
            return;
        } else {
            x.assert(true);
        }
    }

    return x.getTotalErrors();
}

if (require.main === module) {
    const x = new Assert();
    // The goal in this one is to check that generated JS is valid.
    x.startTestSuite('Generated JS', false);
    print('=> Starting testing generated JS files...');
    checkGeneratedJs(x).then(nbErrors => {
        print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
            `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);
        x.endTestSuite(false);

        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkGeneratedJs,
    };
}
