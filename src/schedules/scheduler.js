const cron = require('node-cron')
const MessagesService = require('../services/messages.service')
const IncomRequestService = require('../services/incomRequest.service')
const { logger }= require('../log')
const { TIMEZONE, SENT_THRESHOLD, NO_SENT_THRESHOLD } = process.env
const { botList } = require('../bots/botlist')

//check delete sent messages every 1 min.
module.exports.taskDeleteSentMessages = cron.schedule('* */1 * * *', function () {

    // delete SENT MESSAGES
    MessagesService.deleteSentMessages({ threshold: SENT_THRESHOLD })
        .then(result => {
            logger.debug(result + ' msgs is deleted')
        })

    // delete NO SENT MESSAGES
    MessagesService.deleteNoSentMessages({ threshold: NO_SENT_THRESHOLD })
        .then(result => {
            logger.debug(result + ' msgs is deleted')
        })

}, {
    scheduled: false,
    timezone: TIMEZONE
});


//send to bot every 30 sec.
module.exports.taskSentMessages = cron.schedule('*/30 * * * * *', function () {

    MessagesService.getMessagesToSend("0, 2, 3")
        .then(message => {
            message.forEach(async (node) => {
                logger.info(`sending message ${node.uuid} (to user: ${node.idUser})`)

                try {
                    let userMsgRoute = await MessagesService.getMessengerUserMessageRoutes(node.idUser, node.idEventType)
                    let error_sending = false

                    for (const item of userMsgRoute) {
                        switch (item.messengerCode) {
                            case "TELEGRAM":
                                let tgmBotRecord = botList.get(item.idBot)
                                tgmBotRecord.bot.sendMessage(item.outerId, node.text)
                                    .catch(() => error_sending = true)
                                break;

                            case "VIBER":
                                let viberBotRecord = botList.get(item.idBot)
                                viberBotRecord.bot.sendText(item.outerId, node.text)
                                    .catch(() => error_sending = true)
                                break;
                        }
                    }

                    if (!error_sending) {
                        await MessagesService.setMessageStatus({
                            message: {uuid: node.uuid},
                            status: 1
                        });
                        if(node.idIncomRequest && node.idIncomRequest != 0) {
                            await IncomRequestService.setIncomRequestStatus(node.idIncomRequest, 3)
                        }
                        logger.info(`sent message successfuly`)
                    } else {
                        await MessagesService.setMessageStatus({
                            message: {uuid: node.uuid},
                            status: 3
                        });
                        logger.error('Error: send message')
                    }

                } catch (err) {
                    await MessagesService.setMessageStatus({
                        message: {uuid: node.uuid},
                        status: 2
                    });
                    logger.error(err);
                }
            })
        })
}, {
    scheduled: false,
    timezone: TIMEZONE
})
