var Sequelize = require('sequelize');
var config = require('../../config/mysql.json');
var logger = require('jethro');

var sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    },
    logging:function(data){
        logger("transport", "MySQL", data);
    }
});

module.exports = sequelize;
