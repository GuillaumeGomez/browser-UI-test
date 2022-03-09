const {Parser, cleanString} = require('./parser.js');
const consts = require('./consts.js');

const COLOR_CHECK_ERROR = '`show-text: true` needs to be used before checking for `color` ' +
'(otherwise the browser doesn\'t compute it)';

function getAndSetElements(selector, varName, checkAllElements) {
    let code;
    if (selector.isXPath) {
        code = `let ${varName} = await page.$x("${selector.value}");\n` +
        `if (${varName}.length === 0) { throw 'XPath "${selector.value}" not found'; }\n`;
        if (!checkAllElements) {
            code += `${varName} = ${varName}[0];\n`;
        }
    } else if (!checkAllElements) {
        code = `let ${varName} = await page.$("${selector.value}");\n` +
        `if (${varName} === null) { throw '"${selector.value}" not found'; }\n`;
    } else {
        code = `let ${varName} = await page.$$("${selector.value}");\n` +
        `if (${varName}.length === 0) { throw '"${selector.value}" not found'; }\n`;
    }
    return code;
}

function checkIntegerTuple(tuple, text1, text2, negativeCheck = false) {
    const value = tuple.getRaw();
    if (value.length !== 2 || value[0].kind !== 'number' || value[1].kind !== 'number') {
        return {
            'error': 'invalid syntax: expected "([number], [number])", ' +
                `found \`${tuple.getText()}\``,
        };
    }
    const ret = value[0].getIntegerValue(text1, negativeCheck);
    if (ret.error !== undefined) {
        return ret;
    }
    const ret2 = value[1].getIntegerValue(text2, negativeCheck);
    if (ret2.error !== undefined) {
        return ret2;
    }
    return {'value': [ret.value, ret2.value]};
}

function validateJson(json, allowedValueTypes, keyName) {
    const entries = {};
    const warnings = [];

    for (let i = 0; i < json.length; ++i) {
        const entry = json[i];

        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getText()}\``);
            continue;
        } else if (allowedValueTypes.indexOf(entry['value'].kind) === -1) {
            let allowed = '';
            for (i = 0; i < allowedValueTypes.length - 1; ++i) {
                if (allowed.length !== 0) {
                    allowed += ', ';
                }
                allowed += allowedValueTypes[i];
            }
            if (allowed.length !== 0) {
                allowed += ' and ';
            }
            allowed += allowedValueTypes[allowedValueTypes.length - 1];
            const article = allowedValueTypes.length > 1 ? 'are' : 'is';
            return {
                'error': `only ${allowed} ${article} allowed, found \`` +
                    `${entry['value'].getText()}\` (${entry['value'].getArticleKind()})`,
            };
        }
        const key_s = entry['key'].getStringValue();
        if (Object.prototype.hasOwnProperty.call(entries, key_s)) {
            return {
                'error': `${keyName} \`${key_s}\` is duplicated`,
            };
        }
        const value_s = entry['value'].getStringValue();
        entries[key_s] = value_s;
    }
    return {
        'values': entries,
        'warnings': warnings.length > 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseClick(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a position or a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1) {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'string') {
        const selector = elems[0].getSelector();
        if (selector.error !== undefined) {
            return selector;
        }
        const varName = 'parseClickVar';
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) +
                `await ${varName}.click();`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``};
    }
    const ret = checkIntegerTuple(elems[0], 'X position', 'Y position');
    if (ret.error !== undefined) {
        return ret;
    }
    const [x, y] = ret.value;
    return {
        'instructions': [
            `await page.mouse.click(${x},${y});`,
        ],
    };
}

// Possible inputs:
//
// * Number of milliseconds
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//a")
function parseWaitFor(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected an integer or a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1) {
        return {
            'error': 'expected an integer or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'number') {
        const ret = elems[0].getIntegerValue('number of milliseconds', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                `await page.waitFor(${ret.value});`,
            ],
            'wait': false,
        };
    } else if (elems[0].kind !== 'string') {
        return {
            'error': 'expected an integer or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const selector = elems[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    let instructions;
    if (selector.isXPath) {
        instructions = [
            `await page.waitForXPath("${selector.value}");`,
        ];
    } else {
        instructions = [
            `await page.waitForSelector("${selector.value}");`,
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
    };
}

// Possible inputs:
//
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseFocus(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'string') {
        return {'error': `expected a CSS selector or an XPath, found \`${parser.getRawArgs()}\``};
    }
    const selector = elems[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    if (selector.isXPath) {
        const varName = 'parseFocusVar';
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) +
                `await ${varName}.focus();`,
            ],
        };
    }
    return {
        'instructions': [
            `await page.focus("${selector.value}");`,
        ],
    };
}

// Possible inputs:
//
// * ("CSS selector" or "XPath", "text")
// * ("CSS selector" or "XPath", keycode)
// * "text" (in here, it'll write into the current focused element)
// * keycode (in here, it'll write the given keycode into the current focused element)
function parseWrite(parser) {
    const err = 'expected "string" or integer or ("CSS selector" or "XPath", "string") or ' +
        '("CSS selector" or "XPath", integer)';
    const elems = parser.elems;

    if (elems.length !== 1) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1) {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string') {
        return {
            'instructions': [
                `await page.keyboard.type("${elems[0].getStringValue()}");`,
            ],
        };
    } else if (elems[0].kind === 'number') {
        const ret = elems[0].getIntegerValue('keycode', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                `await page.keyboard.press(String.fromCharCode(${ret.value}));`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'invalid number of arguments in tuple, ' + err,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected a CSS selector or an XPath as tuple first argument, found ' +
                tuple[0].getArticleKind(),
        };
    } else if (tuple[1].kind !== 'string' && tuple[1].kind !== 'number') {
        return {
            'error': 'expected a string or an integer as tuple second argument, found ' +
                tuple[1].getArticleKind(),
        };
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const varName = 'parseWriteVar';
    if (tuple[1].kind === 'string') {
        if (selector.isXPath) {
            return {
                'instructions': [
                    getAndSetElements(selector, varName, false) +
                    `await ${varName}.type("${tuple[1].getStringValue()}");`,
                ],
            };
        }
        return {
            'instructions': [
                `await page.type("${selector.value}", "${tuple[1].getStringValue()}");`,
            ],
        };
    }
    const ret = tuple[1].getIntegerValue('keycode', true);
    if (ret.error !== undefined) {
        return ret;
    }
    if (selector.isXPath) {
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) +
                `${varName}.focus();`,
                `await page.keyboard.press(String.fromCharCode(${ret.value}));`,
            ],
        };
    }
    return {
        'instructions': [
            `await page.focus("${selector.value}");`,
            `await page.keyboard.press(String.fromCharCode(${ret.value}));`,
        ],
    };
}


// Possible inputs:
//
// * ("key", delay)
// * (keycode, delay)
// * "key"
// * keycode
//
// The key codes (both strings and integers) can be found here:
// https://github.com/puppeteer/puppeteer/blob/v1.14.0/lib/USKeyboardLayout.js
function parsePressKey(parser) {
    const elems = parser.elems;
    const err = 'expected [string] or [integer] or ([string], [integer]) or ([integer], [integer])';

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1) {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string') {
        const s = elems[0].getStringValue();
        if (s.length === 0) {
            return {'error': 'key cannot be empty'};
        }
        return {
            'instructions': [
                `await page.keyboard.press("${s}")`,
            ],
        };
    } else if (elems[0].kind === 'number') {
        const ret = elems[0].getIntegerValue('keycode', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                'await page.keyboard.press(String.fromCharCode' +
                `(${ret.value}))`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'invalid number of arguments in tuple, ' + err,
        };
    } else if (tuple[0].kind !== 'string' && tuple[0].kind !== 'number') {
        return {
            'error': 'expected a string or an integer as tuple first argument, found ' +
                tuple[0].getArticleKind(),
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error':
            `expected an integer as tuple second argument, found ${tuple[1].getArticleKind()}`,
        };
    }
    // First we get the delay value.
    const ret = tuple[1].getIntegerValue('delay', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const delay = `, ${ret.value}`;

    // Then we get the keycode.
    if (tuple[0].kind === 'string') {
        const s = tuple[0].getStringValue();
        if (s.length === 0) {
            return {'error': 'key cannot be empty'};
        }
        return {
            'instructions': [
                `await page.keyboard.press("${s}"${delay})`,
            ],
        };
    }
    const ret2 = tuple[0].getIntegerValue('keycode', true);
    if (ret2.error !== undefined) {
        return ret2;
    }
    return {
        'instructions': [
            `await page.keyboard.press(String.fromCharCode(${ret2.value})${delay})`,
        ],
    };
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseMoveCursorTo(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a position or a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1) {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'string') {
        const selector = elems[0].getSelector();
        if (selector.error !== undefined) {
            return selector;
        }
        if (selector.isXPath) {
            const varName = 'parseMoveCursorToVar';
            return {
                'instructions': [
                    getAndSetElements(selector, varName, false) +
                    `await ${varName}.hover();`,
                ],
            };
        }
        return {
            'instructions': [
                `await page.hover("${selector.value}");`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const ret = checkIntegerTuple(elems[0], 'X position', 'Y position', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const [x, y] = ret.value;
    return {
        'instructions': [
            `await page.mouse.move(${x},${y});`,
        ],
    };
}

// Possible inputs:
//
// * relative path (example: ../struct.Path.html)
// * full URL (for example: https://doc.rust-lang.org/std/struct.Path.html)
// * local path (example: file://some-file.html)
function parseGoTo(parser) {
    if (parser.elems.length === 0) {
        return {'error': 'Expected a URL, found nothing'};
    } else if (parser.elems.length !== 1) {
        return {'error': `Expected a URL, found \`${parser.getRawArgs()}\``};
    }
    // There will always be one element...
    const line = parser.elems[0].getRaw();
    const permissions = 'await arg.browser.overridePermissions(page.url(), arg.permissions);';
    // We just check if it goes to an HTML file, not checking much though...
    if (line.startsWith('http://') === true
        || line.startsWith('https://') === true
        || line.startsWith('www.') === true
        || line.startsWith('file://') === true) {
        return {
            'instructions': [
                `await page.goto("${cleanString(line)}");`,
                permissions,
            ],
        };
    } else if (line.startsWith('.')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"/${cleanString(line)}");`,
                permissions,
            ],
        };
    } else if (line.startsWith('/')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"${cleanString(line)}");`,
                permissions,
            ],
        };
    }
    return {'error': `a relative path or a full URL was expected, found \`${line}\``};
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseScrollTo(parser) {
    return parseMoveCursorTo(parser); // The page will scroll to the element
}

// Possible inputs:
//
// * (width, height)
function parseSize(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected `([number], [number])`, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected \`([number], [number])\`, found \`${parser.getRawArgs()}\``};
    }
    const ret = checkIntegerTuple(elems[0], 'width', 'height', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const [width, height] = ret.value;
    return {
        'instructions': [
            `await page.setViewport({width: ${width}, height: ${height}})`,
        ],
    };
}

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseLocalStorage(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected JSON, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'json') {
        return {'error': `expected JSON, found \`${parser.getRawArgs()}\``};
    }
    const json = elems[0].getRaw();
    const content = [];
    let warnings = [];

    for (let i = 0; i < json.length; ++i) {
        const entry = json[i];

        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getText()}\``);
            continue;
        } else if (entry['key'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getText()}\``);
            continue;
        }
        const key_s = entry['key'].getStringValue();
        const value_s = entry['value'].getStringValue();
        if (entry['value'].kind === 'ident') {
            if (value_s !== 'null') {
                return {'error': `Only \`null\` ident is allowed, found \`${value_s}\``};
            }
            content.push(`localStorage.removeItem("${key_s}");`);
        } else {
            content.push(`localStorage.setItem("${key_s}", "${value_s}");`);
        }
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (content.length === 0) {
        return {
            'instructions': [],
            'warnings': warnings,
        };
    }
    return {
        'instructions': [
            `await page.evaluate(() => {\n${content.join('\n')}\n})`,
        ],
        'warnings': warnings,
    };
}

function getInsertStrings(assertFalse, insideLoop) {
    const insertBefore = 'try {\n';

    if (assertFalse) {
        if (insideLoop) {
            // We want to check ALL elements, not return at the first successful one!
            return [insertBefore, '\n} catch(e) { continue; } throw "assert didn\'t fail";'];
        } else {
            return [insertBefore, '\n} catch(e) { return; } throw "assert didn\'t fail";'];
        }
    }
    return ['', ''];
}

function getAssertSelector(parser) {
    const err = 'expected a tuple, read the documentation to see the accepted inputs';
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length < 2 || tuple.length > 3) {
        return {'error': 'invalid number of values in the tuple, read the documentation to see ' +
                    'the accepted inputs'};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': `expected JSON dictionary as second argument, found \`${tuple[1].getText()}\``,
        };
    } else if (tuple.length === 3) {
        if (tuple[2].kind !== 'ident') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${tuple[2].getRaw()}\``,
            };
        } else if (tuple[2].getRaw() !== 'ALL') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${tuple[2].getRaw()}\``,
            };
        }
    }

    const selector = tuple[0].getSelector();
    if (tuple.length === 3) {
        // We already checked it above so let's go!
        selector.checkAllElements = true;
    }
    selector.tuple = tuple;
    return selector;
}

function parseAssertCssInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }
    const checkAllElements = selector.checkAllElements;
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const xpath = selector.isXPath ? 'XPath ' : 'selector ';
    const pseudo = !selector.isXPath && selector.pseudo !== null ?
        `, "${selector.pseudo}"` : '';

    const json = selector.tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'CSS property');

    if (entries.error !== undefined) {
        return entries;
    } else if (entries.values.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': entries.warnings,
            'checkResult': true,
        };
    }
    const varName = 'parseAssertElemCss';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';
    let needColorCheck = false;
    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (v.length === 0) {
            return {
                'error': `Empty values are not allowed: \`${k}\` has an empty value`,
            };
        } else if (k.length === 0) {
            return {
                'error': 'Empty CSS property keys ("" or \'\') are not allowed',
            };
        }
        if (k === 'color') {
            needColorCheck = true;
        }
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }
    // This allows to round values in pixels to make checks simpler in case it's a decimal.
    const extra = `\
if (typeof assertComputedStyle[${varKey}] === "string" && \
assertComputedStyle[${varKey}].search(/^(\\d+\\.\\d+px)$/g) === 0) {
    if (browserUiTestHelpers.extractFloat(assertComputedStyle[${varKey}], true) + "px" !== \
${varValue}) {
        throw 'expected \`' + ${varValue} + '\` for key \`' + ${varKey} + '\` for ${xpath}\
\`${selector.value}\`, found \`' + assertComputedStyle[${varKey}] + '\` (or \`' + \
browserUiTestHelpers.extractFloat(assertComputedStyle[${varKey}], true) + 'px\`)';
    }
    continue;
}`;
    const code = `const ${varDict} = {${d}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${insertBefore}if (e.style[${varKey}] != ${varValue} && \
assertComputedStyle[${varKey}] != ${varValue}) {
${extra}
throw 'expected \`' + ${varValue} + '\` for key \`' + ${varKey} + '\` for ${xpath}\
\`${selector.value}\`, found \`' + assertComputedStyle[${varKey}] + '\`';
}${insertAfter}
}\n`;

    const instructions = [];
    if (needColorCheck) {
        instructions.push('if (!arg.showText) {\n' +
            `throw "${COLOR_CHECK_ERROR}";\n` +
            '}',
        );
    }
    if (!checkAllElements) {
        instructions.push(getAndSetElements(selector, varName, checkAllElements) +
            'await page.evaluate(e => {\n' +
            `let assertComputedStyle = getComputedStyle(e${pseudo});\n${code}` +
            `}, ${varName});`,
        );
    } else {
        instructions.push(getAndSetElements(selector, varName, checkAllElements) +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                'await page.evaluate(e => {\n' +
                `let assertComputedStyle = getComputedStyle(e${pseudo});\n${code}` +
                `}, ${varName}[i]);\n` +
            '}',
        );
    }
    return {
        'instructions': instructions,
        'wait': false,
        'warnings': entries.warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", {"css property": "value"})
// * ("XPath", {"css property": "value"})
// * ("CSS", {"css property": "value"}, ALL)
// * ("XPath", {"css property": "value"}, ALL)
function parseAssertCss(parser) {
    return parseAssertCssInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", {"css property": "value"})
// * ("XPath", {"css property": "value"})
// * ("CSS", {"css property": "value"}, ALL)
// * ("XPath", {"css property": "value"}, ALL)
function parseAssertCssFalse(parser) {
    return parseAssertCssInner(parser, true);
}

function parseAssertPropertyInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }
    const checkAllElements = selector.checkAllElements;
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const json = selector.tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'property');
    if (entries.error !== undefined) {
        return entries;
    }

    if (entries.values.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': entries.warnings,
            'checkResult': true,
        };
    }
    const varName = 'parseAssertElemProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';
    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }
    const code = `const ${varDict} = {${d}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${insertBefore}\
if (e[${varKey}] === undefined || String(e[${varKey}]) != ${varValue}) {
throw 'expected \`' + ${varValue} + '\` for property \`' + ${varKey} + '\` for ${xpath}\
\`${selector.value}\`, found \`' + e[${varKey}] + '\`';
}${insertAfter}
}\n`;

    let instructions;
    if (!checkAllElements) {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            `await ${varName}.evaluate(e => {\n` +
                `${code}` +
            '});',
        ];
    } else {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                `await ${varName}[i].evaluate(e => {\n` +
                    `${code}` +
                '});\n' +
            '}',
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
        'warnings': entries.warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", {"DOM property": "value"})
// * ("XPath", {"DOM property": "value"})
// * ("CSS", {"DOM property": "value"}, ALL)
// * ("XPath", {"DOM property": "value"}, ALL)
function parseAssertProperty(parser) {
    return parseAssertPropertyInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", {"DOM property": "value"})
// * ("XPath", {"DOM property": "value"})
// * ("CSS", {"DOM property": "value"}, ALL)
// * ("XPath", {"DOM property": "value"}, ALL)
function parseAssertPropertyFalse(parser) {
    return parseAssertPropertyInner(parser, true);
}

function parseAssertAttributeInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }
    const checkAllElements = selector.checkAllElements;
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const json = selector.tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'attribute');

    if (entries.error !== undefined) {
        return entries;
    } else if (entries.values.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': entries.warnings,
            'checkResult': true,
        };
    }

    const varName = 'parseAssertElemAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Attribute';
    const varValue = varName + 'Value';

    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }

    const code = `const ${varDict} = {${d}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${insertBefore}if (e.getAttribute(${varKey}) !== ${varValue}) {
throw 'expected \`' + ${varValue} + '\` for attribute \`' + ${varKey} + '\` for ${xpath}\
\`${selector.value}\`, found \`' + e.getAttribute(${varKey}) + '\`';
}${insertAfter}
}\n`;

    let instructions;
    if (!checkAllElements) {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            'await page.evaluate(e => {\n' +
            code +
            `}, ${varName});`,
        ];
    } else {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                'await page.evaluate(e => {\n' +
                code +
                `}, ${varName}[i]);\n` +
            '}',
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
        'warnings': entries.warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", {"css property": "value"})
// * ("XPath", {"css property": "value"})
// * ("CSS", {"css property": "value"}, ALL)
// * ("XPath", {"css property": "value"}, ALL)
function parseAssertAttribute(parser) {
    return parseAssertAttributeInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", {"css property": "value"})
// * ("XPath", {"css property": "value"})
// * ("CSS", {"css property": "value"}, ALL)
// * ("XPath", {"css property": "value"}, ALL)
function parseAssertAttributeFalse(parser) {
    return parseAssertAttributeInner(parser, true);
}

function parseAssertCountInner(parser, assertFalse) {
    const err = 'expected a tuple or a string, read the documentation to see the accepted inputs';
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        if (tuple.length < 2) {
            return {'error': err};
        }
        return {'error': 'unexpected argument after number of occurences'};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error': `expected second argument to be a number, found \`${tuple[1].getRaw()}\``,
        };
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const occurences = tuple[1].getIntegerValue('number of occurences', true);
    if (occurences.error !== undefined) {
        return occurences;
    }
    const varName = 'parseAssertElemInt';
    let start;
    if (selector.isXPath) {
        start = `let ${varName} = await page.$x("${selector.value}");\n`;
    } else {
        start = `let ${varName} = await page.$$("${selector.value}");\n`;
    }
    return {
        'instructions': [
            start +
            // TODO: maybe check differently depending on the tag kind?
            `${insertBefore}if (${varName}.length !== ${occurences.value}) {\n` +
            `throw 'expected ${occurences.value} elements, found ' + ${varName}.length;\n` +
            `}${insertAfter}`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", number of occurences [integer])
// * ("XPath", number of occurences [integer])
function parseAssertCount(parser) {
    return parseAssertCountInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", number of occurences [integer])
// * ("XPath", number of occurences [integer])
function parseAssertCountFalse(parser) {
    return parseAssertCountInner(parser, true);
}

function parseAssertTextInner(parser, assertFalse) {
    const err = 'expected a tuple or a string, read the documentation to see the accepted inputs';
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    let checkAllElements = false;
    const tuple = elems[0].getRaw();
    if (tuple.length < 2 || tuple.length > 3) {
        return {'error': 'invalid number of values in the tuple, read the documentation to see ' +
                    'the accepted inputs'};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a string, found \`${tuple[1].getRaw()}\``,
        };
    } else if (tuple.length === 3) {
        if (tuple[2].kind !== 'ident') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${tuple[2].getRaw()}\``,
            };
        } else if (tuple[2].getRaw() !== 'ALL') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${tuple[2].getRaw()}\``,
            };
        }
        checkAllElements = true;
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, checkAllElements);
    const selector = tuple[0].getSelector();

    const value = tuple[1].getStringValue();
    const varName = 'parseAssertElemStr';
    let instructions;
    if (!checkAllElements) {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            `${insertBefore}await page.evaluate(e => {\n` +
            `browserUiTestHelpers.compareElemsText(e, "${value}");\n` +
            `}, ${varName});${insertAfter}`,
        ];
    } else {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                `${insertBefore}await page.evaluate(e => {\n` +
                `browserUiTestHelpers.compareElemsText(e, "${value}");\n` +
                `}, ${varName}[i]);${insertAfter}` +
            '}',
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector", text [STRING])
// * ("XPath", text [STRING])
// * ("CSS selector", text [STRING], ALL)
// * ("XPath", text [STRING], ALL)
function parseAssertText(parser) {
    return parseAssertTextInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector", text [STRING])
// * ("XPath", text [STRING])
// * ("CSS selector", text [STRING], ALL)
// * ("XPath", text [STRING], ALL)
function parseAssertTextFalse(parser) {
    return parseAssertTextInner(parser, true);
}

function parseAssertInner(parser, assertFalse) {
    const err = 'expected a tuple, a CSS selector or an XPath';
    const elems = parser.elems;

    let tuple;
    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1) {
        return {'error': `expected a CSS selector or an XPath, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string') {
        tuple = elems;
    } else if (elems[0].kind === 'tuple') {
        tuple = elems[0].getRaw();
        if (tuple.length !== 1) {
            return {
                'error': 'expected only a CSS selector or an XPath in the tuple, found ' +
                    `${tuple.length} elements`,
            };
        } else if (tuple[0].kind !== 'string') {
            return {
                'error': 'expected argument to be a CSS selector or an XPath, ' +
                    `found \`${tuple[0].getRaw()}\``,
            };
        }
    } else {
        return {'error': err + `, found \`${elems[0].getRaw()}\``};
    }
    const selector = tuple[0].getSelector();

    if (selector.error !== undefined) {
        return selector;
    }
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    let instructions;
    if (selector.isXPath) {
        instructions = [
            `${insertBefore}if ((await page.$x("${selector.value}")).length === 0) { ` +
            `throw 'XPath "${selector.value}" not found'; }${insertAfter}`,
        ];
    } else {
        instructions = [
            `${insertBefore}if ((await page.$("${selector.value}")) === null) { ` +
            `throw '"${selector.value}" not found'; }${insertAfter}`,
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * "CSS selector"
// * "XPath"
// * ("CSS selector")
// * ("XPath")
function parseAssert(parser) {
    return parseAssertInner(parser, false);
}

// Possible inputs:
//
// * "CSS selector"
// * "XPath"
// * ("CSS selector")
// * ("XPath")
function parseAssertFalse(parser) {
    return parseAssertInner(parser, true);
}

function parseAssertPositionInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }

    const isPseudo = !selector.isXPath && selector.pseudo !== null;

    const checkAllElements = selector.checkAllElements;
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    const json = selector.tuple[1].getRaw();

    const entries = validateJson(json, ['number'], 'JSON dict key');

    if (entries.error !== undefined) {
        return entries;
    } else if (entries.values.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': entries.warnings,
            'checkResult': true,
        };
    }

    const varName = 'parseAssertPosition';

    let code = '';
    for (const [key, value] of Object.entries(entries.values)) {
        if (key === 'x') {
            code += 'function checkX(e) {\n' +
                insertBefore +
                'let x = e.getBoundingClientRect().left;\n';
            if (isPseudo) {
                code += `let pseudoStyle = window.getComputedStyle(e, "${selector.pseudo}");\n` +
                    'let style = window.getComputedStyle(e);\n' +
                    'x += browserUiTestHelpers.extractFloat(pseudoStyle.left) - ' +
                        'browserUiTestHelpers.extractFloat(style.marginLeft);\n';
            }
            code += 'let roundedX = Math.round(x);\n' +
                `if (x !== ${value} && roundedX !== Math.round(${value})) {\n` +
                `throw "different X values: " + x + "(or " + roundedX + ") != " + ${value};\n` +
                `}${insertAfter}\n` +
                '}\n' +
                'checkX(elem);\n';
        } else if (key === 'y') {
            code += 'function checkY(e) {\n' +
                insertBefore +
                'let y = e.getBoundingClientRect().top;\n';
            if (isPseudo) {
                code += `let pseudoStyle = window.getComputedStyle(e, "${selector.pseudo}");\n` +
                    'let style = window.getComputedStyle(e);\n' +
                    'y += browserUiTestHelpers.extractFloat(pseudoStyle.top) - ' +
                        'browserUiTestHelpers.extractFloat(style.marginTop);\n';
            }
            code += 'let roundedY = Math.round(y);\n' +
                `if (y !== ${value} && roundedY !== Math.round(${value})) {\n` +
                `throw "different Y values: " + y + "(or " + roundedY + ") != " + ${value};\n` +
                `}${insertAfter}\n` +
                '}\n' +
                'checkY(elem);\n';
        } else {
            return {
                'error': 'Only accepted keys are "x" and "y", found `' +
                    `"${key}"\` (in \`${selector.tuple[1].getText()}\`)`,
            };
        }
    }
    let instructions;
    if (!checkAllElements) {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            'await page.evaluate(elem => {\n' +
            code +
            `}, ${varName});`,
        ];
    } else {
        instructions = [
            getAndSetElements(selector, varName, checkAllElements) +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                'await page.evaluate(elem => {\n' +
                code +
                `}, ${varName}[i]);\n` +
            '}',
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"X" | "Y": integer})
// * ("CSS selector" | "XPath", {"X" | "Y": integer}, ALL)
function parseAssertPosition(parser) {
    return parseAssertPositionInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"X" | "Y": integer})
// * ("CSS selector" | "XPath", {"X" | "Y": integer}, ALL)
function parseAssertPositionFalse(parser) {
    return parseAssertPositionInner(parser, true);
}

function parseAssertLocalStorageInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected JSON, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'json') {
        return {'error': `expected JSON, found \`${parser.getRawArgs()}\``};
    }
    const json = elems[0].getRaw();
    const content = [];
    let warnings = [];

    for (let i = 0; i < json.length; ++i) {
        const entry = json[i];

        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getText()}\``);
            continue;
        } else if (entry['key'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getText()}\``);
            continue;
        }
        const key_s = entry['key'].getStringValue();
        let value_s;
        let err_s;
        if (entry['value'].kind === 'ident') {
            value_s = entry['value'].getStringValue();
            err_s = value_s;
            if (value_s !== 'null') {
                return {'error': `Only \`null\` ident is allowed, found \`${value_s}\``};
            }
        } else {
            value_s = `"${entry['value'].getStringValue()}"`;
            err_s = `\\"${entry['value'].getStringValue()}\\"`;
        }
        if (assertFalse) {
            content.push(
                `if (localStorage.getItem("${key_s}") == ${value_s}) {\n` +
                    `var value = localStorage.getItem("${key_s}");\n` +
                    `throw "localStorage item \\"${key_s}\\" (" + value + ") == ${err_s}";\n` +
                '}');
        } else {
            content.push(
                `if (localStorage.getItem("${key_s}") != ${value_s}) {\n` +
                    `var value = localStorage.getItem("${key_s}");\n` +
                    `throw "localStorage item \\"${key_s}\\" (" + value + ") != ${err_s}";\n` +
                '}');
        }
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (content.length === 0) {
        return {
            'instructions': [],
            'warnings': warnings,
            'wait': false,
        };
    }
    return {
        'instructions': [
            `await page.evaluate(() => {\n${content.join('\n')}\n});`,
        ],
        'warnings': warnings,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * JSON object (for example: {"key": "expected value", "another key": "another expected"})
function parseAssertLocalStorage(parser) {
    return parseAssertLocalStorageInner(parser, false);
}

// Possible inputs:
//
// * JSON object (for example: {"key": "unexpected value", "another key": "another unexpected"})
function parseAssertLocalStorageFalse(parser) {
    return parseAssertLocalStorageInner(parser, true);
}

function parseCompareElementsTextInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple of CSS selector/XPath, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple of CSS selector/XPath, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        let err = `expected 2 CSS selectors/XPathes, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`};
    }
    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsText';
    const selectors = getAndSetElements(selector1, varName + '1', false) +
        getAndSetElements(selector2, varName + '2', false);

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    return {
        'instructions': [
            selectors +
            `${insertBefore}await page.evaluate((e1, e2) => {\n` +
            'let e1value;\n' +
            'if (e1.tagName.toLowerCase() === "input") {\n' +
                'e1value = e1.value;\n' +
            '} else {\n' +
                'e1value = e1.textContent;\n' +
            '}\n' +
            'if (e2.tagName.toLowerCase() === "input") {\n' +
                'if (e2.value !== e1value) {\n' +
                    'throw \'"\' + e1value + \'" !== "\' + e2.value + \'"\';\n' +
                '}\n' +
            '} else if (e2.textContent !== e1value) {\n' +
                'throw \'"\' + e1value + \'" !== "\' + e2.textContent + \'"\';\n' +
            '}\n' +
            `}, ${varName}1, ${varName}2);${insertAfter}`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2")
function parseCompareElementsText(parser) {
    return parseCompareElementsTextInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2")
function parseCompareElementsTextFalse(parser) {
    return parseCompareElementsTextInner(parser, true);
}

function parseCompareElementsAttributeInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'array') {
        return {
            'error': 'expected third argument to be an array of string, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    }
    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getText()}\``};
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsAttr';
    const selectors = getAndSetElements(selector1, varName + '1', false) +
        getAndSetElements(selector2, varName + '2', false);

    let arr = '';
    for (let i = 0; i < array.length; ++i) {
        if (i > 0) {
            arr += ',';
        }
        arr += `"${array[i].getStringValue()}"`;
    }

    const code = `const attributes = [${arr}];\n` +
    'for (let i = 0; i < attributes.length; ++i) {\n' +
    'const attr = attributes[i];\n' +
    `${insertBefore}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {\n` +
        'throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);\n' +
    `}${insertAfter}\n` +
    '}\n';

    return {
        'instructions': [
            selectors +
            'await page.evaluate((e1, e2) => {\n' +
            code +
            `}, ${varName}1, ${varName}2);`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["attr"])
function parseCompareElementsAttribute(parser) {
    return parseCompareElementsAttributeInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ["attr"])
function parseCompareElementsAttributeFalse(parser) {
    return parseCompareElementsAttributeInner(parser, true);
}

function parseCompareElementsCssInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'array') {
        return {
            'error': 'expected third argument to be an array of string, ' +
                `found ${tuple[2].getArticleKind()}`,
        };
    }
    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getText()}\``};
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const pseudo1 = !selector1.isXPath && selector1.pseudo !== null ?
        `, "${selector1.pseudo}"` : '';

    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const pseudo2 = !selector2.isXPath && selector2.pseudo !== null ?
        `, "${selector2.pseudo}"` : '';

    const varName = 'parseCompareElementsCss';
    const selectors = getAndSetElements(selector1, varName + '1', false) +
        getAndSetElements(selector2, varName + '2', false);

    let arr = '';
    let needColorCheck = false;
    for (let i = 0; i < array.length; ++i) {
        const key = array[i].getStringValue();
        if (key.length === 0) {
            return {
                'error': 'Empty CSS property keys ("" or \'\') are not allowed',
            };
        }
        if (arr.length > 0) {
            arr += ',';
        }
        if (key === 'color') {
            needColorCheck = true;
        }
        arr += `"${key}"`;
    }

    const code = `const properties = [${arr}];\n` +
    'for (let i = 0; i < properties.length; ++i) {\n' +
        'const css_property = properties[i];\n' +
        `${insertBefore}let style1_1 = e1.style[css_property];\n` +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && ' +
            'style1_2 != style2_1 && style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + ' +
            `style1_2 + ' != ' + style2_2; }${insertAfter}\n` +
    '}\n';

    const instructions = [];
    if (needColorCheck) {
        instructions.push('if (!arg.showText) {\n' +
            `throw "${COLOR_CHECK_ERROR}";\n` +
            '}',
        );
    }
    instructions.push(
        selectors +
        'await page.evaluate((e1, e2) => {' +
        `let computed_style1 = getComputedStyle(e1${pseudo1});\n` +
        `let computed_style2 = getComputedStyle(e2${pseudo2});\n` +
        code +
        `}, ${varName}1, ${varName}2);`,
    );
    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["CSS properties"])
function parseCompareElementsCss(parser) {
    return parseCompareElementsCssInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ["CSS properties"])
function parseCompareElementsCssFalse(parser) {
    return parseCompareElementsCssInner(parser, true);
}

function parseCompareElementsPropertyInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'array') {
        return {
            'error': 'expected third argument to be an array of string, ' +
                `found ${tuple[2].getArticleKind()}`,
        };
    }
    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getText()}\``};
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }

    const varName = 'parseCompareElementsProp';
    const selectors = getAndSetElements(selector1, varName + '1', false) +
        getAndSetElements(selector2, varName + '2', false);

    const code = `const ${varName}s = ${tuple[2].getText()};\n` +
    `for (let i = 0; i < ${varName}s.length; ++i) {\n` +
        `const property = ${varName}s[i];\n` +
        `${insertBefore}const value = await ${varName}1.evaluateHandle((e, p) => {\n` +
            'return String(e[p]);\n' +
        '}, property);\n' +
        `await ${varName}2.evaluate((e, v, p) => {\n` +
            'if (v !== String(e[p])) {\n' +
            'throw p + ": `" + v + "` !== `" + String(e[p]) + "`";\n' +
            '}\n' +
        `}, value, property);${insertAfter}\n` +
    '}';
    return {
        'instructions': [
            selectors + code,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["CSS properties"])
function parseCompareElementsProperty(parser) {
    return parseCompareElementsPropertyInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ["CSS properties"])
function parseCompareElementsPropertyFalse(parser) {
    return parseCompareElementsPropertyInner(parser, true);
}

function parseCompareElementsPositionInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'tuple') {
        return {
            'error': `expected third argument to be a tuple, found ${tuple[2].getArticleKind()}`,
        };
    }
    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getText()}\``};
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsPos';
    const selectors = getAndSetElements(selector1, varName + '1', false) +
        getAndSetElements(selector2, varName + '2', false);

    const sub_tuple = tuple[2].getRaw();
    let x = false;
    let y = false;
    let code = '';

    function handlePseudoX(selector, end) {
        if (selector.isXPath || selector.pseudo === null) {
            return '';
        }
        return `let pseudoStyle${end} = window.getComputedStyle(e${end}, "${selector.pseudo}");\n` +
            `let style${end} = window.getComputedStyle(e${end});\n` +
            `x${end} += browserUiTestHelpers.extractFloat(pseudoStyle${end}.left) - ` +
                `browserUiTestHelpers.extractFloat(style${end}.marginLeft);\n`;
    }
    function handlePseudoY(selector, end) {
        if (selector.isXPath || selector.pseudo === null) {
            return '';
        }
        return `let pseudoStyle${end} = window.getComputedStyle(e${end}, "${selector.pseudo}");\n` +
            `let style${end} = window.getComputedStyle(e${end});\n` +
            `y${end} += browserUiTestHelpers.extractFloat(pseudoStyle${end}.top) - ` +
                `browserUiTestHelpers.extractFloat(style${end}.marginTop);\n`;
    }

    for (let i = 0; i < sub_tuple.length; ++i) {
        if (sub_tuple[i].kind !== 'string') {
            return { 'error': `\`${tuple[2].getText()}\` should only contain strings` };
        }
        const value = sub_tuple[i].getRaw();
        if (value === 'x') {
            if (x) {
                return {
                    'error': `Duplicated "x" value in \`${tuple[2].getText()}\``,
                };
            }
            code += 'function checkX(e1, e2) {\n' +
                insertBefore +
                'let x1 = e1.getBoundingClientRect().left;\n' +
                handlePseudoX(selector1, '1') +
                'let x2 = e2.getBoundingClientRect().left;\n' +
                handlePseudoX(selector2, '2') +
                'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
                insertAfter +
                '}\n' +
                'checkX(elem1, elem2);\n';
            x = true;
        } else if (value === 'y') {
            if (y) {
                return {
                    'error': `Duplicated "y" value in \`${tuple[2].getText()}\``,
                };
            }
            code += 'function checkY(e1, e2) {\n' +
                insertBefore +
                'let y1 = e1.getBoundingClientRect().top;\n' +
                handlePseudoY(selector1, '1') +
                'let y2 = e2.getBoundingClientRect().top;\n' +
                handlePseudoY(selector2, '2') +
                'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
                insertAfter +
                '}\n' +
                'checkY(elem1, elem2);\n';
            y = true;
        } else {
            return {
                'error': 'Only accepted values are "x" and "y", found `' +
                    `${sub_tuple[i].getText()}\` (in \`${tuple[2].getText()}\`)`,
            };
        }
    }
    return {
        'instructions': [
            selectors +
            'await page.evaluate((elem1, elem2) => {\n' +
            `${code}}, ${varName}1, ${varName}2);`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ("x"|"y"))
function parseCompareElementsPosition(parser) {
    return parseCompareElementsPositionInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ("x"|"y"))
function parseCompareElementsPositionFalse(parser) {
    return parseCompareElementsPositionInner(parser, true);
}

function parseCompareElementsPositionNearInner(parser, assertFalse) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'json') {
        return {
            'error': 'expected third argument to be a JSON dict, found ' +
                tuple[2].getArticleKind(),
        };
    }

    const json = tuple[2].getRaw();
    const entries = validateJson(json, ['number'], 'JSON dict key');

    if (entries.error !== undefined) {
        return entries;
    } else if (entries.values.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': entries.warnings,
            'checkResult': true,
        };
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsPosNear';
    const selectors = getAndSetElements(selector1, varName + '1', false) +
        getAndSetElements(selector2, varName + '2', false);

    const warnings = [];
    let code = '';
    for (const [key, value] of Object.entries(entries.values)) {
        if (key === 'x') {
            if (value < 0) {
                return {
                    'error': `Delta cannot be negative (in \`"x": ${value}\`)`,
                };
            } else if (value === '0') {
                warnings.push(
                    'Delta is 0 for "X", maybe try to use `compare-elements-position` instead?');
            }
            code += 'function checkX(e1, e2) {\n' +
                insertBefore +
                'let x1 = e1.getBoundingClientRect().left;\n' +
                'let x2 = e2.getBoundingClientRect().left;\n' +
                'let delta = Math.abs(x1 - x2);\n' +
                `if (delta > ${value}) {\n` +
                `throw "delta X values too large: " + delta + " > ${value}";\n` +
                '}\n' +
                insertAfter +
                '}\n' +
                'checkX(elem1, elem2);\n';
        } else if (key === 'y') {
            if (value < 0) {
                return {
                    'error': `Delta cannot be negative (in \`"y": ${value}\`)`,
                };
            } else if (value === '0') {
                warnings.push(
                    'Delta is 0 for "Y", maybe try to use `compare-elements-position` instead?');
            }
            code += 'function checkY(e1, e2) {\n' +
                insertBefore +
                'let y1 = e1.getBoundingClientRect().top;\n' +
                'let y2 = e2.getBoundingClientRect().top;\n' +
                'let delta = Math.abs(y1 - y2);\n' +
                `if (delta > ${value}) {\n` +
                `throw "delta Y values too large: " + delta + " > ${value}";\n` +
                '}\n' +
                insertAfter +
                '}\n' +
                'checkY(elem1, elem2);\n';
        } else {
            return {
                'error': 'Only accepted keys are "x" and "y", found `' +
                    `"${key}"\` (in \`${tuple[2].getText()}\`)`,
            };
        }
    }
    return {
        'instructions': [
            selectors +
            'await page.evaluate((elem1, elem2) => {\n' +
            `${code}}, ${varName}1, ${varName}2);`,
        ],
        'wait': false,
        'checkResult': true,
        'warnings': warnings.length > 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", {"x"|"y": number}))
function parseCompareElementsPositionNear(parser) {
    return parseCompareElementsPositionNearInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", {"x"|"y": number})
function parseCompareElementsPositionNearFalse(parser) {
    return parseCompareElementsPositionNearInner(parser, true);
}

// Possible inputs:
//
// * ("CSS selector", "text")
// * ("XPath", "text")
function parseText(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected `("CSS selector" or "XPath", "text")`, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected `("CSS selector" or "XPath", "text")`, found' +
                ` \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2 || tuple[0].kind !== 'string' || tuple[1].kind !== 'string') {
        return {'error': 'expected `("CSS selector" or "XPath", "text")`'};
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const value = tuple[1].getStringValue();
    const varName = 'parseTextElem';
    return {
        'instructions': [
            getAndSetElements(selector, varName, false) +
            'await page.evaluate(e => {\n' +
            'if (["input", "textarea"].indexOf(e.tagName.toLowerCase()) !== -1) {\n' +
            `e.value = "${value}";\n` +
            '} else {\n' +
            `e.innerText = "${value}";\n` +
            '}\n' +
            `}, ${varName});`,
        ],
    };
}

function innerParseCssAttribute(parser, argName, varName, callback) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", ` +
                `"${argName} value")\` or \`("CSS selector" or "XPath", [JSON object])\`` +
                ', found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", ` +
                `"${argName} value")\` or \`("CSS selector" or "XPath", [JSON object])\`` +
                `, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple[0].kind !== 'string') {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", "${argName} ` +
                'value")` or `("CSS selector" or "XPath", [JSON object])`',
        };
    }
    const selector = tuple[0].getSelector('(first argument)');
    if (selector.error !== undefined) {
        return selector;
    }
    if (tuple.length === 3) {
        if (tuple[1].kind !== 'string' || tuple[2].kind !== 'string') {
            return {
                'error': `expected strings for ${argName} name and ${argName} value (second ` +
                    'and third arguments)',
            };
        }
        const attributeName = tuple[1].getStringValue(true);
        if (attributeName.length === 0) {
            return {'error': 'attribute name (second argument) cannot be empty'};
        }
        const value = tuple[2].getStringValue();
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) +
                `await page.evaluate(e => {\n${callback(attributeName, value)}\n}, ` +
                `${varName});`,
            ],
        };
    } else if (tuple.length !== 2) {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", "${argName} ` +
                'value")` or `("CSS selector" or "XPath", [JSON object])`',
        };
    }
    if (tuple[1].kind !== 'json') {
        return {
            'error': 'expected json as second argument (since there are only two arguments), ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    }
    let code = '';
    let warnings = [];
    const json = tuple[1].getRaw();
    varName += 'Json';

    for (let i = 0; i < json.length; ++i) {
        const entry = json[i];

        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getText()}\``);
            continue;
        } else if (entry['key'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getText()}\``);
            continue;
        }
        const key_s = entry['key'].getStringValue();
        const value_s = entry['value'].getStringValue();
        if (code.length !== 0) {
            code += '\n';
        }
        code += `await page.evaluate(e => {\n${callback(key_s, value_s)}\n}, ${varName});`;
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': warnings,
        };
    }
    return {
        'instructions': [
            getAndSetElements(selector, varName, false) +
            code,
        ],
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector", "attribute name", "attribute value")
// * ("XPath", "attribute name", "attribute value")
// * ("CSS selector", [JSON object])
// * ("XPath", [JSON object])
function parseAttribute(parser) {
    return innerParseCssAttribute(parser, 'attribute', 'parseAttributeElem',
        (key, value) => `e.setAttribute("${key}","${value}");`);
}

// Possible inputs:
//
// * ("CSS selector", "CSS property name", "CSS property value")
// * ("XPath", "CSS property name", "CSS property value")
// * ("CSS selector", [JSON object])
// * ("XPath", [JSON object])
function parseCss(parser) {
    return innerParseCssAttribute(parser, 'CSS property', 'parseCssElem',
        (key, value) => `e.style["${key}"] = "${value}";`);
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
// * "CSS selector"
// * "XPath"
function parseScreenshotComparison(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected boolean or CSS selector or XPath, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool' && elems[0].kind !== 'string') {
        return {
            'error': `expected boolean or CSS selector or XPath, found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'bool') {
        return {
            'instructions': [
                `arg.screenshotComparison = ${elems[0].getRaw()};`,
            ],
            'wait': false,
        };
    }
    const warnings = [];
    const selector = elems[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    } else if (selector.value === 'true' || selector.value === 'false') {
        warnings.push(`\`${elems[0].getText()}\` is a string and will be used as CSS selector.` +
            ' If you want to set `true` or `false` value, remove quotes.');
    }
    return {
        'instructions': [
            `arg.screenshotComparison = "${selector.value}";`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings.join('\n') : undefined,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseDebug(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            'if (arg && arg.debug_log && arg.debug_log.setDebugEnabled) {\n' +
            `arg.debug_log.setDebugEnabled(${elems[0].getRaw()});\n` +
            '} else {\n' +
            'throw "`debug` command needs an object with a `debug_log` field of `Debug` type!";\n' +
            '}',
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parsePauseOnError(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            `arg.pauseOnError = ${elems[0].getRaw()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseFail(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            `arg.expectedToFail = ${elems[0].getRaw()};`,
        ],
        'wait': false,
    };
}

function innerReloadAndHistory(parser, options, command, jsFunc, errorMessage) {
    let timeout = options.timeout;
    const warnings = [];
    const elems = parser.elems;

    if (elems.length > 1) {
        return {
            'error': `expected either [integer] or no arguments, got ${elems.length} arguments`,
        };
    } else if (elems.length !== 0) {
        if (elems[0].kind !== 'number') {
            return {
                'error': 'expected either [integer] or no arguments, found ' +
                    elems[0].getArticleKind(),
            };
        }
        const ret = elems[0].getIntegerValue('timeout', true);
        if (ret.error !== undefined) {
            return ret;
        }
        timeout = ret.value;
        if (parseInt(timeout) === 0) {
            warnings.push('You passed 0 as timeout, it means the timeout has been disabled on ' +
                `this ${command}`);
        }
    }
    let insertAfter = '';
    if (errorMessage !== null) {
        insertAfter = 'if (ret === null) {\n' +
            `throw "${errorMessage}";\n` +
            '}\n';
    }
    return {
        'instructions': [
            `const ret = page.${jsFunc}({'waitUntil': 'domcontentloaded', ` +
                `'timeout': ${timeout}});\n` +
                insertAfter +
                'await ret;',
        ],
        'warnings': warnings.length > 0 ? warnings.join('\n') : undefined,
    };
}

// Possible inputs:
//
// * nothing
// * number (of milliseconds before timeout)
function parseReload(parser, options) {
    return innerReloadAndHistory(parser, options, 'reload', 'reload', null);
}

// Possible inputs:
//
// * nothing
// * number (of milliseconds before timeout)
function parseHistoryGoBack(parser, options) {
    return innerReloadAndHistory(
        parser, options, 'history-go-back', 'goBack', 'cannot go back in history');
}

// Possible inputs:
//
// * nothing
// * number (of milliseconds before timeout)
function parseHistoryGoForward(parser, options) {
    return innerReloadAndHistory(
        parser, options, 'history-go-forward', 'goForward', 'cannot go forward in history');
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseShowText(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    // We need the value to be updated first.
    const instructions = [`arg.showText = ${elems[0].getRaw()};`];
    // And then to make the expected changes to the DOM.
    if (elems[0].getRaw() === 'true') {
        instructions.push('await page.evaluate(() => {\n' +
            `let tmp = document.getElementById('${consts.STYLE_HIDE_TEXT_ID}');\n` +
            'if (tmp) { tmp.remove(); }\n' +
            '});');
    } else {
        instructions.push('await page.evaluate(() => {\n' +
            `window.${consts.STYLE_ADDER_FUNCTION}('${consts.CSS_TEXT_HIDE}', ` +
            `'${consts.STYLE_HIDE_TEXT_ID}');\n` +
            '});');
    }
    return {
        'instructions': instructions,
    };
}

// Possible inputs:
//
// * ((x, y), (x, y))
// * ((x, y), "CSS selector")
// * ("CSS selector", (x, y))
// * ("XPath", (x, y))
// * ("CSS selector" or "XPath", "CSS selector" or "XPath")
function parseDragAndDrop(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                'CSS selector or an XPath, found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                `CSS selector or an XPath, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                'CSS selector or an XPath',
        };
    }
    const checkArg = arg => {
        if (arg.kind !== 'tuple' && arg.kind !== 'string') {
            return {
                'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                    `CSS selector or an XPath, found \`${arg.getText()}\``,
            };
        } else if (arg.kind === 'tuple') {
            const ret = checkIntegerTuple(arg, 'X position', 'Y position', true);
            if (ret.error !== undefined) {
                return ret;
            }
        }
        return {};
    };
    let ret = checkArg(tuple[0]);
    if (ret.error !== undefined) {
        return ret;
    }
    ret = checkArg(tuple[1]);
    if (ret.error !== undefined) {
        return ret;
    }
    const instructions = [];
    const setupThings = (arg, varName, posName, pos) => {
        let code = '';
        if (arg.kind === 'string') {
            const selector = arg.getSelector(`(${pos} argument)`);
            if (selector.error !== undefined) {
                return selector;
            }
            const box = `${varName}_box`;
            code += getAndSetElements(selector, varName, false) +
                `const ${box} = await ${varName}.boundingBox();\n` +
                `const ${posName} = [${box}.x + ${box}.width / 2, ${box}.y + ${box}.height / 2];\n`;
        } else {
            const elems = arg.getRaw();
            code += `const ${posName} = [${elems[0].getRaw()}, ${elems[1].getRaw()}];\n`;
        }
        return `${code}await page.mouse.move(${posName}[0], ${posName}[1]);`;
    };
    ret = setupThings(tuple[0], 'parseDragAndDropElem', 'start', 'first');
    if (ret.error !== undefined) {
        return ret;
    }
    instructions.push(ret + '\nawait page.mouse.down();');
    ret = setupThings(tuple[1], 'parseDragAndDropElem2', 'end', 'second');
    if (ret.error !== undefined) {
        return ret;
    }
    instructions.push(ret + '\nawait page.mouse.up();');
    return {
        'instructions': instructions,
    };
}

// Possible inputs:
//
// * string
function parseEmulate(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected string for "device name", found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'string') {
        return {'error': `expected string for "device name", found \`${parser.getRawArgs()}\``};
    }
    const device = elems[0].getStringValue();
    return {
        'instructions': [
            `if (arg.puppeteer.devices["${device}"] === undefined) { throw 'Unknown device ` +
            `\`${device}\`. List of available devices can be found there: ` +
            'https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js or ' +
            'you can use `--show-devices` option\'; }' +
            ` else { await page.emulate(arg.puppeteer.devices["${device}"]); }`,
        ],
    };
}

// Possible inputs:
//
// * number
function parseTimeout(parser) {
    const warnings = [];
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected integer for number of milliseconds, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'number') {
        return {
            'error': 'expected integer for number of milliseconds, found' +
                ` \`${parser.getRawArgs()}\``,
        };
    }
    const ret = elems[0].getIntegerValue('number of milliseconds', true);
    if (ret.error !== undefined) {
        return ret;
    }
    if (parseInt(ret.value) === 0) {
        warnings.push('You passed 0 as timeout, it means the timeout has been disabled on ' +
            'this reload');
    }
    return {
        'instructions': [
            `page.setDefaultTimeout(${ret.value})`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * (number, number)
function parseGeolocation(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected (longitude [number], latitude [number]), found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected (longitude [number], latitude [number]), ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple[0].kind !== 'number') {
        return {
            'error': 'expected number for longitude (first argument), ' +
                `found \`${tuple[0].getText()}\``,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error': 'expected number for latitude (second argument), ' +
                `found \`${tuple[1].getText()}\``,
        };
    }
    return {
        'instructions': [
            `await page.setGeolocation(${tuple[0].getRaw()}, ${tuple[1].getRaw()});`,
        ],
    };
}

// Possible inputs:
//
// * array of strings
function parsePermissions(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected an array of strings, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'array') {
        return {'error': `expected an array of strings, found \`${parser.getRawArgs()}\``};
    }
    const array = elems[0].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${elems[0].getText()}\``};
    }

    for (let i = 0; i < array.length; ++i) {
        if (consts.AVAILABLE_PERMISSIONS.indexOf(array[i].getRaw()) === -1) {
            return {
                'error': `\`${array[i].getText()}\` is an unknown permission, you can see the ` +
                    'list of available permissions with the `--show-permissions` option',
            };
        }
    }

    return {
        'instructions': [
            `arg.permissions = ${elems[0].getText()};`,
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseJavascript(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            `await page.setJavaScriptEnabled(${elems[0].getRaw()});`,
        ],
    };
}

// Possible inputs:
//
// * number
function parseFontSize(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a font size (in pixels), found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'number') {
        return {'error': `expected a font size (in pixels), found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            'const client = await page.target().createCDPSession();\n' +
            'await client.send("Page.enable");\n' +
            'await client.send("Page.setFontSizes", {\n' +
                'fontSizes: {\n' +
                    `standard: ${elems[0].getRaw()},\n` +
                    `fixed: ${elems[0].getRaw()},\n` +
                '}\n' +
            '});',
        ],
    };
}

const ORDERS = {
    'assert': parseAssert,
    'assert-false': parseAssertFalse,
    'assert-attribute': parseAssertAttribute,
    'assert-attribute-false': parseAssertAttributeFalse,
    'assert-count': parseAssertCount,
    'assert-count-false': parseAssertCountFalse,
    'assert-css': parseAssertCss,
    'assert-css-false': parseAssertCssFalse,
    'assert-local-storage': parseAssertLocalStorage,
    'assert-local-storage-false': parseAssertLocalStorageFalse,
    'assert-position': parseAssertPosition,
    'assert-position-false': parseAssertPositionFalse,
    'assert-property': parseAssertProperty,
    'assert-property-false': parseAssertPropertyFalse,
    'assert-text': parseAssertText,
    'assert-text-false': parseAssertTextFalse,
    'attribute': parseAttribute,
    'click': parseClick,
    'compare-elements-attribute': parseCompareElementsAttribute,
    'compare-elements-attribute-false': parseCompareElementsAttributeFalse,
    'compare-elements-css': parseCompareElementsCss,
    'compare-elements-css-false': parseCompareElementsCssFalse,
    'compare-elements-position': parseCompareElementsPosition,
    'compare-elements-position-false': parseCompareElementsPositionFalse,
    'compare-elements-position-near': parseCompareElementsPositionNear,
    'compare-elements-position-near-false': parseCompareElementsPositionNearFalse,
    'compare-elements-property': parseCompareElementsProperty,
    'compare-elements-property-false': parseCompareElementsPropertyFalse,
    'compare-elements-text': parseCompareElementsText,
    'compare-elements-text-false': parseCompareElementsTextFalse,
    'css': parseCss,
    'debug': parseDebug,
    'drag-and-drop': parseDragAndDrop,
    'emulate': parseEmulate,
    'fail': parseFail,
    'focus': parseFocus,
    'font-size': parseFontSize,
    'geolocation': parseGeolocation,
    'goto': parseGoTo,
    'history-go-back': parseHistoryGoBack,
    'history-go-forward': parseHistoryGoForward,
    'javascript': parseJavascript,
    'local-storage': parseLocalStorage,
    'move-cursor-to': parseMoveCursorTo,
    'pause-on-error': parsePauseOnError,
    'permissions': parsePermissions,
    'press-key': parsePressKey,
    'reload': parseReload,
    'screenshot-comparison': parseScreenshotComparison,
    'scroll-to': parseScrollTo,
    'show-text': parseShowText,
    'size': parseSize,
    'text': parseText,
    'timeout': parseTimeout,
    'wait-for': parseWaitFor,
    'write': parseWrite,
};

// If the command fails, the script should stop right away because everything coming after will
// very likely be broken.
const FATAL_ERROR_COMMANDS = [
    'attribute',
    'click',
    'css',
    'drag-and-drop',
    'emulate',
    'focus',
    'goto',
    'local-storage',
    'move-cursor-to',
    'scroll-to',
    'text',
    'write',
];

// Commands which do not run JS commands but change the behavior of the commands following.
const NO_INTERACTION_COMMANDS = [
    'debug',
    'emulate',
    'fail',
    'javascript',
    'screenshot-comparison',
    'timeout',
];

// Commands which can only be used before the first `goto` command.
const BEFORE_GOTO = [
    'emulate',
];

function parseContent(content, options) {
    const parser = new Parser(content, options.variables);
    const commands = {'commands': []};
    let res;
    let firstGotoParsed = false;

    for (;;) {
        if (!parser.parseNextCommand()) {
            if (parser.error) {
                return {
                    'error': parser.error,
                    'line': parser.currentLine,
                };
            }
            // We reached the end of the file!
            break;
        }
        const order = parser.command.getRaw().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(ORDERS, order)) {
            if (firstGotoParsed === false) {
                if (order !== 'goto' && NO_INTERACTION_COMMANDS.indexOf(order) === -1) {
                    const cmds = NO_INTERACTION_COMMANDS.map(x => `\`${x}\``);
                    const last = cmds.pop();
                    const text = cmds.join(', ') + ` or ${last}`;
                    return {
                        'error': `First command must be \`goto\` (${text} can be used before)!`,
                        'line': parser.currentLine,
                    };
                }
                firstGotoParsed = order === 'goto';
            } else if (BEFORE_GOTO.indexOf(order) !== -1) {
                return {
                    'error': `Command ${order} must be used before first goto!`,
                    'line': parser.currentLine,
                };
            }
            res = ORDERS[order](parser, options);
            if (res.error !== undefined) {
                res.line = parser.currentLine;
                return res;
            }
            if (res['warnings'] !== undefined) {
                if (commands['warnings'] === undefined) {
                    commands['warnings'] = [];
                }
                commands['warnings'].push.apply(commands['warnings'], res['warnings']);
            }
            commands['commands'].push({
                'fatal_error': FATAL_ERROR_COMMANDS.indexOf(order) !== -1,
                'wait': res['wait'],
                'checkResult': res['checkResult'],
                'original': parser.getOriginalCommand(),
                'line_number': parser.command.line,
                'instructions': res['instructions'],
            });
        } else {
            return {'error': `Unknown command "${order}"`, 'line': parser.currentLine};
        }
    }
    return commands;
}

const EXPORTS = {
    'parseContent': parseContent,
    'COLOR_CHECK_ERROR': COLOR_CHECK_ERROR,
};

for (const func of Object.values(ORDERS)) {
    EXPORTS[func.name] = func;
}

// Those functions shouldn't be used directly!
module.exports = EXPORTS;
