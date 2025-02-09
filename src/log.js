const winston = require('winston')
const logformat = winston.format.combine(
    winston.format.simple(),
    // winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => `${info.timestamp}: ${info.message}`)
);

const infoLogFilename = 'logs/info.log'
const errorLogFilename = 'logs/error.log'

module.exports.logger = winston.createLogger({
        level: 'info',
        format: logformat,
        transports: [
            new winston.transports.File({
                filename: errorLogFilename,
                level: 'error',
                format: logformat
            }),
            new winston.transports.File({
                filename: infoLogFilename,
                level: 'info',
                format: logformat
            }),
            new winston.transports.Console({
                level: 'info',
                format: winston.format.combine(
                    winston.format.colorize(),
                    logformat
                )
            })
        ],
    })

module.exports.errorLogFilename = errorLogFilename
module.exports.infoLogFilename = infoLogFilename


