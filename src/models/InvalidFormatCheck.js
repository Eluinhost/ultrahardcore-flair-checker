var orm = require('./../db/Orm');
var Seq = require('sequelize');

var InvalidFormatCheck = orm.define('InvalidFormatCheck',
    {
        name: {
            type: Seq.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true
        }
    },
    {
        timestamps: true,
        updatedAt: false
    });


module.exports = InvalidFormatCheck;