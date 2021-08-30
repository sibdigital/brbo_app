const {logger } = require("../log");
const {GraphQLClient, gql} = require('graphql-request')
const EventTypeService = require('./eventTypes.service')

const { PORT } = process.env
const endpoint = `http://localhost:${PORT || 3000}/graphql`
const graphQLClient = new GraphQLClient(endpoint)

class MessagesService {

    async addMessage(message){
        try{
            const data = await graphQLClient.request(gql`
                mutation {
                    __typename
                    createRegSentMessage(input: {regSentMessage: {
                        idEventType: "${message.idEventType}",
                        idTargetSystem: "${message.idTargetSystem}",
                        text: "${message.text}",
                        idUser: "${message.idUser}",
                        status: 0,
                        attachedFile: "${message.attached_file}",
                        attachedFileType: "${message.attached_file_type}",
                        attachedFileSize: ${message.attached_file_size},
                        attachedFileHash: "${message.attached_file_hash}"
                        dateCreate: "${new Date().toISOString()}"}}) {
                        clientMutationId
                    }
                }
            `
            )
            return data.error || 1
        }catch(reason) {
            logger.error(`messageService.addMessage(): ` + reason)
            return 0
        }
    }

    async deleteNoSentMessages(params){
        try {
            if(params) {
                //delete mutation
                const data = await graphQLClient.request(gql`
                            mutation {
                                __typename
                                deleteNoSentMessages(input: { threshold: ${params.threshold} }){
                                    bigInt
                                }
                            }
                    `
                )
                return data.deleteNoSentMessages ? data.deleteNoSentMessages.bigInt : 0
            } else {
                return 0
            }
        } catch(e){
            logger.error(`messageService.deleteNoSentMessage(): ` + e.toString())
            return 0
        }
    }

    async deleteSentMessages(params){
        try {
            if(params) {
                //delete mutation
                const data = await graphQLClient.request(gql`
                            mutation {
                                __typename
                                deleteSentMessages(input: { threshold: ${params.threshold} }){
                                    bigInt
                                }
                            }
                    `
                )
                return data.deleteSentMessages.bigInt
            } else {
                return 0
            }
        } catch(e){
            logger.error(`messageService.deleteSentMessage(): ` + e)
            return 0
        }
    }

    async findEventTypeByMessage(message){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allClsEventTypes(condition: {code: "${message.event_type}", isDeleted: false}) {
                        nodes {
                            uuid
                            idTargetSystem
                            clsTargetSystemByIdTargetSystem {
                                regTargetSystemUsersByIdTargetSystem(condition: {outerId: "${message.user_id}", isDeleted: false}) {
                                    edges {
                                        node {
                                            idUser
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `)
            return data.allClsEventTypes.nodes
        } catch (e) {
            logger.error(`messageService.findEventType(${message}) - ` + e)
            return false
        }
    }

    async getMessagesToSend(statuses){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allRegSentMessages(filter: {status: {in: [${statuses}]}}) {
                        nodes {
                            uuid
                            idUser
                            idEventType
                            text
                            status
                            attachedFile
                            attachedFileType
                            attachedFileSize
                            attachedFileHash
                            idIncomRequest
                            settings
                        }
                    }                
                }
            `)
            return data.allRegSentMessages.nodes
        } catch (e) {
            logger.error(`messageService.getMessagesToSend` + e)
            return false
        }
    }

    async getMessengerUserMessageRoutes(idUser, idEventType){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allVMessengerUserMessageRoutes(condition: {idUser: "${idUser}", idEventType: "${idEventType}"}) {
                        nodes {                             
                                idBot
                                idUser
                                idMessenger
                                idEventType
                                idTargetSystem
                                idParentEventType
                                outerId
                                userSettings
                                botName
                                botSettings
                                messengerCode
                                botCode
                        }
                    }
                }
            `)
            return data.allVMessengerUserMessageRoutes.nodes
        } catch (e) {
            logger.error(`messageService.getMessengerUserMessageRoutes():` + e)
            return false
        }
    }

    async getMessengerUserMessageRoutesByBot(idUser, idEventType, idBot){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allVMessengerUserMessageRoutes(condition: {
                        idUser: "${idUser}", 
                        idEventType: "${idEventType}",
                        idBot: "${idBot}"
                    }) {
                        nodes {                             
                                idBot
                                idUser
                                idMessenger
                                idEventType
                                idTargetSystem
                                idParentEventType
                                outerId
                                userSettings
                                botName
                                botSettings
                                messengerCode
                        }
                    }
                }
            `)
            return data.allVMessengerUserMessageRoutes.nodes
        } catch (e) {
            logger.error(`messageService.getMessengerUserMessageRoutesByBot():` + e)
            return `messageService.getMessengerUserMessageRoutesByBot():` + e
        }
    }

    async getUserKeyboardData(idUser, idBot, idParentEventTypeCode){
        try {
            let gquery;
            if(idParentEventTypeCode == null){
                gquery = gql`
                    {
                        allVMessengerUserMessageRoutes(
                            condition: {idBot: "${idBot}", idUser: "${idUser}", typeEvent: 1 },
                            filter: {idParentEventType: {isNull: true}}
                        ) {
                            nodes {
                                idEventType
                            }
                        }
                    }
                `
            } else {
                const idEvent = await EventTypeService.findEventTypeByCodeAndType(idParentEventTypeCode, 1)
                gquery = gql`
                    {
                        allVMessengerUserMessageRoutes(
                            condition: {idBot: "${idBot}", idUser: "${idUser}", idParentEventType: "${idEvent[0].uuid}", typeEvent: 1 }
                        ) {
                            nodes {
                                idEventType
                            }
                        }
                    }
                `
            }

            let data = await graphQLClient.request(gquery);

            if(data.allVMessengerUserMessageRoutes.nodes[0]) {
                const ids = data.allVMessengerUserMessageRoutes.nodes.map(node => "\"" + node.idEventType + "\"")

                const result = await graphQLClient.request(gql`
                    {
                        allClsEventTypes(filter: {uuid: {in: [${ids}]}}) {
                            nodes {
                                name
                                code
                            }
                        }
                    }
                `);
                return result.allClsEventTypes.nodes
            } else {
                return null
            }
        } catch (e) {
            logger.error(`messageService.getUserKeyboardData(): ` + e)
            return null
        }
    }

    async setMessageStatus(params){
        try {
            if(params) {
                //update mutation
                const data = await graphQLClient.request(gql`
                            mutation {
                                __typename
                                updateRegSentMessageByUuid(input: {
                                    regSentMessagePatch: { status: ${params.status}},
                                    uuid: "${params.message.uuid}"}) 
                                {
                                    clientMutationId
                                }
                            }
                    `
                )
                return data.error || 1
            } else {
                return 0
            }
        } catch(e){
            logger.error(`messageService.setMessageStatus(): ` + e)
            return 0
        }
    }
}

module.exports = new MessagesService();
