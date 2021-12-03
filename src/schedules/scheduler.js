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

    MessagesService.getSentMessages({findedStatus: 0, tempStatus: 15})
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
    let sendMes = "*Информация по вашему запросу.*";
    const sessionStore = getSessionStore();
    const id = "telegram:" + item.outerId;
    const allSessions = await sessionStore.all();
    const idPreviousMess = allSessions[id]._state.previousEvent;
    const previousMess = allSessions[id]._state[idPreviousMess];
    let previousEvent = previousMess.message.callbackQuery ? previousMess.message.callbackQuery.data : "Меню";

    if (tgmBotRecord._token === allSessions[id]._state.idBot) {
        if (settingsToSend && settingsToSend.length != 0) {
            settingsToSend.forEach(value => {
                buttons.push([{'text': value.label, 'callback_data': value.eventTypeCode + ":" + value.identificator}]);
            });
            sendMes = messageToSend ? messageToSend.text : sendMes;
            const replyMarkup = await additionalButtons(buttons, previousEvent, 'telegram');
            await tgmBotRecord.sendMessage(item.outerId, sendMes, {parseMode: 'markdown', replyMarkup})

        } else if (messageToSend && messageToSend.length != 0) {
                messageToSend.forEach(item => {
                    sendMes += "\n" + item.label;
                });
            const splitMess = sendMes.match(/[\s\S]{1,1000}/g);
            const replyMarkup = await additionalButtons(buttons, previousEvent, 'telegram');
            for (const value of splitMess) {
                await tgmBotRecord.sendMessage(item.outerId, value, {parseMode: 'markdown', replyMarkup});
            }
        } else {
            await tgmBotRecord.sendMessage(item.outerId, "По вашему запросу ничего не найдено");
        }
    }
}

//sendViber
async function sendViber(settingsToSend, viberBotRecord, item, buttons, messageToSend) {
    let sendMes = "Информация по вашему запросу.";
    const id = "viber:" + item.outerId;
    const sessionStore = getSessionStore();
    const allSessions = await sessionStore.all();
    const idPreviousMess = allSessions[id]._state.previousEvent;
    const previousMess = allSessions[id]._state[idPreviousMess];
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
            sendMes = messageToSend ? messageToSend.text : sendMes;
            const keyboard = await additionalButtons(buttons, previousEvent, 'viber');
            await viberBotRecord.sendText(item.outerId, sendMes, keyboard)

        } else if (messageToSend && messageToSend.length != 0) {
            messageToSend.forEach(item => {
                sendMes += "\n" + item.label;
            });
            const splitMess = sendMes.match(/[\s\S]{1,1000}/g);
            const keyboard = await additionalButtons(buttons, previousEvent, 'viber');
            for (const value of splitMess) {
                await viberBotRecord.sendText(item.outerId, value, keyboard);
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
