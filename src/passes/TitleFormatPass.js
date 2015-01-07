var logger = require('./../Logger');
var async = require('async');
var Q = require('q');

/**
 * @param {Object} config
 * @param {String} config.titleRegex - the regex to match titles, capture group 1 being the time
 * @param {String} config.message - the message to leave on invalid titled posts
 * @param {String} config.invalidClass - the class of the invalid match flair
 * @param {String} config.invalidText - the text for the invalid match flair
 * @constructor
 */
function TitleFormatPass(config) {
    this._TitleCheck = require('./../models/TitleCheck');
    this._titleRegex = new RegExp(config.titleRegex, 'i');
    this._response = config.message;
    this._invalidFlairClass = config.invalidClass;
    this._invalidFlairText = config.invalidText;
}

TitleFormatPass.prototype = {
    /**
     * Filters out posts whose titles have already been processed in previous checks
     *
     * @param posts
     * @returns {Q.promise} that resolves to the filtered array
     * @private
     */
    _removeProcessedPosts: function(posts) {
        logger.info('Found %d posts to check', posts.length);

        var def = Q.defer();

        var self = this;
        // filter out already done posts
        async.filter(
            posts,
            function(item, callback) {
                self._checkProcessed(item.data.name).then(
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
    },
    /**
     * Checks if we've already processed this post in the past
     *
     * @param name
     * @returns {Q.promise} resolves to true if processed, false if not
     * @private
     */
    _checkProcessed: function(name) {
        var def = Q.defer();

        this._TitleCheck.find(name).then(
            function success(model) {
                def.resolve(model !== null);
            },
            function error(err) {
                def.reject(err);
            }
        );

        return def.promise;
    },
    /**
     * Processes a post, does not check if already processed before
     *
     * @param post
     * @returns {Q.promise} a promise that resolves to when completed
     * @private
     */
    _processPost: function(post) {
        if (this._titleRegex.test(post.data.title)) {
            logger.info('Post ID %s title (%s) is correct. Skipping', post.data.name, post.data.title);
            return Q();
        }

        logger.info('Post ID %s has an invalid title: %s. Adding a comment to the post and adding invalid match flair', post.data.name, post.data.title);

        // add a comment on to the post
        var commentPromise = this.reddit('/api/comment').post({
            text: this._response,
            thing_id: post.data.name
        }).then(
            function success() {
                logger.info('Added comment to post ID %s', post.data.name);
            },
            function error(err) {
                logger.error('Failed to add comment to post ID %s: %s', post.data.name, err);
            }
        );

        // add invalid match flair
        var flairPromise = this.reddit('/r/$subreddit/api/flair').post({
            $subreddit: post.data.subreddit,
            api_type: 'json',
            css_class: this._invalidFlairClass,
            link: post.data.name,
            text: this._invalidFlairText
        }).then(
            function success(data) {
                logger.info('Added flair for post ID %s: %s', post.data.name, data);
            },
            function error(err) {
                logger.error('Failed to add invalid match flair to post ID %s: %s', post.data.name, err);
            }
        );

        // promise that resolves after flair/comment is done
        return Q.allSettled(commentPromise, flairPromise);
    },
    /**
     * Processes all of the given posts, skips already processed posts
     *
     * @param posts
     * @returns {Q.promise} a promise that resolves when completed
     */
    processPosts: function(posts) {
        var def = Q.defer();

        var self = this;
        this._removeProcessedPosts(posts).then(function(results) {

            async.each(
                results,
                function(result, callback) {
                    self._processPost(result).finally(function() {
                        callback()
                    });
                },
                function(err) {
                    if (err) {
                        def.reject(err);
                    } else {
                        def.resolve();
                    }
                }
            );

            results.forEach(self._processPost, self);
        });

        return def.promise;
    }
};

module.exports = TitleFormatPass;