function InvalidFormatChecker(reddit) {
    this.reddit = reddit;
}

/**
 * Checks if we've already commented on this post
 *
 * @param name
 * @returns {boolean} true if already commented, false otherwise
 */
function haveAlreadyCommented(name) {
    //TODO use DB to see if already posted to this post
    return false;
}

function processPost(post) {
    //TODO check if format is incorrect

    // if incorrect add comment

    // update DB to say post checked
}

InvalidFormatChecker.prototype = {
    checkPosts: function(posts) {
        posts.forEach(this.checkPost);
    },
    checkPost: function(post) {
        if(!haveAlreadyCommented(post.data.name)) { // unique identified tx_xxxxxx
            processPost(post);
        }
    }
};

module.exports = InvalidFormatChecker;