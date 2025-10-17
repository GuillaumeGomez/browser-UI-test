const process = require('process');
const path = require('path');
const os = require('os');
const utils = require('./utils.js');
const print = utils.print;
const consts = require('./consts.js');

const BROWSERS = ['chrome', 'firefox'];

function helper(args) {
    print('Available options:');
    print('');

    const options = Array.from(args.entries());
    options.sort(([a, _v1], [b, _v2]) => {
        if (a > b) {
            return 1;
        } else if (a < b) {
            return -1;
        } else {
            return 0;
        }
    });
    for (const [option_name, value] of options) {
        const extra = value.extra !== undefined ? ' ' + value.extra : '';
        let option = `  ${option_name}${extra}`;
        while (option.length < 32) {
            option += ' ';
        }
        print(`${option}: ${value.help}`);
    }
}

function showVersion() {
    const package_json = utils.readFile(path.join(__dirname, '..', 'package.json'));
    print(JSON.parse(package_json)['version']);
    process.exit(0);
}

function showDeviceList() {
    const b = utils.loadPuppeteerWrapper();
    print('List of available devices:');
    print('');
    const devices = b.puppeteer.KnownDevices;
    for (let i = 0; i < devices.length; ++i) {
        print(`"${devices[i].name}"`);
    }
}

function showPermissionsList() {
    print('List of available permissions:');
    print('');
    const permissions = consts.AVAILABLE_PERMISSIONS;
    for (const permission of permissions) {
        print(`"${permission}"`);
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
        this.allowFileAccessFromFiles = false;
        this.testFiles = [];
        this.variables = new Map();
        this.extensions = [];
        this.browser = 'chrome';
        this.incognito = false;
        this.emulate = '';
        this.emulateMediaFeatures = new Map();
        this.timeout = 30000;
        this.pauseOnError = null;
        this.permissions = [];
        this.onPageCreatedCallback = async function() {};
        this.failOnJsError = true;
        this.screenshotOnFailure = false;
        this.nbThreads = os.cpus().length;
        this.messageFormat = 'human';
        this.displayFormat = 'normal';
        this.filters = [];
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
        copy.allowFileAccessFromFiles = this.allowFileAccessFromFiles;
        copy.testFiles = JSON.parse(JSON.stringify(this.testFiles));
        copy.variables = new Map(
            Object.entries(JSON.parse(JSON.stringify(Object.fromEntries(this.variables)))),
        );
        copy.extensions = JSON.parse(JSON.stringify(this.extensions));
        copy.browser = this.browser.slice();
        copy.incognito = this.incognito;
        copy.emulate = this.emulate.slice();
        copy.emulateMediaFeatures = new Map(Object.entries(
            JSON.parse(JSON.stringify(Object.fromEntries(this.emulateMediaFeatures))),
        ));
        copy.timeout = this.timeout;
        copy.pauseOnError = this.pauseOnError;
        copy.permissions = JSON.parse(JSON.stringify(this.permissions));
        copy.onPageCreatedCallback = this.onPageCreatedCallback;
        copy.failOnJsError = this.failOnJsError;
        copy.failOnRequestError = this.failOnRequestError;
        copy.executablePath = this.executablePath !== null ? this.executablePath.slice() : null;
        copy.screenshotOnFailure = this.screenshotOnFailure;
        copy.nbThreads = this.nbThreads;
        copy.messageFormat = this.messageFormat.slice();
        copy.displayFormat = this.displayFormat.slice();
        copy.filters = this.filters.slice();
        return copy;
    }

    parseArguments(args = []) {
        const browsers = BROWSERS.map(e => `"${e}"`).join(' or ');

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
        const oneArg = (name, accepted) => {
            if (it + 1 >= args.length) {
                throw new Error(`Missing ${name} after \`${args[it]}\` option`);
            }
            it += 1;
            const arg = args[it].trim();
            if (accepted !== undefined) {
                if (!accepted.includes(arg)) {
                    const s = accepted.map(a => `\`${a}\``).join(' or ');
                    throw new Error(`\`${args[it - 1]}\` option only accepts ${s} as value, found` +
                        ` \`${arg}\``);
                }
            }
            return arg;
        };
        const twoArgs = name => {
            if (it + 2 < args.length) {
                const parts = [args[it + 1], args[it + 2]];
                it += 2;
                return parts;
            } else if (it + 1 < args.length) {
                throw new Error(`Missing ${name} value after \`${args[it]}\` option`);
            } else {
                throw new Error(`Missing ${name} name and value after \`${args[it]}\` option`);
            }
        };

        const argsMap = new Map([
            ['--allow-file-access-from-files', {
                'help': 'Disable CORS errors when testing with local files',
                'handler': () => {
                    this.allowFileAccessFromFiles = true;
                },
            }],
            ['--browser', {
                'help': `Run tests on given browser (${browsers}) /!\\ Only testing on chrome` +
                    ' is stable!',
                'extra': '[BROWSER NAME]',
                'handler': () => {
                    this.browser = oneArg('browser name', BROWSERS);
                },
            }],
            ['--debug', {
                'help': 'Display more information',
                'handler': () => {
                    this.debug = true;
                },
            }],
            ['--disable-fail-on-js-error', {
                'help': 'If a JS error occurs on a web page, the test will not fail',
                'handler': () => {
                    this.failOnJsError = false;
                },
            }],
            ['--disable-fail-on-request-error', {
                'help': 'If a request failed, it won\'t fail the test',
                'handler': () => {
                    this.failOnRequestError = false;
                },
            }],
            ['--emulate', {
                'help': 'Emulate the given device',
                'extra': '[DEVICE NAME]',
                'handler': () => this.emulate = oneArg('device name'),
            }],
            ['--emulate-media-feature', {
                'help': 'Add a new `media-feature` to emulate',
                'extra': '[name] [value]',
                'handler': () => {
                    const [key, value] = twoArgs('media feature');
                    if (!utils.ALLOWED_EMULATE_MEDIA_FEATURES_KEYS.includes(key)) {
                        throw new Error(
                            `Unknown key \`${key}\` in \`--emulate-media-feature\` option`);
                    }

                    this.emulateMediaFeatures.set(
                        key,
                        // No need to escape it as it is used "as is" and not in generated JS code.
                        value,
                    );
                },
            }],
            ['--enable-screenshot-comparison', {
                'help': 'Enable screenshot comparisons at the end of the scripts by the end',
                'handler': () => {
                    this.screenshotComparison = true;
                },
            }],
            ['--executable-path', {
                'help': 'Path of the browser\'s executable you want to use',
                'extra': '[PATH]',
                'handler': () => this.executablePath = oneArg('executable path'),
            }],
            ['--extension', {
                'help': 'Add an extension to load from the given path',
                'extra': '[PATH]',
                'handler': () => {
                    const extension = oneArg('extension\'s path');
                    if (this.extensions.indexOf(extension) === -1) {
                        this.extensions.push(extension);
                    }
                },
            }],
            ['--failure-folder', {
                'help': 'Path of the folder where failed tests image will be placed (same as ' +
                    '`image-folder` if not provided)',
                'extra': '[PATH]',
                'handler': addPath,
            }],
            ['--filter', {
                'help': 'Only run test with the provided filters is in their file name (can ' +
                    'be repeated)',
                'extra': '[NAME]',
                'handler': () => {
                    this.filters.push(oneArg('filter'));
                },
            }],
            ['--generate-images', {
                'help': 'If provided, it\'ll generate missing test images',
                'handler': () => {
                    this.generateImages = true;
                },
            }],
            ['--image-folder', {
                'help': 'Path of the folder where screenshots will be generated (same as ' +
                    '`test-folder` if not provided)',
                'extra': '[PATH]',
                'handler': addPath,
            }],
            ['--incognito', {
                'help': 'Enable incognito mode',
                'handler': () => {
                    this.incognito = true;
                },
            }],
            ['--jobs', {
                'help': 'Number of parallel jobs, defaults to number of CPUs',
                'extra': '[N]',
                'handler': () => {
                    const jobs = oneArg('number');
                    if (/^-?\d+$/.test(jobs)) {
                        this.nbThreads = parseInt(jobs);
                    } else {
                        throw new Error(
                            `Expected a number after \`--jobs\` option, found \`${jobs}\``);
                    }
                    if (this.nbThreads < 1) {
                        throw new Error('Number of threads cannot be < 1!');
                    }
                },
            }],
            ['--no-headless', {
                'help': 'Disable headless mode',
                'handler': () => {
                    this.headless = false;
                },
            }],
            ['--display-format', {
                'help': 'If tests should display all information or just the minimum (like ' +
                    'warnings and errors)',
                'extra': '[normal|compact]',
                'handler': () => {
                    this.displayFormat = oneArg('display format', ['normal', 'compact']);
                },
            }],
            ['--message-format', {
                'help': 'In which format the messages (like errors) should be emitted',
                'extra': '[human|json]',
                'handler': () => {
                    this.messageFormat = oneArg('message format', ['human', 'json']);
                },
            }],
            ['--pause-on-error', {
                'help': 'Pause execution script until user press ENTER',
                'extra': '[true|false]',
                'handler': () => {
                    this.pauseOnError = oneArg('`true` or `false`', ['true', 'false']) === 'true';
                },
            }],
            ['--permission', {
                'help': 'Add a permission to enable',
                'extra': '[PERMISSION]',
                'handler': () => {
                    const permission = oneArg('permission name');
                    if (this.permissions.indexOf(permission) === -1) {
                        this.permissions.push(permission);
                    }
                },
            }],
            ['--run-id', {
                'help': 'Id to be used for failed images extension (`test` by default)',
                'extra': '[id]',
                'handler': () => {
                    this.runId = oneArg('id');
                    if (this.runId.includes('/') || this.runId.includes('\\')) {
                        throw new Error('`--run-id` cannot contain `/` or `\\` characters!');
                    }
                },
            }],
            ['--screenshot-on-failure', {
                'help': 'If a test fails, a screenshot will be generated and the test ' +
                    'execution will be stopped',
                'handler': () => {
                    this.screenshotOnFailure = true;
                },
            }],
            ['--show-devices', {
                'help': 'Show list of available devices',
                'handler': () => {
                    showDevices = true;
                },
            }],
            ['--show-text', {
                'help': 'Disable text invisibility (be careful when using it!)',
                'handler': () => {
                    this.showText = true;
                },
            }],
            ['--show-permissions', {
                'help': 'Show list of available permissions',
                'handler': () => {
                    showPermissions = true;
                },
            }],
            ['--test-folder', {
                'help': 'Path of the folder where `.goml` script files are',
                'extra': '[PATH]',
                'handler': addPath,
            }],
            ['--timeout', {
                'help': 'Set default timeout for all tests',
                'extra': '[MILLISECONDS]',
                'handler': () => {
                    const milliseconds = oneArg('number of milliseconds');
                    if (/^-?\d+$/.test(milliseconds)) {
                        this.timeout = parseInt(milliseconds);
                    } else {
                        throw new Error(
                            `\`--timeout\` expected an integer, found \`${milliseconds}\``);
                    }
                    if (this.timeout < 0) {
                        throw new Error('Number of milliseconds for `timeout` cannot be < 0!');
                    }
                },
            }],
            ['--test-file', {
                'help': 'Add the given path to the list of tests to be run (can be repeated)',
                'extra': '[PATH]',
                'handler': () => {
                    const test = oneArg('test file');
                    if (this.testFiles.indexOf(test) === -1) {
                        this.testFiles.push(test);
                    }
                },
            }],
            ['--variable', {
                'help': 'Variable to be used in scripts',
                'extra': '[name] [value]',
                'handler': () => {
                    const [name, value] = twoArgs('variable');
                    this.variables.set(name, utils.escapeBackslahes(value));
                },
            }],
            ['--version', {
                'help': 'Show the current version of the framework',
                'handler': () => {
                    showVersion();
                    return false;
                },
            }],
            ['--help', {
                'help': 'Show this text',
                'handler': () => {
                    helper(argsMap);
                    return false;
                },
            }],
        ]);

        for (; it < args.length; ++it) {
            if (!argsMap.has(args[it])) {
                throw new Error(`Unknown option \`${args[it]}\`\n` +
                    'Use `--help` if you want the list of the available commands');
            }
            if (argsMap.get(args[it]).handler() === false) {
                return false;
            }
        }

        if (showDevices === true) {
            showDeviceList();
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
                'to test with `--test-file` option!');
        } else if (this.failureFolder.length === 0
            && this.screenshotComparison === true
            && this.testFolder.length === 0) {
            throw new Error('You need to provide `--failure-folder` or `--test-folder` option if ' +
                '`--enable-screenshot-comparison` option is used!');
        }
        for (const test of this.testFiles) {
            if (test.endsWith('.goml') === false) {
                throw new Error('Only `.goml` script files are allowed in the `--test-file` ' +
                    `option, got \`${test}\``);
            }
        }
        this.validateFields();
    }

    isJsonOutput() {
        return this.messageFormat === 'json';
    }

    isCompactDisplay() {
        return this.displayFormat === 'compact';
    }

    validateFields() {
        // Check if variables have the expected types (you never know...).
        const validateField = (fieldName, expectedType) => {
            if (expectedType === 'array') {
                if (Array.isArray(this[fieldName]) !== true) {
                    throw new Error(`\`Options.${fieldName}\` field is supposed to be an array! ` +
                        `(Type is ${typeof this[fieldName]})`);
                }
            } else if (typeof this[fieldName] !== expectedType) {
                throw new Error(`\`Options.${fieldName}\` field is supposed to be a ` +
                    `${expectedType}! (Type is ${typeof this[fieldName]})`);
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
        validateField('allowFileAccessFromFiles', 'boolean');
        validateField('screenshotOnFailure', 'boolean');
        validateField('nbThreads', 'number');
        validateField('messageFormat', 'string');
        validateField('displayFormat', 'string');
        validateField('filters', 'array');
        if (!(this.variables instanceof Map)) {
            throw new Error('`Options.variables` field is supposed to be a `Map`! ' +
                `(Type is ${typeof this.variables})`);
        }
        if (!(this.emulateMediaFeatures instanceof Map)) {
            throw new Error('`Options.emulateMediaFeatures` field is supposed to be a ' +
                `\`Map\`! (Type is ${typeof this.emulateMediaFeatures})`);
        }
        for (const key of this.emulateMediaFeatures.keys()) {
            if (!utils.ALLOWED_EMULATE_MEDIA_FEATURES_KEYS.includes(key)) {
                throw new Error(`Unknown key \`${key}\` in \`Options.emulateMediaFeatures\` field`);
            }
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
