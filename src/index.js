var Snoocore = require('snoocore');
var config = require('../config/config.json');
var InvalidFormatChecker = require('./InvalidFormatChecker');


var reddit = new Snoocore({
    userAgent: 'UltraHardcore Flair Checker',
    throttle: 1000,
    oauth: config.oauth,
    login: config.login
});

var formatChecker = new InvalidFormatChecker(reddit);

require('./db/DbInit')().then(function() {
    return reddit.auth();
}).then(function() {
    return reddit('/r/$subreddit/search').get({
        $subreddit: config.subreddit,
        limit: config.limit,
        restrict_sr: true,
        sort: 'new'
    })
}).then(function(results) {
    return formatChecker.checkPosts(results.data.children);
});