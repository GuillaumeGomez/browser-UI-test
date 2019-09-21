# browser-UI-test

Small JS framework to easily provide UI screenshot-based tests.

## Description

This framework provides the possibility to quickly check browser UI through small script files (with the `.goml` extension). By default, once the script is done running, it takes a screenshot of the page and compares it to the expected one. If they're different, the test will fail.

## Usage

You can either use this framework by using it as dependency or running it directly. In both cases you'll need to write some `.goml` scripts. It looks like this:

```
goto: https://somewhere.com // go to this url
text: ("#button", "hello") // set text of element #button
assert: ("#button", "hello") // check if #button element's text has been set to "hello"
```

### Using this framework as a binary

If you installed it, you should have a script called "browser-ui-test". You can run it as follows:

```bash
$ browser-ui-test --test-files some-file.goml
```

To see the list of available options, use `-h` or `--help`:

```bash
$ browser-ui-test --help
```

### Using this framework as a dependency

You can do so by importing both `runTests` and `Options` from `index.js`. `Options` is a class where you can set the parameters you need/want. If you feel better providing "command-line args"-like parameters, you can use it as follows:

```js
const {Options, runTests} = require('browser-ui-test');

const options = new Options();
try {
    // This is more convenient that setting fields one by one.
    options.parseArguments(['--no-screenshot', '--test-folder', 'some-other-place']);
} catch (error) {
    console.error(`invalid argument: ${error}`);
    process.exit(1);
}
```

Then you just pass this `options` variable to the `runTests` function and it's done:

```js
runTests(options).then(x => {
    const [output, nb_failures] = x;
    console.log(output);
    process.exit(nb_failures);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
```

To be noted that there is also a function `runTest` which only runs the specified test file:

```js
const {runTest} = require('browser-ui-test');

runTest('someFile.goml').then(x => {
    const [output, nb_failures] = x;
    console.log(output);
    process.exit(nb_failures);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
```

### Exported elements

Like said above, you can use this framework through code directly. Here is the list of available elements:

 * `runTest`: Function to run a specific test. Parameters:
   * testPath: String [MANDATORY]
   * options: `Options` type [OPTIONAL]
   * saveLogs: Boolean [OPTIONAL]
 * `runTests`: Function to run tests based on the received options. Parameters:
   * options: `Options` type [OPTIONAL]
   * saveLogs: Boolean [OPTIONAL]
 * `Options`: Object used to store run options. More information follows in the [`Options`](#Options) section.

#### Options

If you want to see all the available options, just run with the `-h` or `--help` options. If you want to build the `Options` object yourself, you might be interested by what follows.

The list of fields of the `Options` class is the following:

 * `debug`: display more information
 * `emulate`: name of the device you want to emulate (list of available devices is [here](https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js) or you can use `--show-devices` option)
 * `extensions`: extensions to be loaded by the browser
 * `failureFolder`: path of the folder where failed tests image will be placed (`testFolder` value by default)
 * `generateImages`: if provided, it'll generate test images and won't run comparison tests
 * `imageFolder`: path of the folder where screenshots are and where they are generated (`testFolder` value by default)
 * `noHeadless`: disable headless mode
 * `noScreenshot`: disable screenshots generation and comparison at the end of the scripts
 * `onPageCreatedCallback`: callback which is called when a new puppeteer page is created. **It needs to be an async function!**
 * `permissions`: List of permissions to enable (you can see the full list by running with `--show-permissions`)
 * `runId`: id to be used for failed images extension ('test' by default)
 * `showText`: disable text invisibility (be careful when using it!)
 * `testFiles`: list of `.goml` files' path to be run
 * `testFolder`: path of the folder where `.goml` script files are
 * `timeout`: number of milliseconds that'll be used as default timeout for all commands interacting with the browser. Defaults to 30 seconds, cannot be less than 0, if 0, it means it'll wait undefinitely so use it carefully!
 * `variables`: variables to be used in the `.goml` scripts (more information about variables [below](#Variables))

### Running it directly

You need to pass options through the command line but it's basically the same as doing it with code. Let's run it with the same options as presented above:

```bash
$ node src/index.js --test-folder some-other-place
```

## Font issues

Unfortunately, font rendering differs depending on the computer **and** on the OS. To bypass this problem but still allow to have a global UI check, the text is invisible by default. If you are **sure** that you need to check with the text visible, you can use the option `--show-text`.

## Variables

In this framework, you can use variables defined through the `--variable` option or through your environment. For example, if you start your script with:

```
A_VARIABLE=12 node src/index.js --test-folder tests/scripts/ --variable DOC_PATH tests/html_files --variable ANOTHER_ONE 42
```

You will have three variables that you'll be able to use (since `A_VARIABLE` is available through your environment). Then, to use them in your scripts, you need to put their name between `|` characters:

```
text: ("#an-element", |A_VARIABLE|)
```

In here, it'll set "#an-element" element's text to "12".

A small note: the variable `CURRENT_DIR` is always available (and contains the directory where the script has been started) and **cannot** be override! It is also guaranteed to never end with `/` or `\\`.

## `.goml` scripts

Those scripts aim to be as quick to write and as small as possible. To do so, they provide a short list of commands. Please note that those scripts must **always** start with a [`goto`](#goto) command (non-interactional commands such as `screenshot` or `fail` can be use first as well).

Here's the command list:

 * [`assert`](#assert)
 * [`attribute`](#attribute)
 * [`click`](#click)
 * [`css`](#css)
 * [`drag-and-drop`](#drag-and-drop)
 * [`emulate`](#emulate)
 * [`fail`](#fail)
 * [`focus`](#focus)
 * [`geolocation`](#geolocation)
 * [`goto`](#goto)
 * [`javascript`](#javascript)
 * [`local-storage`](#local-storage)
 * [`move-cursor-to`](#move-cursor-to)
 * [`permissions`](#permissions)
 * [`reload`](#reload)
 * [`screenshot`](#screenshot)
 * [`scroll-to`](#scroll-to)
 * [`show-text`](#show-text)
 * [`size`](#size)
 * [`text`](#text)
 * [`timeout`](#timeout)
 * [`wait-for`](#wait-for)
 * [`write`](#write)

#### assert

**assert** command checks if the condition is true, otherwise fail. Four different functionalities are available:

```
// will check that "#id > .class" exists
assert: ("#id > .class")
// will check that first "#id > .class" has text "hello"
assert: ("#id > .class", "hello")
// will check that there are 2 "#id > .class"
assert: ("#id > .class", 2)
// will check that "#id > .class" has blue color
assert: ("#id > .class", { "color": "blue" })
// will check that "#id > .class" has an attribute called "attribute-name" with value "attribute-value"
assert: ("#id > .class", "attribute-name", "attribute-value")
```

#### attribute

**attribute** command allows to update an element's attribute. Example:

```
attribute: ("#button", "attribute-name", "attribute-value")
```

To set multiple attributes at a time, you can use a JSON object:

```
attribute: ("#button", {"attribute name": "attribute value", "another": "x"})
```

#### click

**click** command send a click event on an element or at the specified position. It expects a CSS selector or a position. Examples:

```
click: ".element"
click: "#element > a"
click: (10, 12)
```

#### css

**css** command allows to update an element's style. Example:

```
css: ("#button", "background-color", "red")
```

To set multiple styles at a time, you can use a JSON object:

```
css: ("#button", {"background-color": "red", "border": "1px solid"})
```

#### drag-and-drop

**drag-and-drop** command allows to move an element to another place (assuming it implements the necessary JS and is draggable). It expects a tuple of two elements. Each element can be a position or a CSS selector. Example:

```
drag-and-drop: ("#button", "#destination") // move "#button" to where "#destination" is
drag-and-drop: ("#button", (10, 10)) // move "#button" to (10, 10)
drag-and-drop: ((10, 10), "#button") // move the element at (10, 10) to where "#button" is
drag-and-drop: ((10, 10), (20, 35)) // move the element at (10, 10) to (20, 35)
```

#### emulate

**emulate** command changes the display to look like the targetted device. **It can only be used before the first `goto` call!** Example:

```
emulate: "iPhone 8"
```

To see the list of available devices, either run this framework with `--show-devices` option or go [here](https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js).

#### fail

**fail** command sets a test to be expected to fail (or not). Example:

```
fail: false
```

You can use it as follows too:

```
// text of "#elem" is "hello"
assert: ("#elem", "hello")
text: ("#elem", "not hello")
// we want to check if the text changed (strangely but whatever)
fail: true
assert: ("#elem", "hello")
// now we set it back to false to check the new text
fail: false
assert: ("#elem", "not hello")
```

#### focus

**focus** command focuses (who would have guessed?) on a given element. It expects a CSS selector. Examples:

```
focus: ".element"
focus: "#element"
```

#### geolocation

**geolocation** command allows you to set your position. Please note that you might need to enable the `geolocation` permission in order to make it work. It expects as argument `([longitude], [latitude])`. Examples:

```
permissions: ["geolocation"] // we enable the geolocation permission just in case...
geolocation: (2.3635482, 48.8569108) // position of Paris
geolocation: (144.9337482, -37.7879639) // position of Melbourne
```

#### goto

**goto** command changes the current page to the given path/url. It expects a path (starting with `.` or `/`) or a URL. Examples:

```
goto: https://test.com
goto: http://test.com
goto: /test
goto: ../test
goto: file://some-location/index.html
```

**/!\\** If you want to use `goto` with `file://`, please remember that you must pass a full path to the web browser (from the root). You can access this information direction with `{current-dir}`:

```
goto: file://{current-dir}/my-folder/index.html
```

If you don't want to rewrite your doc path everytime, you can run the test with the `doc-path` argument and then use it as follow:

```
goto: file://{doc-path}/file.html
```

You can of course use `{doc-path}` and `{current-dir}` at the same time:

```
goto: file://{current-dir}/{doc-path}/file.html
```

#### javascript

**javascript** command enables/disables the javascript. If you want to render the page without javascript, don't forget to disable it before the call to `goto`! Examples:

```
javascript: false // we disable it before using goto to have a page rendered without javascript
goto: https://somewhere.com // rendering without javascript
```

#### local-storage

**local-storage** command sets local storage's values. It expect a JSON object. Example:

```
local-storage: {"key": "value", "another key": "another value"}
```

#### move-cursor-to

**move-cursor-to** command moves the mouse cursor to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector. Examples:

```
move-cursor-to: "#element"
move-cursor-to: ".element"
move-cursor-to: (10, 12)
```

#### permissions

**permissions** command allows you to enable some of the browser's permissions. **All non-given permissions  will be disabled!** You can see the list of the permissions with the `--show-permissions` option. Examples:

```
permissions: ["geolocation"] // "geolocation" permission is enabled
permissions: ["camera"] // "camera" permission is enabled and "geolocation" is disabled
```

#### reload

**reload** command reloads the current page. Example:

```
reload:
reload: 12000 // reload the current page with a timeout of 12 seconds
reload: 0 // disable timeout, be careful when using it!
```

#### screenshot

**screenshot** command enables/disables the screenshot at the end of the script (and therefore its comparison). It expects a boolean value or a CSS selector. Example:

```
screenshot: false // disable screenshot comparison at the end of the script
screenshot: "#test" // will take a screenshot of the specified element and compare it at the end
screenshot: true // back to "normal", full page screenshot and comparison
```

#### scroll-to

**scroll-to** command scrolls to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector. Examples:

```
scroll-to: "#element"
scroll-to: ".element"
scroll-to: (10, 12)
```

#### show-text

**show-text** command allows to enable/disable the text hiding. Example:

```
show-text: true // text won't be invisible anymore
```

#### size

**size** command changes the window's size. It expects a tuple of integers (`(width, height)`). Example:

```
size: (700, 1000)
```

#### text

**text** command allows to update an element's text. Example:

```
text: ("#button", "hello")
```

### timeout

**timeout** command allows you to update the timeout of pages' operations. The value is in milliseconds. If you set it to `0`, it'll wait indefinitely (so use it cautiously!). The default value is 30 seconds. Example:

```
timeout: 20000 // set timeout to 20 seconds
timeout: 0 // no more timeout, to be used cautiously!
```

#### wait-for

**wait-for** command waits for a given duration or for an element to be created. It expects a CSS selector or a duration in milliseconds.

**/!\\** Be careful when using it: if the given selector never appears, the test will timeout after 30 seconds by default (can be changed with the `timeout` command).

Examples:

```
wait-for: ".element"
wait-for: "#element > a"
wait-for: 1000
```

#### write

**write** command sends keyboard inputs on given element. If no element is provided, it'll write into the currently focused element. It expects a string and/or a CSS selector. The string has to be surrounded by quotes (either `'` or `"`). Examples:

```
write: (".element", "text")
write: ("#element", "text")
write: "text"
```

### Comments?

You can add comments in the `.goml` scripts with `//`. Example:

```
goto: https://somewhere.com // let's start somewhere!
```

## Run tests

If you want to run this repository's scripts tests:

```bash
$ node src/index.js --test-folder tests/scripts/ --failure-folder failures --variable DOC_PATH tests/html_files
```

Or more simply:

```bash
$ npm test
```

If you want to test "internals", run:

```bash
$ npm run all-test
```

If you want to run test suites separately:

```bash
$ npm run api-test
$ npm run parser-test
$ npm run exported-test
```

## Donations

If you appreciate my work and want to support me, you can do it here:

[![Become a patron](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/GuillaumeGomez)
