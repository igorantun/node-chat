var cookie = require('cookie');
module.exports = function(req, res, next){
    console.log(req);
    next();
};