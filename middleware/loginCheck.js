var cookie = require('cookie');
module.exports = function(req, res, next){
    if (typeof req.session.user !== "undefined"){
        res.locals.user = req.session.user;
        res.locals.user.logged_in = true;
    } else {
        res.locals.user = {};
        res.locals.user.logged_in = false;
    }
    next();
};