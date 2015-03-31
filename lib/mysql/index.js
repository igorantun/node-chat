var mysql = require('mysql');
var config = require('../../config/mysql.json');

var connection = mysql.createConnection({
    host     : config.host,
    user     : config.username,
    password : config.password,
    database : config.database,
    insecureAuth: true
});

connection.connect();

module.exports = connection;
