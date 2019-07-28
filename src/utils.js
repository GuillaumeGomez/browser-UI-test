const fs = require('fs');
const execFileSync = require('child_process').execFileSync;
const config = require('./config.js');
const process = require('process');

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
    return addSlash(process.cwd());
}

function readFile(filePath, encoding, callback) {
    if (typeof encoding === 'undefined') {
        encoding = 'utf8';
    }
    if (callback) {
        fs.readFile(filePath, encoding, callback);
    } else {
        return fs.readFileSync(filePath, encoding);
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
    let disp = console.log;
    if (level === config.LOG_ERROR) {
        disp = console.error;
    } else if (level === config.LOG_WARNING) {
        disp = console.warn;
    } else {
        level = config.LOG_NORMAL;
    }
    disp(output);
}

module.exports = {
    addSlash: addSlash,
    getCurrentDir: getCurrentDir,
    readFile: readFile,
    writeToFile: writeToFile,
    add_error: add_error,
    add_warning: add_warning,
    add_log: add_log,
    writeObjectToFile: writeObjectToFile,
};
