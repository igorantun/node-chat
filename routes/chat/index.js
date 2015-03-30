var express = 	require('express');
var router = 	express.Router();
var pack = require('../../package.json');

router.use('/', function (req, res) {
    if (res.locals.user.logged_in === true) {
        res.render('pages/index', {version: pack.version});
    } else {
        res.redirect("/auth/login");
    }
});

module.exports = router;