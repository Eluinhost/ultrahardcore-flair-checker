var chai = require('chai');
var sinon = require('sinon');
chai.use(require('sinon-chai'));
var expect = chai.expect;
var Q = require('q');
var config = require('./../config/config.json');

var TitleFormatPass = require('./../src/passes/TitleFormatPass');

describe('PostFetcher', function () {

    var TitleCheck, pass, checkedDef, unCheckedDef;

    beforeEach(function () {
        TitleCheck = {
            find: sinon.stub()
        };

        checkedDef = Q.defer();
        unCheckedDef = Q.defer();

        checkedDef.resolve({});
        unCheckedDef.resolve(null);

        TitleCheck.find.withArgs('already-checked').returns(checkedDef.promise);
        TitleCheck.find.withArgs('not-checked').returns(unCheckedDef.promise);

        pass = new TitleFormatPass(config.titleRegex);
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

    it('removes already processed posts from an array', function(done) {
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

        pass._removeProcessedPosts(posts).then(function(results) {

            // we expect half to have been filtered out
            expect(results).to.have.length(posts.length / 2);

            done();
        }).fail(function(err) {
            done(err);
        });
    });

    // skip for now as logic will be changed
    it('can process an individual post');

    it('can filter and process an entire array of posts');
});