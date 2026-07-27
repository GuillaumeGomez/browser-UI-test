module.exports = {
    'STYLE_HIDE_TEXT_ID': 'browser-ui-test-style-text-hide',
    'STYLE_ADDER_FUNCTION': 'browserUiCreateNewStyleElement',
    'CSS_TEXT_HIDE': '* { color: rgba(0,0,0,0) !important; }',
    'AVAILABLE_PERMISSIONS': [
        'accelerometer',
        'accessibility-events',
        'ambient-light-sensor',
        'background-sync',
        'camera',
        'clipboard-read',
        'clipboard-write',
        'geolocation',
        'gyroscope',
        'magnetometer',
        'microphone,',
        'midi',
        'midi-sysex',
        'notifications',
        'payment-handler',
        'push',
    ],
    'COLOR_CHECK_ERROR': '`show-text: true` needs to be used before checking for `color` ' +
        '(otherwise the browser doesn\'t compute it)',
    'CLIPBOARD_READ_PERMISSION_ERROR': '`permissions: ["clipboard-read"]` is needed before the ' +
        'clipboard can be read',
    'CLIPBOARD_WRITE_PERMISSION_ERROR': '`permissions: ["clipboard-write"]` is needed before the ' +
        'clipboard can be updated',
};
