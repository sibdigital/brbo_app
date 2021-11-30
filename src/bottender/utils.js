const {platform, router} = require('bottender/router');
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

    const registeredUser = await UsersService.registeredUser(userId, botToken);
    if (!registeredUser) {
        await context.sendText(USER_NOT_REGISTERED_MESSAGE)
        return;
    }
    if (context.platform === 'telegram') {
        const lastEvent = context.state.lastEvent;
        if (lastEvent) {
            if (context.event.isMessage && lastEvent.includes(FIND_PROJ)) {
                await FindProj(context, GET_MESS_FIND_PROJ)
                return
            } else if (context.event.isMessage && lastEvent.includes(FIND_MEMB)) {
                await FindMemb(context, GET_MESS_FIND_MEMB)
                return
            }
        }
    }
    const requests = await MessagesService.getUserKeyboardData(registeredUser.user.uuid, registeredUser.bot.uuid, null)

    if (requests && requests.length > 0) {
        const keyboard = constructKeyboard(context, requests);
        await context.sendText(SELECT_REQUEST_MESSAGE, keyboard)

    } else {
        await context.sendText(REQUEST_NOT_AVAILABLE_MESSAGE)
    }
}

var answerKeyboard = async function(context) {

    if(await checkMenu(context) === true){return}
    const userId = context._session.user.id
    const botToken = context._client._token

    const registeredUser = await UsersService.registeredUser(userId, botToken);
    if (!registeredUser) {
        await context.sendText(USER_NOT_REGISTERED_MESSAGE)
        return;
    }
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
    let user;
    let project;
    if (context.platform === "telegram") {
        user = context.event.rawEvent.message.from
        project = context.event.message.text.trim()
    }
    else if (context.platform === "viber"){
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
    context.setState({lastEvent:null})
}

async function FindMemb(context, event) {
    let user;
    let fio;
    if (context.platform === "telegram") {
        user = context.event.message.from
        fio = context.event.message.text.trim()
    }
    else if (context.platform === "viber"){
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
    if (!!context.event.callbackQuery) {
        if(context.event.callbackQuery.data === 'Меню') {
            await showKeyboard(context)
            return true
        }
    } else if (!!context.event.message) {
        if(context.event.message.text === 'Меню') {
            await showKeyboard(context)
            return true
        }
    }
    return false
}


module.exports.showKeyboard = showKeyboard
module.exports.answerKeyboard = answerKeyboard
