var Q = require('q');

var models = [require('./../models/InvalidFormatCheck')];

module.exports = function() {
    return models.map(function(element) {
        return function() {
            return element.sync()
        }
    }).reduce(
        function(soFar, func) {
            return soFar.finally(func);
        },
        Q()
    );
};