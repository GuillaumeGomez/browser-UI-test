# `.goml` scripts

This file describes how the `.goml` format works.

## Quick links

 * [Add comments in scripts](#add-comments-in-scripts)
 * [Multiline commands/strings?](#multiline-commandsstrings)
 * [Variables](#variables)
 * [Concatenation](#concatenation)
 * [Expressions](#expressions)
 * [Object paths](#object-paths)
 * [Command list](#command-list)

## Add comments in scripts

You can add comments in the `.goml` scripts with `//`. Example:

```
go-to: "https://somewhere.com" // let's start somewhere!
```

## Multiline commands/strings?

You can have a command/string on more than one line. For example:

```
write-into: (
    ".elements",
    "multi
line
text"
)
```

## Variables

In this framework, you can use variables defined through the `--variable` option or through your
environment. For example, if you start your script with:

```bash
A_VARIABLE=12 node src/index.js \
    --test-folder tests/scripts/ \
    --variable DOC_PATH tests/html_files \
    --variable ANOTHER_ONE 42
```

You will have three variables that you'll be able to use (since `A_VARIABLE` is available through your environment). Then, to use them in your scripts, you need to put their name between `|` characters:

```
set-text: ("#an-element", |A_VARIABLE|)
```

In here, it'll set "#an-element" element's text to "12".

If you want to set a variable from inside a script, use one of the `store-*` commands. Important to be noted: the created variables only override the variables set with `--variable` in the current script and don't change environment variables.

A small note: the variable `CURRENT_DIR` is always available (and contains the directory where the script has been started) and **cannot** be override! It is also guaranteed to never end with `/` or `\\`.

## Concatenation

You can concatenate numbers and strings using the `+` sign:

```
store-value: (effect, ":hover")
set-text: ("element" + |variable|, "something " + 2 + " something else")
```

Rules of concatenation are simple: if any of the element is a string, then it'll concatenate as a string. Examples:

```ignore
1 + 2 + "a" // gives string "12a"
1 + 2 // gives number 3
```

This is just a sub-part of expressions which allow more things.

## Expressions

You can do more advanced things like:

```
store-value: (variable, 12)
assert: 12 == |variable| && |variable| + 1 < 14
```

The expression type will be evaluated depending on its components. If comparisons are being performed, it will be evaluated as booleans. Comparisons can only be performed between elements of the same type, except for numbers and strings which can be compared despite not being the same type.

```ignore
true != false // ok
1 != false // not ok
"a" == "a" // ok
"false" == false // not ok
1 == "1" // ok
```

You can also compare arrays, tuples and JSON dictionaries:

```ignore
["a", "b"] == [1, 2] // computed as false
["a", "b"] != [1, 2] // computed as true
(1, "a") == (1, "a", "e") // computed as false
{"1": "a"} != {"1": "e"} // computed as true
```

## Object paths

Some commands allow "object path" argument. In case you want to access children or deeper properties of an object, you will need to use an object path. For example, if you have something like:

```json
{
  "a": {
    "b": {
      "c": 12,
    }
  }
}
```

You can access the lower levels using:

```ignore
"a"."b"."c"
```

Object paths also work with concatenation and variables:

```ignore
|var|."a" + "b"."c"
```

## Command list

Those scripts aim to be as quick to write and as small as possible. To do so, they provide a short list of commands. Please note that those scripts must **always** start with a [`goto`](#goto) command (non-interactional commands such as `screenshot-comparison` or `expect-failure` can be use first as well).

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
 * [`assert-size`](#assert-size)
 * [`assert-size-false`](#assert-size-false)
 * [`assert-text`](#assert-text)
 * [`assert-text-false`](#assert-text-false)
 * [`assert-variable`](#assert-variable)
 * [`assert-variable-false`](#assert-variable-false)
 * [`assert-window-property`](#assert-window-property)
 * [`assert-window-property-false`](#assert-window-property-false)
 * [`block-network-request`](#block-network-request)
 * [`call-function`](#call-function)
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
 * [`compare-elements-size`](#compare-elements-size)
 * [`compare-elements-size-false`](#compare-elements-size-false)
 * [`compare-elements-size-near`](#compare-elements-size-near)
 * [`compare-elements-size-near-false`](#compare-elements-size-near-false)
 * [`compare-elements-text`](#compare-elements-text)
 * [`compare-elements-text-false`](#compare-elements-text-false)
 * [`debug`](#debug)
 * [`define-function`](#define-function)
 * [`drag-and-drop`](#drag-and-drop)
 * [`emulate`](#emulate)
 * [`expect-failure`](#expect-failure)
 * [`fail-on-js-error`](#fail-on-js-error)
 * [`fail-on-request-error`](#fail-on-request-error)
 * [`focus`](#focus)
 * [`geolocation`](#geolocation)
 * [`go-to`](#go-to)
 * [`history-go-back`](#history-go-back)
 * [`history-go-forward`](#history-go-forward)
 * [`include`](#include)
 * [`javascript`](#javascript)
 * [`move-cursor-to`](#move-cursor-to)
 * [`pause-on-error`](#pause-on-error)
 * [`permissions`](#permissions)
 * [`press-key`](#press-key)
 * [`reload`](#reload)
 * [`screenshot`](#screenshot)
 * [`screenshot-comparison`](#screenshot-comparison)
 * [`screenshot-on-failure`](#screenshot-on-failure)
 * [`scroll-to`](#scroll-to)
 * [`set-attribute`](#set-attribute)
 * [`set-css`](#set-css)
 * [`set-device-pixel-ratio`](#set-device-pixel-ratio)
 * [`set-document-property`](#set-document-property)
 * [`set-font-size`](#set-font-size)
 * [`set-local-storage`](#set-local-storage)
 * [`set-property`](#set-property)
 * [`set-text`](#set-text)
 * [`set-timeout`](#set-timeout)
 * [`set-window-size`](#set-window-size)
 * [`set-window-property`](#set-window-property)
 * [`show-text`](#show-text)
 * [`store-attribute`](#store-attribute)
 * [`store-css`](#store-css)
 * [`store-document-property`](#store-document-property)
 * [`store-local-storage`](#store-local-storage)
 * [`store-position`](#store-position)
 * [`store-property`](#store-property)
 * [`store-size`](#store-size)
 * [`store-text`](#store-text)
 * [`store-value`](#store-value)
 * [`store-window-property`](#store-window-property)
 * [`wait-for`](#wait-for)
 * [`wait-for-false`](#wait-for-false)
 * [`wait-for-attribute`](#wait-for-attribute)
 * [`wait-for-attribute-false`](#wait-for-attribute-false)
 * [`wait-for-count`](#wait-for-count)
 * [`wait-for-count-false`](#wait-for-count-false)
 * [`wait-for-css`](#wait-for-css)
 * [`wait-for-document-property`](#wait-for-document-property)
 * [`wait-for-local-storage`](#wait-for-local-storage)
 * [`wait-for-position`](#wait-for-position)
 * [`wait-for-property`](#wait-for-property)
 * [`wait-for-text`](#wait-for-text)
 * [`wait-for-size`](#wait-for-size)
 * [`wait-for-window-property`](#wait-for-window-property)
 * [`write`](#write)
 * [`write-into`](#write-into)

#### assert

**assert** command checks that the element exists or that the boolean is true, otherwise fails. Examples:

```
// To be noted: all following examples can use XPath instead of CSS selector.

// Will check that "#id > .class" exists:
assert: "#id > .class"
assert: ("#id > .class") // strictly equivalent

// Will check that the boolean is true:
store-attribute: ("#id > .class", {"class": class_var})
// We assume that the window's height is superior than 1000.
store-window-property: {"innerHeight": window_height}
assert: |class_var| == "class" && |window_height| > 1000
// Or more simply:
assert: true
```

#### assert-false

**assert-false** command checks that the element doesn't exist or that the boolean is false, otherwise fails. It's mostly doing the opposite of [`assert`](#assert). Examples:

```
// To be noted: all following examples can use XPath instead of CSS selector.

// Will check that "#id > .class" doesn't exists:
assert-false: "#id > .class"
assert-false: ("#id > .class") // strictly equivalent

// Will check that the boolean is false:
store-attribute: ("#id > .class", {"class": class_var})
// We assume that the window's height is superior than 1000.
store-window-property: {"innerHeight": window_height}
assert-false: |class_var| != "class" && |window_height| < 1000
// Or more simply:
assert-false: false
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

If you want to check that an attribute doesn't exist, you can use `null`:

```
// Checking that "attribute-name" doesn't exist.
assert-attribute: ("#id > .class", {"attribute-name": null})
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

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

If you want to check that an attribute does exist, you can use `null`:

```
// Checking that "attribute-name" does exist.
assert-attribute-false: ("#id > .class", {"attribute-name": null})
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

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

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

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

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### assert-document-property

**assert-document-property** command checks the properties' value of the `document` object of a webpage have the provided value. So if you want to check the current page's URL or title, this is the command you need. Examples:

```
assert-document-property: ({"URL": "https://some.where", "title": "a title"})
// If you only provide properties, you can also only provide a JSON dict:
assert-document-property: {"URL": "https://some.where", "title": "a title"}

// To access a child element, you can use object paths:
assert-document-property: { "body"."firstChildElement"."clientTop": "10px" }
```

If you want to check that a property doesn't exist, you can use `null`:

```
// Checking that "property-name" doesn't exist.
assert-document-property: {"property-name": null}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

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

// To access a child element, you can use object paths:
assert-document-property-false: { "body"."firstChildElement"."clientTop": "10px" }
```

If you want to check that a property does exist, you can use `null`:

```
// Checking that "property-name" does exist.
assert-document-property-false: {"property-name": null}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH",
"STARTS_WITH" or "NEAR".

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

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### assert-property

**assert-property** command checks that the DOM properties of the element(s) have the expected value. Examples:

```
assert-property: ("#id > .class", { "offsetParent": "null" })
assert-property: (
    "//*[@id='id']/*[@class='class']",
    { "offsetParent": "null", "clientTop": "10px" },
)

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-property: ("#id > .class", { "offsetParent": "null" }, ALL)
assert-property: (
    "//*[@id='id']/*[@class='class']",
    { "offsetParent": "null", "clientTop": "10px" },
    ALL,
)

// To access a child element, you can use object paths:
assert-property: ("body", { "firstChildElement"."clientTop": "10px" })
```

If you want to check that a property doesn't exist, you can use `null`:

```
// Checking that "property-name" doesn't exist.
assert-property: ("#id > .class", {"property-name": null})
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH", "STARTS_WITH" or "NEAR".

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
assert-property-false: (
    "//*[@id='id']/*[@class='class']",
    { "offsetParent": "null", "clientTop": "10px" },
)

// If you want to check all elements matching this selector/XPath, use `ALL`:
assert-property-false: ("#id > .class", { "offsetParent": "null" }, ALL)
assert-property-false: (
    "//*[@id='id']/*[@class='class']",
    { "offsetParent": "null", "clientTop": "10px" },
    ALL,
)

// To access a child element, you can use object paths:
assert-property-false: ("body", { "firstChildElement"."clientTop": "10px" })
```

If you want to check that a property does exist, you can use `null`:

```
// Checking that "property-name" does exist.
assert-property-false: ("#id > .class", {"property-name": null})
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

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

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### assert-size

**assert-size** command checks that either the "width" or the "height" (or both) have the expected value. Examples:

```
assert-size: ("button", {"width": 200, "height": 20})
// Same with XPath
assert-size: ("//button", {"width": 200, "height": 20})
```

If you want to check all the elements matching the given selector, use `ALL`:

```
assert-size: ("button", {"width": 200, "height": 20}, ALL)
// Same with XPath
assert-size: ("//button", {"width": 200, "height": 20}, ALL)
```

To be more exact, this command compares the "offsetWidth" and "offsetHeight", which include the content
size, the padding and the border.

#### assert-size-false

**assert-size-false** command checks that neither the "width" or the "height" (or both) have the expected value. Examples:

```
assert-size-false: ("button", {"width": 200, "height": 20})
// Same with XPath
assert-size-false: ("//button", {"width": 200, "height": 20})
```

If you want to check all the elements matching the given selector, use `ALL`:

```
assert-size-false: ("button", {"width": 200, "height": 20}, ALL)
// Same with XPath
assert-size-false: ("//button", {"width": 200, "height": 20}, ALL)
```

To be more exact, this command compares the "offsetWidth" and "offsetHeight", which include the content
size, the padding and the border.

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

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### assert-variable

**assert-variable** commands checks that the value of the given variable is the one provided. Examples:

```
assert-variable: (variable_name, "hello")
assert-variable: (variable_name, "hel", CONTAINS)
assert-variable: (variable_name, 12)
assert-variable: (variable_name, 12.1)
```

Apart from "CONTAINS", you can also use "ENDS_WITH", "STARTS_WITH" or "NEAR" and even combine them if you want. Example:

```
assert-variable: (variable_name, "hel", [CONTAINS, STARTS_WITH])
```

The `ENDS_WITH` and `STARTS_WITH` interpret the variable as a string, while `NEAR` interprets it as a number and asserts that the difference between the variable and the tested value is less than or equal to 1. This check is useful in cases where the browser rounds a potentially-fractional value to an integer, and may not always do it consistently from run to run:

```
// all of these assertions will pass
store-value: (variable_name, "hello")
assert-variable: (variable_name, "he", STARTS_WITH)
assert-variable: (variable_name, "o", ENDS_WITH)
store-value: (variable_name, 10)
assert-variable: (variable_name, 10, NEAR)
assert-variable: (variable_name, 9, NEAR)
assert-variable: (variable_name, 11, NEAR)
assert-variable-false: (variable_name, 8, NEAR)
assert-variable-false: (variable_name, 12, NEAR)
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

Apart from "CONTAINS", you can also use "ENDS_WITH", "STARTS_WITH" or "NEAR" and even combine them if you want. Example:

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

// To access a child element, you can use object paths:
assert-document-property: { "document"."body"."firstChildElement"."clientTop": "10px" }
```

If you want to check that a property doesn't exist, you can use `null`:

```
// Checking that "property-name" doesn't exist.
assert-window-property-false: {"property-name": null}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

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

// To access a child element, you can use object paths:
assert-document-property-false: { "document"."body"."firstChildElement"."clientTop": "10px" }
```

If you want to check that a property does exist, you can use `null`:

```
// Checking that "property-name" does exist.
assert-window-property-false: {"property-name": null}
```

You can use more specific checks as well by using one of the following identifiers: "CONTAINS", "ENDS_WITH", "STARTS_WITH" or "NEAR".

```
assert-window-property-false: (
    {"location": "https://some.where", "pageYOffset": "10"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
assert-window-property-false: (
    {"location": "https://some.where", "pageYOffset": "10"},
    [STARTS_WITH, ENDS_WITH],
)
```

#### block-network-request

**block-network-request** command prevents a URL that matches a glob from loading. Asterisks `*` are wildcards:

```
// Prevent search index from loading
block-network-request: "*/search-index.js"
```

By default, a failed network request will cause the test to fail. Use the
[`fail-on-request-error`](#fail-on-request-error) command to change this behaviour.

  * If you use `block-network-request` with `fail-on-request-error` turned on,
    which is the default, the test case will fail if the page blocks a
    network request. It acts as an assertion that the request is not made.
  * To test the page's functionality after the request fails, turn it off:

        fail-on-request-error: false

#### call-function

**call-function** command allows you to call a function defined with `define-function`. It expects a tuple containing the name of the function to call and its arguments (if any). Example:

```
define-function: (
    "fn1",
    [background_color, whole_check],
    block {
        assert-css: ("header", {"background-color": |background_color|, "color": "red"})
        assert-attribute: ("header", |whole_check|)
    },
)

call-function: (
    "fn1", // the function name
    // the arguments
    {
        "background_color": "yellow",
        "whole_check": {"class": "the-header"},
    },
)
```

If you want more information about how functions work, take a look at [`define-function`](#define-function).

Important to note: the arguments of the function take precedence over the variables defined with the `store-*` commands and over the environment variables.

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
click-with-offset: (".element", {"x": 10})
// Same but with an XPath:
click-with-offset: ("//*[@class='element']", {"x": 10})

click-with-offset: (".element", {"x": 10, "y": 3})
click-with-offset: (".element", {"y": 3})
```

#### compare-elements-attribute

**compare-elements-attribute** command allows you to compare two DOM elements' attributes. By default, it's checking if they're equal Examples:

```
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX"])
compare-elements-attribute: ("//element1", "element2", ["attribute1", "attributeX"])

// The two previous commands can be written like this too:
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX"], "=")
compare-elements-attribute: ("//element1", "element2", ["attribute1", "attributeX"], "=")
```

Here is the list of the supported operators: `=`, `<`, `>`, `<=`, `>=`.

Examples:

```
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX"], "<")
compare-elements-attribute: ("element1", "element2", ["attribute1", "attributeX"], ">=")
```

#### compare-elements-attribute-false

**compare-elements-attribute-false** command allows you to check that two DOM elements' attributes (and assuming the comparison will fail). If one of the elements doesn't exist, the command will fail. Examples:

```
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX"])
compare-elements-attribute-false: ("//element1", "element2", ["attribute1", "attributeX"])

// The two previous commands can be written like this too:
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX"], "=")
compare-elements-attribute-false: ("//element1", "element2", ["attribute1", "attributeX"], "=")
```

Here is the list of the supported operators: `=`, `<`, `>`, `<=`, `>=`.

Examples:

```
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX"], "<")
compare-elements-attribute-false: ("element1", "element2", ["attribute1", "attributeX"], ">=")
```

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### compare-elements-css

**compare-elements-css** command allows you to check that two DOM elements' CSS properties are equal. Examples:

```
compare-elements-css: ("element1", "//element2", ["CSS property1", "CSS property2"])
compare-elements-css: ("//element1", "element2", ["CSS property1", "CSS property2"])
```

#### compare-elements-css-false

**compare-elements-css-false** command allows you to check that two DOM elements' CSS properties are different. If one of the elements doesn't exist, the command will fail. Examples:

```
compare-elements-css-false: ("element1", "//element2", ["CSS property1", "CSS property2"])
compare-elements-css-false: ("//element1", "element2", ["CSS property1", "CSS property2"])
```

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### compare-elements-position

**compare-elements-position** command allows you to check that two DOM elements X/Y positions are equal. Examples:

```
// Compare the X position.
compare-elements-position: ("//element1", "element2", ["x"])
// Compare the Y position.
compare-elements-position: ("element1", "//element2", ["y"])
// Compare the X and Y positions.
compare-elements-position: ("//element1", "//element2", ["x", "y"])
// Compare the Y and X positions.
compare-elements-position: ("element1", "element2", ["y", "x"])
```

#### compare-elements-position-false

**compare-elements-position-false** command allows you to check that two DOM elements X/Y positions are different. If one of the elements doesn't exist, the command will fail. Examples:

```
// Compare the X position.
compare-elements-position-false: ("//element1", "element2", ["x"])
// Compare the Y position.
compare-elements-position-false: ("element1", "//element2", ["y"])
// Compare the X and Y positions.
compare-elements-position-false: ("//element1", "//element2", ["x", "y"])
// Compare the Y and X positions.
compare-elements-position-false: ("element1", "element2", ["y", "x"])
```

#### compare-elements-position-near

**compare-elements-position-near** command allows you to check that two DOM elements' X/Y positions are within the given pixel range. Examples:

```
// Compare the X position.
compare-elements-position-near: ("//element1", "element2", {"x": 1})
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
compare-elements-position-near-false: ("//element1", "element2", {"x": 1})
// Compare the Y position.
compare-elements-position-near-false: ("element1", "//element2", {"y": 1})
// Compare both X and Y positions.
compare-elements-position-near-false: ("//element1", "//element2", {"x": 4, "y": 2})
// Compare both Y and X positions.
compare-elements-position-near-false: ("element1", "element2", {"y": 3, "x": 1})
```

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### compare-elements-property

**compare-elements-property** command allows you to check that two DOM elements' properties are equal. Examples:

```
compare-elements-property: ("element1", "//element2", ["property1", "property2"])
compare-elements-property: ("//element1", "element2", ["property1", "property2"])

// Object-paths are also supported:
compare-elements-property: ("//element1", "element2", ["property1"."sub"])
```

#### compare-elements-property-false

**compare-elements-property-false** command allows you to check that two DOM elements' properties are different. If one of the elements doesn't exist, the command will fail. Examples:

```
compare-elements-property-false: ("element1", "//element2", ["property1", "property2"])
compare-elements-property-false: ("//element1", "element2", ["property1", "property2"])

// Object-paths are also supported:
compare-elements-property-false: ("//element1", "element2", ["property1"."sub"])
```

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### compare-elements-size

**compare-elements-size** command allows you to check that two DOM elements' width and/or height are equal. Examples:

```
// Compare the width.
compare-elements-size: ("//element1", "element2", ["width"])
// Compare the height
compare-elements-size: ("element1", "//element2", ["height"])
// Compare the width and the height.
compare-elements-size: ("//element1", "//element2", ["width", "height"])
compare-elements-size: ("element1", "element2", ["height", "width"])
```

#### compare-elements-size-false

**compare-elements-size-false** command allows you to check that two DOM elements' width and/or height are different. If one of the elements doesn't exist, the command will fail. Examples:

```
// Compare the width.
compare-elements-size-false: ("//element1", "element2", ["width"])
// Compare the height
compare-elements-size-false: ("element1", "//element2", ["height"])
// Compare the width and the height.
compare-elements-size-false: ("//element1", "//element2", ["width", "height"])
compare-elements-size-false: ("element1", "element2", ["height", "width"])
```

#### compare-elements-size-near

**compare-elements-size-near** command allows you to check that two DOM elements' width and/or height are within the given than the given pixel range. Examples:

```
// Compare the width.
compare-elements-size-near: ("//element1", "element2", {"width": 1})
// Compare the height
compare-elements-size-near: ("element1", "//element2", {"height": 4})
// Compare the width and the height.
compare-elements-size-near: ("//element1", "//element2", {"width": 2, "height": 1})
compare-elements-size-near: ("element1", "element2", {"width": 1, "height": 2})
```

#### compare-elements-size-near-false

**compare-elements-size-near-false** command allows you to check that two DOM elements' width and/or height differ by more than the given pixel range. If one of the elements doesn't exist, the command will fail. Examples:

```
// Compare the width.
compare-elements-size-near-false: ("//element1", "element2", {"width": 1})
// Compare the height
compare-elements-size-near-false: ("element1", "//element2", {"height": 4})
// Compare the width and the height.
compare-elements-size-near-false: ("//element1", "//element2", {"width": 2, "height": 1})
compare-elements-size-near-false: ("element1", "element2", {"height": 1, "width": 2})
```

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

Another thing to be noted: if you don't care whether the selector exists or not either, take a look at the [`expect-failure`](#expect-failure) command too.

#### debug

**debug** command enables/disables the debug logging. Example:

```
debug: false // disabling debug in case it was enabled
debug: true // enabling it again
```

#### define-function

**define-function** command creates a function. It's quite useful when you want to test the same things with different parameters. Example:

```
define-function: (
    "fn1", // The function name.
    [background_color, whole_check], // The names of the arguments of the function.
    // And below the commands to be called.
    block {
        // First is the command-name, then its arguments like you would pass them normally to the command.
        assert-css: ("header", {"background-color": |background_color|, "color": "blue"})
        assert-attribute: ("header", |whole_check|)
    },
)

// Then you can call the function like this:
call-function: ("fn1", {
    "background_color": "yellow",
    "whole_check": {"class": "the-header"},
})
```

As you can see, a few variables are used inside `define-function`. However, they are only interpreted when the function is actually called with `call-function` and not when the function is declared! So if you use a variable that is declared after the function, it's completely fine.

About variables, the function has access to all variables ever defined before it was called, however there are precedence rules:

 1. First it looks inside function arguments.
 2. Second it looks inside declared variables.
 3. Lastly it looks inside environment.

If you call `define-function` inside the function to overwrite it, it will not overwrite the current instance, only the following ones. Example:

```
define-function: (
    "fn1",
    [],
    block {
        // We overwrite "fn1".
        define-function: (
            "fn1",
            [],
            block { assert-attribute: ("header", {"class": "blue"}) },
        )
        // A "normal" command.
        assert-css: ("header", {"color": "red"})
        // Then we call again "fn1".
        call-function: ("fn1", {})
        assert-position: ("header", {"y": 12})
    },
)

call-function: ("fn1", {})
```

So in this case, here is what will happen:

 1. `fn1` is created with `define-function`.
 2. `fn1` is called with `call-function`.
 3. `fn1` is overwritten with `define-function`.
 4. `assert-css` is called.
 5. `fn1` is called again with `define-function`.
 6. `assert-attribute` is called.
 7. `assert-position` is called.

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

#### expect-failure

**expect-failure** command sets a test to be expected to fail (or not). Example:

```
expect-failure: false
```

You can use it as follows too:

```
// text of "#elem" is "hello"
assert-text: ("#elem", "hello")
set-text: ("#elem", "not hello")
// we want to check if the text changed (strangely but whatever)
expect-failure: true
assert-text: ("#elem", "hello")
// now we set it back to false to check the new text
expect-failure: false
assert-text: ("#elem", "not hello")
```

#### fail-on-js-error

**fail-on-js-error** command sets changes the behaviour of `browser-ui-test` when a JS error occurs on the web page. By default, they are ignored. It overloads the value from the `--enable-on-js-error-fail` option. Example:

```
// To enable the check:
fail-on-js-error: true
```

#### fail-on-request-error

**fail-on-request-error** command sets changes the behaviour of `browser-ui-test` when a request fails on the web page. By default, this option is enabled. It overloads the value from the `--disable-on-request-error-fail` option. Example:

```
// To disable the check:
fail-on-request-error: false
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

#### geolocation

**geolocation** command allows you to set your position. Please note that you might need to enable the `geolocation` permission in order to make it work. It expects as argument `([longitude], [latitude])`. Examples:

```
permissions: ["geolocation"] // we enable the geolocation permission just in case...
geolocation: (2.3635482, 48.8569108) // position of Paris
geolocation: (144.9337482, -37.7879639) // position of Melbourne
```

#### go-to

**go-to** command changes the current page to the given path/url. It expects a path (starting with `.` or `/`) or a URL. Examples:

```
go-to: "https://test.com"
go-to: "http://test.com"
go-to: "/test"
go-to: "../test"
go-to: "file://some-location/index.html"
```

**/!\\** If you want to use `go-to` with `file://`, please remember that you must pass a full path to the web browser (from the root). You can access this information direction with `|CURRENT_DIR|`:

```
go-to: "file://" + |CURRENT_DIR| + "/my-folder/index.html"
```

If you don't want to rewrite your doc path everytime, you can run the test with the `doc-path` argument and then use it as follow:

```
go-to: "file://" + |DOC_PATH| + "/file.html"
```

You can of course use `|DOC_PATH|` and `|CURRENT_DIR|` at the same time:

```
go-to: "file://" + |CURRENT_DIR| + "/" + |DOC_PATH| + "/file.html"
```

#### history-go-back

**history-go-back** command goes back to the previous page in the browser history. If there no previous page, it'll fail (if you want to check that, take a look at [`expect-failure`](#expect-failure)). Example:

```
history-go-back:
history-go-back: 12000 // wait for the previous page in history to render with a timeout of 12 seconds
history-go-back: 0 // disable timeout, be careful when using it!
```

Please note that if no `timeout` is specified, the one from the [`timeout`](#timeout) command is used.

#### history-go-forward

**history-go-forward** command goes back to the next page in the browser history. If there no next page, it'll fail (if you want to check that, take a look at [`expect-failure`](#expect-failure)). Example:

```
history-go-back:
history-go-back: 12000 // wait for the previous page in history to render with a timeout of 12 seconds
history-go-back: 0 // disable timeout, be careful when using it!
```

Please note that if no `timeout` is specified, the one from the [`timeout`](#timeout) command is used.

#### include

**include** command loads the given path then runs it. If the path is not absolute, it'll be relative to the current file. The file is not loaded until the `include` command is run. Example:

```ignore
// current file: /bar/foo.goml
include: "bar.goml"        // It will load `/bar/bar.goml`
include: "/babar/foo.goml" // It will load `/babar/foo.goml`
```

#### javascript

**javascript** command enables/disables the javascript. If you want to render the page without javascript, don't forget to disable it before the call to `goto`! Examples:

```
javascript: false // we disable it before using go-to to have a page rendered without javascript
go-to: "https://somewhere.com" // rendering without javascript
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
screenshot: ("a")

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

#### screenshot-on-failure

**screenshot-on-failure** command enables/disables the generation of a screenshot when a test fails. If enabled, it will also stops the script execution at the first error. By default, this option is disabled. It `overrides` the `--screenshot-on-failure` option value. It expects a boolean value. Example:

```
// Enable screenshot generation when the script fails:
screenshot-on-failure: true

// Disable screenshot generation when the script fails (the default):
screenshot-on-failure: false
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

#### set-attribute

**set-attribute** command allows to update an element's attribute. Example:

```
set-attribute: ("#button", {"attribute name": "attribute value", "another": "x"})
// Same but with a XPath:
set-attribute: ("//*[@id='button']", {"attribute name": "attribute value", "another": "x"})
```

To remove an attribute, you can use the `null` ident:

```
set-attribute: ("a", {"href": null})
```

#### set-css

**set-css** command allows to update an element's style. Example:

```
set-css: ("#button", {"background-color": "red"})
// Same but with an XPath:
set-css: ("//*[@id='button']", {"background-color": "red"})

// To set multiple styles at once:
set-css: ("#button", {"background-color": "red", "border": "1px solid"})
// Same but with an XPath:
set-css: ("//*[@id='button']", {"background-color": "red", "border": "1px solid"})
```

#### set-device-pixel-ratio

**set-device-pixel-ratio** commands allows you to change the device scale factor. You can find more information about it [here](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). It expected a positive non-null number (can be a float). Example:

```
set-device-pixel-ratio: 1 // the default value
set-device-pixel-ratio: 0.5
```

You can check its value like this:

```
// We use `STARTS_WITH` because otherwise the check would very likely fail
// because of floating numbers rounding.
assert-window-property: ({"devicePixelRatio": "0.5"}, [STARTS_WITH])
```

#### set-document-property

**set-document-property** command sets the given values to the `document` object properties. Example:

```
set-document-property: {"title": "a", "linkColor": "blue"}

// It works with object paths as well:
set-document-property: {"activeElement"."innerText": "new text"}
```

#### set-font-size

**set-font-size** command changes the default font size. Example:

```
set-font-size: 22 // Default font size will now be 22px.
```

#### set-local-storage

**set-local-storage** command sets or removes local storage's entries. It expects a JSON object. Example:

```
set-local-storage: {"key": "value", "another key": "another value"}

// If you want to remove an entry from the local storage, pass `null` as value:
set-local-storage: {"key": null}
```

#### set-property

**set-property** command allows to update an element's property. Example:

```
set-property: ("details", {"open": "false"})
// Same but with a XPath:
set-property: ("//details", {"property-name": "property-value"})

// Setting multiple properties at once:
set-property: ("details", {"open": "false", "another": "x"})
// Same but with a XPath:
set-property: ("//details", {"open": "false", "another": "x"})

// It works with object-path as well:
set-property: ("details", {"a"."b": "false"})
```

To remove a property, you can use the `null` ident. Please note that the properties set by the browser will only be reset.

```
set-property: ("details", {"open": null})
```

#### set-text

**set-text** command allows to update an element's text. Example:

```
set-text: ("#button", "hello")
// Same but with an XPath:
set-text: ("//*[@id='button']", "hello")
```

#### set-timeout

**set-timeout** command allows you to update the timeout of pages' operations. The value is in milliseconds. If you set it to `0`, it'll wait indefinitely (so use it cautiously!). The default value is 30 seconds. Example:

```
set-timeout: 20000 // set timeout to 20 seconds
set-timeout: 0 // no more timeout, to be used cautiously!
```

#### set-window-property

**set-window-property** command sets the given values to the `window` object properties. Example:

```
set-window-property: {"scrollX": 12, "screenLeft": "a"}

// It works with object paths as well:
set-window-property: {"document"."activeElement"."innerText": "new text"}
```

#### set-window-size

**set-window-size** command changes the window's size. It expects a tuple of integers (`(width, height)`). Example:

```
set-window-size: (700, 1000)
```

#### show-text

**show-text** command allows to enable/disable the text hiding. Example:

```
show-text: true // text won't be invisible anymore
```

#### store-attribute

**store-attribute** command stores an element's attribute into a variable. Examples:

```
store-attribute: ("#button", {"id": variable_name})
assert: |variable| == "button"

// You can set multiple variables at once too:
store-attribute: ("#button", {"id": variable_name, "class": another_variable})
```

For more information about variables, read the [variables section](#variables).

#### store-css

**store-css** command stores an element's CSS into a variable. Examples:

```
store-css: ("#button", {"color": variable_name})
assert-variable: (variable_name, "rgb(255, 0, 0)")
// You can set multiple variables at once.
store-css: ("#button", {"color": variable_name, "font-size": font_size})
```

For more information about variables, read the [variables section](#variables).

#### store-document-property

**store-document-property** command stores a property of the `document` object into a variable. Examples:

```
store-document-property: {"title": variable_name}

// You can store multiple ones at a time:
store-document-property: {"URL": variable_name, "title": another_var}

// You can use object-path as well:
store-document-property: {"body"."scrollHeight": variable_name}
```

For more information about variables, read the [variables section](#variables).

#### store-local-storage

**store-local-storage** command stores a value from the local storage into a variable. Examples:

```
set-local-storage: {"key": "value"}
store-local-storage: {"key": variable_name}
assert-variable: (variable_name, "value")

// You can store multiple ones at a time:
store-local-storage: {"key": variable_name, "another-one": another_var}
```

For more information about variables, read the [variables section](#variables).

#### store-position

**store-position** command stores an element's position into a variable. Examples:

```
store-position: ("#button", {"x": x})
store-position: ("#button", {"y": variable})
assert: |width| == 30 && |variable| == 10

// It could be written like this too:
store-position: ("#button", {"x": x, "y": var2})

// It also works for pseudo elements:
store-position: ("#button::after", {"x": x, "y": var2})
```

For more information about variables, read the [variables section](#variables).

#### store-property

**store-property** command stores an element's property into a variable. Examples:

```
store-property: ("#button", {"clientHeight": variable_name})
assert-variable: (variable_name, 152)
// You can set multiple variables at once.
store-property: ("#button", {"scrollHeight": variable_name, "clientHeight": another_var})

// You can use object-path as well:
store-property: ("#button", {"firstChildElement"."clientHeight": variable_name})
```

For more information about variables, read the [variables section](#variables).

#### store-size

**store-size** command stores an element's size into a variable. Examples:

```
store-size: ("#button", {"width": width})
store-size: ("#button", {"height": height})
assert: |width| == 30 && |height| == 10

// It could be written like this too:
store-size: ("#button", {"width": width, "height": height})

// It also works for pseudo elements:
store-size: ("#button::after", {"width": width, "height": var2})
```

To be more exact, this command stores the "offsetWidth" and "offsetHeight", which include the content
size, the padding and the border.

For more information about variables, read the [variables section](#variables).

#### store-text

**store-text** command stores an element's text into a variable. Examples:

```
store-property: ("#button", {"innerText": variable_name})
assert-variable: (variable_name, "click me")
```

For more information about variables, read the [variables section](#variables).

#### store-value

**store-value** command stores a value into a variable. The value can be a number, a string or a JSON dictionary. Examples:

```
store-value: (variable_name, "hello")
store-value: (variable_name, 1)
store-value: (variable_name, 1.45)
store-value: (variable_name, {"key": "value"})
```

For more information about variables, read the [variables section](#variables).

#### store-window-property

**store-window-property** command stores a property of the `window` object into a variable. Examples:

```
store-window-property: {"pageYOffset": variable_name}

// You can store multiple ones at a time:
store-window-property: {"devicePixelRatio": variable_name, "pageXOffset": another_var}

// You can use object-path as well:
store-document-property: {"document"."body"."scrollHeight": variable_name}
```

For more information about variables, read the [variables section](#variables).

#### wait-for

**wait-for** command waits for a given duration or for an element to exist. It expects a CSS selector or an XPath or a duration in milliseconds.

**/!\\** Be careful when using it: if the given selector is never created, the test will timeout after 30 seconds by default (can be changed with the [`timeout`](#timeout) command).

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

If you want to wait for an element to be removed, take a look at [`wait-for-false`](#wait-for-false).

#### wait-for-false

**wait-for-false** command waits for an element to not exist. It expects a CSS selector or an XPath.

**/!\\** Be careful when using it: if the given selector exists and never gets removed, the test will timeout after 30 seconds by default (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-false: ".element"
// Same with an XPath:
wait-for-false: "//*[@class='element']"

wait-for-false: "#element > a"
// Same with an XPath:
wait-for-false: "//*[@id='element']/a"
```

If you want to wait for an element to be created, take a look at [`wait-for`](#wait-for).

#### wait-for-attribute

**wait-for-attribute** command waits for the given element to have the expected values for the given attributes. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-attribute: ("#element", {"class": "hello"})
wait-for-attribute: ("#element", {"class": "hello", "id": "some-id"})

// Same with an XPath:
wait-for-attribute: ("//*[@id='element']", {"class": "hello"})
wait-for-attribute: ("//*[@id='element']", {"class": "hello", "id": "some-id"})
```

If you want to wait for an attribute removal, you can use `null`:

```
// Waiting for "attribute-name" to be removed.
wait-for-attribute: ("#id > .class", {"attribute-name": null})
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

```
wait-for-attribute: (
    "#id",
    {"class": "where", "title": "a title"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
wait-for-attribute: (
    "#id",
    {"class": "where", "title": "a title"},
    [STARTS_WITH, ENDS_WITH, ALL],
)
```

If you want to wait for attributes to be created or to not have the expected value, take a look at [`wait-for-attribute-false`](#wait-for-attribute-false).

#### wait-for-attribute-false

**wait-for-attribute-false** command waits for at least one of the provided attributes value to be different. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-attribute-false: ("#element", {"class": "hello"})
wait-for-attribute-false: ("#element", {"class": "hello", "id": "some-id"})

// Same with an XPath:
wait-for-attribute-false: ("//*[@id='element']", {"class": "hello"})
wait-for-attribute-false: ("//*[@id='element']", {"class": "hello", "id": "some-id"})
```

If you want to wait for an attribute to be created, you can use `null`:

```
// Waiting for "attribute-name" to be created.
wait-for-attribute-false: ("#id > .class", {"attribute-name": null})
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

```
wait-for-attribute-false: (
    "#id",
    {"class": "where", "title": "a title"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
wait-for-attribute-false: (
    "#id",
    {"class": "where", "title": "a title"},
    [STARTS_WITH, ENDS_WITH, ALL],
)
```

If you want to wait for attributes to be removed or have the expected value, take a look at [`wait-for-attribute`](#wait-for-attribute).

#### wait-for-count

**wait-for-count** command waits for the page to contain exactly the number of elements which match the provided selector. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-count: ("#element", 1)

// Same with an XPath:
wait-for-count: ("//*[@id='element']", 1)
```

If you want to wait for the number of elements to not be there, take a look at [`wait-for-count-false`](#wait-for-count-false).

#### wait-for-count-false

**wait-for-count-false** command waits for the page to not contain the number of elements which match the provided selector. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-count-false: ("#element", 1)

// Same with an XPath:
wait-for-count-false: ("//*[@id='element']", 1)
```

If you want to wait for the number of elements, take a look at [`wait-for-count`](#wait-for-count).

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

If you want to check all the elements matching the given selector have the given CSS values, you can use the `ALL` ident at the end:

```
wait-for-css: ("button", {"font-size": "12px"}, ALL)
// Same with an XPath:
wait-for-css: ("//button", {"font-size": "12px"}, ALL)
```

#### wait-for-document-property

**wait-for-document-property** command waits for the document objects properties to have the expected values. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-document-property: {"key": "value"}
wait-for-document-property: {"key": "value", "key2": "value2"}

// You can also use object-paths:
wait-for-document-property: {"key"."sub-key": "value"}
```

You can use more specific checks as well by using one of the following identifiers: CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

Examples:

```
wait-for-document-property: ({"key": "value"}, ENDS_WITH)
wait-for-document-property: ({"key": "value", "key2": "value2"}, [ENDS_WITH, STARTS_WITH])
```

#### wait-for-local-storage

**wait-for-local-storage** command waits for the local storage keys to have the expected values. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-local-storage: {"key": "value"}
wait-for-local-storage: {"key": "value", "key2": "value2"}
```

#### wait-for-position

**wait-for-position** command waits for the element(s) position to match the expected values. Only `x` and `y` values are accepted as keys for the positions. Examples:

```
wait-for-position: (".class", {"x": 1, "y": 2})
wait-for-position: ("//*[@class='class']", {"x": 1, "y": 2})

// If you want to wait for all elements matching this selector/XPath, use `ALL`:
wait-for-position: (".class", {"x": 1, "y": 2}, ALL)
wait-for-position: ("//*[@class='class']", {"x": 1, "y": 2}, ALL)
```

#### wait-for-property

**wait-for-property** command waits for the given element(s) to have the expected values for the given properties. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-property: ("#element", {"scrollTop": 10})
wait-for-property: ("#element", {"scrollTop": 10, "name": "hello"})

// Same with an XPath:
wait-for-property: ("//*[@id='element']", {"scrollTop": 10})
wait-for-property: ("//*[@id='element']", {"scrollTop": 10, "name": "hello"})

// You can also use object-paths:
wait-for-property: ("#element", {"key"."sub-key": "value"})
```

If you want to check that a property doesn't exist, you can use `null`:

```
// Checking that "property-name" doesn't exist.
wait-for-property: ("#id > .class", {"property-name": null})
```

You can use more specific checks as well by using one of the following identifiers: "ALL", "CONTAINS", "ENDS_WITH", "STARTS_WITH" or "NEAR".

```
wait-for-property: (
    "#id",
    {"className": "where", "title": "a title"},
    STARTS_WITH,
)
```

You can even combine the checks:

```
wait-for-property: (
    "#id",
    {"className": "where", "title": "a title"},
    [STARTS_WITH, ENDS_WITH, ALL],
)
```

#### wait-for-size

**wait-for-size** command wait for the given element(s) that either the "width" or the "height" (or both) have the expected value. Examples:

```
wait-for-size: ("button", {"width": 200, "height": 20})
// Same with XPath
wait-for-size: ("//button", {"width": 200, "height": 20})
```

If you want to check all the elements matching the given selector, use `ALL`:

```
wait-for-size: ("button", {"width": 200, "height": 20}, ALL)
// Same with XPath
wait-for-size: ("//button", {"width": 200, "height": 20}, ALL)
```

To be more exact, this command compares the "offsetWidth" and "offsetHeight", which include the content
size, the padding and the border.

#### wait-for-text

**wait-for-text** command waits for the given element(s) to have the expected text. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-text: ("#element", "text")
// Same with an XPath:
wait-for-text: ("//*[@id='element']", "text")

// If you want to wait for all elements matching this selector/XPath, use `ALL`:
wait-for-text: ("#id > .class", "hello", ALL)
wait-for-text: ("//*[@id='id']/*[@class='class']", "hello", ALL)
```

Apart from "ALL", you can also use "CONTAINS", "ENDS_WITH" and "STARTS_WITH" and even combine them if you want. Example:

```
wait-for-text: (".class", "hello", CONTAINS)
// To wait for all ".class" elements to contain "hello":
wait-for-text: (".class", "hello", [ALL, CONTAINS])
// To wait for all ".class" elements to start and end with "hello":
wait-for-text: (".class", "hello", [ALL, STARTS_WITH, ENDS_WITH])
```

#### wait-for-window-property

**wait-for-window-property** command waits for the window objects properties to have the expected values. It'll wait up to 30 seconds by default before failing (can be changed with the [`timeout`](#timeout) command).

Examples:

```
wait-for-window-property: {"key": "value"}
wait-for-window-property: {"key": "value", "key2": "value2"}

// You can also use object-paths:
wait-for-window-property: {"key"."sub-key": "value"}
```

You can use more specific checks as well by using one of the following identifiers: CONTAINS", "ENDS_WITH", "STARTS_WITH", or "NEAR".

Examples:

```
wait-for-window-property: ({"key": "value"}, ENDS_WITH)
wait-for-window-property: ({"key": "value", "key2": "value2"}, [ENDS_WITH, STARTS_WITH])
```

#### write

**write** command sends keyboard inputs on the currently focused element. Examples:

```
// It'll write into the currently focused element.
write: "text"
write: 13 // this is the keycode for "enter"
```

If you want to write into a specific element by specifying its path, use [`write-into`](#write-into)
instead.

#### write-into

**write-into** command sends keyboard inputs on a given element. Examples:

```
// It'll write into the given element if it exists:
write-into: (".element", "text")
write-into: ("//*[@class='element']", "text")
write-into: ("#element", 13) // this is the keycode for "enter"
write-into: ("//*[@id='element']", 13) // this is the keycode for "enter"
```
