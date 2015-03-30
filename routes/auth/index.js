var express = 	require('express');
var router = 	express.Router();

//Routes
var login = require('./login/');
var twitter = require('./twitter/');
var logout = require('./logout');

router.use("/login", login);
router.use('/twitter', twitter);
router.use("/logout", logout);

module.exports = router;