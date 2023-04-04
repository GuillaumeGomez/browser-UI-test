# browser-UI-test

Small JS framework to provide headless browser-based tests.

## Description

This framework provides the possibility to quickly check browser UI through small script files (with the `.goml` extension). By default, once the script is done running, it takes a screenshot of the page and compares it to the expected one. If they're different, the test will fail.

## Quick links

This is a big README, so to make you go through it faster:

 * [Usage](#usage)
 * [Using this framework as a binary](#using-this-framework-as-a-binary)
 * [Using this framework as a dependency](#using-this-framework-as-a-dependency)
 * [Exported elements](#exported-elements)
 * [Running it directly](#running-it-directly)
 * [`.goml` scripts](https://github.com/GuillaumeGomez/browser-UI-test/blob/master/goml-script.md)
 * [Command list](https://github.com/GuillaumeGomez/browser-UI-test/blob/master/goml-script.md#command-list)
 * [Run tests](#run-tests)
 * [Donations](#donations)

## How to install

This framework is hosted on npmjs [here](https://www.npmjs.com/package/browser-ui-test). Therefore,
you can install it locally using this command:

```console
npm install browser-ui-test
```

### Trouble installing puppeteer?

In case you can't install puppeteer "normally", you can give a try to `--unsafe-perm=true`:

```bash
$ npm install puppeteer --unsafe-perm=true
```

## Usage

You can either use this framework by using it as dependency or running it directly. In both cases you'll need to write some `.goml` scripts. It looks like this:

```
go-to: "https://somewhere.com" // go to this url
text: ("#button", "hello") // set text of element #button
assert: ("#button", "hello") // check if #button element's text has been set to "hello"
```

The list of the commands is available [here](https://github.com/GuillaumeGomez/browser-UI-test/blob/master/goml-script.md).

### Using this framework as a binary

If you installed it, you should have a script called "browser-ui-test". You can run it as follows:

```bash
$ browser-ui-test --test-files some-file.goml
```

To see the list of available options, use `-h` or `--help`:

```bash
$ browser-ui-test --help
```

### Using Docker

This repository provides a `Dockerfile` in case you want to make your life easier when running
tests. For example, the equivalent of running `npm run test` is:

```bash
# in case I am in the browser-UI-test folder
$ docker build . -t browser-ui
$ docker run \
    -v "$PWD:/data" \
    -u $(id -u ${USER}):$(id -g ${USER}) \
    browser-ui \
    # browser-ui-test options from this point
    --test-folder /data/tests/scripts/ \
    --failure-folder /data/failures \
    --variable DOC_PATH /data/tests/html_files
```

Explanations for these commands! The first one builds an image using the current folder and names it
"browser-ui".

The second one runs using what we built in the first command. Two important things here are
`-v "$PWD:/data"` and `-u $(id -u ${USER}):$(id -g ${USER})`.

`-v "$PWD:/data"` is used to tell docker to bind the current folder (`$PWD`) in the `/data` folder
in the context of docker. If you want to bind another folder, just change the `$PWD` value. Please
remember that you need to use absolute paths!

`-u $(id -u ${USER}):$(id -g ${USER})` is used to run the docker container as the current user so
that the generated files aren't owned by `root` (which can quickly become annoying).

Then we tell it to run the "browser-ui" image.

For the rest, `--test-folder`, `--failure-folder` and `--variable` are `browser-UI-test` options.
You'll note that I prepended them with "/data" because this is where we mounted the volume in the
docker instance. To know what the options are for, please refer to the [Options](#Options) part of
this README.

#### Docker hub

Important note: each merge on master pushes a new image on docker hub. You can find them [here](https://hub.docker.com/repository/docker/gomezguillaume/browser-ui-test/general).

There are three kinds of docker images:

 1. By (npm) version
 2. Latest master branch update
 3. By date

### Using this framework as a dependency

You can do so by importing both `runTests` and `Options` from `index.js`. `Options` is a class where
you can set the parameters you need/want. If you feel better providing "command-line args"-like
parameters, you can use it as follows:

```js
const {Options, runTests} = require('browser-ui-test');

const options = new Options();
try {
    // This is more convenient that setting fields one by one.
    options.parseArguments(['--enable-screenshot-comparison', '--test-folder', 'some-other-place']);
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

Like said above, you can use this framework through code directly. Here is the list of available
elements:

 * `runTest`: Function to run a specific test. Parameters:
   * testPath: String [MANDATORY]
   * options: `Options` type [OPTIONAL]
   * saveLogs: Boolean [OPTIONAL]
 * `runTests`: Function to run tests based on the received options. Parameters:
   * options: `Options` type [OPTIONAL]
   * saveLogs: Boolean [OPTIONAL]
 * `Options`: Object used to store run options. More information follows in the [`Options`](#Options) section.

#### Options

If you want to see all the available options, just run with the `-h` or `--help` options. If you
want to build the `Options` object yourself, you might be interested by what follows.

The list of fields of the `Options` class is the following:

 * `allowFileAccessFromFiles`: if set to `true`, it will disable CORS errors for local files
 * `debug`: display more information
 * `emulate`: name of the device you want to emulate (list of available devices is [here](https://github.com/puppeteer/puppeteer/blob/b5020dc04121b265c77662237dfb177d6de06053/src/common/DeviceDescriptors.ts) or you can use `--show-devices` option)
 * `executablePath`: browser's executable path to be used
 * `extensions`: extensions to be loaded by the browser
 * `failOnJsError`: if set to `true`, if a web page has a JS error, the test will fail
 * `failOnRequestError`: if set to `true` (its default value), if a request fails, the test will fail
 * `failureFolder`: path of the folder where failed tests image will be placed (`testFolder` value by default)
 * `generateImages`: if provided, it'll generate test images and won't run comparison tests
 * `imageFolder`: path of the folder where screenshots are and where they are generated (`testFolder` value by default)
 * `incognito`: whether or not the browser is running in incognito mode
 * `noHeadless`: disable headless mode
 * `screenshotComparison`: enable screenshots generation and comparison at the end of the scripts
 * `screenshotOnFailure`: takes a screenshot if a test fails and stops the test execution
 * `onPageCreatedCallback`: callback which is called when a new puppeteer page is created. It provides the puppeteer `page` and the test name as arguments
 * `pauseOnError`: will pause indefinitely if an error occurs.
 * `permissions`: list of permissions to enable (you can see the full list by running with `--show-permissions`)
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

Unfortunately, font rendering differs depending on the computer **and** on the OS. To bypass this
problem but still allow to have a global UI check, the text is invisible by default. If you are
**sure** that you need to check with the text visible, you can use the option `--show-text`.

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

 * [github-sponsors](https://github.com/sponsors/GuillaumeGomez)
 * [paypal](https://paypal.me/imperioland)
 * [![Become a patron](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/GuillaumeGomez)
