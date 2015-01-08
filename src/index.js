var config = require('./../config/config.json');
var TitleCheck = require('./models/TitleCheck');
var moment = require('moment');
var TitleFormatPass = require('./passes/TitleFormatPass');
var CompletedMatchPass = require('./passes/CompletedMatchPass');
var PostFetcher = require('./PostFetcher');
var Snoocore = require('snoocore');
var logger = require('./Logger');

// create a Snoocore instance to use in all the things
var reddit = new Snoocore({
    userAgent: 'UltraHardcore Flair Checker',
    throttle: 1000,
    oauth: config.login.oauth,
    login: config.login.account
});

// create the title pass for checking post title formats one time only
var titleFormatPass = new TitleFormatPass(reddit, {
    titleRegex: config.titleRegex,
    timeMessage: config.titlePass.timeMessage,
    formatMessage: config.titlePass.formatMessage,
    upcomingFlairClass: config.flairs.upcoming.class,
    upcomingFlairText: config.flairs.upcoming.text,
    minTime: config.titlePass.graceTime,
    retention: config.titlePass.retention
});

var completedMatchPass = new CompletedMatchPass(
    reddit,
    config.flairs.completed.class,
    config.flairs.completed.text,
    config.titleRegex
);

// create a fetcher for getting latest posts
var postFetcher = new PostFetcher(
    reddit,
    config.subreddit,
    config.flairs.upcoming.class,
    config.flairs.completed.class,
    config.flairs.ignores
);

require('./db/DbInit')()
    .then(function() {
        return titleFormatPass.removeOldChecks();
    })
    .then(function() {
        logger.info('Authenticating with Reddit');
        return reddit.auth()
    })
    .then(function() {
        logger.info('Fetching unflaired posts');

        return postFetcher.fetchUnflaired(config.fetchCount);
    })
    .then(function(posts) {
        return titleFormatPass.processPosts(posts);
    })
    .then(function() {
        return postFetcher.fetchUpcoming(config.fetchCount);
    })
    .then(function(posts) {
        return completedMatchPass.processPosts(posts);
    })
    .fail(function(err) {
        logger.error('Error occurred: %s', err);
    });