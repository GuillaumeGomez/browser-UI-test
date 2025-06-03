const process = require('process');

function buildPuppeteerOptions(options) {
    const puppeteer_options = {'args': [
        '--font-render-hinting=none',
    ]};
    if (options.headless === false) {
        puppeteer_options['headless'] = false;
    } else {
        // FIXME: Once `:focus` selector is working again, this can be either replaced with
        // `new` or removed if puppeteer version > 22.
        puppeteer_options['headless'] = 'old';
    }
    for (let i = 0; i < options.extensions.length; ++i) {
        puppeteer_options['args'].push(`--load-extension=${options.extensions[i]}`);
    }
    puppeteer_options['args'].push('--no-sandbox');
    if (options.allowFileAccessFromFiles === true) {
        puppeteer_options['args'].push('--allow-file-access-from-files');
    }
    if (options.executablePath !== null) {
        puppeteer_options['executablePath'] = options.executablePath;
    }
    if (options.browser === 'chrome') {
        puppeteer_options['product'] = 'chrome';
    } else {
        puppeteer_options['product'] = 'firefox';
    }
    return puppeteer_options;
}

function check_if_known_error(error) {
    const KNOWN_ERRORS = [
        'Failed to launch the browser process!',
        'read ECONNRESET',
    ];

    for (const known_error of KNOWN_ERRORS) {
        if (error.message.indexOf(known_error) !== -1) {
            return true;
        }
    }
    return false;
}

function handlePuppeteerExit() {
    process.emit('browser-ui-test-puppeter-failure');
}

class PuppeteerWrapper {
    constructor() {
        this.puppeteer = require('puppeteer');
        this.browser = null;
        this.context = null;
        this.permissions = new Map();
    }

    async init(options) {
        let i;
        let last_error;

        for (i = 0; i < 3; ++i) {
            try {
                this.browser = await this.puppeteer.launch(buildPuppeteerOptions(options));
            } catch (error) {
                if (!check_if_known_error(error)) {
                    throw error;
                }
                last_error = error;
                continue;
            }
            break;
        }
        if (i === 3) {
            throw last_error;
        }
        if (options.incognito === true) {
            this.context = await this.browser.createIncognitoBrowserContext();
        }
    }

    async newPage(options, fileInfo, logs) {
        // If chromium has an issue, puppeteer simply exits instead of returning an error...
        // So to let the user knows what happened, we need to catch it so we can display an error
        // to let them know how to go around this problem.
        process.once('beforeExit', handlePuppeteerExit);

        let page;
        if (this.context) {
            logs.debug(fileInfo, 'Starting test in incognito mode.');
            page = await this.context.newPage();
        } else {
            page = await this.browser.newPage();
        }

        // If we reach this line, it means everything went fine so we can remove the listener.
        process.removeListener('beforeExit', handlePuppeteerExit);

        page.setDefaultTimeout(options.timeout);
        return page;
    }

    async close() {
        if (this.context) {
            await this.context.close();
            this.context = null;
        }
        if (this.browser !== null) {
            await this.browser.close();
        }
    }

    async overridePermissions(url, permissions) {
        if (this.browser === null) {
            return;
        }
        let value = this.permissions.get(url);
        if (value === undefined) {
            // FIXME: should we really set this permission by default?
            this.permissions.set(url, new Set(['clipboard-read']));
            // this.permissions.set(url, new Map());
            value = this.permissions.get(url);
        }
        permissions = new Set(permissions);
        for (const permission of permissions) {
            value.add(permission);
        }
        // FIXME: Once we have a way to call this function when drop a page (because we leave an
        // iframe or we are done with a page), we can call this code.
        // let current_permissions = new Set(value.keys());
        // // We increase the permissions we already have.
        // for (const permission of permissions) {
        //     const nb = current_permissions.get(permission);
        //     if (nb !== undefined) {
        //         this.permissions.set(permission, nb + 1);
        //     } else {
        //         this.permissions.set(permission, 1);
        //     }
        // }
        // // We remove the permissions that are not used anymore.
        // for (const permission of current_permissions) {
        //     if (permission.has(permission)) {
        //         continue;
        //     }
        //     const nb = this.permissions.get(permission);
        //     if (nb < 2) {
        //         value.delete(permission);
        //     } else {
        //         value.set(permission, nb - 1);
        //     }
        // }
        const context = this.context === null ? this.browser.defaultBrowserContext() : this.context;
        await context.overridePermissions(url, Array.from(value));
    }

    async emulate(options, fileInfo, page, logs) {
        if (options.emulate === '') {
            // Setting default size then.
            const viewport = page.viewport();
            const newViewport = {
                ...viewport,
                width: 1000,
                height: 1000,
            };
            await page.setViewport(newViewport);
            return;
        }
        if (this.puppeteer.KnownDevices[options.emulate] === undefined) {
            throw new Error(`Unknown device \`${options.emulate}\`. List of available devices ` +
                'can be found there: ' +
                'https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js');
        }
        logs.debug(`Emulating "${options.emulate}" device.`);
        await page.emulate(fileInfo, this.puppeteer.KnownDevices[options.emulate]);
    }
}

module.exports = {
    'PuppeteerWrapper': PuppeteerWrapper,
};
