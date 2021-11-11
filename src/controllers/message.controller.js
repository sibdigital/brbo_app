const {logger } = require("../log");
const MessageService = require('../services/messages.service')
const IncomRequestService = require('../services/incomRequest.service')
/*
test query in Postman
curl --location --request POST 'localhost:3000/message/send' \
--header 'Content-Type: application/json' \
--data-raw '{ "messages": [
    { "event_type": "EVENT_1", "user_id": "login1", "text": "message_text"}
]}'
 */

class MessageController {

    createMessage(req, res) {
        if (!req.body) return res.sendStatus(400);

        const messages = req.body.messages

        const promises = messages.map(async (message) => {
            return new Promise(async (resolve, reject) => {
                try {
                    let resMessage = message
                    let data = await MessageService.findEventTypeByMessage(message)
                    if (data.length == 0 || data[0].uuid == "" || data[0].clsTargetSystemByIdTargetSystem.regTargetSystemUsersByIdTargetSystem.edges.length == 0) {
                        resMessage.status = `not found route/eventTypes/user`
                        return resolve(resMessage)
                    } else {
                        message.idEventType = data[0].uuid
                        message.idTargetSystem = data[0].idTargetSystem
                        message.idUser = data[0].clsTargetSystemByIdTargetSystem.regTargetSystemUsersByIdTargetSystem.edges[0].node.idUser

                        if (message.idIncomRequest) {
                            const isUpdated = await IncomRequestService.setIncomRequestStatus(message.idIncomRequest, 2)
                            if(isUpdated){
                                logger.info('message.id_incom_request (' + message.idIncomRequest + ') status is set=2')
                            } else {
                                logger.error('message.id_incom_request (' + message.idIncomRequest + ') error set status')
                            }
                        }

                        if (message.attachedFile){
                            // save to filesystem
                        } else {
                            message.attachedFile = null
                            message.attachedFileType = null
                            message.attachedFileSize = null
                            message.attachedFileHash = null
                        }

                        const result = await MessageService.addMessage(message)
                        resMessage.status = result ? 'created' : 'error create'
                    }
                    return resolve(resMessage)
                } catch (e) {
                    logger.error(`createMessage error: ${e}`)
                    reject(`createMessage error: ${e}`)
                }
            })
        })

        Promise.allSettled(promises).then((result) => {
            const messages = result.map(v => v.status == 'fulfilled' ? v.value : Object.assign({}, {status: v.reason}) )
            res.send(messages)
        })
    }
}

module.exports = new MessageController();

