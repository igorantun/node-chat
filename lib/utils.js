/* Exports */
module.exports = {
    sendToOne: function(clients, data, user, type) {
        for(var client in clients) {
            if(clients[client].un == user) {
                if(type == 'message') clients[client].con.write(JSON.stringify(data));
                if(type == 'role') {
                    clients[client].role = data.role;
                    users[clients[client].id].role = data.role;
                }
            }
        }
    },

    sendToAll: function(clients, data) {
        for(var client in clients) {
            clients[client].con.write(JSON.stringify(data));
        }
    },

    sendBack: function(clients, data, user) {
        clients[user.con.id].con.write(JSON.stringify(data));
    },

    checkUser: function(clients, user) {
        for(var client in clients) {
            if(clients[client].un == user) {
                return true;
            }
        }
        return false;
    },

    getUserByName: function(clients, name) {
        for(client in clients) {
            if(clients[client].un == name) {
                return clients[client];
            }
        }
    },

    normalizePort: function(val) {
        var port = parseInt(val, 10);

        if(isNaN(port)) {
            return val;
        }

        if(port >= 0) {
            return port;
        }

        return false;
    }
}