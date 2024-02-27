const fs = require('fs');
const config = require('./config.js');
const path = require('path');
const process = require('process');
const {PuppeteerWrapper} = require('./puppeteer-wrapper.js');

const RESERVED_VARIABLE_NAME = 'CURRENT_DIR';

String.prototype.replaceAll = function(search, replace_with) {
    return this.split(search).join(replace_with);
};

function addSlash(s) {
    if (!s.endsWith('/') && !s.endsWith('\\') && s.length > 0) {
        return s + '/';
    }
    return s;
}

function escapeBackslahes(s) {
    return s.split('\\').join('\\\\');
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
    if (variableName === RESERVED_VARIABLE_NAME) {
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

function extractFileNameWithoutExtension(filePath) {
    return path.parse(filePath).name;
}

function loadPuppeteerWrapper() {
    return new PuppeteerWrapper();
}

function compareArrays(a1, a2) {
    if (!(a1 instanceof Array) || !(a2 instanceof Array) || a1.length !== a2.length) {
        return false;
    }
    for (let i = 0, len = a1.length; i < len; i++) {
        if (a1[i] instanceof Array) {
            if (a2[i] instanceof Array) {
                if (!compareArrays(a1[i], a2[i])) {
                    return false;
                }
            } else {
                return false;
            }
        // eslint-disable-next-line eqeqeq
        } else if (a1[i] != a2[i]) {
            return false;
        }
    }
    return true;
}

async function loadPuppeteer(options) {
    const puppeteer = loadPuppeteerWrapper();
    await puppeteer.init(options);
    return puppeteer;
}

function splitPath(path) {
    const pathParts = [];

    let start = 0;
    let i = 0;
    for (; i < path.length; ++i) {
        if (path[i] === '/' || path[i] === '\\') {
            const p = path.slice(start, i);
            if (p.length !== 0) {
                pathParts.push(p);
            }
            start = i + 1;
        }
    }
    if (start < i) {
        pathParts.push(path.slice(start, i));
    }
    return pathParts;
}

function stripCommonPathsPrefix(path, path2 = null) {
    if (path === null) {
        return '';
    } else if (path2 === null) {
        path2 = getCurrentDir();
    }
    const pathParts = splitPath(path);
    if (pathParts.length === 0) {
        return path;
    }
    const pathParts2 = splitPath(path2);

    let i = 0;
    for (; i < pathParts.length && i < pathParts2.length; ++i) {
        if (pathParts[i] !== pathParts2[i]) {
            return pathParts.slice(i, pathParts.length).join('/');
        }
    }
    if (i < pathParts.length) {
        return pathParts.slice(i, pathParts.length).join('/');
    }
    return pathParts[pathParts.length - 1];
}

function plural(x, nb) {
    if (nb !== 1) {
        return `${x}s`;
    }
    return x;
}

function hasError(x) {
    return x.error !== undefined && x.error !== null;
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
    // Used in `options.js` for function `showDeviceList()`.
    'loadPuppeteerWrapper': loadPuppeteerWrapper,
    'RESERVED_VARIABLE_NAME': RESERVED_VARIABLE_NAME,
    'escapeBackslahes': escapeBackslahes,
    'extractFileNameWithoutExtension': extractFileNameWithoutExtension,
    'compareArrays': compareArrays,
    'stripCommonPathsPrefix': stripCommonPathsPrefix,
    'plural': plural,
    'hasError': hasError,
};
