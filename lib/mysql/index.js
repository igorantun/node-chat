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

//Borrowed from knexjs
sequelize.escape = function(val) {
    if (val === undefined || val === null) {
        return 'NULL';
    }

    switch (typeof val) {
        case 'boolean':
            return (val) ? 'true' : 'false';
        case 'number':
            return val + '';
    }

    if (typeof val === 'object') val = val.toString();

    val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function (s) {
        switch (s) {
            case "\0":
                return "\\0";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\b":
                return "\\b";
            case "\t":
                return "\\t";
            case "\x1a":
                return "\\Z";
            default:
                return "\\" + s;
        }
    });
    return "'" + val + "'";
};

module.exports = sequelize;
