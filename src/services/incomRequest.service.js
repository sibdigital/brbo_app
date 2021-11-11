const {logger } = require("../log");
const {GraphQLClient, gql} = require('graphql-request')

const endpoint = `http://localhost:${process.env.PORT}/graphql`
const graphQLClient = new GraphQLClient(endpoint)

class IncomRequestService{
    async findIncomRequest(idIncomRequest) {
        try {
            const data = await graphQLClient.request(gql`
                {
                    allRegIncomRequests(condition: {uuid: "${idIncomRequest}", status: 1}) {
                        nodes {
                            uuid
                        }
                    }
                }
            `)
            /*
            {
              "data": {
                "allRegIncomRequests": {
                  "nodes": []
                }
              }
            }
            */
            return data.allRegIncomRequests.nodes.length
        } catch (e) {
            logger.error(`IncomRequestService.findIncomRequest(${idIncomRequest}) not found`)
            return false
        }
    }

    async findIncomRequestByTargetSystemAndEventType(targetSystemCode, idEventType){
        try {
            const idTargetSystem = await graphQLClient.request(gql`
                {
                    allClsTargetSystems(condition: {code: "${targetSystemCode}", isDeleted: false}) {
                        nodes {
                            uuid
                        }
                    }
                }
                `
            )

            const data = await graphQLClient.request(gql`
                {
                    allRegIncomRequests(condition: {idTargetSystem: "${idTargetSystem.allClsTargetSystems.nodes[0].uuid}", idEventType: "${idEventType}", status: 0}) {
                        nodes {
                            clsUserByIdUser {
                                identificator
                            }
                            uuid
                            clsEventTypeByIdEventType {
                            code
                          }
                            requestBody
                    
                        }
                    }
                }
            `)
            return data.allRegIncomRequests.nodes
        } catch (e) {
            logger.error(`IncomRequestService.findIncomRequestByTargetSystemAndEventType return not found`)
            return false
        }
    }

    async setIncomRequestStatus(idIncomRequest, statusIncomRequest) {
        try {
            //if (await this.findIncomRequest(idIncomRequest)) {
            const data = await graphQLClient.request(gql`
                            mutation {
                                __typename
                                updateRegIncomRequestByUuid(input: {regIncomRequestPatch: {status: ${statusIncomRequest}}, uuid: "${idIncomRequest}"}) {
                                    clientMutationId
                                }
                            }
                    `
            )
            return data.error || true // Promise.resolve({error: '', data: data})
//            } else {
//                throw "not found incomRequest"
//            }
        } catch (e) {
            logger.error(`IncomRequestService.setIncomRequestStatus(): ` + e)
            return false //Promise.reject({error: e, data: null})
        }
    }

    async addIncomRequest(params){
        try{
            const result = await graphQLClient.request(gql`
                mutation {
                    __typename
                    createRegIncomRequest(input: {regIncomRequest: {
                        idBot: "${params.idBot}", 
                        idMessenger: "${params.idMessenger}", 
                        idEventType: "${params.idEventType}", 
                        idTargetSystem: "${params.idTargetSystem}", 
                        idUser: "${params.idUser}", 
                        requestBody: "${params.requestBody}",
                        status: 0
                    }}) {
                        clientMutationId
                    }
                }
            `)
            return result
        } catch (e) {
            logger.error(`incomRequestService.add: ${e}`)
        }
    }


    //удаление запросов
    async deleteSentRequests(params){
        try {
            if(params) {
                //delete mutation
                const data = await graphQLClient.request(gql`
                            mutation {
                                __typename
                                deleteSentRequests(input: { threshold: ${params.threshold} }){
                                    bigInt
                                }
                            }
                    `
                )
                return data.deleteSentRequests.bigInt
            } else {
                return 0
            }
        } catch(e){
            logger.error(`incomRequestService.deleteSentRequests(): ` + e.toString())
            return 0
        }
    }

    async deleteNoSentRequests(params){
        try {
            if(params) {
                //delete mutation
                const data = await graphQLClient.request(gql`
                            mutation {
                                __typename
                                deleteNoSentRequests(input: { threshold: ${params.threshold} }){
                                    bigInt
                                }
                            }
                    `
                )
                return data.deleteNoSentMessages.bigInt
            } else {
                return 0
            }
        } catch(e){
            logger.error(`incomRequestService.deleteNoSentMessage(): ` + e.toString())
            return 0
        }
    }

    async deleteReadRequests(params){
        try {
            if(params) {
                //delete mutation
                const data = await graphQLClient.request(gql`
                            mutation {
                                __typename
                                deleteReadRequests(input: { threshold: ${params.threshold} }){
                                    bigInt
                                }
                            }
                    `
                )
                return data.deleteNoSentMessages.bigInt
            } else {
                return 0
            }
        } catch(e){
            logger.error(`incomRequestService.deleteNoSentMessage(): ` + e.toString())
            return 0
        }
    }


}

module.exports = new IncomRequestService();
