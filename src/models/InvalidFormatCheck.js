var orm = require('./../db/Orm');
var Seq = require('sequelize');

var InvalidFormatCheck = orm.define('InvalidFormatCheck',
    {
        name: {
            type: Seq.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true
        },
        checked: {
            type: Seq.INTEGER,
            allowNull: false
        }
    },
    {
        timestamps: false
    });


module.exports = InvalidFormatCheck;