var Model = require('./../db/Orm').Model;

var InvalidFormatCheck = Model.extend(
    {
        tableName: 'InvalidFormatCheck',
        idAttribute: 'name',
        name: String,
        hasTimestamps: true
    }
);

module.exports = InvalidFormatCheck;