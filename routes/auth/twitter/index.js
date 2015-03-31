var express = 	require('express');
var router = 	express.Router();
var passport = require("passport");
var TwitterStrategy = require('passport-twitter').Strategy;
var config = require('../../../lib/config/');
var mysql = require('../../../lib/mysql');

passport.use(new TwitterStrategy({
            consumerKey: config.twitter.TWITTER_CONSUMER_KEY,
            consumerSecret: config.twitter.TWITTER_CONSUMER_SECRET,
            callbackURL: "http://localhost:3000/auth/twitter/callback",
            session: false
        },
        function(token, tokenSecret, profile, done) {
            console.log(profile);
            var q = "SELECT * FROM users WHERE token = '" + token + "'";
            console.log(q);
            mysql.query(q, function(err, result){
                if (!err){
                    if (result.length > 0){
                        if (result[0].tokenSecret === tokenSecret){
                            done(null, result[0]);
                        }
                    } else {
                        console.log(profile);
                        var user = {
                            id: profile.id,
                            token: token,
                            tokenSecret: tokenSecret,
                            name: profile._json.name,
                            username: profile.username,
                            location: profile._json.location,
                            description: profile._json.description
                        };
                        mysql.query("INSERT INTO users SET ?", user,  function(err, result){
                            if (!err){
                                done(null, user);
                            } else {
                                throw err;
                            }
                        });
                    }
                } else {
                    throw err;
                }
            });
        })
);

var jwt = require("jsonwebtoken");

router.get('/', passport.authenticate('twitter'));
router.get('/callback',
    passport.authenticate('twitter', {
        session: false
    }),
    function(req, res) {
        req.session.user = req.user;
        var user = req.user;
        req.session.token = jwt.sign({
            foo: true,
            user: {id: user.id, username: user.username, type:"twitter"},
            date: new Date()
        }, config.jwt.salt);
        res.cookie('jwt', req.session.token, {httpOnly: true });
        res.redirect("/chat");
    }
);

module.exports = router;