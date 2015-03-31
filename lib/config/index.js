var config = {};
var logger = require('../logger/');

config.mysql = require('../../config/mysql.json');
config.twitter = require('../../config/twitter.json');
config.express = require('../../config/express.json');
config.jwt = require('../../config/jwt.json');

logger("info", "Config", "Successfully loaded config files!");

module.exports = config;
