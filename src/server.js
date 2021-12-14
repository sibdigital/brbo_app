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

server.use(bodyParser.json({verify, limit: '10mb'}));
server.use(bodyParser.urlencoded({extended: false, verify, limit: '10mb'}));
server.use(cors())
server.use(postgraphile)
server.use("/brbo/api", routes)
server.all('*', (req, res) => {
    return handle(req, res);
});

ngrok.connect({
    proto: 'http',
    addr: PORT,
})
    .then(url => {
        logger.info('Tunnel Created -> ' + url);
        logger.info('Tunnel Inspector ->  http://127.0.0.1:4040');

        //url если через heroku
        //url = process.env.URL_HEROKU

        server.listen(PORT, err => {
            if (err) throw err;
            const msg = `Server running on ${NODE_ENV} mode on port ${PORT}`
            logger.info(msg)

            BotService.getConfigChannels()
                .then(r => {
                    const config = {
                        session: {
                            driver: 'file',
                            expiresIn: process.env.TIME_EXPIRATION_SESSION,
                            stores: {
                                file: {
                                    dirname: '.sessions',
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
    })
    .catch(err => {
        console.error('Error while connecting Ngrok', err);
        return new Error('Ngrok Failed');
    })