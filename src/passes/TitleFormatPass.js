var config = require('./../../config/config.json');
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

var titleRegex = new RegExp(config.titleRegex, 'i');


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
            logger.info('Post ID %s has an invalid title: %s. Adding a comment to the post and adding invalid match flair', post.data.name, post.data.title);

            // add a comment on to the post
            this.reddit('/api/comment').post({
                text: config.titlePass.message,
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
            this.reddit('/r/$subreddit/api/flair').post({
                $subreddit: config.subreddit,
                api_type: 'json',
                css_class: config.flairs.invalid.class,
                link: post.data.name,
                text: config.flairs.invalid.text
            }).then(
                function success(data) {
                    logger.info('Added flair for post ID %s: %s', post.data.name, data);
                },
                function error(err) {
                    logger.error('Failed to add invalid match flair to post ID %s: %s', post.data.name, err);
                }
            );
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