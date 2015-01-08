var logger = require('./../Logger');
var async = require('async');
var Q = require('q');
var moment = require('moment');

/**
 * Checks posts for titles in the past
 *
 * @param {Snoocore} reddit - the snoocore instance to use
 * @param {String} completedClass - the css class of the flair to use
 * @param {String} completedText - the text of the flair to use
 * @param {String} titleRegex
 * @constructor
 */
function CompletedMatchPass(reddit, completedClass, completedText, titleRegex) {
    this._reddit = reddit;
    this._completedClass = completedClass;
    this._completedText = completedText;
    this._titleRegex = new RegExp(titleRegex, 'i');
}

CompletedMatchPass.prototype = {
    /**
     * Sets the flair for the given link
     *
     * @param {String} subreddit
     * @param {String} name - the id of the link
     * @param {String} flair - the flair css class
     * @param {String} flairText
     * @returns {Q.promise}
     * @private
     */
    _setFlair: function(subreddit, name, flair, flairText) {
        return this._reddit('/r/$subreddit/api/flair').post({
            $subreddit: subreddit,
            api_type: 'json',
            css_class: flair,
            link: name,
            text: flairText
        }).then(
            function success() {
                logger.info('Added upcoming match flair for post ID %s', name);
            },
            function error(err) {
                logger.error('Failed to add upcoming match flair to post ID %s: %s', name, err);
            }
        );
    },
    /**
     * Processes a post, does not check if already processed before
     *
     * @param post
     * @returns {Q.promise} a promise that resolves to when completed
     * @private
     */
    _processPost: function(post) {
        logger.info('Starting completed status of post ID %s (%s)', post.data.name, post.data.title);

        var matches = this._titleRegex.exec(post.data.title);

        // check the title is in a valid format
        if(null === matches) {
            logger.error('Invalid post title for %s, post ID %s with upcoming match flair', post.data.title, post.data.name);
            return Q();
        }

        // title is a valid format, check if the date is in the past
        if (moment.utc(matches[1], 'MMM DD HH:mm', 'en').diff(moment.utc()) > 0) {
            return Q(); // game title still in the future
        }

        logger.info('Post ID %s title (%s) is in the past. Adding completed match flair', post.data.name, post.data.title);

        return this._setFlair(post.data.subreddit, post.data.name, this._completedClass, this._completedText);
    },
    /**
     * Processes all of the given posts
     *
     * @param posts
     * @returns {Q.promise} a promise that resolves when completed
     */
    processPosts: function(posts) {
        var def = Q.defer();

        var self = this;
        logger.info('Processing %d upcoming match posts', posts.length);

        async.each(
            posts,
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

        return def.promise;
    }
};

module.exports = CompletedMatchPass;