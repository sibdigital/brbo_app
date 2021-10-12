const {logger } = require("../log");
const {GraphQLClient, gql} = require('graphql-request')

const endpoint = `http://localhost:${process.env.PORT}/graphql`
const graphQLClient = new GraphQLClient(endpoint)

class UsersService {

    async findAll(outerId){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allRegMessengerUsers(condition: {outerId: "${outerId}", isDeleted: false}) {
                        nodes {
                            settings
                            clsMessengerByIdMessenger {
                                name
                                clsBotsByIdMessenger(condition: {isDeleted: false}) {
                                    nodes {
                                        uuid
                                        code
                                        name
                                        settings
                                        idMessenger
                                    }
                                }
                            }
                            clsUserByIdUser {
                                uuid
                                code
                                identificator
                            }
                        }
                    }
                }
            `)
            return data.allRegMessengerUsers.nodes
        } catch (e) {
            logger.error(`UsersService.findAll(${outerId}) - ` + e)
            return false
        }
    }


    async findRegTargetSystemUser(targetSystemId, login){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allRegTargetSystemUsers(condition: {idTargetSystem: "${targetSystemId}", login: "${login}", isDeleted: false}) {
                        nodes {
                            uuid
                        }
                    }
                }
            `)
            return data.allRegTargetSystemUsers.nodes
        } catch (e) {
            logger.error(`UsersService.findRegTargetSystemUser(${targetSystemId}, ${login}) - ` + e)
            return false
        }
    }

    async createRegTargetSystemUser(targetSystemId, user){
        try {
            let data = await graphQLClient.request(gql`
                mutation {
                    __typename
                    createRegTargetSystemUser(input: {
                        regTargetSystemUser: {
                            idTargetSystem: "${targetSystemId}",
                            login: "${user.login}",
                            outerId: "${user.login}",
                            firstname: "${user.firstname || ''}",
                            lastname: "${user.lastname || ''}",
                            patronymic: "${user.patronymic || ''}",
                            email: "${user.email || ''}"
                            isDeleted: false
                        }
                    }) {
                        clientMutationId
                    }
                }
            `)
            return data.error || 1
        } catch (e) {
            logger.error(`UsersService.createRegTargetSystemUser(${targetSystemId}, ${user.login}) - ` + e)
            return 0
        }
    }

    async updateRegTargetSystemUser(targetSystemUserId, user){
        try {
            let data = await graphQLClient.request(gql`
                mutation {
                    __typename
                    updateRegTargetSystemUserByUuid(input: {
                        regTargetSystemUserPatch: {
                            firstname: "${user.firstname || ''}",
                            lastname: "${user.lastname || ''}",
                            patronymic: "${user.patronymic || ''}",
                            email: "${user.email || ''}",
                            isDeleted: ${user.is_deleted || false}
                        },
                        uuid: "${targetSystemUserId}" 
                    }) {
                        clientMutationId
                    }
                }
            `)
            return data.error || 1
        } catch (e) {
            logger.error(`UsersService.updateRegTargetSystemUser(${targetSystemUserId}, ${user.login}) - ` + e)
            return 0
        }
    }

    async registeredUser(userId, botToken) {
        const users = await this.findAll(userId);

        if (!users) {
            return false;
        }

        let bot;

        const user = users[0];
        if (user) {
            user.clsMessengerByIdMessenger.clsBotsByIdMessenger.nodes
              .forEach(item => {
                  let settings = JSON.parse(item.settings)
                  if (settings.accessToken == botToken) {
                      bot = item
                  }
              })
        }

        if (!bot) {
            return false;
        }

        return {
            user: users[0].clsUserByIdUser,
            bot: bot
        }
    }
}

module.exports = new UsersService();
