var orm = require('./../db/Orm');
var Seq = require('sequelize');

/**
 * TitleCheck is an entry in the database to show that a post's title has already been checked. A post title cannot
 * change therefore we will only ever need to check a post title once and skip any others.
 */
var TitleCheck = orm.define('TitleCheck',
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


module.exports = TitleCheck;