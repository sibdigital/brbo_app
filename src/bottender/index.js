const { platform, router, text, telegram, viber } = require('bottender/router');
const { logger } = require('../log');

const UsersService = require("../services/users.service");
const MessagesService = require("../services/messages.service");
const EventTypeService = require("../services/eventTypes.service");
const IncomRequestService = require("../services/incomRequest.service");

const USER_NOT_REGISTERED_MESSAGE = 'Вы не зарегистрированы! Пройдите регистрацию';
const REQUEST_NOT_AVAILABLE_MESSAGE = 'Вам недоступны запросы. Обратитесь к администратору системы';
const SELECT_REQUEST_MESSAGE = 'Выберите запрос';
const REQUEST_ACCEPTED_MESSAGE = '*Запрос принят. Ожидайте ответа*';

const FIND_PROJ = process.env.FIND_PROJ
const FIND_MEMB = process.env.FIND_MEMB
const GET_MESS_FIND_PROJ = process.env.MES_FIND_PROJ
const GET_MESS_FIND_MEMB = process.env.MES_FIND_MEMB


function getEventTypeCode(context) {
    let eventTypeCode;
    if (context.platform === 'telegram') {
        const callbackQuery = context.event.callbackQuery;
        const messageId = callbackQuery.message.messageId;
        eventTypeCode = callbackQuery.data;
    } else if (context.platform === 'viber') {
        if (context.event.isText) {
            eventTypeCode = context.event.message.text;
        }
    }
    context.state.lastEvent = eventTypeCode;
    return eventTypeCode;
}

function constructKeyboard(context, requests) {
    let keyboard;
    if (context.platform === 'telegram') {
        const buildTelegramKeyboard = (keysArr) => {
            let arr = []
            keysArr.forEach(eventType => {
                arr.push(Array.of({code: eventType.code, text: eventType.name}))
            })

            const keyboard = {
                replyMarkup: {
                    inlineKeyboard: arr.map(row =>
                        row.map(cell => ({
                            text: cell.text,
                            callbackData: cell.code,
                        }))
                    ),
                }
            }
            return keyboard;
        }
        keyboard = buildTelegramKeyboard(requests);
    } else if (context.platform === 'viber') {
        const buildViberKeyboard = (keysArr) => {
            const buttons = [];
            keysArr.forEach(eventType => {
                buttons.push({
                    Columns: 6,
                    Rows: 1,
                    ActionType: "reply",
                    ActionBody: eventType.code,
                    // BgColor: "#f6f7f9",
                    Text: eventType.name,
                })
            })

            const keyboard = {
                keyboard: {
                    Type: "keyboard",
                    Buttons: buttons,
                }
            }
            return keyboard;
        }
        keyboard = buildViberKeyboard(requests);
    }
    return keyboard;
}

async function ShowKeyboard(context) {

    const lastEvent = context.state.lastEvent;
    if(lastEvent) {
        if (context.event.isMessage && lastEvent.includes(FIND_PROJ)) {
            await FindProj(context, GET_MESS_FIND_PROJ)
            return
        } else if (context.event.isMessage && lastEvent.includes(FIND_MEMB)) {
            await FindMemb(context, GET_MESS_FIND_MEMB)
            return
        }
    }
    const userId = context._session.user.id
    const botToken = context._client._token

    const registeredUser = await UsersService.registeredUser(userId, botToken);
    if (!registeredUser) {
        await context.sendText(USER_NOT_REGISTERED_MESSAGE)
        return;
    }

    const requests = await MessagesService.getUserKeyboardData(registeredUser.user.uuid, registeredUser.bot.uuid, null)

    if (requests && requests.length > 0) {
        const keyboard = constructKeyboard(context, requests);
        await context.sendText(SELECT_REQUEST_MESSAGE, keyboard)

    } else {
        await context.sendText(REQUEST_NOT_AVAILABLE_MESSAGE)
    }
}

async function AnswerKeyboard(context) {
    if(context.platform == 'telegram'&& context.event.rawEvent.callbackQuery.data == 'Меню'){
        await ShowKeyboard(context)
        return;
    }
    const userId = context._session.user.id
    const botToken = context._client._token

    const registeredUser = await UsersService.registeredUser(userId, botToken);
    if (!registeredUser) {
        await context.sendText(USER_NOT_REGISTERED_MESSAGE)
        return;
    }
    let requestBody = null;
    let eventSt = null;
    const eventTypeCode = getEventTypeCode(context);

    if(eventTypeCode.includes(":"))
    {
        requestBody = eventTypeCode.split(":")[1]
        eventSt = eventTypeCode.split(":")[0]
        context.state.idProject = requestBody

    }
    else {
        eventSt = eventTypeCode;
    }

    const eventType = await EventTypeService.findEventTypeByCodeAndType(eventSt,null)

    if (eventType && eventType.length > 0) {
        const requests = await MessagesService.getUserKeyboardData(registeredUser.user.uuid, registeredUser.bot.uuid, eventSt)
        if (requests && requests.length > 0) {
            const keyboard = constructKeyboard(context, requests);
            await context.sendText(SELECT_REQUEST_MESSAGE, keyboard)
        } else {
            const eventType = await EventTypeService.findEventTypeByCodeAndType(eventSt, null)
            if (eventType && eventType.length > 0) {
                const result = await IncomRequestService.addIncomRequest({
                    idBot: registeredUser.bot.uuid,
                    idMessenger: registeredUser.bot.idMessenger,
                    idEventType: eventType[0].uuid,
                    idTargetSystem: eventType[0].idTargetSystem,
                    idUser: registeredUser.user.uuid,
                    requestBody: requestBody,
                })
                if (result) {
                    await context.sendText(REQUEST_ACCEPTED_MESSAGE, {parseMode: 'markdown'})
                }
            }
        }
    }
}

/* Telegram functions */

async function ActivateTgUser(context) {
    if (context.event.isMessage) {
        const user = context.event.message.from
        const ident = context.event.message.text.replace('/register', '').trim()
        if (ident) {
            logger.info('register telegram client id:' + user.id + ', username: ' + user.username + ', identificator: ' + ident);
            await context.sendText(`Hi, ${user.firstName}! You are send ident: ${ident}`);
        } else {
            await context.sendText(`Hi, ${user.firstName}! You are send empty ident`);
        }
    }
}

async function FindProj(context, event) {
    const user = context.event.message.from
    const project = context.event.message.text.trim()
    const botToken = context.client._token
    if (project) {
        const registeredUser = await UsersService.registeredUser(user.id, botToken);
        const eventType = await EventTypeService.findEventTypeByCodeAndType(event, null)

        const result = await IncomRequestService.addIncomRequest({
            idBot: registeredUser.bot.uuid,
            idMessenger: registeredUser.bot.idMessenger,
            idEventType: eventType[0].uuid,
            idTargetSystem: eventType[0].idTargetSystem,
            idUser: registeredUser.user.uuid,
            requestBody: project,
        })
        if (result) {
            await context.sendText(REQUEST_ACCEPTED_MESSAGE, {parseMode: 'markdown'})
        }
    } else {
        await context.sendText(`You are send empty message`);
    }

}

async function FindMemb(context, event) {
    const user = context.event.message.from
    const fio = context.event.message.text.trim()
    const botToken = context.client._token
    const idProject = context.state.idProject;
    const json = JSON.stringify({idProject,fio})

    if (json) {
        const registeredUser = await UsersService.registeredUser(user.id, botToken);
        const eventType = await EventTypeService.findEventTypeByCodeAndType(event, null)
        const result = await IncomRequestService.addIncomRequest({
            idBot: registeredUser.bot.uuid,
            idMessenger: registeredUser.bot.idMessenger,
            idEventType: eventType[0].uuid,
            idTargetSystem: eventType[0].idTargetSystem,
            idUser: registeredUser.user.uuid,
            requestBody: json.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0'),
        })
        if (result) {
            await context.sendText(REQUEST_ACCEPTED_MESSAGE, {parseMode: 'markdown'})
        }
    } else {
        await context.sendText(`You are send empty message`);
    }

}


async function TelegramDefaultAction(context) {
    if (context.event.isMessage) {
        const user = context.event.message.from
        logger.info('telegram client id:' + user.id + ', username: ' + user.username);
        await context.sendText(`Hi, ${user.firstName}! You are send message: ${context.event.message.text}`);
    }
}

async function TelegramActions(context) {
    const message = context.event.rawEvent;
    const previousEvent = context.event.rawEvent.updateId-1;
    context.setState({previousEvent})
    context.setState({[message.updateId]: {message}})
    return router([
        text('/start', ShowKeyboard),
        text(/\/register (.+)/, ActivateTgUser),
        text("*", ShowKeyboard),
        telegram.callbackQuery(AnswerKeyboard),

        // telegram.chosenInlineResult(context.sendText(getTest)),
        // telegram.any(TelegramDefaultAction),
    ]);

}

/* Viber functions */

async function ViberDefaultAction(context) {
    if (context.event.isMessage) {
        const user = context.event._rawEvent.sender
        logger.info("viber client user.id:  " + user.id + ", user.name: " + user.name)
        await context.sendText(`Hi, ${user.name}! `);
    }
}

async function ViberActions(context) {
    return router([
        text('/start', ShowKeyboard),
        //text('*', ShowKeyboard),
        viber.message(AnswerKeyboard),
        //viber.any(ViberDefaultAction)
    ]);
}

module.exports = async function App(context) {
    return router([
        platform('telegram', TelegramActions),
        platform('viber', ViberActions),
    ]);

};