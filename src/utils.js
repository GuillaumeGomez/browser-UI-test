const fs = require('fs');
const config = require('./config.js');
const process = require('process');
const {PuppeteerWrapper} = require('./puppeteer-wrapper.js');

String.prototype.replaceAll = function(search, replace_with) {
    return this.split(search).join(replace_with);
};

function addSlash(s) {
    if (!s.endsWith('/') && s.length > 0) {
        return s + '/';
    }
    return s;
}

function getCurrentDir() {
    let dir = process.cwd();
    if (dir.endsWith('/') === true || dir.endsWith('\\') === true) {
        dir = dir.substring(0, dir.length - 1);
    }
    return dir;
}

function readFile(filePath, encoding, callback) {
    if (typeof encoding === 'undefined') {
        encoding = 'utf8';
    }
    if (callback) {
        return fs.readFile(filePath, encoding, callback);
    }
    return fs.readFileSync(filePath, encoding);
}

function print(s, backline = true) {
    if (typeof s === 'string') {
        process.stdout.write(`${s}${backline === true ? '\n' : ''}`);
    }
}

function writeToFile(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
}

function writeObjectToFile(filePath, object) {
    return writeToFile(filePath, JSON.stringify(object));
}

function add_error(output) {
    add_log(output, config.ERROR);
}

function add_warning(output) {
    add_log(output, config.LOG_WARNING);
}

function add_log(output, level) {
    let disp = console.log; // eslint-disable-line
    if (level === config.LOG_ERROR) {
        disp = console.error;
    } else if (level === config.LOG_WARNING) {
        disp = console.warn;
    } else {
        level = config.LOG_NORMAL;
    }
    disp(output);
}

function getVariableValue(variables, variableName, functionArgs = null) {
    if (variableName === 'CURRENT_DIR') {
        return getCurrentDir();
    } else if (functionArgs !== null &&
        Object.prototype.hasOwnProperty.call(functionArgs, variableName)) {
        return functionArgs[variableName];
    } else if (Object.prototype.hasOwnProperty.call(variables, variableName)) {
        return variables[variableName];
    } else if (Object.prototype.hasOwnProperty.call(process.env, variableName)) {
        return process.env[variableName];
    }
    return null;
}

function loadPuppeteerWrapper(options) {
    return new PuppeteerWrapper(options);
}

async function loadPuppeteer(options) {
    const puppeteer = loadPuppeteerWrapper(options);
    await puppeteer.init(options);
    return puppeteer;
}

module.exports = {
    'addSlash': addSlash,
    'getCurrentDir': getCurrentDir,
    'readFile': readFile,
    'writeToFile': writeToFile,
    'add_error': add_error,
    'add_warning': add_warning,
    'add_log': add_log,
    'writeObjectToFile': writeObjectToFile,
    'print': print,
    'getVariableValue': getVariableValue,
    'loadPuppeteer': loadPuppeteer,
    'loadPuppeteerWrapper': loadPuppeteerWrapper,
};
