var express = 	require('express');
var router = 	express.Router();

//Routes
var auth = require('./auth');
var chat = require('./chat');

router.use("/auth", auth);
router.use("/chat", chat);

module.exports = router;
