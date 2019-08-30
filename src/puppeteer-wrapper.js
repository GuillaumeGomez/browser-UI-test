const {print} = require('./utils.js');


function buildPuppeteerOptions(options) {
    const puppeteer_options = {'args': ['--font-render-hinting=none']};
    if (options.headless === false) {
        puppeteer_options['headless'] = false;
    }
    for (let i = 0; i < options.extensions.length; ++i) {
        puppeteer_options['args'].push(`--load-extension=${options.extensions[i]}`);
    }
    return puppeteer_options;
}

class PuppeteerWrapper {
    constructor(options) {
        try {
            if (options.browser === 'firefox') {
                this.puppeteer = require('puppeteer-firefox');
            }
        } catch (err) {
            print(err.message);
            throw new Error('If you want to use firefox, please install it first! Also, please ' +
                'remember that it is experimental!');
        }
        if (options.browser === 'chrome') {
            this.puppeteer = require('puppeteer');
        }
        this.browser = null;
        this.context = null;
    }

    async init(options) {
        this.browser = await this.puppeteer.launch(buildPuppeteerOptions(options));
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
        await this.browser.close();
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
