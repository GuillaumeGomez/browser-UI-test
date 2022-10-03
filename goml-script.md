# `.goml` scripts

This file describes how the `.goml` format works.

## Quick links

 * [Add comments in scripts](#add-comments-in-scripts)
 * [Multiline commands/strings?](#multiline-commandsstrings)
 * [Variables](#variables)
 * [Concatenation](#concatenation)
 * [Command list](#command-list)

## Add comments in scripts

You can add comments in the `.goml` scripts with `//`. Example:

```
goto: https://somewhere.com // let's start somewhere!
```

## Multiline commands/strings?

You can have a command/string on more than one line. For example:

```
write: (
    ".elements",
    "multi
line
text"
)
```

## Variables

In this framework, you can use variables defined through the `--variable` option or through your
environment. For example, if you start your script with:

```
A_VARIABLE=12 node src/index.js --test-folder tests/scripts/ --variable DOC_PATH tests/html_files --variable ANOTHER_ONE 42
```

You will have three variables that you'll be able to use (since `A_VARIABLE` is available through your environment). Then, to use them in your scripts, you need to put their name between `|` characters:

```
text: ("#an-element", |A_VARIABLE|)
```

In here, it'll set "#an-element" element's text to "12".

If you want to set a variable from inside a script, use one of the `store-*` commands. Important to be noted: the created variables only override the variables set with `--variable` in the current script and don't change environment variables.

A small note: the variable `CURRENT_DIR` is always available (and contains the directory where the script has been started) and **cannot** be override! It is also guaranteed to never end with `/` or `\\`.

## Concatenation

You can concatenate numbers and strings using the `+` sign:

```
store-value: (effect, ":hover")
text: ("element" + |effect|, "something " + 2 + " something else")
```

Rules of concatenation s simple: if any of the element is a string, then it'll concatenate as a string. Examples:

```
1 + 2 + "a" // gives "12a"
1 + 2 // gives "3"
```

## Command list

Those scripts aim to be as quick to write and as small as possible. To do so, they provide a short list of commands. Please note that those scripts must **always** start with a [`goto`](#goto) command (non-interactional commands such as `screenshot-comparison` or `fail` can be use first as well).

Here's the command list:

 * [`assert`](#assert)
 * [`assert-false`](#assert-false)
 * [`assert-attribute`](#assert-attribute)
 * [`assert-attribute-false`](#assert-attribute-false)
 * [`assert-count`](#assert-count)
 * [`assert-count-false`](#assert-count-false)
 * [`assert-css`](#assert-css)
 * [`assert-css-false`](#assert-css-false)
 * [`assert-document-property`](#assert-document-property)
 * [`assert-document-property-false`](#assert-document-property-false)
 * [`assert-local-storage`](#assert-local-storage)
 * [`assert-local-storage-false`](#assert-local-storage-false)
 * [`assert-position`](#assert-position)
 * [`assert-position-false`](#assert-position-false)
 * [`assert-property`](#assert-property)
 * [`assert-property-false`](#assert-property-false)
 * [`assert-text`](#assert-text)
 * [`assert-text-false`](#assert-text-false)
 * [`assert-variable`](#assert-variable)
 * [`assert-variable-false`](#assert-variable-false)
 * [`assert-window-property`](#assert-window-property)
 * [`assert-window-property-false`](#assert-window-property-false)
 * [`attribute`](#attribute)
 * [`click`](#click)
 * [`click-with-offset`](#click-with-offset)
 * [`compare-elements-attribute`](#compare-elements-attribute)
 * [`compare-elements-attribute-false`](#compare-elements-attribute-false)
 * [`compare-elements-css`](#compare-elements-css)
 * [`compare-elements-css-false`](#compare-elements-css-false)
 * [`compare-elements-position`](#compare-elements-position)
 * [`compare-elements-position-false`](#compare-elements-position-false)
 * [`compare-elements-position-near`](#compare-elements-position-near)
 * [`compare-elements-position-near-false`](#compare-elements-position-near-false)
 * [`compare-elements-property`](#compare-elements-property)
 * [`compare-elements-property-false`](#compare-elements-property-false)
 * [`compare-elements-text`](#compare-elements-text)
 * [`compare-elements-text-false`](#compare-elements-text-false)
 * [`css`](#css)
 * [`debug`](#debug)
 * [`drag-and-drop`](#drag-and-drop)
 * [`emulate`](#emulate)
 * [`fail`](#fail)
 * [`fail-on-js-error`](#fail-on-js-error)
 * [`focus`](#focus)
 * [`font-size`](#font-size)
 * [`geolocation`](#geolocation)
 * [`goto`](#goto)
 * [`history-go-back`](#history-go-back)
 * [`history-go-forward`](#history-go-forward)
 * [`javascript`](#javascript)
 * [`local-storage`](#local-storage)
 * [`move-cursor-to`](#move-cursor-to)
 * [`pause-on-error`](#pause-on-error)
 * [`permissions`](#permissions)
 * [`press-key`](#press-key)
 * [`reload`](#reload)
 * [`screenshot`](#screenshot)
 * [`screenshot-comparison`](#screenshot-comparison)
 * [`scroll-to`](#scroll-to)
 * [`show-text`](#show-text)
 * [`size`](#size)
 * [`store-attribute`](#store-attribute)
 * [`store-css`](#store-css)
 * [`store-local-variable`](#store-local-variable)
 * [`store-property`](#store-property)
 * [`store-value`](#store-value)
 * [`text`](#text)
 * [`timeout`](#timeout)
 * [`wait-for`](#wait-for)
 * [`wait-for-attribute`](#wait-for-attribute)
 * [`wait-for-css`](#wait-for-css)
 * [`wait-for-text`](#wait-for-text)
 * [`write`](#write)

#### assert

**assert** command checks that the element exists, otherwise fail. Examples:

```
// To be noted: all following examples can use XPath instead of CSS selector.

// will check that "#id > .class" exists
assert: "#id > .class"
assert: ("#id > .class") // strictly equivalent
```

#### assert-false

**assert-false** command checks that the element doesn't exist, otherwise fail. It's mostly doing the opposite of [`assert`](#assert). Examples:

```
// To be noted: all following examples can use XPath instead of CSS selector.

// will check that "#id > .class" doesn't exists
assert-false: "#id > .class"
assert-false: ("#id > .class") // strictly equivalent
```

#### assert-attribute

**assert-attribute** command checks that the given attribute(s) of the element(s) have the expected value. If the element or one of the attributes doesn't exist, the command will fail. Examples:

```
assert-attribute: ("#id > .class", {"attribute-name": "attribute-value"})
assert-attribute: ("//*[@id='id']/*[@class='class']", {"key1": "value1", "key2": "value2"})

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-attribute: ("#id > .class", {"attribute-name": "attribute-value"}, ALL)
assert-attribute: ("//*[@id='id']/*[@class='class']", {"key1": "value1", "key2": "value2"}, ALL)
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-attribute: (
    "#id",
    {"class": "where", "title": "a title"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
assert-attribute: (
    "#id",
    {"class": "where", "title": "a title"},
    [STARTS_WITH, ENDS_WITH, ALL],
)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements`](#compare-elements-attribute) command.

#### assert-attribute-false

**assert-attribute-false** command checks that the given attribute(s) of the element(s) don't have the given value. If the element doesn't exist, the command will fail. Examples:

```
// IMPORTANT: "#id > .class" has to exist otherwise the command will fail!
assert-attribute-false: ("#id > .class", {"attribute-name": "attribute-value"})
assert-attribute-false: ("//*[@id='id']/*[@class='class']", {"key1": "value1", "key2": "value2"})

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-attribute-false: ("#id > .class", {"attribute-name": "attribute-value"}, ALL)
assert-attribute-false: ("//*[@id='id']/*[@class='class']", {"key1": "value1", "key2": "value2"}, ALL)
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-attribute-false: (
    "#id",
    {"class": "where", "title": "a title"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
assert-attribute-false: (
    "#id",
    {"class": "where", "title": "a title"},
    [STARTS_WITH, ENDS_WITH, ALL],
)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements-false`](#compare-elements-attribute-false) command.

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### assert-count

**assert-count** command checks that there are exactly the number of occurrences of the provided selector/XPath. Examples:

```
// will check that there are 2 "#id > .class"
assert-count: ("#id > .class", 2)
assert-count: ("//*[@id='id']/*[@class='class']", 2)
```

#### assert-count-false

**assert-count-false** command checks that there are not the number of occurrences of the provided selector/XPath. Examples:

```
// will check that there are not 2 "#id > .class"
assert-count-false: ("#id > .class", 2)
assert-count-false: ("//*[@id='id']/*[@class='class']", 2)
```

#### assert-css

**assert-css** command checks that the CSS properties of the element(s) have the expected value. Examples:

```
assert-css: ("#id > .class", { "color": "blue" })
assert-css: ("//*[@id='id']/*[@class='class']", { "color": "blue", "height": "10px" })

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-css: ("#id > .class", { "color": "blue" }, ALL)
assert-css: ("//*[@id='id']/*[@class='class']", { "color": "blue", "height": "10px" }, ALL)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements`](#compare-elements-css) command.

#### assert-css-false

**assert-css-false** command checks that the CSS properties of the element(s) don't have the provided value. If the element doesn't exist, the command will fail. Examples:

```
assert-css-false: ("#id > .class", { "color": "blue" })
assert-css-false: ("//*[@id='id']/*[@class='class']", { "color": "blue", "height": "10px" })

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-css-false: ("#id > .class", { "color": "blue" }, ALL)
assert-css-false: ("//*[@id='id']/*[@class='class']", { "color": "blue", "height": "10px" }, ALL)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements-false`](#compare-elements-css-false) command.

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### assert-document-property

**assert-document-property** command checks the properties' value of the `document` object of a webpage have the provided value. So if you want to check the current page's URL or title, this is the command you need. Examples:

```
assert-document-property: ({"URL": "https://some.where", "title": "a title"})
// If you only provide properties, you can also only provide a JSON dict:
assert-document-property: {"URL": "https://some.where", "title": "a title"}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-document-property: ({"URL": "https://some.where", "title": "a title"}, STARTS_WITH)
```

You can even combine the checks:

```
assert-document-property: ({"URL": "https://some.where", "title": "a title"}, [STARTS_WITH, ENDS_WITH])
```

#### assert-document-property-false

**assert-document-property-false** command checks the properties' value of the `document` object of a webpage don't have the provided value. So if you want to check the current page's URL or title, this is the command you need. Examples:

```
assert-document-property-false: ({"URL": "https://some.where", "title": "a title"})
// If you only provide properties, you can also only provide a JSON dict:
assert-document-property-false: {"URL": "https://some.where", "title": "a title"}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-document-property-false: ({"URL": "https://some.where", "title": "a title"}, STARTS_WITH)
```

You can even combine the checks:

```
assert-document-property-false: ({"URL": "https://some.where", "title": "a title"}, [STARTS_WITH, ENDS_WITH])
```

#### assert-local-storage

**assert-local-storage** command checks that the local storage key has the given value. Examples:

```
assert-local-storage: {"key": "value"}

// If you want to check that the key doesn't exist:
assert-local-storage: {"key": null}
```

#### assert-local-storage-false

**assert-local-storage-false** command checks that the local storage key doesn't have the same value as the provided one. Examples:

```
assert-local-storage-false: {"key": "value"}

// If you want to check that the key exists:
assert-local-storage-false: {"key": null}
```

#### assert-position

**assert-position** command checks that the element(s) position matches the expected. Only `x` and `y` values are accepted as keys for the positions. Examples:

```
assert-position: (".class", {"x": 1, "y": 2})
assert-position: ("//*[@class='class']", {"x": 1, "y": 2})

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-position: (".class", {"x": 1, "y": 2}, ALL)
assert-position: ("//*[@class='class']", {"x": 1, "y": 2}, ALL)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements-position`](#compare-elements-position) command.

#### assert-position-false

**assert-position-false** command checks that the element(s) position **does not** match the expected. Only `x` and `y` values are accepted as keys for the positions. Examples:

```
assert-position-false: (".class", {"x": 1, "y": 2})
assert-position-false: ("//*[@class='class']", {"x": 1, "y": 2})

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-position-false: (".class", {"x": 1, "y": 2}, ALL)
assert-position-false: ("//*[@class='class']", {"x": 1, "y": 2}, ALL)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements-position-false`](#compare-elements-position-false) command.

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### assert-property

**assert-property** command checks that the DOM properties of the element(s) have the expected value. Examples:

```
assert-property: ("#id > .class", { "offsetParent": "null" })
assert-property: ("//*[@id='id']/*[@class='class']", { "offsetParent": "null", "clientTop": "10px" })

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-property: ("#id > .class", { "offsetParent": "null" }, ALL)
assert-property: ("//*[@id='id']/*[@class='class']", { "offsetParent": "null", "clientTop": "10px" }, ALL)
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-property: (
    "#id",
    {"className": "where", "title": "a title"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
assert-property: (
    "#id",
    {"className": "where", "title": "a title"},
    [STARTS_WITH, ENDS_WITH, ALL],
)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements`](#compare-elements-property) command.

#### assert-property-false

**assert-property-false** command checks that the CSS properties of the element(s) don't have the provided value. If the element doesn't exist, the command will fail. Examples:

```
assert-property-false: ("#id > .class", { "offsetParent": "null" })
assert-property-false: ("//*[@id='id']/*[@class='class']", { "offsetParent": "null", "clientTop": "10px" })

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-property-false: ("#id > .class", { "offsetParent": "null" }, ALL)
assert-property-false: ("//*[@id='id']/*[@class='class']", { "offsetParent": "null", "clientTop": "10px" }, ALL)
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-property-false: (
    "#id",
    {"className": "where", "title": "a title"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
assert-property-false: (
    "#id",
    {"className": "where", "title": "a title"},
    [STARTS_WITH, ENDS_WITH, ALL],
)
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements-false`](#compare-elements-property-false) command.

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### assert-text

**assert-text** command checks that the element(s) have the expected text. Examples:

```
assert-text: ("#id > .class", "hello")
assert-text: ("//*[@id='id']/*[@class='class']", "hello")

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-text: ("#id > .class", "hello", ALL)
assert-text: ("//*[@id='id']/*[@class='class']", "hello", ALL)
```

Apart from "ALL", you can also use "CONTAINS", "ENDS_WITH" and "STARTS_WITH" and even combine them if you want. Example:

```
assert-text: (".class", "hello", CONTAINS)
// To check that all ".class" elements contain "hello":
assert-text: (".class", "hello", [ALL, CONTAINS])
// To check that all ".class" elements start and end with "hello":
assert-text: (".class", "hello", [ALL, STARTS_WITH, ENDS_WITH])
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements`](#compare-elements-text) command.

#### assert-text-false

**assert-text-false** command checks that the element(s) don't have the provided text. If the element doesn't exist, the command will fail. Examples:

```
assert-text-false: ("#id > .class", "hello")
assert-text-false: ("//*[@id='id']/*[@class='class']", "hello")

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-text-false: ("#id > .class", "hello", ALL)
assert-text-false: ("//*[@id='id']/*[@class='class']", "hello", ALL)
```

Apart from "ALL", you can also use "CONTAINS", "ENDS_WITH" and "STARTS_WITH" and even combine them if you want. Example:

```
assert-text-false: (".class", "hello", CONTAINS)
// To check that no ".class" element contains "hello":
assert-text: (".class", "hello", [ALL, CONTAINS])
// To check that all ".class" elements don't start nor end with "hello":
assert-text: (".class", "hello", [ALL, STARTS_WITH, ENDS_WITH])
```

Please note that if you want to compare DOM elements, you should take a look at the [`compare-elements-false`](#compare-elements-text-false) command.

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### assert-variable

**assert-variable** commands checks that the value of the given variable is the one provided. Examples:

```
assert-variable: (variable_name, "hello")
assert-variable: (variable_name, "hel", CONTAINS)
assert-variable: (variable_name, 12)
assert-variable: (variable_name, 12.1)
```

Apart from "CONTAINS", you can also use "ENDS_WITH" and "STARTS_WITH" and even combine them if you want. Example:

```
assert-variable: (variable_name, "hel", [CONTAINS, STARTS_WITH])
```

For more information about variables, read the [variables section](#variables).

#### assert-variable-false

**assert-variable-false** commands checks that the value of the given variable is not the one provided. Examples:

```
assert-variable-false: (variable_name, "hello")
assert-variable-false: (variable_name, "hel", CONTAINS)
assert-variable-false: (variable_name, 12)
assert-variable-false: (variable_name, 12.1)
```

Apart from "CONTAINS", you can also use "ENDS_WITH" and "STARTS_WITH" and even combine them if you want. Example:

```
assert-variable-false: (variable_name, "hel", [CONTAINS, ENDS_WITH])
```

For more information about variables, read the [variables section](#variables).

#### assert-window-property

**assert-window-property** command checks the properties' value of the `window` object of a webpage have the provided value. Examples:

```
assert-window-property: ({"pageYOffset": "0", "location": "https://some.where"})
// If you only provide properties, you can also only provide a JSON dict:
assert-window-property: {"pageYOffset": "0", "location": "https://some.where"}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-window-property: (
    {"location": "https://some.where", "pageYOffset": "0"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
assert-window-property: (
    {"location": "https://some.where", "pageYOffset": "0"},
    [STARTS_WITH, ENDS_WITH],
)
```

#### assert-window-property-false

**assert-window-property-false** command checks the properties' value of the `window` object of a webpage don't have the provided value. Examples:

```
assert-window-property-false: ({"location": "https://some.where", "pageYOffset": "10"})
// If you only provide properties, you can also only provide a JSON dict:
assert-window-property-false: {"location": "https://some.where", "pageYOffset": "10"}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH" or "STARTS_WITH".

```
assert-window-property-false: (
    {"location": "https://some.where", "pageYOffset": "10"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
assert-windo-property-false: (
    {"location": "https://some.where", "pageYOffset": "10"},
    [STARTS_WITH, ENDS_WITH],
)
```

#### attribute

**attribute** command allows to update an element's attribute. Example:

```
attribute: ("#button", "attribute-name", "attribute-value")
// Same but with a XPath:
attribute: ("//*[@id='button']", "attribute-name", "attribute-value")
```

To set multiple attributes at a time, you can use a JSON object:

```
attribute: ("#button", {"attribute name": "attribute value", "another": "x"})
// Same but with a XPath:
attribute: ("//*[@id='button']", {"attribute name": "attribute value", "another": "x"})
```

#### click

**click** command send a click event on an element or at the specified position. It expects a CSS selector or an XPath or a position. Examples:

```
click: ".element"
// Same but with an XPath:
click: "//*[@class='element']"

click: "#element > a"
// Same but with an XPath:
click: "//*[@id='element']/a"

click: (10, 12)
```

#### click-with-offset

**click-with-offset** command send a click event on an element after applying the provided offset. It expects a CSS selector or an XPath and a JSON dictionary. Examples:

```
// Clicking on `.element` but adding an offset of 10 on `X`.
click-with-offset: (".element", {"x": 10}
// Same but with an XPath:
click-with-offset: ("//*[@class='element']", {"x": 10}

click-with-offset: (".element", {"x": 10, "y": 3}
click-with-offset: (".element", {"y": 3}
```

#### compare-elements-attribute

**compare-elements-attribute** command allows you to compare two DOM elements' attributes. By default, it's checking if they're equal Examples:

```
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX", ...])
compare-elements-attribute: ("//element1", "element2", ["attribute1", "attributeX", ...])

// The two previous commands can be written like this too:
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX", ...], "=")
compare-elements-attribute: ("//element1", "element2", ["attribute1", "attributeX", ...], "=")
```

Here is the list of the supported operators: `=`, `<`, `>`, `<=`, `>=`.

Examples:

```
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX", ...], "<")
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX", ...], ">=")
```

#### compare-elements-attribute-false

**compare-elements-attribute-false** command allows you to check that two DOM elements' attributes (and assuming the comparison will fail). If one of the elements doesn't exist, the command will fail. Examples:

```
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX", ...])
compare-elements-attribute-false: ("//element1", "element2", ["attribute1", "attributeX", ...])

// The two previous commands can be written like this too:
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX", ...], "=")
compare-elements-attribute-false: ("//element1", "element2", ["attribute1", "attributeX", ...], "=")
```

Here is the list of the supported operators: `=`, `<`, `>`, `<=`, `>=`.

Examples:

```
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX", ...], "<")
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX", ...], ">=")
```

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### compare-elements-css

**compare-elements-css** command allows you to check that two DOM elements' CSS properties are equal. Examples:

```
compare-elements-css: ("element1", "//element2", ["CSS property1", "CSS property2", ...])
compare-elements-css: ("//element1", "element2", ["CSS property1", "CSS property2", ...])
```

#### compare-elements-css-false

**compare-elements-css-false** command allows you to check that two DOM elements' CSS properties are different. If one of the elements doesn't exist, the command will fail. Examples:

```
compare-elements-css-false: ("element1", "//element2", ["CSS property1", "CSS property2", ...])
compare-elements-css-false: ("//element1", "element2", ["CSS property1", "CSS property2", ...])
```

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### compare-elements-position

**compare-elements-position** command allows you to check that two DOM elements' X/Y positions are equal. Examples:

```
// Compare the X position.
compare-elements-position: ("//element1", "element2", ("x"))
// Compare the Y position.
compare-elements-position: ("element1", "//element2", ("y"))
// Compare the X and Y positions.
compare-elements-position: ("//element1", "//element2", ("x", "y"))
// Compare the Y and X positions.
compare-elements-position: ("element1", "element2", ("y", "x"))
```

#### compare-elements-position-false

**compare-elements-position-false** command allows you to check that two DOM elements' X/Y positions are different. If one of the elements doesn't exist, the command will fail. Examples:

```
// Compare the X position.
compare-elements-position-false: ("//element1", "element2", ("x"))
// Compare the Y position.
compare-elements-position-false: ("element1", "//element2", ("y"))
// Compare the X and Y positions.
compare-elements-position-false: ("//element1", "//element2", ("x", "y"))
// Compare the Y and X positions.
compare-elements-position-false: ("element1", "element2", ("y", "x"))
```

#### compare-elements-position-near

**compare-elements-position-near** command allows you to check that two DOM elements' X/Y positions are within the given pixel range. Examples:

```
// Compare the X position.
compare-elements-position-near: ("//element1", "element2", {"x": 1}))
// Compare the Y position.
compare-elements-position-near: ("element1", "//element2", {"y": 1})
// Compare both X and Y positions.
compare-elements-position-near: ("//element1", "//element2", {"x": 4, "y": 2})
// Compare both Y and X positions.
compare-elements-position-near: ("element1", "element2", {"y": 3, "x": 1})
```

#### compare-elements-position-near-false

**compare-elements-position-near-false** command allows you to check that two DOM elements' X/Y positions differ by more than the given pixel range. If one of the elements doesn't exist, the command will fail. Examples:

```
// Compare the X position.
compare-elements-position-near-false: ("//element1", "element2", {"x": 1}))
// Compare the Y position.
compare-elements-position-near-false: ("element1", "//element2", {"y": 1})
// Compare both X and Y positions.
compare-elements-position-near-false: ("//element1", "//element2", {"x": 4, "y": 2})
// Compare both Y and X positions.
compare-elements-position-near-false: ("element1", "element2", {"y": 3, "x": 1})
```

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### compare-elements-property

**compare-elements-property** command allows you to check that two DOM elements' CSS properties are equal. Examples:

```
compare-elements-property: ("element1", "//element2", ["CSS property1", "CSS property2", ...])
compare-elements-property: ("//element1", "element2", ["CSS property1", "CSS property2", ...])
```

#### compare-elements-property-false

**compare-elements-property-false** command allows you to check that two DOM elements' CSS properties are different. If one of the elements doesn't exist, the command will fail. Examples:

```
compare-elements-property-false: ("element1", "//element2", ["CSS property1", "CSS property2", ...])
compare-elements-property-false: ("//element1", "element2", ["CSS property1", "CSS property2", ...])
```

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### compare-elements-text

**compare-elements-text** command allows you to compare two DOM elements' text content. Examples:

```
compare-elements-text: ("element1", "element2")
compare-elements-text: ("//element1", "element2")
```

#### compare-elements-text-false

**compare-elements-text-false** command allows you to compare two DOM elements (and check they're not equal!). If one of the elements doesn't exist, the command will fail. Examples:

```
compare-elements-text-false: ("//element1", "element2")
compare-elements-text-false: ("element1", "//element2")
```

Another thing to be noted: if you don't care wether the selector exists or not either, take a look at the [`fail`](#fail) command too.

#### css

**css** command allows to update an element's style. Example:

```
css: ("#button", "background-color", "red")
// Same but with an XPath:
css: ("//*[@id='button']", "background-color", "red")
```

To set multiple styles at a time, you can use a JSON object:

```
css: ("#button", {"background-color": "red", "border": "1px solid"})
// Same but with an XPath:
css: ("//*[@id='button']", {"background-color": "red", "border": "1px solid"})
```

#### debug

**debug** command enables/disables the debug logging. Example:

```
debug: false // disabling debug in case it was enabled
debug: true // enabling it again
```

#### drag-and-drop

**drag-and-drop** command allows to move an element to another place (assuming it implements the necessary JS and is draggable). It expects a tuple of two elements. Each element can be a position or a CSS selector or an XPath. Example:

```
drag-and-drop: ("#button", "#destination") // move "#button" to where "#destination" is
drag-and-drop: ("//*[@id='button']", (10, 10)) // move "//*[@id='button']" to (10, 10)
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

#### fail-on-js-error

**fail-on-js-error** command sets changes the behaviour of `browser-ui-test` when a JS error occurs on the web page. By default, they are ignored. It overloads the value from the `--enable-on-js-error-fail` option. Example:

```
# To enable the check:
fail-on-js-error: true
```

#### focus

**focus** command focuses (who would have guessed?) on a given element. It expects a CSS selector or an XPath. Examples:

```
focus: ".element"
// Same but with an XPath:
focus: "//*[@class='element']"

focus: "#element"
// Same but with an XPath:
focus: "//*[@id='element']"
```

#### font-size

**font-size** command changes the default font size. Example:

```
font-size: 22 // Default font size will now be 22px.
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

#### history-go-back

**history-go-back** command goes back to the previous page in the browser history. If there no previous page, it'll fail (if you want to check that, take a look at [`fail`](#fail)). Example:

```
history-go-back:
history-go-back: 12000 // wait for the previous page in history to render with a timeout of 12 seconds
history-go-back: 0 // disable timeout, be careful when using it!
```

Please note that if no `timeout` is specified, the one from the [`timeout`](#timeout) command is used.

#### history-go-forward

**history-go-forward** command goes back to the next page in the browser history. If there no next page, it'll fail (if you want to check that, take a look at [`fail`](#fail)). Example:

```
history-go-back:
history-go-back: 12000 // wait for the previous page in history to render with a timeout of 12 seconds
history-go-back: 0 // disable timeout, be careful when using it!
```

Please note that if no `timeout` is specified, the one from the [`timeout`](#timeout) command is used.

#### javascript

**javascript** command enables/disables the javascript. If you want to render the page without javascript, don't forget to disable it before the call to `goto`! Examples:

```
javascript: false // we disable it before using goto to have a page rendered without javascript
goto: https://somewhere.com // rendering without javascript
```

#### local-storage

**local-storage** command sets or removes local storage's entries. It expects a JSON object. Example:

```
local-storage: {"key": "value", "another key": "another value"}

// If you want to remove an entry from the local storage, pass `null` as value:
local-storage: {"key": null}
```

#### move-cursor-to

**move-cursor-to** command moves the mouse cursor to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector. Examples:

```
move-cursor-to: "#element"
// Same but with an XPath:
move-cursor-to: "//*[@id='element']"

move-cursor-to: ".element"
// Same but with an XPath:
move-cursor-to: "//*[@class='element']"

move-cursor-to: (10, 12)
```

#### pause-on-error

**pause-on-error** command enables/disables the pause in case an error occurred. It is enabled by
default when you run in `no-headless` mode.

```
pause-on-error: true // If an error occurs afterward, it'll pause until you press ENTER.
pause-on-error: false
```

#### permissions

**permissions** command allows you to enable some of the browser's permissions. **All non-given permissions  will be disabled!** You can see the list of the permissions with the `--show-permissions` option. Examples:

```
permissions: ["geolocation"] // "geolocation" permission is enabled
permissions: ["camera"] // "camera" permission is enabled and "geolocation" is disabled
```

#### press-key

**press-key** command sends a key event (both **keydown** and **keyup** events). It expects a tuple of `(keycode, delay)` or simply `keycode`. `keycode` is either a string or an integer. `delay` is the time to wait between **keydown** and **keyup** in milliseconds (if not specified, it is 0).

The key codes (both strings and integers) can be found [here](https://github.com/puppeteer/puppeteer/blob/v1.14.0/lib/USKeyboardLayout.js).

Examples:

```
press-key: 'Escape'
press-key: 27 // Same but with an integer
press-key: ('Escape', 1000) // The keyup event will be send after 1000 ms.
```

#### reload

**reload** command reloads the current page. Example:

```
reload:
reload: 12000 // reload the current page with a timeout of 12 seconds
reload: 0 // disable timeout, be careful when using it!
```

Please note that if no `timeout` is specified, the one from the [`timeout`](#timeout) command is used.

#### screenshot

**screenshot** command generates a screenshot with the given name. It can generates a screenshot of a specific element if you give it a CSS selector or an XPath as second argument. Example:

```
// Generates a screenshot for the whole page named `a.png`.
screenshot: "a"
screenshot: ("a") // It does exactly the same thing.

// To generate a screenshot of a specific element:
screenshot: ("a", "#some-id")
screenshot: ("a", "//*[@id='some-id'") // Same thing but with an XPath.
```

#### screenshot-comparison

**screenshot-comparison** command enables/disables the screenshot at the end of the script (and therefore its comparison). It overrides the `--enable-screenshot-comparison` option value. It expects a boolean value or a CSS selector or an XPath. Example:

```
// Enable screenshot comparison at the end of the script:
screenshot-comparison: true

// Will take a screenshot of the specified element and compare it at the end:
screenshot-comparison: "#test"

// Same as the previous example but with an XPath:
screenshot-comparison: "//*[@id='test']"

// Disable screenshot comparison:
screenshot-comparison: false
```

#### scroll-to

**scroll-to** command scrolls to the given position or element. It expects a tuple of integers (`(x, y)`) or a CSS selector. Examples:

```
scroll-to: "#element"
// Same but with an XPath:
scroll-to: "//*[@id='element']"

scroll-to: ".element"
// Same but with an XPath:
scroll-to: "//*[@class='element']"

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

#### store-attribute

**store-attribute** command stores an element's attribute into a variable. Examples:

```
store-attribute: (variable_name, "#button", "id")
assert-variable: (variable_name, "button")
```

For more information about variables, read the [variables section](#variables).

#### store-css

**store-css** command stores an element's CSS into a variable. Examples:

```
store-css: (variable_name, "#button", "color")
assert-variable: (variable_name, "rgb(255, 0, 0)")
```

For more information about variables, read the [variables section](#variables).

#### store-local-variable

**store-local-variable** command stores a value from the local storage into a variable. Examples:

```
local-storage: {"key": "value"}
store-local-storage: (variable_name, "key")
assert-variable: (variable_name, "value")
```

For more information about variables, read the [variables section](#variables).

#### store-property

**store-property** command stores an element's property into a variable. Examples:

```
store-property: (variable_name, "#button", "clientHeight")
assert-variable: (variable_name, 152)
store-property: (variable_name, "#button", "scrollHeight")
```

For more information about variables, read the [variables section](#variables).

#### store-text

**store-text** command stores an element's text into a variable. Examples:

```
store-property: (variable_name, "#button")
assert-variable: (variable_name, "click me")
```

For more information about variables, read the [variables section](#variables).


#### store-value

**store-value** command stores a value into a variable. The value can be a number of a string. Examples:

```
store-value: (variable_name, "hello")
store-value: (variable_name, 1)
store-value: (variable_name, 1.45)
```

For more information about variables, read the [variables section](#variables).

#### text

**text** command allows to update an element's text. Example:

```
text: ("#button", "hello")
// Same but with an XPath:
text: ("//*[@id='button']", "hello")
```

### timeout

**timeout** command allows you to update the timeout of pages' operations. The value is in milliseconds. If you set it to `0`, it'll wait indefinitely (so use it cautiously!). The default value is 30 seconds. Example:

```
timeout: 20000 // set timeout to 20 seconds
timeout: 0 // no more timeout, to be used cautiously!
```

#### wait-for

**wait-for** command waits for a given duration or for an element to be created. It expects a CSS selector or an XPath or a duration in milliseconds.

**/!\\** Be careful when using it: if the given selector never appears, the test will timeout after 30 seconds by default (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for: 1000

wait-for: ".element"
// Same with an XPath:
wait-for: "//*[@class='element']"

wait-for: "#element > a"
// Same with an XPath:
wait-for: "//*[@id='element']/a"
```

#### wait-for-attribute

**wait-for-attribute** command waits for the given element to have the expected values for the attributes. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-attribute: ("#element", {"class": "hello"})
wait-for-attribute: ("#element", {"class": "hello", "id": "some-id"})

// Same with an XPath:
wait-for-attribute: ("//*[@id='element']", {"class": "hello"})
wait-for-attribute: ("//*[@id='element']", {"class": "hello", "id": "some-id"})
```

#### wait-for-css

**wait-for-css** command waits for the given element to have the expected values for the provided CSS keys. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-css: ("#element", {"font-size": "12px"})
wait-for-css: ("#element", {"font-size": "12px", "margin-top": "12px"})

// Same with an XPath:
wait-for-css: ("//*[@id='element']", {"font-size": "12px"})
wait-for-css: ("//*[@id='element']", {"font-size": "12px", "margin-top": "12px"})
```

#### wait-for-text

**wait-for-text** command waits for the given element to have the expected text. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-text: ("#element", "text")

// Same with an XPath:
wait-for-text: ("//*[@id='element']", "text")
```

#### write

**write** command sends keyboard inputs on given element. If no element is provided, it'll write into the currently focused element. Examples:

```
// It'll write into the given element if it exists:
write: (".element", "text")
write: ("//*[@class='element']", "text")
write: ("#element", 13) // this is the keycode for "enter"
write: ("//*[@id='element']", 13) // this is the keycode for "enter"

// It'll write into the currently focused element.
write: "text"
write: 13 // this is the keycode for "enter"
```
