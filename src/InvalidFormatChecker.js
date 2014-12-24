var InvalidFormatCheck = require('./models/InvalidFormatCheck');
var Q = require('q');
var config = require('./../config/config.json').formatChecker;
var moment = require('moment');
var logger = require('./Logger');

/**
 * An invalid format checker can check posts for invalid title formats and leave a comment if the post is deemed invalid.
 *
 * @param {Snoocore} reddit
 * @constructor
 */
function InvalidFormatChecker(reddit) {
    this.reddit = reddit;
}

var titleRegex = new RegExp(config.titleRegex, 'i');

/**
 * Checks if we've already processed this post in the past
 *
 * @param name
 * @returns {Q.promise} resolves to true if not processed, false if already process
 */
function shouldProcess(name) {
    var def = Q.defer();

    InvalidFormatCheck.find(name)
        .then(
        function success(model) {
            def.resolve(model === null);
        },
        function error(err) {
            def.reject(err);
        });

    return def.promise;
}

/**
 * Processes a post of invalid title format and leaves a comment on it
 *
 * @param post
 * @returns {Q.promise}
 */
function processPost(post) {
    logger.info('Starting processing for post ID %s', post.data.name);
    var def = Q.defer();

    if (titleRegex.test(post.data.title)) {
        logger.info('Post ID %s title (%s) is correct. Skipping', post.data.name, post.data.title);
    } else {
        logger.info('Post ID %s has an invalid title: %s. Adding a comment to the post', post.data.name, post.data.title);
        // add a comment on to the post
    }

    // update DB to say post checked and avoid duplicate comments
    InvalidFormatCheck.build({ name: post.data.name, checked: moment().valueOf() })
        .save()
        .then(def.resolve, def.reject);

    return def.promise;
}

InvalidFormatChecker.prototype = {
    /**
     * Removes all checks older than the configured date
     */
    removeOld: function() {
        logger.info('Removing out of date checks');
        return InvalidFormatCheck.destroy({
            where: {
                checked: {
                    lt: moment().subtract(config.retention.value, config.retention.unit).valueOf()
                }
            }
        });
    },
    /**
     * Checks each of the posts sequentially. Resolves when completed.
     *
     * @see #checkPost
     *
     * @param {array} posts
     * @returns {Q.promise}
     */
    checkPosts: function(posts) {
        var def = Q.defer();

        posts.map(
            function(element) {
                return this.checkPost.bind(undefined, element);
            },
            this
        ).reduce(
            function(soFar, func) {
                return soFar.finally(func);
            },
            Q()
        ).then(def.resolve);

        return def.promise;
    },
    /**
     * Check the post for invalid formats
     *
     * @param post
     * @returns {Q.promise} resolves to true if was processed, false if skipped because it was already processed. Will
     * reject if any problems during database/check
     */
    checkPost: function(post) {
        var def = Q.defer();
        logger.debug('Checking post with ID %s', post.data.name);
        var processed = false;

        shouldProcess(post.data.name).then(
            function success(toProcess){
                if (toProcess) {
                    processed = true;
                    return processPost(post);
                } else {
                    logger.info('Skipped post ID %s; already processed', post.data.name);
                }
            },
            function error(err) {
                logger.error('Error checking checked status of post ID %s, Error: %s', post.data.name, err);
                def.reject(err);
            }
        ).then(
            function success() {
                def.resolve(processed);
            },
            function error(err) {
                logger.error('Error processing post ID %s, Error: %s', post.data.name, err);
                def.reject(err);
            }
        );

        return def.promise;
    }
};

module.exports = InvalidFormatChecker;