const {logger} = require('../log')
const EventTypeService = require('../services/eventTypes.service')
const TargetSystemService = require('../services/targetSystem.service')

class EventTypeController {

    //создание типа события
    createEventType(req, res) {
        if (!req.body) return res.sendStatus(400);

        const eventTypes = req.body.event_types

        const promises = eventTypes.map(async (eventType) => {
            try {
                let targetSystem = await TargetSystemService.findTargetSystemByCode(eventType.target_system_code)
                if (!targetSystem || targetSystem[0].uuid == "") {
                    throw `not found targetSystem by code ${eventType.target_system_code}`
                } else {
                    eventType.idTargetSystem = targetSystem[0].uuid

                    if (eventType.parent_code) {
                        const parentEventType = await EventTypeService.findEventTypeByCodeAndType(eventType.parent_code)
                        if (parentEventType) {
                            eventType.idParent = parentEventType[0].uuid
                        } else {
                            throw `not found parent_event_type by code ${eventType.parent_code}`
                        }
                    } else {
                        eventType.idParent = null
                    }

                    const checkEventType = await EventTypeService.findEventTypeByCodeAndTargetSystem(eventType.code, targetSystem[0].uuid)
                    if (!checkEventType || checkEventType.length == 0) {
                        // add new record
                        return await EventTypeService.addEventType(eventType)
                    } else {
                        // update record
                        return await EventTypeService.updateEventType(checkEventType[0].uuid,
                            eventType.name,
                            eventType.is_deleted,
                            eventType.type)
                    }
                }
            } catch (e) {
                logger.error(`createEventType error: ${e}`)
                throw `createEventType error: ${e}`
            }
        })

        Promise.allSettled(promises).then((result) => {
            res.send(result)
        })
    }

    async getRequestEvent(req, res) {
        if (!req.body) return res.sendStatus(400);

        const eventTypes = req.body.event_types;
        const idBot = req.body.id_bot;
        const eventsByParent = await EventTypeService.getParentEventsById(eventTypes);
        const parentEvents = await EventTypeService.getRegMessageRouteEvents(eventsByParent, idBot)
        try {
            res.send(parentEvents.map((item) => {
                let json = null;
                json = JSON.stringify({
                    code: item.clsEventTypeByIdEventType.code,
                    name: item.clsEventTypeByIdEventType.name,
                    type: item.clsEventTypeByIdEventType.type,
                    idParent: item.clsEventTypeByIdEventType.idParent,
                    idTargetSystem: item.clsEventTypeByIdEventType.idTargetSystem,
                    dateCreate: item.clsEventTypeByIdEventType.dateCreate
                })
                return json;
            }))
        } catch (e) {
            logger.error(`getRequestEvent error: ${e}`)
            throw `getRequestEvent error: ${e}`
        }

    }
}
module.exports = new EventTypeController()