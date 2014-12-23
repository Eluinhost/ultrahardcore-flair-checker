var orm = require('./../db/Orm');
var Seq = require('sequelize');

/**
 * InvalidFormatCheck is a record to show that a post has already been checked. A post title cannot change therefore
 * we only ever need to check a post once ever. This exists to stop duplicated comments on a post without having to
 * check each of the child comments.
 */
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