const process = require('process');
const path = require('path');
const os = require('os');
const utils = require('./utils.js');
const print = utils.print;
const consts = require('./consts.js');

const BROWSERS = ['chrome', 'firefox'];

function helper() {
    const browsers = BROWSERS.map(e => `"${e}"`).join(' or ');

    print('Available options:');
    print('');
    print('  --allow-file-access-from-files: Disable CORS errors when testing with local files');
    print(`  --browser [BROWSER NAME]      : Run tests on given browser (${browsers})`);
    print('                                  /!\\ Only testing on chrome is stable!');
    print('  --debug                       : Display more information');
    print('  --disable-fail-on-request-error: If a request failed, it won\'t fail the test');
    print('  --emulate [DEVICE NAME]       : Emulate the given device');
    print('  --enable-screenshot-comparison: Enable screenshot comparisons at the end of the ');
    print('                                  scripts by the end');
    print('  --enable-fail-on-js-error     : If a JS error occurs on a web page, the test will ' +
        'fail');
    print('  --executable-path [PATH]      : Path of the browser\'s executable you want to use');
    print('  --extension [PATH]            : Add an extension to load from the given path');
    print('  --failure-folder [PATH]       : Path of the folder where failed tests image will');
    print('                                  be placed (same as `image-folder` if not provided)');
    print('  --generate-images             : If provided, it\'ll generate missing test images');
    print('  --image-folder [PATH]         : Path of the folder where screenshots will be ' +
        'generated');
    print('                                  (same as `test-folder` if not provided)');
    print('  --incognito                   : Enable incognito mode');
    print('  --jobs [N]                    : Number of parallel jobs, defaults to number of CPUs');
    print('  --no-headless                 : Disable headless mode');
    print('  --no-sandbox                  : Disable the sandbox (use with caution!)');
    print('  --pause-on-error [true|false] : Pause execution script until user press ENTER');
    print('  --permission [PERMISSION]     : Add a permission to enable');
    print('  --run-id [id]                 : Id to be used for failed images extension (\'test\'');
    print('                                  by default)');
    print('  --screenshot-on-failure       : If a test fails, a screenshot will be generated and');
    print('                                  the test execution will be stopped');
    print('  --show-devices                : Show list of available devices');
    print('  --show-text                   : Disable text invisibility (be careful when using ' +
        'it!)');
    print('  --show-permissions            : Show list of available permissions');
    print('  --test-folder [PATH]          : Path of the folder where `.goml` script files are');
    print('  --timeout [MILLISECONDS]      : Set default timeout for all tests');
    print('  --test-files [PATHs]          : List of `.goml` files\' path to be run');
    print('  --variable [name] [value]     : Variable to be used in scripts');
    print('  --version                     : Show the current version of the framework');
    print('  --help | -h                   : Show this text');
}

function showVersion() {
    const package_json = utils.readFile(path.join(__dirname, '..', 'package.json'));
    print(JSON.parse(package_json)['version']);
    process.exit(0);
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
        this.screenshotComparison = false;
        this.noSandbox = false;
        this.allowFileAccessFromFiles = false;
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
        this.failOnJsError = false;
        this.screenshotOnFailure = false;
        this.nbThreads = os.cpus().length;
        // Enabled by default!
        this.failOnRequestError = true;
        this.executablePath = null;
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
        copy.screenshotComparison = this.screenshotComparison;
        copy.noSandbox = this.noSandbox;
        copy.allowFileAccessFromFiles = this.allowFileAccessFromFiles;
        copy.testFiles = JSON.parse(JSON.stringify(this.testFiles));
        copy.variables = JSON.parse(JSON.stringify(this.variables));
        copy.extensions = JSON.parse(JSON.stringify(this.extensions));
        copy.browser = this.browser.slice();
        copy.incognito = this.incognito;
        copy.emulate = this.emulate.slice();
        copy.timeout = this.timeout;
        copy.pauseOnError = this.pauseOnError;
        copy.permissions = JSON.parse(JSON.stringify(this.permissions));
        copy.onPageCreatedCallback = this.onPageCreatedCallback;
        copy.failOnJsError = this.failOnJsError;
        copy.failOnRequestError = this.failOnRequestError;
        copy.executablePath = this.executablePath !== null ? this.executablePath.slice() : null;
        copy.screenshotOnFailure = this.screenshotOnFailure;
        copy.nbThreads = this.nbThreads;
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
            } else if (args[it] === '--enable-screenshot-comparison') {
                this.screenshotComparison = true;
            } else if (args[it] === '--no-sandbox') {
                this.noSandbox = true;
            } else if (args[it] === '--allow-file-access-from-files') {
                this.allowFileAccessFromFiles = true;
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
            } else if (args[it] === '--executable-path') {
                if (it + 1 < args.length) {
                    this.executablePath = args[it + 1];
                    it += 1;
                } else {
                    throw new Error('Missing executable path after `--executable-path` option');
                }
            } else if (args[it] === '--enable-fail-on-js-error') {
                this.failOnJsError = true;
            } else if (args[it] === '--disable-fail-on-request-error') {
                this.failOnRequestError = false;
            } else if (args[it] === '--screenshot-on-failure') {
                this.screenshotOnFailure = true;
            } else if (args[it] === '--version') {
                showVersion();
            } else if (args[it] === '--jobs') {
                if (it + 1 < args.length) {
                    const next = args[it + 1];
                    if (/^\d+$/.test(next)) {
                        this.nbThreads = parseInt(next);
                    } else {
                        throw new Error(
                            `Expected a number after \`--jobs\` option, found \`${next}\``);
                    }
                    if (this.nbThreads < 1) {
                        throw new Error('Number of threads cannot be < 1!');
                    }
                    it += 1;
                } else {
                    throw new Error('Missing number after `--jobs` option');
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
            && this.screenshotComparison === true
            && this.testFolder.length === 0) {
            throw new Error('You need to provide `--failure-folder` or `--test-folder` option if ' +
                '`--enable-screenshot-comparison` option is used!');
        }
        for (const test of this.testFiles) {
            if (test.endsWith('.goml') === false) {
                throw new Error('Only `.goml` script files are allowed in the `--test-files` ' +
                    `option, got \`${test}\``);
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
        validateField('screenshotComparison', 'boolean');
        validateField('browser', 'string');
        validateField('imageFolder', 'string');
        validateField('incognito', 'boolean');
        validateField('emulate', 'string');
        validateField('timeout', 'number');
        validateField('testFiles', 'array');
        validateField('extensions', 'array');
        validateField('permissions', 'array');
        validateField('onPageCreatedCallback', 'function');
        validateField('failOnJsError', 'boolean');
        validateField('failOnRequestError', 'boolean');
        validateField('noSandbox', 'boolean');
        validateField('allowFileAccessFromFiles', 'boolean');
        validateField('screenshotOnFailure', 'boolean');
        validateField('nbThreads', 'number');
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
        if (this.nbThreads < 1) {
            throw new Error('`Options.nbThreads` field cannot be < 1');
        }
    }
}

module.exports = {
    Options: Options,
};
