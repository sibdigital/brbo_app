const {logger } = require("../log");

const usersService = require('../services/users.service')
const targetSystemService = require('../services/targetSystem.service')

class UserController {

    async createOrUpdate(req, res) {
        if (!req.body) return res.sendStatus(400);

        const users = req.body.users

        const promises = users.map(async (user) => {
            return new Promise(async (resolve, reject) => {
                try {
                    const targetSystem = await targetSystemService.findTargetSystemByCode(user.targetSystemCode)
                    if(targetSystem.length == 0){
                        user.status = `target system ${user.targetSystemCode} not found`
                    } else {
                        const targetSystemUser = await usersService.findRegTargetSystemUser(targetSystem[0].uuid, user.login)
                        if(targetSystemUser.length > 0){
                            //update
                            const resultUpdateTargetUser = await usersService.updateRegTargetSystemUser(targetSystemUser[0].uuid, user)
                            user.status = resultUpdateTargetUser ? 'updated' : 'error update'
                        } else {
                            //insert
                            const resultCreateTargetUser = await usersService.createRegTargetSystemUser(targetSystem[0].uuid, user)
                            user.status = resultCreateTargetUser ? 'created' : 'error create'
                        }
                    }
                    return resolve(user)
                } catch (e) {
                    logger.error(`[userController.createOrUpdate]: ${e}`)
                    return reject(`[createOrUpdate.createOrUpdate]: ${e}`)
                }
            })
        })

        Promise.allSettled(promises).then((result) => {
            const users = result.map(v => v.status == 'fulfilled' ? JSON.stringify(v.value) : Object.assign({}, {status: v.reason}) )
            res.send(users)
        })
    }
}

module.exports = new UserController();
