var logger = require('./../Logger');
var async = require('async');
var Q = require('q');
var moment = require('moment');

/**
 * @param {Snoocore} reddit
 * @param {Object} config
 * @param {String} config.titleRegex - the regex to match titles, capture group 1 being the time
 * @param {String} config.timeMessage - the message to leave on invalid titled posts
 * @param {String} config.formatMessage - the message to leave on posts with past dates
 * @param {String} config.upcomingFlairClass - the class for the upcoming match flair
 * @param {String} config.upcomingFlairText - the text for the upcoming match flair
 * @param {Number} config.minTime - the minimum amount of time after creation required before parsing happens in minutes
 * @param {Object} config.retention
 * @param {Number} config.retention.value - the amount of time to keep old id checks
 * @param {String} config.retention.unit - the unit of time for the value to use
 * @constructor
 */
function TitleFormatPass(reddit, config) {
    this._reddit = reddit;
    this._TitleCheck = require('./../models/TitleCheck');
    this._titleRegex = new RegExp(config.titleRegex, 'i');
    this._timeResponse = config.timeMessage;
    this._formatResponse = config.formatMessage;
    this._upcomingFlairClass = config.upcomingFlairClass;
    this._upcomingFlairText = config.upcomingFlairText;
    this._minTime = config.minTime;
    this._retention = config.retention;
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
     * Leaves a comment for the given ID
     *
     * @param {String} response - the message to send
     * @param {String} name - the post ID to leave the comment on
     * @returns {Q.promise}
     * @private
     */
    _leaveComment: function(response, name) {
        return this._reddit('/api/comment').post({
            text: response,
            thing_id: name
        }).then(
            function success() {
                logger.info('Added comment to post ID %s', name);
            },
            function error(err) {
                logger.error('Failed to add comment to post ID %s: %s', name, err);
            }
        );
    },
    /**
     * Removes the post with the given ID, removes as not spam.
     *
     * @param {String} name - the id of the post to remove
     * @returns {Q.promise}
     * @private
     */
    _removePost: function(name) {
        return this._reddit('/api/remove').post({
            id: name,
            spam: false
        });
    },
    /**
     * Saves the title as being checked
     *
     * @param name
     * @returns {Q.promise}
     * @private
     */
    _saveTitleCheck: function(name) {
        return this._TitleCheck.build({ name: name, checked: moment().valueOf() }).save();
    },
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
        logger.info('Starting processing of post ID %s (%s)', post.data.name, post.data.title);

        // if the post is recently posted, skip it. This happens to avoid a newly created post without a flair
        // (like announcements) being deleted before flair is added
        var timeAgo = moment.utc().diff(moment.utc(post.data.created_utc, 'X'), 'minutes');
        logger.info('Post was posted %d minutes ago', timeAgo);

        if(timeAgo < this._minTime) {
            logger.info('Post during grace period, skipping for now, %s', post.data.name);
            return Q();
        }

        // save the fact we checked this post
        var promises = [this._saveTitleCheck(post.data.name)];

        var matches = this._titleRegex.exec(post.data.title);

        // check the title is in a valid format
        if (null !== matches) {
            var scheduled = moment.utc(matches[1], 'MMM DD HH:mm', 'en');
            var current = moment.utc();

            if (scheduled.diff(current, 'months') > 6) {
                scheduled.subtract(1, 'years');
            } else if (scheduled.diff(current, 'months') < -6) {
                scheduled.add(1, 'years');
            }

            // title is a valid format, check if the date is in the past
            if (scheduled.diff(current) < 0) {
                logger.info('Post ID %s title (%s) is in the past. Adding a comment to the post and removing it', post.data.name, post.data.title);

                promises.push(this._leaveComment(this._timeResponse, post.data.name));
                promises.push(this._removePost(post.data.name));
            } else {
                logger.info('Post ID %s title (%s) is correct. Adding upcoming flair', post.data.name, post.data.title);

                // add upcoming match flair
                promises.push(this._setFlair(post.data.subreddit, post.data.name, this._upcomingFlairClass, this._upcomingFlairText));
            }

        } else {
            // invalid title, leave comment and remove post
            logger.info('Post ID %s has an invalid title: %s. Adding a comment to the post and removing it', post.data.name, post.data.title);

            promises.push(this._leaveComment(this._formatResponse, post.data.name));
            promises.push(this._removePost(post.data.name));
        }

        return Q.allSettled(promises);
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
            logger.info('Processing %d filterd posts', results.length);

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
        });

        return def.promise;
    },
    /**
     * Removes all checks in the database older than the configured retention
     *
     * @returns {Q.promise}
     */
    removeOldChecks: function() {
        logger.info('Removing out of date title checks from the database');

        return Q(this._TitleCheck.destroy({
            where: {
                checked: {
                    lt: moment().subtract(this._retention.value, this._retention.unit).valueOf()
                }
            }
        }));
    }
};

module.exports = TitleFormatPass;