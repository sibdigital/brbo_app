const cron = require('node-cron');
const MessagesService = require('../services/messages.service');
const IncomRequestService = require('../services/incomRequest.service');
const EventTypesService = require('../services/eventTypes.service');
const {logger} = require('../log');
const {TIMEZONE, MSG_SENT_THRESHOLD, MSG_NO_SENT_THRESHOLD, REQ_SENT_THRESHOLD, REQ_NO_SENT_THRESHOLD, REQ_READ_THRESHOLD} = process.env;
const expression = process.env.CRON_EXPRESSION;
//const { botList } = require('../bots/botlist')
const {getClient} = require('bottender');
const {getSessionStore} = require('bottender');
const expressionSend = process.env.CRON_EXPRESSION_SEND;
const expressionDelete = process.env.CRON_EXPRESSION_DELETE;
const PLATFORM_VIBER = 'viber';
const PLATFORM_TELEGRAM = 'telegram';
const TYPE_MESSAGE_BUTTON = 'button';
const TYPE_MESSAGE_TEXT = 'text';

//check delete sent messages every 1 day.
module.exports.taskDeleteSentMessages = cron.schedule(expressionDelete, function () {

    // delete SENT MESSAGES
    MessagesService.deleteSentMessages({threshold: MSG_SENT_THRESHOLD})
        .then(result => {
            logger.debug(result + ' msgs is deleted')
        });

    // delete NO SENT MESSAGES
    MessagesService.deleteNoSentMessages({threshold: MSG_NO_SENT_THRESHOLD})
        .then(result => {
            logger.debug(result + ' msgs is deleted')
        });

    // delete SENT REQUESTS
    IncomRequestService.deleteSentRequests({threshold: REQ_SENT_THRESHOLD})
        .then(result => {
            logger.debug(result + ' msgs is deleted')
        });

    // delete NO SENT REQUESTS
    IncomRequestService.deleteNoSentRequests({threshold: REQ_NO_SENT_THRESHOLD})
        .then(result => {
            logger.debug(result + ' msgs is deleted')
        });

    // delete READ REQUESTS
    IncomRequestService.deleteReadRequests({threshold: REQ_READ_THRESHOLD})
        .then(result => {
            logger.debug(result + ' msgs is deleted')
        })

}, {
    scheduled: false,
    timezone: TIMEZONE
});
//send to bot every sec.
module.exports.taskSentMessages = cron.schedule(expressionSend, function () {

    MessagesService.getSentMessages({findedStatus: [0, 2, 3], tempStatus: 15})
        .then(messages => {
            // MessagesService.getMessagesToSend("0, 2, 3")
            //     .then(messages => {
            messages.forEach(async (message) => {
                logger.info(`sending message ${message.uuid} (to user: ${message.idUser})`);


                let idBot = await MessagesService.getIdBotByIncomRequest(message.idIncomRequest);
                let messageToSend = JSON.parse(message.text);
                let settingsToSend = JSON.parse(message.settings);
                let buttons = [];

                try {
                    let userMsgRoutes = await MessagesService.getMessengerUserMessageRoutes(message.idUser, message.idEventType, idBot.idBot);

                    if (!userMsgRoutes || userMsgRoutes.length == 0) {
                        throw 'no routes found';
                    }
                    let error_sending = 'sending error';

                    for (const item of userMsgRoutes) {
                        switch (item.messengerCode) {
                            case PLATFORM_TELEGRAM:
                                let tgmBotRecord = getClient(item.botCode);
                                try {
                                    await sendTelegram(settingsToSend, tgmBotRecord, item, buttons, messageToSend);
                                    error_sending = '';
                                    logger.info(`send to telegram - success`)
                                } catch (e) {
                                    logger.error('[sendMessage]: ' + e);
                                    error_sending = 'error sending via telegram client'
                                }
                                break;

                            case PLATFORM_VIBER:
                                let viberBotRecord = getClient(item.botCode);
                                try {
                                    await sendViber(settingsToSend, viberBotRecord, item, buttons, messageToSend);
                                    error_sending = '';
                                    logger.info(`send to viber - success`)
                                } catch (e) {
                                    logger.error('[sendMessage]: ' + e);
                                    error_sending = 'error sending via viber client'
                                }
                                break;
                        }
                    }

                    if (!error_sending) {
                        await MessagesService.setMessageStatus({
                            message: {uuid: message.uuid},
                            status: 1
                        });
                        if (message.idIncomRequest && message.idIncomRequest != 0) {
                            await IncomRequestService.setIncomRequestStatus(message.idIncomRequest, 3)
                        }
                        logger.info(`set status 'sent'`)
                    } else {
                        await MessagesService.setMessageStatus({
                            message: {uuid: message.uuid},
                            status: 3
                        });
                        logger.error('[sendMessage]: ' + error_sending);
                        logger.info(`set status '3 - error send'`)
                    }

                } catch (err) {
                    await MessagesService.setMessageStatus({
                        message: {uuid: message.uuid},
                        status: 2
                    });
                    logger.error('[sendMessage]: ' + err);
                    logger.info(`set status '2 - error send'`)
                }
            })
        })
}, {
    scheduled: false,
    timezone: TIMEZONE
});

//sendTelegram
async function sendTelegram(settingsToSend, tgmBotRecord, item, buttons, messageToSend) {
    let messInfo = "Информация по вашему запросу";
    let sendMesArr = [];

    const sessionStore = getSessionStore();
    const id = PLATFORM_TELEGRAM + ":" + item.outerId;
    const allSessions = await sessionStore.all();
    const previousEvent = await buttonBack(item, allSessions, id, PLATFORM_TELEGRAM);

    try {
        if (tgmBotRecord._token === allSessions[id]._state.idBot) {
            if (settingsToSend && settingsToSend.length != 0) {
                settingsToSend.forEach(value => {
                    buttons.push(value.length > 1 ? value : [value]);
                });
                messInfo = messageToSend ? messageToSend.text : messInfo;
                const splitMess = await splitArrayMessages(buttons, 20);
                await sendMessage(splitMess, tgmBotRecord, item, messInfo, TYPE_MESSAGE_BUTTON, previousEvent, PLATFORM_TELEGRAM);

            } else if (messageToSend && messageToSend.length != 0) {
                messageToSend.forEach(item => {
                    if (item.link) {
                        sendMesArr.push("\n" + item.emoji + " " + item.link + " " + item.label)
                    } else {
                        sendMesArr.push("\n" + item.emoji + item.label)
                    }
                });
                const splitMess = await splitArrayMessages(sendMesArr, 20);
                await sendMessage(splitMess, tgmBotRecord, item, messInfo, TYPE_MESSAGE_TEXT, previousEvent, PLATFORM_TELEGRAM);
            } else {
                await tgmBotRecord.sendMessage(item.outerId, "По вашему запросу ничего не найдено");
            }
        }
    }
    catch (e) {
        logger.error(`sendTelegram(): ` + e)
    }
}
//sendViber
async function sendViber(settingsToSend, viberBotRecord, item, buttons, messageToSend) {
    let messInfo = "Информация по вашему запросу.";
    let sendMesArr = [];
    const id = PLATFORM_VIBER + ":" + item.outerId;
    const sessionStore = getSessionStore();
    const allSessions = await sessionStore.all();
    const previousEvent = await buttonBack(item, allSessions, id, PLATFORM_VIBER);

    try {
        if (viberBotRecord._token === allSessions[id]._state.idBot) {
            if (settingsToSend && settingsToSend.length != 0) {
                messInfo = messageToSend ? messageToSend.text : messInfo;
                const keyboard = await additionalButtons(settingsToSend, previousEvent, 'viber');
                await viberBotRecord.sendText(item.outerId, messInfo, keyboard)

            } else if (messageToSend && messageToSend.length != 0) {
                messageToSend.forEach(item => {
                    if (item.link) {
                        sendMesArr.push("\n" + item.emoji + " " + item.link + " " + item.label)
                    } else {
                        sendMesArr.push("\n" + item.emoji + item.label)
                    }
                });
                const splitMess = await splitArrayMessages(sendMesArr, 20);
                await sendMessage(splitMess, viberBotRecord, item, messInfo, TYPE_MESSAGE_TEXT, previousEvent, PLATFORM_VIBER);

            } else {
                await viberBotRecord.sendText(item.outerId, "По вашему запросу ничего не найдено");
            }
        }
    }
    catch (e) {
        logger.error(`sendViber(): ` + e)
    }
}

async function additionalButtons(buttons, previousEvent, platform) {
    if(platform === PLATFORM_VIBER) {
        buttons.push({
                columns: 3,
                rows: 1,
                ActionType: "reply",
                ActionBody: 'Меню',
                Text: 'Меню',
            },
            {
                columns: 3,
                rows: 1,
                ActionType: "reply",
                ActionBody: previousEvent,
                Text: "Назад",

            });
        return {
            keyboard: {
                Type: "keyboard",
                Buttons: buttons,
                InputFieldState: "regular",
            }
        };
    }
    else if(platform === PLATFORM_TELEGRAM){
        buttons.push([{'text': 'Главное меню', 'callback_data': 'Меню'}, {
            'text': 'Назад',
            'callback_data': previousEvent,
        }]);
         return {
            inline_keyboard: buttons,
        };
    }
}

async function splitArrayMessages(array, n) {
    const result = [];
    while (array.length > 0) {
        result.push(array.splice(0, n));
    }
    return result;
}

async function sendButtonsTelegram(splitArray, tgmBotRecord, item, messInfo, previousEvent) {
    try {
        if (splitArray[splitArray.length-1].length !== 2 && splitArray[0].length === 2) {
            const removeItem = splitArray.indexOf(splitArray[splitArray.length - 1]);
            const itemA = splitArray[removeItem];
            splitArray.splice(removeItem, 1);
            splitArray.push([{'text': itemA[0][0].text, 'callback_data': itemA[0][0].callback_data}]);

            const replyMarkup = await additionalButtons(splitArray, previousEvent, PLATFORM_TELEGRAM);
            await tgmBotRecord.sendMessage(item.outerId, messInfo, {parseMode: "markdown", replyMarkup})

        } else {
            const replyMarkup = await additionalButtons(splitArray, previousEvent, PLATFORM_TELEGRAM);
            await tgmBotRecord.sendMessage(item.outerId, messInfo, {parseMode: "markdown", replyMarkup})

        }
    } catch (e) {
        logger.error(`sendButtonsTelegram(): ` + e)
    }
}

async function sendMessage(array, botRecord, item, messInfo, type, previousEvent, platform) {
    try {
        for (const itemArr of array) {
            if (type === TYPE_MESSAGE_BUTTON) {
                await sendButtonsTelegram(itemArr, botRecord, item, messInfo, previousEvent);
            }
            if (type === TYPE_MESSAGE_TEXT) {
                const message = itemArr.join()
                const additionalBut = [];
                if(platform === PLATFORM_TELEGRAM) {
                    const replyMarkup = await additionalButtons(additionalBut, previousEvent, PLATFORM_TELEGRAM);
                    if (array[array.length - 1] === itemArr) {
                        await botRecord.sendMessage(item.outerId, messInfo + message, {
                            parseMode: "html",
                            replyMarkup
                        });
                    } else {
                        await botRecord.sendMessage(item.outerId, messInfo + message, {parseMode: "html"});
                    }
                }
                else if(platform === PLATFORM_VIBER){
                    const keyboard = await additionalButtons(additionalBut, previousEvent, PLATFORM_VIBER);
                    if(array[array.length-1] === itemArr) {
                        await botRecord.sendText(item.outerId,  messInfo + message, keyboard);
                    }
                    else {
                        await botRecord.sendText(item.outerId, messInfo + message);
                    }
                }
            }
        }
    } catch (e) {
        logger.error(`sendMessage(): ` + e)
    }
}

async function buttonBack(item, allSessions, id, messenger) {
    try {
        const previousEventsArray = [];
        const session = allSessions[id]._state;
        let back = "Меню";
        for (const [channel, value] of Object.entries(session)) {

            if (PLATFORM_TELEGRAM === messenger) {
                if (value !== null && value.message && value.message.callbackQuery) {
                    previousEventsArray.push(value)
                }
            } else if (PLATFORM_VIBER === messenger) {
                const allEvents = await EventTypesService.findAllEvents()
                for (let allEventsKey in allEvents) {
                        value !== null && value.message && value.message.message.text.includes(allEvents[allEventsKey].code) ? previousEventsArray.push(value) : ""
                }
            }
        }

        const reversePreviousEventsArray = Object.assign([], previousEventsArray).reverse()
        let eventSt = "";
        const spliter = /[:,*]+/;
        for (let key in reversePreviousEventsArray) {
                if (messenger === PLATFORM_TELEGRAM) {
                    const parentEventTelegram = await EventTypesService.findParentEventByCode(reversePreviousEventsArray[0].message.callbackQuery.data.split(spliter)[0])
                    eventSt = reversePreviousEventsArray[key].message.callbackQuery.data.split(spliter)[0]
                    if (parentEventTelegram[0] != null && parentEventTelegram[0].clsEventTypeByIdParent && eventSt === parentEventTelegram[0].clsEventTypeByIdParent.code) {
                        back = reversePreviousEventsArray[key].message.callbackQuery.data;
                        return back
                    }
                } else if (messenger === PLATFORM_VIBER) {
                    const parentEventViber = await EventTypesService.findParentEventByCode(reversePreviousEventsArray[0].message.message.text.split(spliter)[0])
                    eventSt = reversePreviousEventsArray[key].message.message.text.split(spliter)[0]
                    if (parentEventViber[0] !=null && eventSt === parentEventViber[0].clsEventTypeByIdParent.code) {
                        back = reversePreviousEventsArray[key].message.message.text;
                        return back
                    }
                }
            }
        return back;

    } catch (e) {
        logger.error(`buttonBack(): ` + e)
    }
}


