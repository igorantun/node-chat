var express = 	require('express');
var router = 	express.Router();

router.get('/',function(req, res, next){
    if (res.locals.user.logged_in === true){
        res.redirect("/chat");
    } else {
        res.render("pages/login");
    }
});


module.exports = router;