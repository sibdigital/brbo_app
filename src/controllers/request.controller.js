const {logger } = require("../log");

const EventTypeService = require('../services/eventTypes.service')
const IncomRequestService = require('../services/incomRequest.service')

class RequestController {

    async getRequest(req, res) {
        if (!req.body || !req.body.targetSystemCode) return res.sendStatus(400);

        const targetSystemCode = req.body.targetSystemCode
        const eventTypeCode = req.body.eventTypeCode || null

        try {
            let requests = null
            if(eventTypeCode) {
                const eventType = await EventTypeService.findEventTypeByCodeAndType(eventTypeCode)

                requests = await IncomRequestService.findIncomRequestByTargetSystemAndEventType(
                    targetSystemCode,
                    eventType[0].uuid
                )
            } else {
                requests = await IncomRequestService.findIncomRequestByTargetSystemAndEventType(
                    targetSystemCode,
                    ''
                )
            }

            if(requests){
                const promises = requests.map(async (item) => {
                    try{
                        return new Promise(async (res, rej) => {
                            try {
                                const result = await IncomRequestService.setIncomRequestStatus(item.uuid, 1)
                                return res(result)
                            } catch(err){
                                return rej(err)
                            }
                        })
                    } catch(err){
                        logger.error(err)
                        throw item
                    }
                })

                Promise.allSettled(promises)
                    .then((result) => {
                        res.send(requests.map((item) => {
                            let json = null;
                            let requestBodyValues = JSON.parse(item.requestBody);
                            json = JSON.stringify({
                                userId: item.clsUserByIdUser.identificator,
                                idIncomRequest: item.uuid,
                                requestBody: requestBodyValues.requestBody.callback_data,
                                eventTypeCode: item.clsEventTypeByIdEventType.code,
                                idBot: item.idBot,
                                codeMessenger: item.clsMessengerByIdMessenger.code,
                                idProject: requestBodyValues.requestBody.idProject,
                            });

                            return json;
                        }))
                    })
                    .catch(() => res.send(500)).toString()

            } else {
                res.sendStatus(404)
            }

        } catch(e){
            logger.error('getRequest: ' + e)
            res.sendStatus(500)
        }
    }
}

module.exports = new RequestController();