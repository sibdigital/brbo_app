const {platform, router} = require('bottender/router');
const UsersService = require("../services/users.service");
const MessagesService = require("../services/messages.service");
const EventTypeService = require("../services/eventTypes.service");
const IncomRequestService = require("../services/incomRequest.service");
const BotService = require("../services/bot.service")
const {logger} = require('../log');

const USER_NOT_REGISTERED_MESSAGE = 'Вы не зарегистрированы! Для регистрации обратитесь к администратору системы для получения идентификатора';
const REQUEST_NOT_AVAILABLE_MESSAGE = 'Вам недоступны запросы. Обратитесь к администратору системы';
const SELECT_REQUEST_MESSAGE = 'Выберите запрос';
const REQUEST_ACCEPTED_MESSAGE = 'Ожидайте...';

const FIND_PROJ = process.env.FIND_PROJ
const FIND_MEMB = process.env.FIND_MEMB
const GET_MESS_FIND_PROJ = process.env.MES_FIND_PROJ
const GET_MESS_FIND_MEMB = process.env.MES_FIND_MEMB
const REG_EVENT = process.env.REG_EVENT


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
                    columns: 6,
                    rows: 1,
                    actionType: 'reply',
                    actionBody: eventType.code,
                    // BgColor: "#f6f7f9",
                    text: eventType.name,
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

var showKeyboard = async function(context) {
    const userId = context._session.user.id
    const botToken = context._client._token
    const lastEvent = context.state.lastEvent;

    const registeredUser = await UsersService.registeredUser(userId, botToken);
    if (context.platform === 'telegram') {
        if (lastEvent) {
            if (context.event.isMessage && lastEvent.includes(FIND_PROJ)) {
                await FindProj(context, GET_MESS_FIND_PROJ)
                return
            } else if (context.event.isMessage && lastEvent.includes(FIND_MEMB)) {
                await FindMemb(context, GET_MESS_FIND_MEMB)
                return
            }
            else if (context.event.isMessage && lastEvent.includes(REG_EVENT)) {
                await registration(context);
                return
            }
        }
    }

    if (await checkRegistration(context, registeredUser) === true) {return}
    const requests = await MessagesService.getUserKeyboardData(registeredUser.user.uuid, registeredUser.bot.uuid, null)

    if (requests && requests.length > 0) {
        const keyboard = constructKeyboard(context, requests);
        await context.sendText(SELECT_REQUEST_MESSAGE, keyboard)

    } else {
        await context.sendText(REQUEST_NOT_AVAILABLE_MESSAGE)
    }
}

var answerKeyboard = async function(context) {

    if(await registration(context)===true){return}
    if(await checkMenu(context) === true){return}

    const userId = context._session.user.id
    const botToken = context._client._token

    const registeredUser = await UsersService.registeredUser(userId, botToken);
    if(await checkRegistration(context, registeredUser) === true) {return}
    let requestBody = null;
    let eventSt;
    const eventTypeCode = getEventTypeCode(context);
    if (eventTypeCode.includes(":")) {
        requestBody = eventTypeCode.split(":")[1]
        eventSt = eventTypeCode.split(":")[0]
        context.state.idProject = requestBody
    } else {
        eventSt = eventTypeCode;
    }
    const eventType = await EventTypeService.findEventTypeByCodeAndType(eventSt, null)
    await searchProcessingViber(context)

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

async function FindProj(context, event) {
    try {
        let user;
        let project;
        if (context.platform === "telegram") {
            user = context.event.rawEvent.message.from
            project = context.event.message.text.trim()
        } else if (context.platform === "viber") {
            user = context.event.rawEvent.sender
            project = context.state.lastEvent
        }
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
            await context.sendText("Вы отправили пустое сообщение");
        }
        context.setState({lastEvent: null})
    }
    catch (e) {
        logger.error("FindProj: " + e)
    }
}

async function FindMemb(context, event) {
    try {
        let user;
        let fio;
        if (context.platform === "telegram") {
            user = context.event.message.from
            fio = context.event.message.text.trim()
        } else if (context.platform === "viber") {
            user = context.event.rawEvent.sender
            fio = context.event.message.text
        }
        const botToken = context.client._token
        const idProject = context.state.idProject;
        const json = JSON.stringify({idProject, fio})
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
            await context.sendText("Вы отправили пустое сообщение");
        }
    }
    catch (e) {
        logger.error("FindMemb: " + e)
    }
}

async function searchProcessingViber(context) {
    if (context.platform === 'viber') {
        if (context.event.message.text.includes(FIND_PROJ)) {
            context.setState({searchingProj: context.event.message.text})
        } else if (context.event.message.text.includes(FIND_MEMB)) {
            context.setState({searchingMemb: context.event.message.text})
        } else if (context.state.searchingProj || context.state.searchingMemb) {
            const searchingProj = context.state.searchingProj;
            const searchingMemb = context.state.searchingMemb;
            if (!!searchingMemb && searchingMemb.includes(FIND_MEMB)) {
                await FindMemb(context, GET_MESS_FIND_MEMB)
                context.setState({searchingMemb: null})
            } else if (!!searchingProj && searchingProj.includes(FIND_PROJ)) {
                await FindProj(context, GET_MESS_FIND_PROJ)
                context.setState({searchingProj: null})
            }
        }
    }
}

async function checkMenu(context) {
    if (context.platform === 'telegram') {
        if(context.event.callbackQuery.data === 'Меню') {
            await showKeyboard(context)
            return true;
        }
    } else if (context.platform === 'viber') {
        if(context.event.message.text === 'Меню') {
            await showKeyboard(context)
            return true;
        }
    }
}

async function checkRegistration(context, registeredUser){
    if (!registeredUser) {
        const eventRegistration  = [{code: REG_EVENT, name: "Регистрация"}];
        const keyboard = constructKeyboard(context, eventRegistration);
        await context.sendText(USER_NOT_REGISTERED_MESSAGE, keyboard);
        context.state.lastEvent = REG_EVENT;
        return true;
    }
}

async function registration(context) {
    if (context.state.lastEvent === REG_EVENT) {
        if (context.platform === 'telegram') {
            if (context.event.callbackQuery) {
                await context.sendText("Введите идентификатор полученный от администратора")
            } else if (context.event.isMessage) {
                try {
                    await createUser(context);
                } catch (e) {
                    logger.error("registrationTelegram: " + e)
                }
            }
        } else if (context.platform === 'viber') {
            const previousEvent = context.state.previousEvent
            if (context.state[previousEvent].message.message.text === REG_EVENT) {
                try {
                    await createUser(context);
                } catch (e) {
                    logger.error("registrationViber: " + e)
                }
            } else {
                await context.sendText("Введите идентификатор полученный от администратора")
            }
        }
        return true
    }
}

async function createUser(context) {
    try {
        const identificator = context.platform === 'telegram' ? context.event.message.from.id : context.event.rawEvent.sender.id;
        const targetUser = await UsersService.getTargetUserByIdentificator(context.event.message.text)
        if (targetUser.length !== 0) {
            const userExists = await UsersService.findUserExists(targetUser[0].outerId);
            if (userExists.length === 0) {
                const user = await UsersService.createUser(targetUser[0])
                const bot = await BotService.getBotByCode(context.state.idBot)
                const input = {
                    idMessenger: bot[0].idMessenger,
                    idUser: user.uuid,
                    outerId: identificator.toString()
                }
                const createMessengerUser = await MessagesService.createMessengerUser(input);
                const updateTargetUser = await UsersService.updateTargetUserId(targetUser[0].uuid, user.uuid)
                const createMessRoutes = await UsersService.createMessageRoutes(input, bot[0].uuid, targetUser[0].idTargetSystem);
                if (createMessengerUser && updateTargetUser && createMessRoutes) {
                    await context.sendText("Вы зарегистрированы");
                } else {
                    await context.sendText("Вы не зарегистрированы. Обратитесь к администратору за информацией");
                }
            } else {
                await context.sendText("Пользователь с таким идентификатором уже зарегистрирован");
            }
        } else {
            await context.sendText("Введенный вами идентификатор не совпадает с идентификатором, который назначен вам администратором");
        }
        context.resetState();
    } catch (e) {
        logger.error("createUser: " + e)
    }
}


module.exports.showKeyboard = showKeyboard
module.exports.answerKeyboard = answerKeyboard
