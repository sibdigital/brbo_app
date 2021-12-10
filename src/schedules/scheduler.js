const cron = require('node-cron');
const MessagesService = require('../services/messages.service');
const IncomRequestService = require('../services/incomRequest.service');
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
                        switch (item.messengerCode.toUpperCase()) {
                            case "TELEGRAM":
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

                            case "VIBER":
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
    const id = "telegram:" + item.outerId;
    const allSessions = await sessionStore.all();
    const idPreviousMess = allSessions[id]._state.previousEvent;
    const previousMess = allSessions[id]._state[idPreviousMess];
    let previousEvent = previousMess.message.callbackQuery ? previousMess.message.callbackQuery.data : "Меню";
    const emoji = "\u{1F539}";
    let parseMode = 'markdown';

    if (tgmBotRecord._token === allSessions[id]._state.idBot) {
//         if (settingsToSend && settingsToSend.length != 0) {
//             settingsToSend.forEach(value => {
// //                buttons.push(value.length > 1 ? value : [value]);
//                 if(value.length > 1){
//                     buttons.push(value);
//                 }
//                 else {
//                     buttons.push([value]);
//                 }
//             });
//             messInfo = messageToSend ? messageToSend.text : messInfo;
//             //const splitMess = await splitArrayMessages(buttons, 20);
//             //await sendMessage(splitMess, parseMode, tgmBotRecord, item, messInfo, "buttons", previousEvent);
//             //await tgmBotRecord.sendMessage(item.outerId, messInfo, {parseMode: parseMode, replyMarkup})
//
//         }
        if (settingsToSend && settingsToSend.length != 0) {
            settingsToSend.forEach(value => {
                buttons.push([{'text': value.label, 'callback_data': value.eventTypeCode + ":" + value.identificator}]);
            });
            messInfo = messageToSend ? messageToSend.text : messInfo;
            const replyMarkup = await additionalButtons(buttons, previousEvent, 'telegram');
            await tgmBotRecord.sendMessage(item.outerId, messInfo, {parseMode: 'markdown', replyMarkup})

        }
         else if (messageToSend && messageToSend.length != 0) {
            messageToSend.forEach(item => {
                if (item.workPackageLink) {
                    const workPackageLink = JSON.parse(item.workPackageLink);
                    const link = "<a href='" + workPackageLink.link + "'>" + workPackageLink.idWorkPackage + "</a>"
                    sendMesArr.push("\n" + emoji + " " + link + " " + item.label)
                    parseMode = 'html';
                } else {
                    sendMesArr.push("\n" + emoji + item.label)
                }
            });
            const splitMess = await splitArrayMessages(sendMesArr, 20);
            await sendMessage(splitMess, parseMode, tgmBotRecord, item, messInfo, "messages", previousEvent);
        }
         else {
            await tgmBotRecord.sendMessage(item.outerId, "По вашему запросу ничего не найдено");
        }
    }
}

//sendViber
async function sendViber(settingsToSend, viberBotRecord, item, buttons, messageToSend) {
    let messInfo = "Информация по вашему запросу.";
    let sendMesArr = [];
    const id = "viber:" + item.outerId;
    const sessionStore = getSessionStore();
    const allSessions = await sessionStore.all();
    const idPreviousMess = allSessions[id]._state.previousEvent;
    const previousMess = allSessions[id]._state[idPreviousMess];
    const emoji = "(checkmark)";
    let previousEvent = idPreviousMess && previousMess.message.message.text.includes("_") ? previousMess.message.message.text : "Меню";
    if (viberBotRecord._token === allSessions[id]._state.idBot) {
        if (settingsToSend && settingsToSend.length != 0) {
            settingsToSend.forEach(value => {
                buttons.push({
                    columns: 6,
                    rows: 1,
                    ActionType: "reply",
                    ActionBody: value.eventTypeCode + ":" + value.identificator,
                    Text: value.label,
                });
            });
            messInfo = messageToSend ? messageToSend.text : messInfo;
            const keyboard = await additionalButtons(settingsToSend, previousEvent, 'viber');
            await viberBotRecord.sendText(item.outerId, messInfo, keyboard)

        } else if (messageToSend && messageToSend.length != 0) {
            messageToSend.forEach(item => {
                if (item.workPackageLink) {
                    const workPackageLink = JSON.parse(item.workPackageLink);
                    sendMesArr.push("\n" + emoji + " " + workPackageLink.link + " " + item.label);
                }
                else{
                    sendMesArr.push("\n" + item.label);
                }
            });
            const splitMess = await splitArrayMessages(sendMesArr, 20);
            const keyboard = await additionalButtons(buttons, previousEvent, 'viber');
            for (const value of splitMess) {
                const message = value.join()
                if(splitMess[splitMess.length-1] === value) {
                    await viberBotRecord.sendText(item.outerId,  messInfo + message, keyboard);
                }
                else {
                    await viberBotRecord.sendText(item.outerId, messInfo + message);
                }
            }
        } else {
            await viberBotRecord.sendText(item.outerId, "По вашему запросу ничего не найдено");
        }
    }
}

async function additionalButtons(buttons, previousEvent, platform) {
    if(platform === 'viber') {
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
    else if(platform === 'telegram'){
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
async function sendMessage(message, parseMode, tgmBotRecord, item, messInfo, type, previousEvent) {

    for (const itemArr of message) {
        // if(type === "buttons"){
        //     if(itemArr.length%2===0) {
        //         const replyMarkup = await additionalButtons(itemArr, previousEvent, 'telegram');
        //         await tgmBotRecord.sendMessage(item.outerId, messInfo, {parseMode: parseMode, replyMarkup});
        //      }
        //     else {
        //         const removeItem = itemArr.indexOf(itemArr[itemArr.length-1]);
        //         itemArr.splice(removeItem, 1);
        //         itemArr.push([{'text': 'ЗАГЛУШКА', 'callback_data': 'фыв'}]);
        //         const replyMarkup = await additionalButtons(itemArr, previousEvent, 'telegram');
        //         await tgmBotRecord.sendMessage(item.outerId, messInfo, {parseMode: parseMode, replyMarkup});
        //     }
        //
        // }
         if (type === "messages"){
            const message = itemArr.join()
            //const replyMarkup = await additionalButtons(message, previousEvent, 'telegram');
            if (message[message.length - 1] === itemArr) {
                await tgmBotRecord.sendMessage(item.outerId, messInfo + message, {
                    parseMode: parseMode,
                    //replyMarkup
                });
            } else {
                await tgmBotRecord.sendMessage(item.outerId, messInfo + message, {parseMode: parseMode});
            }
        }
    }

}
