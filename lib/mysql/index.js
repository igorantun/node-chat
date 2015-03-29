var mysql = require('mysql');
var config = require('../../config/mysql.json');
var logger = require('jethro');

var connection = mysql.createConnection({
    host     : config.host,
    user     : config.username,
    password : config.password,
    database : config.database
});

connection.connect();

module.exports = connection;
