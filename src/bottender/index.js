const { platform, router, text, telegram, viber } = require('bottender/router');
const { logger } = require('../log');

const UsersService = require("../services/users.service");
const MessagesService = require("../services/messages.service");
const EventTypeService = require("../services/eventTypes.service");
const IncomRequestService = require("../services/incomRequest.service");

const USER_NOT_REGISTERED_MESSAGE = 'Вы не зарегистрированы! Пройдите регистрацию';
const REQUEST_NOT_AVAILABLE_MESSAGE = 'Вам недоступны запросы. Обратитесь к администратору системы';
const SELECT_REQUEST_MESSAGE = 'Выберите запрос';
const REQUEST_ACCEPTED_MESSAGE = 'Запрос принят. Ожидайте ответа';

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
    const userId = context._session.user.id
    const botToken = context._client._token

    const registeredUser = await UsersService.registeredUser(userId, botToken);
    if (!registeredUser) {
        await context.sendText(USER_NOT_REGISTERED_MESSAGE)
        return;
    }

    const eventTypeCode = getEventTypeCode(context);
    const eventType = await EventTypeService.findEventTypeByCodeAndType(eventTypeCode, 1)
    if (eventType && eventType.length > 0) {
        const requests = await MessagesService.getUserKeyboardData(registeredUser.user.uuid, registeredUser.bot.uuid, eventTypeCode)
        if (requests && requests.length > 0) {
            const keyboard = constructKeyboard(context, requests);
            await context.sendText(SELECT_REQUEST_MESSAGE, keyboard)
        } else {
            const eventType = await EventTypeService.findEventTypeByCodeAndType(eventTypeCode, 1)
            if (eventType && eventType.length > 0) {
                const result = await IncomRequestService.addIncomRequest({
                    idBot: registeredUser.bot.uuid,
                    idMessenger: registeredUser.bot.idMessenger,
                    idEventType: eventType[0].uuid,
                    idTargetSystem: eventType[0].idTargetSystem,
                    idUser: registeredUser.user.uuid
                })
                if (result) {
                    await context.sendText(REQUEST_ACCEPTED_MESSAGE)
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

async function TelegramDefaultAction(context) {
    if (context.event.isMessage) {
        const user = context.event.message.from
        logger.info('telegram client id:' + user.id + ', username: ' + user.username);
        await context.sendText(`Hi, ${user.firstName}! You are send message: ${context.event.message.text}`);
    }
}

async function TelegramActions(context) {
    return router([
        text('/start', ShowKeyboard),
        text(/\/register (.+)/, ActivateTgUser),
        telegram.callbackQuery(AnswerKeyboard),
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
        viber.message(AnswerKeyboard),
        // viber.any(ViberDefaultAction)
    ]);
}

module.exports = async function App(context) {
    return router([
        platform('telegram', TelegramActions),
        platform('viber', ViberActions),
    ]);
};
