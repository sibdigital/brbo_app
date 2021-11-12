require('dotenv').config()
const cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')
const postgraphile = require('./postgraphile')
const routes = require('./routes/index')
const {logger} = require('./log')
const ngrok = require('ngrok')
const {PORT, NODE_ENV} = process.env
const {createBotList} = require('./bots')
const {bottender} = require('bottender')
const {taskSentMessages, taskDeleteSentMessages} = require('./schedules/scheduler')
const BotService = require('./services/bot.service')
const {TelegramClient} = require('messaging-api-telegram')
const {ViberClient} = require('messaging-api-viber')
const server = express()


const verify = (req, _, buf) => {
    req.rawBody = buf.toString();
};

const Bottender = bottender({
    dev: process.env.NODE_ENV !== 'production',
});

const handle = Bottender.getRequestHandler();


server.use(bodyParser.json({verify}));
server.use(bodyParser.urlencoded({extended: false, verify}));
server.use(cors())
server.use(postgraphile)
server.use("/api", routes)
server.all('*', (req, res) => {
    return handle(req, res);
});
let url = process.env.URL
//const fs = require('fs').promises;
//let url_ = ''

// ngrok.connect({
//     proto: 'http',
//     addr: PORT,
// })
//     .then(urlNgrok => {
//         logger.info('Tunnel Created -> ' + urlNgrok);
//         logger.info('Tunnel Inspector ->  http://127.0.0.1:4040');
//         // let url = 'URL_NGROK=' + urlNgrok
//         // fs.appendFile(".env", url).then(r => logger.info(`URL_NGROK success saved`));
//
//         url = urlNgrok
//     })
//     .catch(err => {
//         console.error('Error while connecting Ngrok', err);
//         return new Error('Ngrok Failed');
//     })


server.listen(PORT, err => {
    if (err) throw err;
    const msg = `Server running on ${NODE_ENV} mode on port ${PORT}`
    logger.info(msg)

    BotService.getConfigChannels()
        .then(r => {
            const config = {
                session: {
                    driver: 'memory',
                    stores: {
                        memory: {
                            maxSize: 500,
                        }
                    },
                },
                initialState: {},
                channels: r
            }

            console.log(config)

            Bottender.prepare(config)
                .then(() => {
                    logger.info('Bottender app is prepared')

                    //console.log(url)

                    for (const [channel, value] of Object.entries(r)) {
                        const accessToken = value.accessToken

                        let client = null
                        if (channel.indexOf('telegram') >= 0) {
                            client = TelegramClient.connect({
                                accessToken
                            });
                        }
                        if (channel.indexOf('viber') >= 0) {
                            client = ViberClient.connect({
                                accessToken
                            });
                        }

                        client.setWebhook(url + value['path'])
                            .then(() => logger.info(`${value['path']} - set webhook success`))
                            .catch((err) => logger.info(`${value['path']} - set webhook error: ${err}`))

                    }

                    taskSentMessages.start()
                    taskDeleteSentMessages.start()

                    /*
                                                createBotList(url)
                                                    .then((botList) => {
                                                        logger.info('Count active bots: ' + botList.size)
                                                        taskSentMessages.start()
                                                        taskDeleteSentMessages.start()
                                                    })
                                                    .catch((err) => {
                                                        logger.error(err)
                                                    })
                    */

                })
                .catch((err) => {
                    logger.error(err)
                })

        })
        .catch(e => {
            console.log(e)
            return null
        })
})
