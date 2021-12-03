const {logger } = require("../log");
const {GraphQLClient, gql} = require('graphql-request')

const endpoint = `http://localhost:${process.env.PORT}/graphql`
const graphQLClient = new GraphQLClient(endpoint)

class BotService {

    async findAll(){
        try {
            let data = await graphQLClient.request(gql`
                {
                    allClsBots(condition: {isDeleted: false}) {
                        nodes {
                            uuid
                            code
                            clsMessengerByIdMessenger {
                                code
                            }
                            name
                            settings
                            isDeleted
                        }
                    }
                }
            `)
            return Promise.resolve(data.allClsBots.nodes)
        } catch (e) {
            logger.error(`BotsService.findAll() - ` + e)
            return Promise.reject(`BotsService.findAll() - ` + e)
        }
    }

    async getConfigChannels(){
        try {
            let data = await this.findAll()
            let channels = {}
            data.forEach((bot, idx) => {
                // channels[bot.clsMessengerByIdMessenger.code + '_' + idx] = JSON.parse(bot.settings)
                // logger.info(bot.clsMessengerByIdMessenger.code + '_' + idx)
                channels[bot.code] = JSON.parse(bot.settings)
            })
            //return Promise.resolve(channels)
            return  channels
        } catch (e) {
            logger.error(`BotsService.getConfigChannels() - ` + e)
            //return Promise.reject(`BotsService.getConfigChannels() - ` + e)
            return null
        }
    }

    async getConfigChannelsStr(){
        try {
            let data = await this.findAll()
            let channels = '{'
            data.forEach((bot, idx) => {
                channels = channels + bot.clsMessengerByIdMessenger.code + '_' + idx + ': ' + bot.settings
                if(idx != data.length - 1) {
                    channels = channels + ','
                }
                logger.info(bot.clsMessengerByIdMessenger.code + '_' + idx)
            })
            channels = channels + '}'

            channels = channels.replace(/"path"/g, 'path')
            channels = channels.replace(/"enabled"/g, 'enabled')
            channels = channels.replace(/"access_token"/g, 'access_token')
            channels = channels.replace(/"sender"/g, 'sender')
            channels = channels.replace(/"name"/g, 'name')

            return  channels
        } catch (e) {
            logger.error(`BotsService.getConfigChannels() - ` + e)
            return null
        }
    }

    async getBotByCode(code) {
        try {
            let bot = false;
            await this.getConfigChannels().then(item => {
                for (const [channel, value] of Object.entries(item)) {
                    if (value.accessToken === code) {
                        bot = channel
                    }
                }
            })
            let data = await graphQLClient.request(gql`
             {
                      allClsBots(condition: {code: "${bot}"}) {
                        nodes {
                          idMessenger
                          name
                          code
                          uuid
                        }
                      }
              }
            `)
            return data.allClsBots.nodes
        } catch (e) {
            logger.error(`usersService.getBotByCode - ` + e)
            return false
        }
    }

}

module.exports = new BotService();
