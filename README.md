# browser-UI-test

Small JS framework to easily provide UI screenshot-based tests.

## Description

This framework provides the possibility to quickly check browser UI through small script files (with the `.gom` extension). Once the script is done, it takes a screenshot of the page and compares it to the expected one. If they're different, the test will fail.

## Usage

You can use it either by providing it the folder with the `.gom` files to run or import it like this:

```js
const runTests = require('browser-ui-test').runTests;

runTests(['--test-folder', 'tests/scripts/',
          '--failure-folder', 'failures',
          '--doc-path', 'tests/html_files/']).then(result => {
    const [output, nb_failures] = result;
    if (nb_failures === 0) {
        console.log('Tests succeeded!');
    } else {
        console.error(`Tests failed...\n${output}`);
    }
}).catch(err => {
    console.error(`An error occurred: ${err}`);
});
```

### Font issues

Unfortunately, font rendering differs depending on the computer **and** on the OS. To bypass this problem but still allow to have a global UI check, the text is invisible by default. If you are **sure** that you need to check with the text visible, you can use the option `--show-text`.

## Using this framework as a dependency

You can do so by importing both `runTests` and `Options` from `tester.js`. `Options` is a class where you can set the parameters you need/want. If you feel better providing "command-line args"-like parameters, you can use it as follows:

```js
let options = new Options();
try {
    options.parseArguments(['--doc-path', 'somewhere', '--test-folder', 'some-other-place']);
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

### Options

The list of fields of the `Options` class is the following:

 * testFolder: path of the folder where `.gom` script files are
 * failureFolder: path of the folder where failed tests image will be placed
 * runId: id to be used for failed images extension ('test' by default)
 * generateImages: if provided, it'll generate test images and won't run comparison tests
 * docPath: doc path to be used on `goto` local paths
 * noHeadless: disable headless mode
 * showText: disable text invisibility (be careful when using it!)
 * debug: display more information
 * noScreenshot: disable screenshots at the end of the scripts by the end

## Run tests

If you want to run this repository's tests:

```bash
$ node src/tester.js --test-folder tests/scripts/ --failure-folder failures --doc-path tests/html_files/
```

## `.gom` scripts

Those scripts aim to be as quick to write and as small as possible. To do so, they provide a short list of commands. Please note that those scripts must **always** start with a [`goto`](#goto) command.

Here's the command list:

 * [`assert`](#assert)
 * [`attribute`](#attribute)
 * [`click`](#click)
 * [`focus`](#focus)
 * [`goto`](#goto)
 * [`localstorage`](#localstorage)
 * [`movecursorto`](#movecursorto)
 * [`screenshot`](#screenshot)
 * [`scrollto`](#scrollto)
 * [`size`](#size)
 * [`text`](#text)
 * [`waitfor`](#waitfor)
 * [`write`](#write)

#### click

**click** command send a click event on an element or at the specified position. It expects a CSS selector or a position. Examples:

```
click: .element
click: #element > a
click: (10, 12)
```

#### waitfor

**waitfor** command waits for a given duration or for an element to be created. It expects a CSS selector or a duration in milliseconds.

**/!\\** Be careful when using it: if the given selector never appears, the test will timeout after 30 seconds.

Examples:

```
waitfor: .element
waitfor: #element > a
waitfor: 1000
```

#### focus

**focus** command focuses (who would have guessed?) on a given element. It expects a CSS selector. Examples:

```
focus: .element
focus: #element
```

#### write

**write** command sends keyboard inputs on given element. If no element is provided, it'll write into the currently focused element. It expects a string and/or a CSS selector. The string has to be surrounded by quotes (either `'` or `"`). Examples:

```
write: .element "text"
write: #element "text"
write: "text"
```

#### movecursorto

**movecursorto** command moves the mouse cursor to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector. Examples:

```
movecursorto: #element
movecursorto: .element
movecursorto: (10, 12)
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

#### scrollto

**scrollto** command scrolls to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector. Examples:

```
scrollto: #element
scrollto: .element
scrollto: (10, 12)
```

#### size

**size** command changes the window's size. It expects a tuple of integers (`(width, height)`). Example:

```
size: (700, 1000)
```

#### localstorage

**localstorage** command sets local storage's values. It expect a JSON object. Example:

```
localstorage: {"key": "value", "another key": "another value"}
```

#### screenshot

**screenshot** command enables/disables the screenshot at the end of the script (and therefore its comparison). It expects a boolean value. Example:

```
screenshot: false
```

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
```

#### text

**text** command allows to update an element's text. Example:

```
text: ("#button", "hello")
```

#### attribute

**attribute** command allows to update an element's attribute. Example:

```
attribute: ("#button", "attribute-name", "attribute-value")
```

### Comments?

You can add comments in the `.gom` scripts with `// ` (the whitespace is mandatory). Example:

```
goto: https://somewhere.com // let's start somewhere!
```
