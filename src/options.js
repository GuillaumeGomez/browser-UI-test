const utils = require('./utils.js');
const print = utils.print;

function helper() {
    print('tester');
    print('  --test-folder [PATH]    : Path of the folder where `.goml` script files are');
    print('  --failure-folder [PATH] : Path of the folder where failed tests image will');
    print('                            be placed');
    print('  --test-files [PATHs]    : List of `.goml` files\' path to be run');
    print('  --run-id [id]           : Id to be used for failed images extension (\'test\'');
    print('                            by default)');
    print('  --generate-images       : If provided, it\'ll generate missing test images');
    print('  --doc-path [PATH]       : Doc path to be used on `goto` local paths');
    print('  --url [URL]             : URL to be used on `goto` urls');
    print('  --no-headless           : Disable headless mode');
    print('  --show-text             : Disable text invisibility (be careful when using it!)');
    print('  --debug                 : Display more information');
    print('  --no-screenshot         : Disable screenshots at the end of the scripts by the end');
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
        this.debug = false;
        this.noScreenshot = false;
        this.url = '';
        this.testFiles = [];
    }

    parseArguments(args = []) {
        for (let it = 0; it < args.length; ++it) {
            if (args[it] === '--run-id') {
                if (it + 1 < args.length) {
                    this.runId = args[it + 1];
                    if (this.runId.indexOf('/') !== -1) {
                        throw new Error('\'--run-id\' cannot contain \'/\' character!');
                    }
                    it += 1;
                } else {
                    throw new Error('Missing id after \'--run-id\' option');
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
            } else if (args[it] === '--help' || args[it] === '-h') {
                helper();
                return false;
            } else if (args[it] === '--test-folder') {
                if (it + 1 < args.length) {
                    this.testFolderPath = args[it + 1];
                    it += 1;
                } else {
                    throw new Error('Missing path after \'--test-folder\' option');
                }
            } else if (args[it] === '--doc-path') {
                if (it + 1 < args.length) {
                    this.docPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw new Error('Missing path after \'--doc-path\' option');
                }
            } else if (args[it] === '--url') {
                if (it + 1 < args.length) {
                    this.url = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw new Error('Missing URL after \'--url\' option');
                }
            } else if (args[it] === '--failure-folder') {
                if (it + 1 < args.length) {
                    this.failuresFolderPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw new Error('Missing path after \'--failure-folder\' option');
                }
            } else if (args[it] === '--test-files') {
                if (it + 1 >= args.length) {
                    throw new Error('Expected at least one path for \'--test-files\' option');
                }
                for (it = it + 1; it < args.length; ++it) {
                    this.testFiles.push(args[it]);
                }
            } else {
                throw new Error(`Unknown option '${args[it]}'\n` +
                    'Use \'--help\' if you want the list of the available commands');
            }
        }
        return true;
    }

    validate() {
        if (this.testFolderPath.length === 0 && this.testFiles.length === 0) {
            throw new Error('You need to provide \'--test-folder\' option or at least one file ' +
                'to test with \'--test-files\' option!');
        } else if (this.failuresFolderPath.length === 0 && this.noScreenshot === false) {
            throw new Error('You need to provide \'--failure-folder\' option if ' +
                '\'--no-screenshot\' isn\'t used!');
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
        validateField('testFolderPath', 'string');
        validateField('docPath', 'string');
        validateField('failuresFolderPath', 'string');
        validateField('showText', 'boolean');
        validateField('debug', 'boolean');
        validateField('noScreenshot', 'boolean');
        validateField('url', 'string');
        if (Array.isArray(this.testFiles) !== true) {
            throw new Error('`Options.files` field is supposed to be an array!');
        }
    }
}

module.exports = {
    Options: Options,
};
