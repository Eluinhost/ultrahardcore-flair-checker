var Snoocore = require('snoocore');
var config = require('../config/config.json');
var TitleFormatPass = require('./passes/TitleFormatPass');
var logger = require('./Logger');
var Q = require('q');

var reddit = new Snoocore({
    userAgent: 'UltraHardcore Flair Checker',
    throttle: 1000,
    oauth: config.login.oauth,
    login: config.login.account
});

var formatPass = new TitleFormatPass(reddit);

initDatabase()
    .then(authenticate)
    .then(titlePass)
    .catch(function(err) {
        logger.error('Uncaught error during scripts: %s', err);
    });

/**
 * Pass that works once for each post to check titles. Skips any previously parsed posts
 *
 * @returns {Q.promise}
 */
function titlePass() {
    logger.info('Starting title based pass');
    return reddit('/r/$subreddit/search').get(config.titlePass.query).then(function(results) {
        logger.info('Found %d posts to check', results.data.children.length);

        logger.info('Starting title format check');
        return formatPass.checkPosts(results.data.children);
    });
}

/**
 * Authenticate the account with reddit OAuth
 *
 * @returns {Q.promise}
 */
function authenticate() {
    logger.info('Authenticating with Reddit');

    return reddit.auth();
}

/**
 * Sets up the database and syncs models structure and then removes all the expired post checks from the database
 *
 * @returns {Q.promise}
 */
function initDatabase() {
    logger.info('Starting up database');

    return require('./db/DbInit')()
        .then(formatPass.removeOld)
}