var express = 	require('express');
var router = 	express.Router();

//Routes
var login = require('./login/');
var twitter = require('./twitter/');

router.use("/login", login);
router.use('/twitter', twitter);

module.exports = router;