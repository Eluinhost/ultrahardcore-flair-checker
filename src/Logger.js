var winston = require('winston');

var logger = new winston.Logger({
    transports: [
        new winston.transports.DailyRotateFile({
            filename: './logs/output.log',
            level: 'debug',
            timestamp: true
        }),
        new winston.transports.Console({
            timestamp: true,
            colorize: true
        })
    ]
});
module.exports = logger;