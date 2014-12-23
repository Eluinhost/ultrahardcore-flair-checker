var details = require('./DatabaseDetails');

var Sequelize = require('sequelize');

module.exports = new Sequelize(details.database, details.username, details.password, details.options);
