const express = require('express')
const messageRouter = require('./message.routes')
const requestRouter = require('./request.routes')
const eventTypeRouter = require('./eventType.routes')
const router = express.Router()

router.use('/message', messageRouter)
router.use('/request', requestRouter)
router.use('/event_type', eventTypeRouter)

router.route('/ping').get((req, res) => { res.send({ ping: "ok" })})

module.exports = router
