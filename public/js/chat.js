// Variables
var timer,
    socket,
    username,
    clients = [],
    nmr = 0,
    dev = false,
    version = 'BETA 0.1.0',
    connected = false,
    blop = new Audio("sounds/blop.wav");

emojione.ascii = true;
emojione.imageType = 'png';
emojione.unicodeAlt = false;
document.getElementById('version').innerHTML = version;

var regex = /(&zwj;|&nbsp;)/g,
    escapeHtml = function(e,t,n,r){var i=0,s=0,o=false;if(typeof t==="undefined"||t===null){t=2}e=e.toString();if(r!==false){e=e.replace(/&/g,"&")}e=e.replace(/</g,"&lt;").replace(/>/g,"&gt;");var u={ENT_NOQUOTES:0,ENT_HTML_QUOTE_SINGLE:1,ENT_HTML_QUOTE_DOUBLE:2,ENT_COMPAT:2,ENT_QUOTES:3,ENT_IGNORE:4};if(t===0){o=true}if(typeof t!=="number"){t=[].concat(t);for(s=0;s<t.length;s++){if(u[t[s]]===0){o=true}else if(u[t[s]]){i=i|u[t[s]]}}t=i}if(t&u.ENT_HTML_QUOTE_SINGLE){e=e.replace(/'/g,"&#039;")}if(!o){e=e.replace(/"/g,"&#34;")}return e};

// Connection
var connect = function() {
    socket = new SockJS(dev ? 'http://localhost:3000/socket' : 'http://igorantun.com/socket');

    socket.onopen = function() {
        console.info('Connection established.');
        updateInfo();
    };

    socket.onclose = function() {
        if(connected) {
            updateBar('mdi-action-autorenew spin', 'Connection lost, reconnecting...', true);

            timer = setTimeout(function() {
                console.warn('Connection lost, reconnecting...');
                connect();
            }, 1500);
        }
        clients = [];
    };

    socket.onmessage = function(e) {
        var data = JSON.parse(e.data);
        if(dev) console.log(data);

        if(data.type == 'server') {
            switch(data.info) {
                case 'rejected':
                    var message;
                    if(data.reason == 'short') message = 'Your username must have at least 3 characters';
                    if(data.reason == 'space') message = 'Your username should not have spaces';
                    if(data.reason == 'taken') message = 'This username is already taken';
                    showChat('light', null, message, getTime());

                    if(!data.keep) {
                        username = undefined;
                        connected = false;
                    }
                    break;

                case 'success':
                    document.getElementById("send").childNodes[0].nodeValue = "Send";
                    updateBar('mdi-content-send', 'Enter your message here', false);
                    connected = true;
                    break;

                case 'update':
                    showChat('info', null, data.user.oldun + ' changed its name to ' + data.user.un, getTime());
                    clients[data.user.id] = data.user;
                    break;

                case 'connection':
                    showChat('info', null, data.user.un + ' connected to the server', getTime());
                    clients[data.user.id] = data.user;
                    document.getElementById('users').innerHTML = Object.keys(clients).length + ' USERS';
                    break;

                case 'disconnection':
                    showChat('info', null, data.user.un + ' disconnected from the server', getTime());
                    delete clients[data.user.id];
                    document.getElementById('users').innerHTML = Object.keys(clients).length + ' USERS';
                    break;

                case 'clients':
                    clients = data.clients;
                    document.getElementById('users').innerHTML = Object.keys(clients).length + ' USERS';
                    break;
            }
        } else {
            if(data.message.indexOf('@' + username) > -1) {
                data.type = 'mention';
                if(document.getElementById('sound').checked)
                    blop.play();
            } 

            showChat(data.type, data.user, data.message, data.time, data.subtxt);
        }

        if((data.type == 'op' || data.type == 'deop') && data.extra == username)  {
            if(data.type == 'op') $('#admin').show();
            if(data.type == 'deop') $('#admin').hide();
        }
    }
};

function sendSocket(value, method, other, txt) {
    socket.send(JSON.stringify({
        type: method,
        message: escapeHtml(value),
        subtxt: txt,
        extra: other
    }));
}

function updateInfo() {
    socket.send(JSON.stringify({
        user: username,
        type: 'update'
    }));
}


// Utilities
function updateBar(icon, placeholder, disable) {
    document.getElementById('icon').className = 'mdi ' + icon;
    $('#message').attr('placeholder', placeholder);
    $('#message').prop('disabled', disable);
    $('#send').prop('disabled', disable);
}

function showChat(type, user, message, time, subtxt) {
    if(type == 'alert' || type == 'kick' || type == 'info' || type == 'light' || type == 'help' || type == 'op' || type == 'deop')
        user = 'System';
    if(!subtxt)
        $('#chat').append('<tr class="' + type + '""><td><b>' + user + '</b></td><td class="msg">' + message + '</td><td class="pull-right"><b><small>' + time + '</small></b></td></tr>');
    else
        $('#chat').append('<tr class="' + type + '""><td><b>' + user + '</b></td><td class="msg">' + message + '</td><td class="pull-right"><b><small>(' + subtxt + ') ' + time + '</small></b></td></tr>');
    
    $('#panel').animate({scrollTop: $('#panel').prop("scrollHeight")}, 500);
    updateStyle();
    nmr++;
}

function handleInput() {
    var value = escapeHtml($('#message').val().replace(regex, ' ')).trim();

    if(value.length > 0) {
        if(username === undefined) {
            username = value;
            connect();
        } else if(value.charAt(0) == '/') {
            var command = value.substring(1).split(' ');

            switch(command[0].toLowerCase()) {
                case 'pm': case 'op': case 'deop': case 'kick': case 'name': case 'alert': case 'me': case 'em':
                    if(value.substring(command[0].length).length > 0) {
                        if(command[0] == 'pm' && value.substring(command[0].concat(command[1]).length).length > 2)
                            sendSocket(value.substring(command[0].concat(command[1]).length + 2), 'pm', command[1], 'PM');
                        if(command[0] == 'alert')
                            sendSocket(value.substring(command[0].length + 2), 'alert', null, username);
                        if(command[0] == 'op' || command[0] == 'deop' || command[0] == 'kick' || command[0] == 'me' || command[0] == 'em')
                            sendSocket(value.substring(command[0].length + 2), command[0]);
                        if(command[0] == 'name') {
                            username = value.substring(command[0].length + 2);
                            updateInfo();
                        }
                    } else {
                        var variables;
                        if(command[0] == 'alert' || command[0] == 'me' || command[0] == 'em')
                            variables = ' [message]';
                        if(command[0] == 'kick' || command[0] == 'op' || command[0] == 'deop')
                            variables = ' [user]';
                        if(command[0] == 'pm')
                            variables = ' [user] [message]';
                        if(command[0] == 'name')
                            variables = ' [name]';

                        showChat('light', 'Error', 'Use /' + command[0] + variables, getTime());
                    }
                    break; 

                case 'clear':
                    nmr = 0;
                    document.getElementById('chat').innerHTML = '';
                    showChat('light', 'System', 'Messages cleared', getTime());
                    break;

                case 'shrug':
                    sendSocket(value.substring(6) + ' ¯\\_(ツ)_/¯', 'message');
                    break;

                case 'help':
                    $('#help-dialog').modal('show');
                    $('#message').val('');
                    break;

                case 'reconnect':
                    socket.close();
                    break;

                default:
                    showChat('light', 'Error', 'Unknown command, use /help to get a list of the available commands', getTime());
                    break;
            }
        } else {
            sendSocket(value, 'message');
        }

        $('#message').val('');
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

function updateStyle() {
    $('.msg').linkify();
    if(document.getElementById('emoji').checked) {
        var input = document.getElementsByClassName('msg')[nmr].innerHTML;
        var output = emojione.shortnameToImage(document.getElementsByClassName('msg')[nmr].innerHTML);
        document.getElementsByClassName('msg')[nmr].innerHTML = output;
    }
}


// Triggers
$(document).ready(function(){
    $('#message').focus();

    $("#message").keypress(function(e){
        if(e.which == 13) {
            handleInput();
        }
    });

    $('#send').bind("click", function() {
        handleInput();
    });

    $('#users').bind("click", function() {
        var content = '',
            admin;

        for(var i in clients) {
            if(clients[i] != undefined) {
                clients[i].op ? admin = ' - <b>Administrator</b></li>' : admin = '</li>';
                content += '<li><b>ID:</b> ' + clients[i].id + ' - <b>Name:</b> ' + clients[i].un + admin;
            }
        }

        document.getElementById('users-content').innerHTML = content;
        $('#users-dialog').modal('show');
    });

    $('#admin').bind("click", function() {
        $('#admin-help-dialog').modal('show');
    });
});