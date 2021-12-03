const {logger } = require("../log");
const {GraphQLClient, gql} = require('graphql-request')

const endpoint = `http://localhost:${process.env.PORT}/graphql`
const graphQLClient = new GraphQLClient(endpoint)

class EventTypesService {

    async findEventTypeByCodeAndType(code, typ = null){
        try {
            let data = null
            if(typ) {
                data = await graphQLClient.request(gql`
                    {
                        allClsEventTypes(condition: {code: "${code}", type: ${typ}, isDeleted: false}) {
                            nodes {
                                uuid
                                idTargetSystem
                            }
                        }
                    }
                `)
            } else {
                data = await graphQLClient.request(gql`
                    {
                        allClsEventTypes(condition: {code: "${code}", isDeleted: false}) {
                            nodes {
                                uuid
                                idTargetSystem
                            }
                        }
                    }
                `)
            }
            return data.allClsEventTypes.nodes
        } catch (e) {
            logger.error(`eventTypesService.findEventTypeByCodeAndType() - ` + e)
            return false
        }
    }

    async findEventTypeByCodeAndTargetSystem(code, idTargetSystem){
        try {
            const data = await graphQLClient.request(gql`
                {
                    allClsEventTypes(condition: {code: "${code}", idTargetSystem: "${idTargetSystem}"}) {
                        nodes {
                            uuid
                        }
                    }
                }
            `)
            return data.allClsEventTypes.nodes
        } catch (e) {
            logger.error(`eventTypesService.findEventTypeByCodeAndType() - ` + e)
            return false
        }
    }

    async addEventType(eventType){
        try{
            const data = await graphQLClient.request(gql`
                mutation {
                    __typename
                    createClsEventType(input: {clsEventType: {
                        idTargetSystem: "${eventType.idTargetSystem}", 
                        code: "${eventType.code}", 
                        idParent: "${eventType.idParent}", 
                        isDeleted: false, 
                        name: "${eventType.name}", 
                        type: ${eventType.type}
                    }}) {
                        clientMutationId
                    }
                }
            `)
            return data
        } catch(err) {
            logger.error(`eventTypeService.addEventType - ${err}`)
            return `eventTypeService.addEventType - ${err}`
        }
    }

    async updateEventType(idEventType, name, isDeleted, typ){
        try{
            //updateClsEventTypeByUuid(input: {clsEventTypePatch: {name: "", isDeleted: false}, uuid: ""})
            const data = await graphQLClient.request(gql`
                mutation {
                    __typename
                    updateClsEventTypeByUuid(input: {clsEventTypePatch: {
                        isDeleted: ${isDeleted}, 
                        name: "${name}", 
                        type: ${typ}
                    },
                        uuid: "${idEventType}"
                    }){
                        clientMutationId
                    }
                }
            `)
            return data
        } catch(err) {
            logger.error(`eventTypeService.updateEventType - ${err}`)
            return false
        }
    }

    async getRegMessageRouteEvents(events, idBot){
        try {
            const ids = events.map(node => "\"" + node.uuid + "\"")
            const data = await graphQLClient.request(gql`
                {
                  allRegMessageRoutes(filter: {idEventType: {in: [${ids}]}}, condition: {isDeleted: false, idBot: "${idBot}"}) {
                    nodes {
                      idBot
                      idEventType
                            clsEventTypeByIdEventType {
                                code
                                idParent
                                idTargetSystem
                                name
                                type
                                uuid
                                dateCreate
                      }
                    }
                  }
                }
            `)
            return data.allRegMessageRoutes.nodes
        } catch (e) {
            logger.error(`eventTypesService.getParentEventsById() - ` + e)
            return false
        }
    }
    async getParentEventsById(code){
        try {
            const data = await graphQLClient.request(gql`
                {
                  allClsEventTypes(condition: {code: "${code}", isDeleted: false}) {
                    edges {
                      node {
                        clsEventTypesByIdParent {
                          nodes {
                            name
                            code
                            uuid
                          }
                        }
                      }
                    }
                  }
                }
            `)
            return data.allClsEventTypes.edges[0].node.clsEventTypesByIdParent.nodes
        } catch (e) {
            logger.error(`eventTypesService.getParentEventsById() - ` + e)
            return false
        }
    }
}

module.exports = new EventTypesService()
