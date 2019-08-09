const utils = require('./utils.js');
const print = utils.print;

function helper() {
    print('tester');
    print('  --test-folder [PATH]    : Path of the folder where `.goml` script files are');
    print('  --failure-folder [PATH] : Path of the folder where failed tests image will');
    print('                            be placed');
    print('  --run-id [id]           : Id to be used for failed images extension (\'test\'');
    print('                            by default)');
    print('  --generate-images       : If provided, it\'ll generate test images and won\'t');
    print('                            run comparison tests');
    print('  --doc-path [PATH]       : Doc path to be used on `goto` local paths');
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
    }

    parseArguments(args = []) {
        for (let it = 0; it < args.length; ++it) {
            if (args[it] === '--run-id') {
                if (it + 1 < args.length) {
                    this.runId = args[it + 1];
                    if (this.runId.indexOf('/') !== -1) {
                        throw '\'--run-id\' cannot contain \'/\' character!';
                    }
                    it += 1;
                } else {
                    throw 'Missing id after \'--run-id\' option';
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
                    this.testFolderPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw 'Missing path after \'--test-folder\' option';
                }
            } else if (args[it] === '--doc-path') {
                if (it + 1 < args.length) {
                    this.docPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw 'Missing path after \'--doc-path\' option';
                }
            } else if (args[it] === '--failure-folder') {
                if (it + 1 < args.length) {
                    this.failuresFolderPath = utils.addSlash(args[it + 1]);
                    it += 1;
                } else {
                    throw 'Missing path after \'--failure-folder\' option';
                }
            } else {
                throw `Unknown option '${args[it]}'\n` +
                        'Use \'--help\' if you want the list of the available commands';
            }
        }
        return true;
    }

    validate() {
        if (this.testFolderPath.length === 0) {
            throw 'You need to provide \'--test-folder\' option!';
        } else if (this.failuresFolderPath.length === 0) {
            throw 'You need to provide \'--failure-folder\' option!';
        }
    }
}

module.exports = {
    Options: Options,
};
