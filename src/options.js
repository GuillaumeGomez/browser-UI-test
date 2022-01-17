const utils = require('./utils.js');
const print = utils.print;
const consts = require('./consts.js');

const BROWSERS = ['chrome', 'firefox'];

function helper() {
    const browsers = BROWSERS.map(e => `"${e}"`).join(' or ');

    print('Available options:');
    print('');
    print(`  --browser [BROWSER NAME]     : Run tests on given browser (${browsers})`);
    print('                                 /!\\ Only testing on chrome is stable!');
    print('  --debug                      : Display more information');
    print('  --emulate [DEVICE NAME]      : Emulate the given device');
    print('  --extension [PATH]           : Add an extension to load from the given path');
    print('  --failure-folder [PATH]      : Path of the folder where failed tests image will');
    print('                                 be placed (same as `image-folder` if not provided)');
    print('  --image-folder [PATH]        : Path of the folder where screenshots will be put ' +
        '(same as');
    print('                                 `test-folder` if not provided)');
    print('  --incognito                  : Enable incognito mode');
    print('  --generate-images            : If provided, it\'ll generate missing test images');
    print('  --no-headless                : Disable headless mode');
    print('  --no-screenshot              : Disable screenshots at the end of the scripts by the' +
        ' end');
    print('  --pause-on-error [true|false]: Add a permission to enable');
    print('  --permission [PERMISSION]    : Add a permission to enable');
    print('  --run-id [id]                : Id to be used for failed images extension (\'test\'');
    print('                                 by default)');
    print('  --show-devices               : Show list of available devices');
    print('  --show-text                  : Disable text invisibility (be careful when using it!)');
    print('  --show-permissions           : Show list of available permissions');
    print('  --test-folder [PATH]         : Path of the folder where `.goml` script files are');
    print('  --timeout [MILLISECONDS]     : Set default timeout for all tests');
    print('  --test-files [PATHs]         : List of `.goml` files\' path to be run');
    print('  --variable [name] [value]    : Variable to be used in scripts');
    print('  --help | -h                  : Show this text');
}

function showDeviceList(options) {
    const b = utils.loadPuppeteerWrapper(options);
    print('List of available devices:');
    print('');
    const devices = b.puppeteer.devices;
    for (let i = 0; i < devices.length; ++i) {
        print(`"${devices[i].name}"`);
    }
}

function showPermissionsList() {
    print('List of available permissions:');
    print('');
    const permissions = consts.AVAILABLE_PERMISSIONS;
    for (let i = 0; i < permissions.length; ++i) {
        print(`"${permissions[i]}"`);
    }
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
        this.timeout = 30000;
        this.pauseOnError = null;
        this.permissions = [];
        this.onPageCreatedCallback = async function() {};
    }

    clone() {
        const copy = new Options();

        // The VERY boring part.
        copy.runId = this.runId.slice();
        copy.generateImages = this.generateImages;
        copy.headless = this.headless;
        copy.testFolder = this.testFolder.slice();
        copy.failureFolder = this.failureFolder.slice();
        copy.imageFolder = this.imageFolder.slice();
        copy.showText = this.showText;
        copy.debug = this.debug;
        copy.noScreenshot = this.noScreenshot;
        copy.testFiles = JSON.parse(JSON.stringify(this.testFiles));
        copy.variables = JSON.parse(JSON.stringify(this.variables));
        copy.extensions = JSON.parse(JSON.stringify(this.extensions));
        copy.browser = this.browser.slice();
        copy.incognito = this.incognito;
        copy.emulate = this.emulate.slice();
        copy.timeout = this.timeout;
        copy.permissions = JSON.parse(JSON.stringify(this.permissions));
        copy.onPageCreatedCallback = this.onPageCreatedCallback;
        copy.pauseOnError = this.pauseOnError;
        return copy;
    }

    parseArguments(args = []) {
        let showDevices = false;
        let showPermissions = false;
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
            } else if (args[it] === '--pause-on-error') {
                if (it + 1 < args.length) {
                    it += 1;
                    if (['true', 'false'].indexOf(args[it]) === -1) {
                        throw new Error('`--pause-on-error` can only be `true` or `false`!');
                    }
                    this.pauseOnError = args[it] === 'true';
                } else {
                    throw new Error('Missing `true` or `false` after `--pause-on-error` option');
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
            } else if (args[it] === '--no-sandbox') {
                this.noSandbox = true;
            } else if (args[it] === '--incognito') {
                this.incognito = true;
            } else if (args[it] === '--help' || args[it] === '-h') {
                helper();
                return false;
            } else if (args[it] === '--show-devices') {
                showDevices = true;
            } else if (args[it] === '--show-permissions') {
                showPermissions = true;
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
                    throw new Error('Missing extension\'s path after `--extension` option');
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
            } else if (args[it] === '--timeout') {
                if (it + 1 < args.length) {
                    const milliseconds = parseInt(args[it + 1]);
                    if (isNaN(milliseconds) === true) {
                        throw new Error('`--timeout` expected an integer, found `' +
                            `${args[it + 1]}\``);
                    } else if (milliseconds < 0) {
                        throw new Error('Number of milliseconds for `timeout` cannot be < 0!');
                    }
                    this.timeout = milliseconds;
                    it += 1;
                } else {
                    throw new Error('Missing number of milliseconds after `--timeout` option');
                }
            } else if (args[it] === '--permission') {
                if (it + 1 < args.length) {
                    if (this.permissions.indexOf(args[it + 1]) === -1) {
                        this.permissions.push(args[it + 1]);
                    }
                    it += 1;
                } else {
                    throw new Error('Missing permission name after `--permission` option');
                }
            } else {
                throw new Error(`Unknown option \`${args[it]}\`\n` +
                    'Use `--help` if you want the list of the available commands');
            }
        }
        if (showDevices === true) {
            showDeviceList(this);
        }
        if (showPermissions === true) {
            showPermissionsList();
        }
        return showDevices === false && showPermissions === false;
    }

    getImageFolder() {
        return this.imageFolder === '' ? this.testFolder : this.imageFolder;
    }

    getFailureFolder() {
        return this.failureFolder === '' ? this.getImageFolder() : this.failureFolder;
    }

    shouldPauseOnError() {
        return this.pauseOnError === true || this.headless === false && this.pauseOnError === null;
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
            if (expectedType === 'array') {
                if (Array.isArray(this[fieldName]) !== true) {
                    throw new Error(`\`Options.${fieldName}\` field is supposed to be an array!`);
                }
            } else if (typeof this[fieldName] !== expectedType) {
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
        validateField('timeout', 'number');
        validateField('testFiles', 'array');
        validateField('extensions', 'array');
        validateField('permissions', 'array');
        validateField('onPageCreatedCallback', 'function');
        // eslint-disable-next-line eqeqeq
        if (this.variables.constructor != Object) {
            throw new Error('`Options.variables` field is supposed to be a dictionary-like!');
        }
        if (BROWSERS.indexOf(this.browser) === -1) {
            const browsers = BROWSERS.map(e => `"${e}"`).join(' or ');
            throw new Error(`\`Options.browser\` field only accepts ${browsers} as values, ` +
                `found ${this.browser}`);
        }
        if (this.timeout < 0) {
            throw new Error('`Options.timeout` field cannot be < 0');
        }
    }
}

module.exports = {
    Options: Options,
};
