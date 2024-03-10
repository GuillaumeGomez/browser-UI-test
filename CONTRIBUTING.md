# Contributing

## How tests work

You can run all tests using `npm run all-test`. However, you will very likely only ever need
`npm run api-test` and `npm run ui-test`.

API tests check the generated code and are located in `tools/api.js`.

UI tests check the output of a given `.goml` script. They are used to check whether or not a command
is failing and eventually to check what it prints on the console. They are located in
`tests/ui`.

The other tests are checks for the framework's code itself:
 * To check that there is no documentation missing for a command, there is `npm run doc-test`.
 * To run eslint on the code there is `npm run lint`.
 * To ensure that the `.goml` parser is doing what's expected, there is `npm run parser-test`.
 * To check that the exported API is doing what's expected, there is `npm run exported-test`.

For `ui` tests, you can filter which ones you want to run by passing the test name as argument:

```
$ npm run ui-test debug.goml debug2.goml
```

## Add, extend or update command

If you want to add a new command or extend/update an existing command, you will need to update
UI and API tests.

To add an API test, if you added a new command, first add a new entry into the `TO_CHECK` array then
add the tests into the related function.

Once done, you can generate the `.json` file by using `npm run api-test --bless`. Then check the
generated output files to ensure it is generating the expected code. Don't forget to check each
variant of the command!

For UI tests, better to add a new `.goml` file into `tests/ui` if you add a new command.
Otherwise, just update an existing one which checks this command in particular. As for what to add
in the file: check it fails when it's supposed to and works when it's supposed to. Check all
variants as well.

Once done, just like for API tests, you can generate the output file using
`npm run ui-test --bless`. Then once check if its content is what's expected.
