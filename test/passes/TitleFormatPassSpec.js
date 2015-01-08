var chai = require('chai');
var sinon = require('sinon');
chai.use(require('sinon-chai'));
var expect = chai.expect;
var Q = require('q');
var config = require('./../../config/config.json');
var moment = require('moment');
var async = require('async');

var TitleFormatPass = require('./../../src/passes/TitleFormatPass');

describe('TitleFormatPass', function () {

    var TitleCheck, pass, checkedDef, unCheckedDef, reddit, redditObj;

    beforeEach(function () {
        reddit = sinon.stub();
        redditObj = {
            post: sinon.stub()
        };
        redditObj.post.returns(Q());
        reddit.returns(redditObj);

        TitleCheck = {
            find: sinon.stub(),
            destroy: sinon.stub()
        };

        TitleCheck.destroy.returns(Q());

        checkedDef = Q.defer();
        unCheckedDef = Q.defer();

        checkedDef.resolve({});
        unCheckedDef.resolve(null);

        TitleCheck.find.withArgs('already-checked').returns(checkedDef.promise);
        TitleCheck.find.withArgs('not-checked').returns(unCheckedDef.promise);

        pass = new TitleFormatPass(reddit, {
            titleRegex: config.titleRegex,
            timeMessage: 'invalid time',
            formatMessage: 'invalid title format',
            upcomingFlairClass: 'upcoming_match',
            upcomingFlairText: 'upcoming match',
            minTime: 2,
            retention: {
                unit: 'months',
                value: 6
            }
        });
        pass._TitleCheck = TitleCheck;
    });

    it('checks for not checked status from model', function(done) {
        pass._checkProcessed('not-checked').then(function(checked) {
                expect(checked).to.be.false;
                expect(TitleCheck.find).to.have.been.called.once;
                expect(TitleCheck.find).to.have.been.calledWithExactly('not-checked');

                done();
        }).fail(function(err) {
            done(err);
        });
    });

    it('checks for checked status from model', function(done) {
        pass._checkProcessed('already-checked').then(function(checked) {
            expect(checked).to.be.true;
            expect(TitleCheck.find).to.have.been.called.once;
            expect(TitleCheck.find).to.have.been.calledWithExactly('already-checked');

            done();
        }).fail(function(err) {
            done(err);
        });
    });

    it('adds upcoming flair to valid titled posts', function(done) {
        var future = moment.utc().add(7, 'days');
        var past = moment.utc().subtract(7, 'days');

        var dateString = future.format('MMM DD HH:mm');

        var counter = 0;
        var template = function(title) {
            this.data = {
                name: 't3_' + counter++,
                created_utc: past,
                title: title,
                subreddit: 'uhcmatches'
            };
        };

        var testPosts = [
            new template(dateString + ' UTC [EU] - Game Title'), // full formatting
            new template(dateString + ' UTC EU - Game Title'), // missing []
            new template(dateString + ' UTC [EU] Game Title'), // missing -
            new template(dateString + ' UCT [EU] - Game Title'), // UCT
            new template(dateString + ' [EU] - Game Title'), // missing TZ
            new template(dateString + 'EU Game Title') // minimalist Jan 01 00:00EU Game Title
        ];

        TitleCheck.build = sinon.stub();
        TitleCheck.build.returns({
            save: sinon.stub()
        });

        async.each(
            testPosts,
            function(post, callback) {
                pass._processPost(post).then(function() {
                    callback();
                });
            },
            function(err) {
                if(err) {
                    return done(err);
                }

                try {
                    expect(TitleCheck.find.callCount).to.equal(0);
                    expect(TitleCheck.build.callCount).to.equal(6);
                    expect(reddit.callCount).to.equal(6);
                    expect(reddit).to.have.been.always.calledWithExactly('/r/$subreddit/api/flair');

                    expect(redditObj.post.callCount).to.equal(6);
                    testPosts.forEach(function(element) {
                        expect(redditObj.post).to.have.been.calledWithExactly({
                            $subreddit: element.data.subreddit,
                            api_type: 'json',
                            css_class: 'upcoming_match',
                            link: element.data.name,
                            text: 'upcoming match'
                        });
                    });
                    done();
                } catch(err) {
                    done(err);
                }
            }
        )
    });

    it('comments and removes an invalid titled post', function(done) {
        var future = moment.utc().add(7, 'days');
        var past = moment.utc().subtract(7, 'days');

        var dateString = future.format('MMM Do HH:mm'); // Jan 1st 00:00

        var post = {
            data: {
                name: 't3_1',
                created_utc: past,
                title: dateString + ' UTC [EU] - Game Title',
                subreddit: 'uhcmatches'
            }
        };

        TitleCheck.build = sinon.stub();
        TitleCheck.build.returns({
            save: sinon.stub()
        });

        pass._processPost(post).then(function() {
            expect(TitleCheck.find.callCount).to.equal(0);
            expect(TitleCheck.build.callCount).to.equal(1);
            expect(reddit.callCount).to.equal(2);
            expect(reddit).to.have.been.calledWithExactly('/api/remove');
            expect(reddit).to.have.been.calledWithExactly('/api/comment');

            expect(redditObj.post.callCount).to.equal(2);
            // removing
            expect(redditObj.post).to.have.been.calledWithExactly({
                id: 't3_1',
                spam: false
            });
            // commenting
            expect(redditObj.post).to.have.been.calledWithExactly({
                text: 'invalid title format',
                thing_id: 't3_1'
            });

            done();
        }).fail(function(err) {
            done(err);
        });
    });

    it('comments and removes an past-timed titled post', function(done) {
        var past = moment.utc().subtract(7, 'days');

        var dateString = moment.utc().subtract(1, 'days').format('MMM DD HH:mm'); // in the past

        var post = {
            data: {
                name: 't3_1',
                created_utc: past,
                title: dateString + ' UTC [EU] - Game Title',
                subreddit: 'uhcmatches'
            }
        };

        TitleCheck.build = sinon.stub();
        TitleCheck.build.returns({
            save: sinon.stub()
        });

        pass._processPost(post).then(function() {
            expect(TitleCheck.find.callCount).to.equal(0);
            expect(TitleCheck.build.callCount).to.equal(1);
            expect(reddit.callCount).to.equal(2);
            expect(reddit).to.have.been.calledWithExactly('/api/remove');
            expect(reddit).to.have.been.calledWithExactly('/api/comment');

            expect(redditObj.post.callCount).to.equal(2);
            // removing
            expect(redditObj.post).to.have.been.calledWithExactly({
                id: 't3_1',
                spam: false
            });
            // commenting
            expect(redditObj.post).to.have.been.calledWithExactly({
                text: 'invalid time',
                thing_id: 't3_1'
            });

            done();
        }).fail(function(err) {
            done(err);
        });
    });

    it('skips past young posts', function(done) {

        var post = {
            data: {
                name: 't3_1',
                created_utc: moment.utc(), // current time, very recent
                title: 'Dec 31 23:59 UTC [EU] - Game Title',
                subreddit: 'uhcmatches'
            }
        };

        TitleCheck.build = sinon.stub();
        TitleCheck.build.returns({
            save: sinon.stub()
        });

        pass._processPost(post).then(function() {
            expect(TitleCheck.find.callCount).to.equal(0);
            expect(TitleCheck.build.callCount).to.equal(0);
            expect(reddit.callCount).to.equal(0);

            done();
        }).fail(function(err) {
            done(err);
        });
    });

    it('can remove old posts', function(done) {
        pass.removeOldChecks().then(function() {
            expect(TitleCheck.destroy).to.have.been.calledOnce;
            done();
        }).fail(function(err) {
            done(err);
        });
    });

    it('can filter and process an entire array of posts', function(done){
        // half will be valid, half not
        pass._TitleCheck.find = function(name) {
            return Q(name % 2 === 0 ? {} : null);
        };

        // setup posts with id's 0-50
        var posts = [];
        for(var i = 0; i<50; i++) {
            posts.push({
                data: {
                    name: i
                }
            });
        }

        // stub out processing
        pass._processPost = sinon.stub();
        pass._processPost.returns(Q());

        pass.processPosts(posts).then(function() {
            // half should have been filtered out
            expect(pass._processPost.callCount).to.equal(25);

            done();
        }).fail(function(err) {
            done(err);
        });
    });
});