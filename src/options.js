const utils = require('./utils.js');
const print = utils.print;

const BROWSERS = ['chrome', 'firefox'];

function helper() {
    const browsers = BROWSERS.map(e => `"${e}"`).join(' or ');

    print('tester');
    print('  --test-folder [PATH]     : Path of the folder where `.goml` script files are');
    print('  --image-folder [PATH]    : Path of the folder where screenshots will be put (same as');
    print('                             `test-folder` if not provided)');
    print('  --failure-folder [PATH]  : Path of the folder where failed tests image will');
    print('                             be placed (same as `image-folder` if not provided)');
    print('  --test-files [PATHs]     : List of `.goml` files\' path to be run');
    print('  --run-id [id]            : Id to be used for failed images extension (\'test\'');
    print('                             by default)');
    print('  --variable [name] [value]: Variable to be used in scripts');
    print('  --generate-images        : If provided, it\'ll generate missing test images');
    print('  --no-headless            : Disable headless mode');
    print('  --show-text              : Disable text invisibility (be careful when using it!)');
    print('  --debug                  : Display more information');
    print('  --no-screenshot          : Disable screenshots at the end of the scripts by the end');
    print('  --extension [PATH]       : Add an extension to load from the given path');
    print(`  --browser [BROWSER NAME] : Run tests on given browser (${browsers})`);
    print('                             /!\\ Only testing on chrome is stable!');
    print('  --incognito              : Enable incognito mode');
    print('  --emulate [DEVICE NAME]  : Emulate the given device');
    print('  --help | -h              : Show this text');
}

class Options {
    constructor() {
        this.clear();
    }

    clear() {
        this.runId = 'test';
        this.generateImages = false;
        this.headless = true;
        this.testFolder = '';
        this.failureFolder = '';
        this.imageFolder = '';
        this.showText = false;
        this.debug = false;
        this.noScreenshot = false;
        this.testFiles = [];
        this.variables = {};
        this.extensions = [];
        this.browser = 'chrome';
        this.incognito = false;
        this.emulate = '';
    }

    parseArguments(args = []) {
        let it = 0;
        const addPath = () => {
            if (it + 1 < args.length) {
                const parts = args[it].substr(2).split('-');
                for (let i = 1; i < parts.length; ++i) {
                    parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);
                }
                const field = parts.join('');
                this[field] = args[it + 1];
                it += 1;
            } else {
                throw new Error(`Missing path after \`${args[it]}\` option`);
            }
        };

        for (; it < args.length; ++it) {
            if (args[it] === '--run-id') {
                if (it + 1 < args.length) {
                    this.runId = args[it + 1];
                    if (this.runId.indexOf('/') !== -1) {
                        throw new Error('`--run-id` cannot contain `/` character!');
                    }
                    it += 1;
                } else {
                    throw new Error('Missing id after `--run-id` option');
                }
            } else if (args[it] === '--generate-images') {
                this.generateImages = true;
            } else if (args[it] === '--no-headless') {
                this.headless = false;
            } else if (args[it] === '--show-text') {
                this.showText = true;
            } else if (args[it] === '--debug') {
                this.debug = true;
            } else if (args[it] === '--no-screenshot') {
                this.noScreenshot = true;
            } else if (args[it] === '--incognito') {
                this.incognito = true;
            } else if (args[it] === '--help' || args[it] === '-h') {
                helper();
                return false;
            } else if (['--test-folder', '--failure-folder', '--image-folder']
                .indexOf(args[it]) !== -1) {
                addPath(args[it]);
            } else if (args[it] === '--variable') {
                if (it + 2 < args.length) {
                    this.variables[args[it + 1]] = args[it + 2];
                    it += 2;
                } else if (it + 1 < args.length) {
                    throw new Error('Missing variable value after `--variable` option');
                } else {
                    throw new Error('Missing variable name and value after `--variable` option');
                }
            } else if (args[it] === '--test-files') {
                if (it + 1 >= args.length) {
                    throw new Error('Expected at least one path for `--test-files` option');
                }
                for (it = it + 1; it < args.length; ++it) {
                    if (this.testFiles.indexOf(args[it]) === -1) {
                        this.testFiles.push(args[it]);
                    }
                }
            } else if (args[it] === '--extension') {
                if (it + 1 < args.length) {
                    this.extensions.push(args[it + 1]);
                    it += 1;
                } else {
                    throw new Error('Missing path after `--extension` option');
                }
            } else if (args[it] === '--browser') {
                if (it + 1 < args.length) {
                    if (BROWSERS.indexOf(args[it + 1].trim()) === -1) {
                        const browsers = BROWSERS.map(e => `"${e}"`).join(' or ');
                        throw new Error(`\`--browser\` option only accepts ${browsers} as values,` +
                            ` found \`${args[it + 1]}\``);
                    }
                    this.browser = args[it + 1].trim();
                    it += 1;
                } else {
                    throw new Error('Missing browser name after `--browser` option');
                }
            } else if (args[it] === '--emulate') {
                if (it + 1 < args.length) {
                    this.emulate = args[it + 1].trim();
                    it += 1;
                } else {
                    throw new Error('Missing device name after `--emulate` option');
                }
            } else {
                throw new Error(`Unknown option \`${args[it]}\`\n` +
                    'Use `--help` if you want the list of the available commands');
            }
        }
        return true;
    }

    getImageFolder() {
        return this.imageFolder === '' ? this.testFolder : this.imageFolder;
    }

    getFailureFolder() {
        return this.failureFolder === '' ? this.getImageFolder() : this.failureFolder;
    }

    validate() {
        if (this.testFolder.length === 0 && this.testFiles.length === 0) {
            throw new Error('You need to provide `--test-folder` option or at least one file ' +
                'to test with `--test-files` option!');
        } else if (this.failureFolder.length === 0
            && this.noScreenshot === false
            && this.testFolder.length === 0) {
            throw new Error('You need to provide `--failure-folder` or `--test-folder` option if ' +
                '`--no-screenshot` option isn\'t used!');
        }
        for (let i = 0; i < this.testFiles.length; ++i) {
            if (this.testFiles[i].endsWith('.goml') === false) {
                throw new Error('Only `.goml` script files are allowed in the `--test-files` ' +
                    `option, got \`${this.testFiles[i]}\``);
            }
        }
        this.validateFields();
    }

    validateFields() {
        // Check if variables have the expected types (you never know...).
        const validateField = (fieldName, expectedType) => {
            if (typeof this[fieldName] !== expectedType) {
                throw new Error(`\`Options.${fieldName}\` field is supposed to be a ` +
                    `${expectedType}!`);
            }
        };
        validateField('runId', 'string');
        validateField('generateImages', 'boolean');
        validateField('headless', 'boolean');
        validateField('testFolder', 'string');
        validateField('failureFolder', 'string');
        validateField('showText', 'boolean');
        validateField('debug', 'boolean');
        validateField('noScreenshot', 'boolean');
        validateField('browser', 'string');
        validateField('imageFolder', 'string');
        validateField('incognito', 'boolean');
        validateField('emulate', 'string');
        if (Array.isArray(this.testFiles) !== true) {
            throw new Error('`Options.files` field is supposed to be an array!');
        }
        // eslint-disable-next-line eqeqeq
        if (this.variables.constructor != Object) {
            throw new Error('`Options.variables` field is supposed to be a dictionary-like!');
        }
        if (Array.isArray(this.extensions) !== true) {
            throw new Error('`Options.extensions` field is supposed to be an array!');
        }
        if (BROWSERS.indexOf(this.browser) === -1) {
            const browsers = BROWSERS.map(e => `"${e}"`).join(' or ');
            throw new Error(`\`Options.browser\` field only accepts ${browsers} as values, ` +
                `found ${this.browser}`);
        }
    }
}

module.exports = {
    Options: Options,
};
