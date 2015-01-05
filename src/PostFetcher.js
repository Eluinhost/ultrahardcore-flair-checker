var Q = require('q');
var async = require('async');

/**
 * @param reddit Snoocore instance already authenticated
 * @param {String} subreddit the subreddit to search from
 * @param {String} upcoming flair for upcoming matches
 * @param {String} invalid flair for invalid matches
 * @param {String} completed flair for completed matches
 * @param {String[]} ignore other flairs to ignore
 * @constructor
 */
function PostFetcher(reddit, subreddit, upcoming, invalid, completed, ignore) {
    this.reddit = reddit;
    this.subreddit = subreddit;

    this.flairs = {
        upcoming: upcoming,
        invalid: invalid,
        completed: completed,
        ignore: ignore.concat(upcoming, invalid, completed)
    };
}

function deduplicate(posts) {
    // hash table of IDs seen
    var seen = {};

    // return a filtered array with unique post IDs
    return posts.filter(function(post) {
        return seen.hasOwnProperty(post.data.name) ? false : (seen[post.data.name] = true);
    });
}

PostFetcher.prototype = {
    fetch: function(subreddit, query, count) {
        var def = Q.defer();

        var next = this.reddit('/r/$subreddit/search').listing({
            $subreddit: subreddit,
            q: query,
            restrict_sr: true,
            sort: 'new',
            count: count < 100 ? count : 100
        });

        var remaining = count;

        var all = [];
        async.whilst(
            function() {
                return remaining > 0 && next !== null;
            },
            function(done) {
                // fetch the next slice of data
                next.then(function(slice) {
                    var children = slice.allChildren;

                    // if we return more data than we need cut the rest off
                    if (children.length > remaining) {
                        children = children.slice(0, remaining);
                    }

                    // add all the children to the array
                    all = deduplicate(all.concat(children));
                    remaining = count - all.length;

                    // only move to the next one if reddit returned the full 100 results and we need more
                    if (children.length === 100 && remaining > 0) {
                        next = slice.next();
                    } else {
                        next = null;
                    }

                    done();
                }, function(err) {
                    done(err);
                });
            },
            function(err) {
                if(err) {
                    def.reject(err);
                } else {
                    def.resolve(all);
                }
            }
        );

        return def.promise;
    },
    /**
     * Fetches all posts without any of the specified flairs
     */
    fetchUnflaired: function(count) {
        var query = this.flairs.ignore.reduce(function(prev, current) {
            return prev + '-flair:' + current + ' ';
        }, '');

        return this.fetch(this.subreddit, query, count);
    },
    /**
     * Fetches all matches with upcoming match flair
     */
    fetchUpcoming: function(count) {
        var query = 'flair:' + this.flairs.upcoming;

        return this.fetch(this.subreddit, query, count);
    }
};

module.exports = PostFetcher;