# browser-UI-test

Small JS framework to easily provide UI screenshot-based tests.

## Details

This framework provides the possibility to quickly check browser UI through small script files (with the `.gom` extension). Once the script is done, it takes a screenshot of the page and compares it to the expected one. If they're different, the test will fail.

## `.gom` scripts

Those scripts aim to be as quick to write and as small as possible. To do so, they provide a short list of commands. Please note that those scripts must **always** start with a [`goto`](#goto) command.

Here's the command list:

 * [`click`](#click)
 * [`waitfor`](#waitfor)
 * [`focus`](#focus)
 * [`write`](#write)
 * [`movecursorto`](#movecursorto)
 * [`goto`](#goto)
 * [`scrollto`](#scrollto)
 * [`size`](#size)
 * [`localstorage`](#localstorage)

#### click

**click** command send a click event on an element or at the specified position. It expects a CSS selector (a class name or an id) or a position. Examples:

```
click: .element
click: #element
click: (10, 12)
```

#### waitfor

**waitfor** command waits for a given duration or for an element to be created. It expects a CSS selector (a class name or an id) or a duration in milliseconds.

**/!\\** Be careful when using it: if the given selector never appears, the test will hang forever.

Examples:

```
waitfor: .element
waitfor: #element
waitfor: 1000
```

#### focus

**focus** command focuses (who would have guessed?) on a given element. It expects a CSS selector (a class name or an id). Examples:

```
focus: .element
focus: #element
```

#### write

**write** command sends keyboard inputs on given element. If no element is provided, it'll write into the currently focused element. It expects a string and/or a CSS selector (a class name or an id). The string has to be surrounded by quotes (either `'` or `"`). Examples:

```
write: .element "text"
write: #element "text"
write: "text"
```

#### movecursorto

**movecursorto** command moves the mouse cursor to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector (a class name or an id). Examples:

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

**scrollto** command scrolls to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector (a class name or an id). Examples:

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

### Comments?

You can add comments in the `.gom` scripts with `// ` (the whitespace is mandatory). Example:

```
goto: https://somewhere.com // let's start somewhere!
```
