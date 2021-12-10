const {logger } = require("../log");
const {GraphQLClient, gql} = require('graphql-request')
const EventTypeService = require('./eventTypes.service')

const { PORT } = process.env
const endpoint = `http://localhost:${PORT || 3000}/graphql`
const graphQLClient = new GraphQLClient(endpoint)

class MessagesService {


    async addMessage(message){
        try{
            message.status = 0;
            message.dateCreate = new Date().toISOString();
            let input = {input: {regSentMessage:message}};
            delete input.input.regSentMessage.userId;
            delete input.input.regSentMessage.eventTypeCode;

            const query = gql`
            mutation MyMutation($input: CreateRegSentMessageInput!) {
                createRegSentMessage(input: $input) {
                    clientMutationId
                }
            }`;
            const data = await graphQLClient.request(query,input);
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

    async getSentMessages(params){
        try {
            if(params) {
                const data = await graphQLClient.request(gql`
                            mutation {
                                getSentMessages(input: { pFindedStatus: [${params.findedStatus}], pTemporaryStatus: ${params.tempStatus}}){
                                        regSentMessages {
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
                    `
                )
                return data.getSentMessages.regSentMessages
            } else {
                return 0
            }
        } catch(e){
            logger.error(`messageService.getSentMessages(): ` + e)
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
                    allClsEventTypes(condition: {code: "${message.eventTypeCode}", isDeleted: false}) {
                        nodes {
                            uuid
                            idTargetSystem
                            clsTargetSystemByIdTargetSystem {
                                regTargetSystemUsersByIdTargetSystem(condition: {outerId: "${message.userId}", isDeleted: false}) {
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

    async getMessengerUserMessageRoutes(idUser, idEventType, idBot){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allVMessengerUserMessageRoutes(condition: {idUser: "${idUser}", idEventType: "${idEventType}", idBot: "${idBot}"}) {
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

    async getIdBotByIncomRequest(request){
        try {
            let data = await graphQLClient.request(gql`
                {
                  allRegIncomRequests(condition: {uuid: "${request}"}) {
                    nodes {
                      idBot
                    }
                  }
                }
            `)
            return data.allRegIncomRequests.nodes[0]
        } catch (e) {
            logger.error(`messageService.getIdBotByIncomRequest():` + e)
            return false
        }
    }

    async getUserKeyboardData(idUser, idBot, idParentEventTypeCode) {
        try {
            let gquery;
            if (idParentEventTypeCode == null) {
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
                let data = await graphQLClient.request(gquery);

                if (data.allVMessengerUserMessageRoutes.nodes[0]) {
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
                }
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
    async createMessengerUser(request){
        try {
            let input = {input: {regMessengerUser:request}};
            const query = gql`
            mutation MyMutation($input: CreateRegMessengerUserInput!) {
              createRegMessengerUser(input: $input) {
                clientMutationId
              }
            }`;
            const data = await graphQLClient.request(query,input);
            return true
        } catch (e) {
            logger.error(`messageService.getIdBotByIncomRequest():` + e)
            return false
        }
    }
}

module.exports = new MessagesService();
