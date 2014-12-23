var details = require('./DatabaseDetails');

var knex = require('knex')(details);

module.exports = require('bookshelf')(knex);
