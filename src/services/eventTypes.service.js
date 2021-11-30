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

    async getParentEventsById(Id){
        try {
            const data = await graphQLClient.request(gql`
                {
                      allClsEventTypes(condition: {idParent: "${Id}", isDeleted: false}) {
                        nodes {
                          code
                          dateCreate
                          idParent
                          idTargetSystem
                          isDeleted
                          name
                          type
                        }
                      }
                }
            `)
            return data.allClsEventTypes.nodes
        } catch (e) {
            logger.error(`eventTypesService.getParentEventsById() - ` + e)
            return false
        }
    }
    async getParentIdByCode(code){
        try {
            const data = await graphQLClient.request(gql`
                {
                  allClsEventTypes(condition: {code: "${code}", isDeleted: false}) {
                    nodes {
                      uuid
                    }
                  }
                }
            `)
            return data.allClsEventTypes.nodes[0]
        } catch (e) {
            logger.error(`eventTypesService.getParentEventsById() - ` + e)
            return false
        }
    }
    async getAllEventType(){
        try {
            const data = await graphQLClient.request(gql`
                {
                  allClsEventTypes {
                    nodes {
                      code
                      name
                      idParent
                    }
                  } 
                }
            `)
            return data.allClsEventTypes.nodes
        } catch (e) {
            logger.error(`eventTypesService.getAllEventType() - ` + e)
            return false
        }
    }
}

module.exports = new EventTypesService()
