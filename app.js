/* Requires */
var favicon = require('serve-favicon');
var s = require('underscore.string');
var readline = require('readline');
var express = require('express');
var sockjs = require('sockjs');
var https = require('https');
var chalk = require('chalk');
var fs = require('fs');

var log = require('./lib/log.js');
var utils = require('./lib/utils.js');
var config = require('./config.json');
var pack = require('./package.json');
var path = require('path');


/* Config */
var port = utils.normalizePort(process.env.PORT || config.port);
var app = express();
var server;


/* Variables */
var lastTime = [];
var rateLimit = [];
var currentTime = [];
var rateInterval = [];

var chat = sockjs.createServer();
var clients = [];
var users = {};
var bans = [];
var uid = 1;

var alphanumeric = /^\w+$/;

if(config.readline.use) {
    var rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt(config.readline.prompt);
    rl.prompt();
}


/* Express */
app.set('port', port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(favicon(path.join(__dirname,'public/img/favicon.png')));
app.locals.version = pack.version;


/* Routes */
app.use(config.url, express.static(path.join(__dirname, 'public')));
app.get(config.url, function (req, res) {
    res.render('index', {version:pack.version});
});


/* Logic */
chat.on('connection', function(conn) {
    log('socket', chalk.underline(conn.id) + ': connected (' + conn.headers['x-forwarded-for'] + ')');
    rateLimit[conn.id] = 1;
    lastTime[conn.id] = Date.now();
    currentTime[conn.id] = Date.now();

    clients[conn.id] = {
        id: uid,
        un: null,
        ip: conn.headers['x-forwarded-for'],
        role: 0,
        con: conn,
        warn : 0
    };

    users[uid] = {
        id: uid,
        oldun: null,
        un: null,
        role: 0
    };
    
    for(i in bans) {
        if(bans[i][0] == clients[conn.id].ip) {
            if(Date.now() - bans[i][1] < bans[i][2]) {
                conn.write(JSON.stringify({type:'server', info:'rejected', reason:'banned', time:bans[i][2]}));
                return conn.close();
            } else {
                bans.splice(i);
            }
        }
    }

    conn.write(JSON.stringify({type:'server', info:'clients', clients:users}));
    conn.write(JSON.stringify({type:'server', info:'user', client:users[uid]}));
    conn.on('data', function(message) {
        currentTime[conn.id] = Date.now();
        rateInterval[conn.id] = (currentTime[conn.id] - lastTime[conn.id]) / 1000;
        lastTime[conn.id] = currentTime[conn.id];
        rateLimit[conn.id] += rateInterval[conn.id];

        if(rateLimit[conn.id] > 1) {
            rateLimit[conn.id] = 1;
        }

        if(rateLimit[conn.id] < 1 && JSON.parse(message).type != 'delete' && JSON.parse(message).type != 'typing' && JSON.parse(message).type != 'ping') {
            clients[conn.id].warn++;

            if(clients[conn.id].warn < 6) {
                return conn.write(JSON.stringify({type:'server', info:'spam', warn:clients[conn.id].warn}));
            } else {
                bans.push([clients[conn.id].ip, Date.now(), 5 * 1000 * 60]);
                utils.sendToAll(clients, {type:'ban', extra:clients[conn.id].un, message:'Server banned ' + clients[conn.id].un + ' from the server for 5 minutes for spamming the servers'});

                return conn.close();
            }
        } else {
            try {
                var data = JSON.parse(message);

                if(data.type == 'ping') {
                    return false;
                }

                if(data.type == 'typing') {
                    return utils.sendToAll(clients, {type:'typing', typing:data.typing, user:clients[conn.id].un});
                }

                if(data.type == 'delete' && clients[conn.id].role > 0) {
                    utils.sendToAll(clients, {type:'server', info:'delete', mid:data.message});
                }

                if(data.type == 'update') {
                    return updateUser(conn.id, data.user);
                }

                if(data.message.length > 768) {
                    data.message = data.message.substring(0, 768);
                    message = JSON.stringify(data);
                }

                if(data.type == 'pm') log('message', chalk.underline(clients[conn.id].un) + ' to ' + chalk.underline(data.extra) + ': ' + data.message);
                else log('message', '[' + data.type.charAt(0).toUpperCase() + data.type.substring(1) + '] ' + chalk.underline(clients[conn.id].un) + ': ' + data.message);

                handleSocket(clients[conn.id], message);
            } catch(err) {
                return log('error', err);
            }

            rateLimit[conn.id] -= 1;
        }
    });

    conn.on('close', function() {
        log('socket', chalk.underline(conn.id) + ': disconnected (' + clients[conn.id].ip + ')');
        utils.sendToAll(clients, {type:'typing', typing:false, user:clients[conn.id].un});
        utils.sendToAll(clients, {type:'server', info:'disconnection', user:users[clients[conn.id].id]});
        delete users[clients[conn.id].id];
        delete clients[conn.id];
    });
});


/* Functions */
function updateUser(id, name) {
    if(name.length > 2 && name.length < 17 && name.indexOf(' ') < 0 && !utils.checkUser(clients, name) && name.match(alphanumeric) && name != 'Console' && name != 'System') {
        if(clients[id].un == null) {
            clients[id].con.write(JSON.stringify({type:'server', info:'success'}));
            uid++;
        }

        users[clients[id].id].un = name;
        utils.sendToAll(clients, {
            type: 'server',
            info: clients[id].un == null ? 'connection' : 'update',
            user: {
                id: clients[id].id,
                oldun: clients[id].un,
                un: name,
                role: clients[id].role
            }
        });
        clients[id].un = name;
    } else {
        var motive = 'format';
        var check = false;

        if(!name.match(alphanumeric)) motive = 'format';
        if(name.length < 3 || name.length > 16) motive = 'length';
        if(utils.checkUser(clients, name) ||  name == 'Console' || name == 'System') motive = 'taken';
        if(clients[id].un != null) check = true;

        clients[id].con.write(JSON.stringify({type:'server', info:'rejected', reason:motive, keep:check}));
        if(clients[id].un == null) clients[id].con.close();
    }
}

function handleSocket(user, message) {
    var data = JSON.parse(message);

    data.id = user.id;
    data.user = user.un;
    data.type = s.escapeHTML(data.type);
    data.message = s.escapeHTML(data.message);
    data.mid = (Math.random() + 1).toString(36).substr(2, 5);

    switch(data.type) {
        case 'pm':
            if(data.extra != data.user && utils.checkUser(clients, data.extra)) {
                utils.sendToOne(clients, users, data, data.extra, 'message');
                data.subtxt = 'PM to ' + data.extra;
                utils.sendBack(clients, data, user);
            } else {
                data.type = 'light';
                data.subtxt = null;
                data.message = utils.checkUser(clients, data.extra) ? 'You can\'t PM yourself' : 'User not found';
                utils.sendBack(clients, data, user);
            }
            break;

        case 'global': case 'kick': case 'ban': case 'role':
            if(user.role > 0) {
                if(data.type == 'global') {
                    if(user.role == 3) {
                        return utils.sendToAll(clients, data);
                    } else {
                        data.subtxt = null;
                        data.message = 'You don\'t have permission to do that';
                        return utils.sendBack(clients, data, user);
                    }
                } else {
                    data.subtxt = null;
                    if(data.message != data.user) {
                        if(utils.checkUser(clients, data.message)) {
                            switch(data.type) {
                                case 'ban':
                                    var time = parseInt(data.extra);

                                    if(!isNaN(time) && time > 0) {
                                        if(user.role > 1 && utils.getUserByName(clients, data.message).role == 0) {
                                            for(var client in clients) {
                                                if(clients[client].un == data.message) {
                                                    bans.push([clients[client].ip, Date.now(), time * 1000 * 60]);
                                                }
                                            }

                                            data.extra = data.message;
                                            data.message = data.user + ' banned ' + data.message + ' from the server for ' + time + ' minutes';
                                            return utils.sendToAll(clients, data);
                                        } else {
                                            data.message = 'You don\'t have permission to do that';
                                            return utils.sendBack(clients, data, user);
                                        }
                                    } else {
                                        data.type = 'light';
                                        data.message = 'Use /ban [user] [minutes]';
                                        return utils.sendToOne(clients, users, data, data.user, 'message')
                                    }
                                    break;

                                case 'role':
                                    if(data.extra > -1 && data.extra < 4) {
                                        if(user.role == 3) {
                                            var role;
                                            data.role = data.extra;
                                            data.extra = data.message;

                                            if(data.role == 0) role = 'User';
                                            if(data.role == 1) role = 'Helper';
                                            if(data.role == 2) role = 'Moderator';
                                            if(data.role == 3) role = 'Administrator';
                                            data.message = data.user + ' set ' + data.message + '\'s role to ' + role;

                                            utils.sendToOne(clients, users, data, JSON.parse(message).message, 'role');
                                            utils.sendToAll(clients, {type:'server', info:'clients', clients:users});
                                        } else {
                                            data.message = 'You don\'t have permission to do that';
                                            return utils.sendBack(clients, data, user);
                                        }
                                    } else {
                                        data.type = 'light';
                                        data.message = 'Use /role [user] [0-3]';
                                        return utils.sendToOne(clients, users, data, data.user, 'message')
                                    }
                                    break;

                                case 'kick':
                                    if(user.role > 1 && utils.getUserByName(clients, data.message).role == 0) {
                                        data.extra = data.message;
                                        data.message = data.user + ' kicked ' + data.message + ' from the server';
                                    } else {
                                        data.message = 'You don\'t have permission to do that';
                                        return utils.sendBack(clients, data, user);
                                    }
                                    break;
                            }                            
                            utils.sendToAll(clients, data);
                        } else {
                            data.type = 'light';
                            data.message = 'User not found';
                            utils.sendBack(clients, data, user);
                        }
                    } else {
                        data.message = 'You can\'t do that to yourself';
                        utils.sendBack(clients, data, user);
                    }
                }
            } else {
                data.message = 'You don\'t have permission to do that';
                utils.sendBack(clients, data, user);
            }
            break;

        default:
            utils.sendToAll(clients, data);
            break;
    }
}



/* Internal */
if(config.readline.use) {
    readLine();
}

function readLine() {
    rl.on('line', function(line) {
        var data = {};
        if(line.indexOf('/role') == 0) {
            var string = 'Console gave ' + line.substring(6) + ' administrator permissions';

            data.message = string;
            data.user = 'Console';
            data.type = 'role';
            data.extra = line.substring(6);
            data.role = 3;

            utils.sendToAll(clients, data);
            utils.sendToOne(clients, users, data, line.substring(6), data.type);
        }

        rl.prompt();
    }).on('close', function() {
        log('stop', 'Shutting down\n');
        process.exit(0);
    });
}

if(!config.ssl.use) {
    var http = require('http');
    server = http.createServer(app);
} else {
    var https = require('https');
    var opt = {
        key: fs.readFileSync(config.ssl.key),
        cert: fs.readFileSync(config.ssl.cert)
    };

    server = https.createServer(opt, app);
}

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

function onError(error) {
    if(error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    switch(error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;

        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;

        default:
            throw error;
    }
}

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    log('start', 'Listening at ' + bind);
}

chat.installHandlers(server, {prefix:'/socket', log:function(){}});
