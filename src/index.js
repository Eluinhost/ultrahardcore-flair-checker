var Snoocore = require('snoocore');
var config = require('../config/config.json');
var InvalidFormatChecker = require('./InvalidFormatChecker');
var logger = require('./Logger');

var reddit = new Snoocore({
    userAgent: 'UltraHardcore Flair Checker',
    throttle: 1000,
    oauth: config.oauth,
    login: config.login
});

var formatChecker = new InvalidFormatChecker(reddit);

logger.info('Starting up database');
require('./db/DbInit')().then(function() {
    return formatChecker.removeOld()
}).then(function() {
    logger.info('Authenticating with Reddit');
    return reddit.auth()
}).then(function() {
    logger.info('Fetching reddit posts');
    return reddit('/r/$subreddit/search').get({
        $subreddit: config.subreddit,
        limit: config.limit,
        restrict_sr: true,
        sort: 'new'
    })
}).then(function(results) {
    logger.info('Found %d posts to check', results.data.children.length);
    logger.info('Starting title format check');
    return formatChecker.checkPosts(results.data.children);
}).catch(function(err) {
    logger.error('Uncaught error during script: %s', err);
});