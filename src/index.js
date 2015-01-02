var Snoocore = require('snoocore');
var config = require('../config/config.json');
var TitleFormatPass = require('./passes/TitleFormatPass');
var logger = require('./Logger');
var Q = require('q');
var TitleCheck = require('./models/TitleCheck');
var moment = require('moment');
var async = require('async');


var reddit = new Snoocore({
    userAgent: 'UltraHardcore Flair Checker',
    throttle: 1000,
    oauth: config.login.oauth,
    login: config.login.account
});


initDatabase()
    .then(authenticate)
    .then(titlePass)
    .catch(function(err) {
        logger.error('Uncaught error during scripts: ' + err);
    });

/**
 * Pass that works once for each post to check titles. Skips any previously parsed posts
 *
 * @returns {Q.promise}
 */
function titlePass() {
    logger.info('Starting title based pass');

    return reddit('/r/$subreddit/search').get(config.titlePass.query)
        .then(filterAlreadyProcessed)
        .then(function(posts) {
            logger.info('Starting title format check for %s posts', posts.length);

            var formatPass = new TitleFormatPass(reddit);
            formatPass.processPosts(posts);

            return posts;
        })
        .then(function(posts) {
            saveNewChecks(posts);
        });
}

function saveNewChecks(posts) {
    // converts posts array to array of function that need to be called in series and then executes them

    return posts.map(function(post) {
        return saveNewCheck.bind(undefined, post.data.name)
    }).reduce(Q.when, Q());
}

function saveNewCheck(name) {
    // update DB to say post checked and avoid duplicate comments
    return TitleCheck.build({ name: name, checked: moment().valueOf() }).save();
}

/**
 * Filters out posts whose titles have already been processed in previous checks
 *
 * @param results
 * @returns {Q.promise}
 */
function filterAlreadyProcessed(results) {
    logger.info('Found %d posts to check', results.data.children.length);

    var def = Q.defer();

    // filter out already done posts
    async.filter(
        results.data.children,
        function(item, callback) {
            alreadyProcessedTitle(item.data.name).then(
                function success(processed) {
                    callback(!processed);
                },
                function error(err) {
                    // skip post on errors
                    logger.error('Error checking status from database for post %s: %s', item.data.name, err);
                    callback(false);
                }
            )
        },
        def.resolve
    );

    return def.promise;
}

/**
 * Checks if we've already processed this post in the past
 *
 * @param name
 * @returns {Q.promise} resolves to true if not processed, false if already process
 */
function alreadyProcessedTitle(name) {
    var def = Q.defer();

    TitleCheck.find(name).then(
        function success(model) {
            def.resolve(model !== null);
        },
        function error(err) {
            def.reject(err);
        }
    );

    return def.promise;
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
        .then(function() {
            logger.info('Removing out of date title checks from the database');

            return TitleCheck.destroy({
                where: {
                    checked: {
                        lt: moment().subtract(config.titlePass.retention.value, config.titlePass.retention.unit).valueOf()
                    }
                }
            });
        })
}