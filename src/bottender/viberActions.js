const tools = require("./utils")

const { platform, router, text, telegram, viber } = require('bottender/router');

async function ViberDefaultAction(context) {
    if (context.event.isMessage) {
        const user = context.event._rawEvent.sender
        logger.info("viber client user.id:  " + user.id + ", user.name: " + user.name)
        await context.sendText(`Hi, ${user.name}! `);
    }
}
var viberActions = async function(context) {
    const message = context.event.rawEvent;
    if (context.event.isMessage) {
        const previousEvent = context._session._state.temp != null ? context._session._state.temp : '';
        const temp = context.event.rawEvent.messageToken;
        context.setState({previousEvent})
        context.setState({temp})
        context.setState({[message.messageToken]: {message}})
        context.setState({idBot: context.client._token})
        return router([
            text('/start', tools.showKeyboard),
            //text('*', tools.showKeyboard),
            viber.message(tools.answerKeyboard),
        ]);
    }
}

module.exports.viberActions = viberActions;