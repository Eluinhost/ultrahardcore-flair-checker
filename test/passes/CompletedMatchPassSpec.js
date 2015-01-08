var chai = require('chai');
var sinon = require('sinon');
chai.use(require('sinon-chai'));
var expect = chai.expect;
var Q = require('q');
var config = require('./../../config/config.json');
var moment = require('moment');

var CompletedMatchPass = require('./../../src/passes/CompletedMatchPass');

describe('CompletedMatchPass', function () {

    var pass, reddit, redditObj;

    beforeEach(function () {
        reddit = sinon.stub();
        redditObj = {
            post: sinon.stub()
        };
        redditObj.post.returns(Q());
        reddit.returns(redditObj);

        pass = new CompletedMatchPass(reddit, 'completed_match', 'Completed Match', new RegExp(config.titleRegex, 'i'));
    });

     it('adds completed flair to past posts', function(done) {
         var past = moment.utc().subtract(7, 'days');

         var dateString = past.format('MMM DD HH:mm');

         var data = {
            name: 't3_1',
            created_utc: past,
            title: dateString + ' UTC [EU] - Game Title',
            subreddit: 'uhcmatches'
         };

         pass._processPost({data: data}).then(function() {
                expect(reddit.callCount).to.equal(1);
                expect(reddit).to.have.been.always.calledWithExactly('/r/$subreddit/api/flair');

                expect(redditObj.post.callCount).to.equal(1);
                expect(redditObj.post).to.have.been.calledWithExactly({
                    $subreddit: data.subreddit,
                    api_type: 'json',
                    css_class: 'completed_match',
                    link: data.name,
                    text: 'Completed Match'
                });
                done();
            }
         ).fail(function(err) {
                done(err);
         });
    });

    it('does nothing to non completed matches', function(done) {
        var past = moment.utc().subtract(7, 'days');
        var future = moment.utc().add(7, 'days');

        var dateString = future.format('MMM DD HH:mm');

        var data = {
            name: 't3_1',
            created_utc: past,
            title: dateString + ' UTC [EU] - Game Title',
            subreddit: 'uhcmatches'
        };

        pass._processPost({data: data}).then(function() {
                expect(reddit).to.have.not.been.called;
                expect(redditObj.post).to.have.not.been.called;

                done();
            }
        ).fail(function(err) {
                done(err);
            });
    });
});