const viberActions = require("./viberActions")
const telegramActions = require("./telegramActions")
const { platform, router, text, telegram, viber } = require('bottender/router');

module.exports = async function App(context) {
        return router([
            platform('telegram', telegramActions.telegramActions),
            platform('viber', viberActions.viberActions),
        ]);
};