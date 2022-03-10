function buildPuppeteerOptions(options) {
    const puppeteer_options = {'args': ['--font-render-hinting=none']};
    if (options.headless === false) {
        puppeteer_options['headless'] = false;
    }
    for (let i = 0; i < options.extensions.length; ++i) {
        puppeteer_options['args'].push(`--load-extension=${options.extensions[i]}`);
    }
    if (options.noSandbox === true) {
        // Highly unsafe! Only use it when you know what you're doing!
        puppeteer_options['args'].push('--no-sandbox');
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

class PuppeteerWrapper {
    constructor() {
        this.puppeteer = require('puppeteer');
        this.browser = null;
        this.context = null;
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

    async newPage(options, debug_log) {
        let page;
        if (this.context) {
            debug_log.append('Starting test in incognito mode.');
            page = await this.context.newPage();
        } else {
            page = await this.browser.newPage();
        }
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
        const context = this.browser.defaultBrowserContext();
        await context.overridePermissions(url, permissions);
    }

    async emulate(options, page, debug_log) {
        if (options.emulate === '') {
            return;
        }
        if (this.puppeteer.devices[options.emulate] === undefined) {
            throw new Error(`Unknown device \`${options.emulate}\`. List of available devices ` +
                'can be found there: ' +
                'https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js');
        }
        debug_log.append(`Emulating "${options.emulate}" device.`);
        await page.emulate(this.puppeteer.devices[options.emulate]);
    }
}

module.exports = {
    'PuppeteerWrapper': PuppeteerWrapper,
};
