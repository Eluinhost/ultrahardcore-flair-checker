var chai = require('chai');
var sinon = require('sinon');
chai.use(require('sinon-chai'));
var expect = chai.expect;
var Q = require('q');


var PostFetcher = require('./../src/PostFetcher');
var Snoocore = require('snoocore');
var config = require('./../config/config.json');

describe('PostFetcher', function () {

    var fetcher, reddit, listing, fullSlice, shortSlice, fullPromise, shortPromise;

    beforeEach(function () {
        // 100 results
        var fullData = require('./data/query.json');
        // just 25 results
        var shortData = require('./data/shortquery.json');

        // resolve to a fake slice
        fullSlice = {
            allChildren: fullData.data.children,
            next: sinon.stub()
        };
        fullPromise = Q.defer();
        fullPromise.resolve(fullSlice);

        shortSlice = {
            allChildren: shortData.data.children,
            next: sinon.stub()
        };
        shortPromise = Q.defer();
        shortPromise.resolve(shortSlice);

        // set up the promises to make pages of 100 -> 25 for a total of 125 posts
        fullSlice.next.returns(shortPromise.promise);

        listing = sinon.stub();
        listing.returns(fullPromise.promise);

        reddit = sinon.stub();
        reddit.returns({
            listing: listing
        });

        fetcher = new PostFetcher(reddit, 'sub', 'upcoming', 'invalid', 'completed',['ig1', 'ig2']);
    });

    // should only call the first page of the listing and only fetch the specified amount
    it('fetches correct amount for less than 100 limit', function(done) {

        // fetch 70 posts
        fetcher._fetch('sub', 'query', 70).then(
            function(data) {
                try {
                    expect(reddit).to.have.been.calledWithExactly('/r/$subreddit/search');
                    expect(listing).to.have.been.calledWithExactly({
                        $subreddit: 'sub',
                        q: 'query',
                        restrict_sr: true,
                        sort: 'new',
                        count: 70  // ensure we're fetching 70
                    });
                    expect(fullSlice.next).to.not.have.been.called; // no calls to the next page should happen
                    expect(shortSlice.next).to.not.have.been.called;
                    expect(data).to.have.length(70); // make sure we get the correct amount

                    done();
                } catch(e) {
                    done(e);
                }
            },
            function(err) {
                done('Error: ' + err);
            }
        );
    });

    // make sure it queries the next page when fetching > 100 posts
    it('fetches correct amount for greater than 100 limit', function(done) {

        // start a query for 110 posts
        fetcher._fetch('sub', 'query', 110).then(
            function(data) {
                try {
                    expect(reddit).to.have.been.calledWithExactly('/r/$subreddit/search');
                    expect(listing).to.have.been.calledWithExactly({
                        $subreddit: 'sub',
                        q: 'query',
                        restrict_sr: true,
                        sort: 'new',
                        count: 100  // 100 is max for reddit so we do it in chunks
                    });
                    expect(fullSlice.next).to.have.been.called.once; // only query the first slice after the listing
                    expect(shortSlice.next).to.have.not.been.called;

                    // check length of returned data is the same we requested
                    expect(data).to.have.length(110);
                    done();
                } catch(e) {
                    done(e);
                }
            },
            function(err) {
                done('Error: ' + err);
            }
        );
    });

    // we only have 125 posts available, make sure if we query for more we return all possible
    it('returns as much as it can', function(done) {

        // start a query for 150 posts
        fetcher._fetch('sub', 'query', 150).then(
            function(data) {
                try {
                    expect(reddit).to.have.been.calledWithExactly('/r/$subreddit/search');
                    expect(listing).to.have.been.calledWithExactly({
                        $subreddit: 'sub',
                        q: 'query',
                        restrict_sr: true,
                        sort: 'new',
                        count: 100  // 100 is max for reddit so we do it in chunks
                    });
                    expect(fullSlice.next).to.have.been.called.once;  // we query for the next page
                    expect(shortSlice.next).to.have.not.been.called;  // there are no more pages after the short one so it shouldn't query for the next page

                    // ensure we got all of the data
                    expect(data).to.have.length(125);
                    done();
                } catch(e) {
                    done(e);
                }
            },
            function(err) {
                done('Error: ' + err);
            }
        )
    });

    it('deduplicates repeat post IDs', function(done) {
        // duplicate first 2 slices
        fullSlice.next.onFirstCall().returns(fullPromise.promise);
        fullSlice.next.onSecondCall().returns(shortPromise.promise);

        // start a query for 250 posts (fetches 100->100->25 for 225 and 115 after deduplication)
        fetcher._fetch('sub', 'query', 250).then(
            function(data) {
                try {
                    expect(reddit).to.have.been.calledWithExactly('/r/$subreddit/search');
                    expect(listing).to.have.been.calledWithExactly({
                        $subreddit: 'sub',
                        q: 'query',
                        restrict_sr: true,
                        sort: 'new',
                        count: 100  // 100 is max for reddit so we do it in chunks
                    });
                    expect(fullSlice.next).to.have.been.called.once;  // we query for the next page
                    expect(shortSlice.next).to.have.not.been.called;  // there are no more pages after the short one so it shouldn't query for the next page

                    // ensure we got all of the data
                    expect(data).to.have.length(125);
                    done();
                } catch(e) {
                    done(e);
                }
            },
            function(err) {
                done('Error: ' + err);
            }
        )
    });

    it('fetches unflaired posts', function(done) {
        fetcher._fetch = sinon.stub();
        var def = Q.defer();
        def.resolve();
        fetcher._fetch.returns(def.promise);

        fetcher.fetchUnflaired(240).then(function() {
            try {
                var ignore = ['ig1', 'ig2', 'upcoming', 'invalid', 'completed'];

                var query = ignore.reduce(function(prev, current) {
                    return prev + '-flair:' + current + ' ';
                }, '');

                expect(fetcher._fetch).to.have.been.calledWithExactly('sub', query, 240);

                done();
            } catch(e) {
                done(e);
            }
        });
    });

    it('fetches upcoming matches', function(done) {
        fetcher._fetch = sinon.stub();
        var def = Q.defer();
        def.resolve();
        fetcher._fetch.returns(def.promise);

        fetcher.fetchUpcoming(240).then(function() {
            try {
                expect(fetcher._fetch).to.have.been.calledWithExactly('sub', 'flair:upcoming', 240);

                done();
            } catch(e) {
                done(e);
            }
        });
    });
});