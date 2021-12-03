const tools = require("./utils")
const {logger} = require('../log');
const { platform, router, text, telegram, viber } = require('bottender/router');

async function TelegramDefaultAction(context) {
    if (context.event.isMessage) {
        const user = context.event.message.from
        logger.info('telegram client id:' + user.id + ', username: ' + user.username);
        await context.sendText(`Hi, ${user.firstName}! You are send message: ${context.event.message.text}`);
    }
}
var telegramActions = async function(context) {
    const message = context.event.rawEvent;
    const previousEvent = context.event.rawEvent.updateId-1;
    context.setState({previousEvent})
    context.setState({[message.updateId]: {message}})
    context.setState({idBot: context.client._token})
    return router([
        text("*", tools.showKeyboard),
        telegram.callbackQuery(tools.answerKeyboard),
    ]);
}
module.exports.telegramActions = telegramActions;