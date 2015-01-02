var config = require('./../../config/config.json').titlePass;
var logger = require('./../Logger');

/**
 * An invalid format checker can check posts for invalid title formats and leave a comment if the post is deemed invalid.
 *
 * @param {Snoocore} reddit
 * @constructor
 */
function TitleFormatPass(reddit) {
    this.reddit = reddit;
}

var titleRegex = new RegExp(config.format.regex, 'i');


TitleFormatPass.prototype = {
    /**
     * Processes a post of invalid title format and leaves a comment on it
     *
     * @param post
     */
    processPost: function(post) {
        if (titleRegex.test(post.data.title)) {
            logger.info('Post ID %s title (%s) is correct. Skipping', post.data.name, post.data.title);
        } else {
            logger.info('Post ID %s has an invalid title: %s. Adding a comment to the post', post.data.name, post.data.title);
            // add a comment on to the post

            this.reddit('/api/comment').post({
                text: config.format.message,
                thing_id: post.data.name
            });
        }
    },
    /**
     * Checks each of the posts sequentially. Resolves when completed.
     *
     * @see #processPost
     *
     * @param {array} posts
     */
    processPosts: function(posts) {
        posts.forEach(this.processPost, this);
    }
};

module.exports = TitleFormatPass;