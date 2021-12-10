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
                            outerId: "${user.identificator}",
                            firstname: "${user.firstname || ''}",
                            lastname: "${user.lastname || ''}",
                            patronymic: "${user.patronymic || ''}",
                            email: "${user.email || ''}"
                            isDeleted: false
                        }
                    }) {
                        clientMutationId
                    }
                }`);
            return data.error || 1
        } catch (e) {
            logger.error(`UsersService.createRegTargetSystemUser(${targetSystemId}, ${user.login}) - ` + e)
            return 0
        }
    }
    async createUser(user){
        try {
            let data = await graphQLClient.request(gql`
                mutation {
                    createClsUser(input: {
                        clsUser: {
                            login: "${user.login}",
                            identificator: "${user.outerId}",
                            firstname: "${user.firstname || ''}",
                            lastname: "${user.lastname || ''}",
                            patronymic: "${user.patronymic || ''}",
                            email: "${user.email || ''}"
                            isDeleted: false
                        }
                    }) {
                        clientMutationId
                            clsUser {
                              code
                              dateCreate
                              email
                              identificator
                              firstname
                              isDeleted
                              lastname
                              login
                              patronymic
                              uuid
                            }
                    }
                }`);

            return data.error || data.createClsUser.clsUser
        } catch (e) {
            logger.error(`usersService.createUser - ` + e)
            return false
        }
    }
    async updateTargetUserId(id, userId){
        try {
            const input = {input:{regTargetSystemUserPatch: {idUser: userId}, uuid: id}}
            const query = gql`
            mutation MyMutation ($input: UpdateRegTargetSystemUserByUuidInput!){
              updateRegTargetSystemUserByUuid(input: $input){
                clientMutationId
              }
            }`
            const data = await graphQLClient.request(query,input);
            return data.error || 1
        } catch (e) {
            logger.error(`usersService.updateTargetUserId - ` + e)
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
                            isDeleted: ${user.is_deleted || false},
                            outerId: "${user.identificator || '' }"
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

    async getTargetUserByIdentificator(identificator) {
        try {
            let data = await graphQLClient.request(gql`
            {
                   allRegTargetSystemUsers(condition: {outerId: "${identificator}", isDeleted: false}) {
                    nodes {
                          outerId
                          patronymic
                          login
                          lastname
                          isDeleted
                          firstname
                          email
                          uuid
                          idTargetSystem
                    }
                }
            }
            `)
            return data.allRegTargetSystemUsers.nodes
        } catch (e) {
            logger.error(`usersService.getTargetUserByIdentificator - ` + e)
            return false
        }
    }
    async findUserExists(identificator){
        try {
            let data = await graphQLClient.request(gql`
            {
                  allClsUsers(condition: {identificator: "${identificator}", isDeleted: false}) {
                    nodes {
                      code
                      login
                      firstname
                      lastname
                      patronymic
                      email
                      identificator
                      uuid
                    }
                  }
            }
            `)
            return data.allClsUsers.nodes;
        }
        catch (e) {
            logger.error(`usersService.findUserExists - ` + e)
            return false
        }
    }
    async getAllEvents(){
        try {
            let data = await graphQLClient.request(gql`
            {
                  allClsEventTypes(condition: { isDeleted: false }) {
                    nodes {
                      code
                      name
                      idParent
                      uuid
                    }
                  }
            }
            `)
            return data.allClsEventTypes.nodes
        }
        catch (e) {
            logger.error(`usersService.getAllEvents - ` + e)
            return false
        }
    }

    async createMessageRoutes(inputMess, idBot, idTargetSystem){
        try{
            const query = gql`
            mutation MyMutation($input: CreateRegMessageRouteInput!) {
              createRegMessageRoute(input: $input) {
                clientMutationId
              }
            }`;
            await this.getAllEvents().then(async item => {
                for (const [channel, value] of Object.entries(item)) {
                        inputMess.idEventType = value.uuid
                        inputMess.isDeleted = false
                        inputMess.idTargetSystem = idTargetSystem
                        inputMess.idBot = idBot
                        inputMess.dateActivation = new Date().toISOString();
                        delete inputMess.outerId;
                        let input = {input: {regMessageRoute:inputMess}};
                        await graphQLClient.request(query, input)
                }
            })

            return true
        }
        catch (e) {
            logger.error(`usersService.createMessageRoutes - ` + e)
            return false
        }
    }
}

module.exports = new UsersService();

