// Variables
var favicon = require('serve-favicon'),
    readline = require('readline'),
    express = require('express'),
    colors = require('colors'),
    sockjs = require('sockjs'),
    https = require('https'),
    path = require('path'),
    fs = require('fs'),
    app = express();

var config = {
    log: true,
    readline: true,
    ipadr: '127.0.0.1' || 'localhost',
    port: 3000,
    ssl: false
};

var styles = {
    info:    colors.bold.blue,
    error:   colors.bold.red.dim,
    socket:  colors.bold.magenta,
    stop:    colors.bold.red.dim,
    start:   colors.bold.green.dim,
    message: colors.bold.green.dim,
    pm:      colors.bold.yellow.dim,
}

if(config.ssl) {
    var options = {
        key: fs.readFileSync('/path/to/your/ssl.key'),
        cert: fs.readFileSync('/path/to/your/ssl.crt')
    },
    server = https.createServer(options);
}

var chat = sockjs.createServer(),
    clients = [],
    users = {},
    uid = 1;

var alphanumeric = /^\w+$/,
    escapeHtml = function(e,t,n,r){var i=0,s=0,o=false;if(typeof t==="undefined"||t===null){t=2}e=e.toString();if(r!==false){e=e.replace(/&/g,"&")}e=e.replace(/</g,"&lt;").replace(/>/g,"&gt;");var u={ENT_NOQUOTES:0,ENT_HTML_QUOTE_SINGLE:1,ENT_HTML_QUOTE_DOUBLE:2,ENT_COMPAT:2,ENT_QUOTES:3,ENT_IGNORE:4};if(t===0){o=true}if(typeof t!=="number"){t=[].concat(t);for(s=0;s<t.length;s++){if(u[t[s]]===0){o=true}else if(u[t[s]]){i=i|u[t[s]]}}t=i}if(t&u.ENT_HTML_QUOTE_SINGLE){e=e.replace(/'/g,"&#039;")}if(!o){e=e.replace(/"/g,"&#34;")}return e};


// Config
if(config.readline) {
    var rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt('[--:--:--][CONSOLE] ');
    rl.prompt();
}


// Express
app.set('view engine', 'ejs');
app.use(favicon(__dirname + '/public/img/favicon.png'));
app.use('/chat', express.static(__dirname + '/public'));

app.get('/chat', function (req, res) {
    res.render('pages/index');
});
      

// Connections
var server = app.listen(config.port, config.ipadr, function() {
    var host = server.address().address,
        port = server.address().port;

    consoleLog('start', 'Listening at http://' + host + ':' + port);
});

chat.on('connection', function(conn) {
    consoleLog('socket', colors.underline(conn.id) +': connected');

    clients[conn.id] = {
        id: uid,
        un: null,
        ip: conn.headers['x-forwarded-for'],
        op: false,
        con: conn
    };

    users[uid] = {
        id: uid,
        oldun: null,
        un: null,
        op: false
    };
    
    conn.write(JSON.stringify({type:'server', info:'clients', clients:users}));
    conn.write(JSON.stringify({type:'server', info:'user', client:users[uid]}));
    conn.on('data', function(message) {
        try {
            var data = JSON.parse(message);

            if(data.type == 'ping') return false;
            if(data.type == 'delete') deleteChat(data.message, conn.id);
            if(data.type == 'update') return updateUser(conn.id, data.user);
            if(data.type == 'pm') consoleLog('message', '[PM] ' + colors.underline(clients[conn.id].un) + ' to ' + colors.underline(data.extra) + ': ' + data.message);
            else consoleLog('message', '[' + data.type.charAt(0).toUpperCase() + data.type.substring(1) + '] ' + colors.underline(clients[conn.id].un) + ': ' + data.message);

            if(data.type != 'update') sendSocket(clients[conn.id], message);
        } catch(err) {
            return consoleLog('error', err);
        }
    });

    conn.on('close', function() {
        consoleLog('socket', colors.underline(conn.id) + ': disconnected');
        sendToAll({type:'server', info:'disconnection', user:users[clients[conn.id].id]})
        delete users[clients[conn.id].id];
        delete clients[conn.id];
    });
});

chat.installHandlers(server, {prefix:'/socket',log:function(){}});


// Util
function deleteChat(chat, user) {
    if(clients[user].op)
        sendToAll({type:'server', info:'delete', mid:chat})
}

function updateUser(id, name) {
    if(name.length > 2 &&  name.length < 17 && name.indexOf(' ') < 0 && !checkUser(name) && name.match(alphanumeric)) {
        if(clients[id].un == null) {
            clients[id].con.write(JSON.stringify({type:'server', info:'success'}));
            uid++;
        }

        users[clients[id].id].un = name;
        sendToAll({
            type: 'server',
            info: clients[id].un == null ? 'connection' : 'update',
            user: {
                id: clients[id].id,
                oldun: clients[id].un,
                un: name,
                op: clients[id].op
            }
        });
        clients[id].un = name;
    } else  {
        var motive, check = false;

        if(!name.match(alphanumeric)) motive = 'format';
        if(name.indexOf(' ') > -1) motive = 'space';
        if(name.length < 3 || name.length > 16) motive = 'length';
        if(checkUser(name)) motive = 'taken';
        if(clients[id].un != null) check = true;

        clients[id].con.write(JSON.stringify({type:'server', info:'rejected', reason:motive, keep:check}));
        if(clients[id].un == null) clients[id].con.close();
    }
}

function sendToAll(data) {
    for(var client in clients)
        clients[client].con.write(JSON.stringify(data));
}

function sendToOne(data, user, type) {
    for(var client in clients) {
        if(clients[client].un == user) {
            if(type == 'message') clients[client].con.write(JSON.stringify(data));
            if(type == 'kick') clients[client].con.write(JSON.stringify(data));
            if(type == 'deop') clients[client].op = false;
            if(type == 'op') clients[client].op = true;
        }
    }
}

function sendBack(data, user) {
    clients[user.con.id].con.write(JSON.stringify(data));
}

function checkUser(user) {
    for(var client in clients) {
        if(clients[client].un == user)
            return true;
    }
    return false;
}

function sendSocket(user, message) {
    var data = JSON.parse(message);

    data.id = user.id;
    data.user = user.un;
    data.time = getTime();
    data.type = escapeHtml(data.type);
    data.message = escapeHtml(data.message);
    data.mid = (Math.random() + 1).toString(36).substr(2, 5);

    switch(data.type) {
        case 'pm':
            if(data.extra != data.user && checkUser(data.extra)) {
                sendToOne(data, data.extra, 'message');
                data.subtxt = 'PM to ' + data.extra;
                sendBack(data, user);
            } else {
                data.type = 'light';
                data.subtxt = null;
                data.message = checkUser(data.extra) ? 'You can\'t PM yourself' : 'User not found';
                sendBack(data, user);
            }
            break;

        case 'global': case 'kick': case 'op': case 'deop':
            if(data.type == 'global' && user.op)
                return sendToAll(data);

            if(!user.op || data.message == data.user) {
                data.subtxt = null;
                data.message = data.message == data.user ? 'You can\'t do that to yourself' : 'You are not an administrator';
                sendBack(data, user);
            } else {
                if(checkUser(data.message)) {
                    data.extra = data.message;
                    if(data.type == 'kick') data.message = data.user + ' kicked ' + data.message + ' from the server';
                    if(data.type == 'deop') data.message = data.user + ' removed ' + data.message + ' administrator permissions';
                    if(data.type == 'op')   data.message = data.user + ' gave ' + data.message + ' administrator permissions';
                    sendToAll(data);

                    if(data.type != 'global')
                        sendToOne(data, JSON.parse(message).message, data.type);
                } else {
                    data.type = 'light';
                    data.subtxt = null;
                    data.message = 'User not found';
                    sendBack(data, user);
                }
            }
            break;

        default:
            sendToAll(data);
            break;
    }
}

function getTime() {
    var now = new Date(),
        time = [now.getHours(), now.getMinutes(), now.getSeconds()];
 
    for(var i = 0; i < 3; i++) {
        if(time[i] < 10)
            time[i] = "0" + time[i];
    }
 
    return time.join(":");
}

function consoleLog(type, message) {
    if(config.log) {
        if(config.readline) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            console.log('[' + getTime() + '][' + styles[type](type.toUpperCase()) + '] ' + message);
            rl.prompt(true);
        } else {
            console.log('[' + getTime() + '][' + styles[type](type.toUpperCase()) + '] ' + message);
        }
    }
}


// Intern
if(config.readline) readLine();
function readLine() {
    rl.on('line', function(line) {
        var type = line.substring(1).split(' ')[0].toLowerCase(),
            action,
            user,
            data = {
                user: 'Console',
                time: getTime()
            };

        if(line.charAt(0) == '/') {
            switch(type) {
                case 'op':
                    action = 'gave '
                    user = line.substring(4);
                    break;
                    
                case 'deop':
                    action = 'removed '
                    user = line.substring(6);
                    break;
            }

            var string = 'Console ' + action + user + ' administrator permissions';

            data.message = string;
            data.type = type;
            data.extra = user;

            sendToAll(data);
            sendToOne(data, user, data.type);
        }

        rl.prompt();
    }).on('close', function() {
        consoleLog('stop', 'Shutting down\n');
        process.exit(0);
    });
}
