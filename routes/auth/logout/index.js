var express = 	require('express');
var router = 	express.Router();

router.use("/", function(req, res, next){
    req.session = null;
    res.redirect("/auth/login");
});

module.exports = router;