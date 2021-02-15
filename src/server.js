require('dotenv').config()
const cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')
const postgraphile = require('./postgraphile')
const routes = require('./routes/index')
const { logger }= require('./log')
// const { bottender } = require('bottender');
const ngrok = require('ngrok')
const { PORT, NODE_ENV, TELEGRAM_ACCESS_TOKEN } = process.env
const bots = require('./brbo_bottender')

const server = express()

const verify = (req, _, buf) => {
    req.rawBody = buf.toString();
};
server.use(bodyParser.json({ verify }));
server.use(bodyParser.urlencoded({ extended: false, verify }));
server.use(cors())
server.use(postgraphile)
server.use("/api", routes)

// server.all('*', (req, res) => {
//     return handle(req, res);
// });

ngrok.connect({
    proto : 'http',
    addr : PORT,
})
.then(url => {
    console.log('Tunnel Created -> ', url);
    console.log('Tunnel Inspector ->  http://127.0.0.1:4040');

    let botList = bots.createBotList(url)

    server.listen(PORT, err => {
        if (err) throw err;
        const msg = `Server running on ${NODE_ENV} mode on port ${PORT}`
        logger.info(msg)
    });

})
.catch(err => {
    console.error('Error while connecting Ngrok', err);
    return new Error('Ngrok Failed');
})
