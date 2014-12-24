var details = require('./DatabaseDetails');
var Sequelize = require('sequelize');
var logger = require('./../Logger');

var options = details.options;

// use to stop extra arguments being set that are irrelvant to the actual log
function logging(message) {
    logger.debug(message);
}
options.logging = logging;

module.exports = new Sequelize(details.database, details.username, details.password, options);
