var Snoocore = require('snoocore');
var config = require('../config/config.json');
var TitleFormatPass = require('./passes/TitleFormatPass');
var logger = require('./Logger');

var reddit = new Snoocore({
    userAgent: 'UltraHardcore Flair Checker',
    throttle: 1000,
    oauth: config.oauth,
    login: config.login
});

var formatPass = new TitleFormatPass(reddit);

logger.info('Starting up database');
require('./db/DbInit')().then(function() {
    return formatPass.removeOld()
}).then(function() {
    logger.info('Authenticating with Reddit');
    return reddit.auth()
}).then(function() {
    logger.info('Fetching reddit posts');
    return reddit('/r/$subreddit/search').get({
        $subreddit: config.subreddit,
        limit: config.limit,
        restrict_sr: true,
        sort: 'new',
        q: config.filter
    })
}).then(function(results) {
    logger.info('Found %d posts to check', results.data.children.length);
    logger.info('Starting title format check');
    return formatPass.checkPosts(results.data.children);
}).catch(function(err) {
    logger.error('Uncaught error during script: %s', err);
});