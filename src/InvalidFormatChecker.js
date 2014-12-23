var InvalidFormatCheck = require('./models/InvalidFormatCheck');
var Q = require('q');

function InvalidFormatChecker(reddit) {
    this.reddit = reddit;
}

/**
 * Checks if we've already processed this post in the past
 *
 * @param name
 * @returns {Q.promise} resolves to true if not processed, false if already process
 */
function shouldProcess(name) {
    var def = Q.defer();

    new InvalidFormatCheck({ name: name })
        .fetch()
        .then(
        function success(model) {
            def.resolve(typeof model === 'undefined');
        },
        function error(err) {
            def.reject(err);
        }
    );

    return def.promise;
}

function processPost(post) {
    var def = Q.defer();
    console.log('processing', post.data.name);

    //TODO check if format is incorrect

    // if incorrect add comment

    // update DB to say post checked
    new InvalidFormatCheck({ name: post.data.name })
        .save()
        .then(def.resolve, def.reject);

    return def.promise;
}

InvalidFormatChecker.prototype = {
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
        console.log('checking', post.data.name);
        var processed = false;

        shouldProcess(post.data.name).then(
            function success(toProcess){
                if (toProcess) {
                    processed = true;
                    console.log('processing', post.data.name);
                    return processPost(post);
                } else {
                    console.log('skipping already processed', post.data.name);
                }
            },
            function error(err) {
                console.log('error processing post', err);
                def.reject(err);
            }
        ).then(
            function success() {
                def.resolve(processed);
            },
            function error(err) {
                console.log('error processing post', err);
                def.reject(err);
            }
        );

        return def.promise;
    }
};

module.exports = InvalidFormatChecker;