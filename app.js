/* Requires */
const favicon = require('serve-favicon')
const s = require('underscore.string')
const readline = require('readline')
const express = require('express')
const sockjs = require('sockjs')
const http = require('http')
const https = require('https')
const fs = require('fs')

const path = require('path')
const logger = require('./lib/log.js')
const utils = require('./lib/utils.js')
const config = require('./config.json')
const pack = require('./package.json')

/* Config */
const port = utils.normalizePort(process.env.PORT || config.port)
const app = express()
let server

/* Variables */
const lastTime = []
const rateLimit = []
const currentTime = []
const rateInterval = []

const chat = sockjs.createServer()
const clients = []
const users = {}
const bans = []
let uid = 1

const alphanumeric = /^\w+$/

let rl
if (config.readline.use) {
  rl = readline.createInterface(process.stdin, process.stdout)
  rl.setPrompt(config.readline.prompt)
  rl.prompt()
}

/* Express */
app.set('port', port)
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(favicon(path.join(__dirname, 'public/img/favicon.png')))
app.locals.version = pack.version

/* Routes */
app.use(config.url, express.static(path.join(__dirname, 'public')))
app.get(config.url, (req, res) => {
  res.render('index', { version: pack.version })
})

/* Logic */
chat.on('connection', (conn) => {
  rateLimit[conn.id] = 1
  lastTime[conn.id] = Date.now()
  currentTime[conn.id] = Date.now()

  clients[conn.id] = {
    id: uid,
    un: null,
    ip: conn.headers['x-forwarded-for'],
    role: 0,
    con: conn,
    warn: 0
  }

  users[uid] = {
    id: uid,
    oldun: null,
    un: null,
    role: 0
  }

  for (const i in bans) {
    if (bans[i][0] === clients[conn.id].ip) {
      if (Date.now() - bans[i][1] < bans[i][2]) {
        conn.write(
          JSON.stringify({
            type: 'server',
            info: 'rejected',
            reason: 'banned',
            time: bans[i][2]
          })
        )
        return conn.close()
      }
      bans.splice(i)
    }
  }

  conn.write(
    JSON.stringify({ type: 'server', info: 'clients', clients: users })
  )
  conn.write(
    JSON.stringify({ type: 'server', info: 'user', client: users[uid] })
  )
  conn.on('data', (message) => {
    currentTime[conn.id] = Date.now()
    rateInterval[conn.id] = (currentTime[conn.id] - lastTime[conn.id]) / 1000
    lastTime[conn.id] = currentTime[conn.id]
    rateLimit[conn.id] += rateInterval[conn.id]

    if (rateLimit[conn.id] > 1) {
      rateLimit[conn.id] = 1
    }

    if (
      rateLimit[conn.id] < 1 &&
      JSON.parse(message).type !== 'delete' &&
      JSON.parse(message).type !== 'typing' &&
      JSON.parse(message).type !== 'ping'
    ) {
      clients[conn.id].warn++

      if (clients[conn.id].warn < 6) {
        logger.info({
          context: 'user',
          message: 'User warned for spamming',
          warn: clients[conn.id].warn,
          user: {
            role: clients[conn.id].role,
            username: clients[conn.id].un,
            id: clients[conn.id].id,
            ip: clients[conn.id].ip
          }
        })

        return conn.write(
          JSON.stringify({
            type: 'server',
            info: 'spam',
            warn: clients[conn.id].warn
          })
        )
      }
      bans.push([clients[conn.id].ip, Date.now(), 5 * 1000 * 60])
      utils.sendToAll(clients, {
        type: 'ban',
        extra: clients[conn.id].un,
        message: `Server banned ${
          clients[conn.id].un
        } from the server for 5 minutes for spamming the servers`
      })

      logger.info({
        context: 'user',
        message: 'User banned for spamming',
        user: {
          role: clients[conn.id].role,
          username: clients[conn.id].un,
          id: clients[conn.id].id,
          ip: clients[conn.id].ip
        }
      })

      return conn.close()
    }
    try {
      const data = JSON.parse(message)

      if (data.type === 'ping') {
        return false
      }

      if (data.type === 'typing') {
        return utils.sendToAll(clients, {
          type: 'typing',
          typing: data.typing,
          user: clients[conn.id].un
        })
      }

      if (data.type === 'delete' && clients[conn.id].role > 0) {
        utils.sendToAll(clients, {
          type: 'server',
          info: 'delete',
          mid: data.message
        })
      }

      if (data.type === 'update') {
        return updateUser(conn.id, data.user)
      }

      if (data.message.length > 768) {
        data.message = data.message.substring(0, 768)
        message = JSON.stringify(data)
      }

      if (data.type === 'pm') {
        logger.info({
          context: 'message',
          message: data.message,
          type: data.type,
          recipient: data.extra,
          user: {
            role: clients[conn.id].role,
            username: clients[conn.id].un,
            id: clients[conn.id].id,
            ip: clients[conn.id].ip
          }
        })
      } else {
        logger.info({
          context: 'message',
          message: data.message,
          type: data.type,
          user: {
            role: clients[conn.id].role,
            username: clients[conn.id].un,
            id: clients[conn.id].id,
            ip: clients[conn.id].ip
          }
        })
      }

      handleSocket(clients[conn.id], message)
    } catch (err) {
      return logger.error(err)
    }

    rateLimit[conn.id] -= 1
  })

  conn.on('close', () => {
    logger.info({
      context: 'socket',
      message: 'User disconnected',
      user: {
        role: clients[conn.id].role,
        username: clients[conn.id].un,
        id: clients[conn.id].id,
        ip: clients[conn.id].ip
      }
    })
    utils.sendToAll(clients, {
      type: 'typing',
      typing: false,
      user: clients[conn.id].un
    })
    utils.sendToAll(clients, {
      type: 'server',
      info: 'disconnection',
      user: users[clients[conn.id].id]
    })
    delete users[clients[conn.id].id]
    delete clients[conn.id]
  })
})

/* Functions */
function updateUser (id, name) {
  if (
    name.length > 2 &&
    name.length < 17 &&
    name.indexOf(' ') < 0 &&
    !utils.checkUser(clients, name) &&
    name.match(alphanumeric) &&
    name !== 'Console' &&
    name !== 'System'
  ) {
    if (clients[id].un == null) {
      clients[id].con.write(
        JSON.stringify({ type: 'server', info: 'success' })
      )
      uid++

      logger.info({
        context: 'socket',
        message: 'User connected',
        user: {
          role: clients[id].role,
          username: name,
          id: clients[id].id,
          ip: clients[id].ip
        }
      })
    } else {
      logger.info({
        context: 'user',
        message: 'User changed its username',
        user: {
          role: clients[id].role,
          username: name,
          oldUsername: clients[id].un,
          id: clients[id].id,
          ip: clients[id].ip
        }
      })
    }

    users[clients[id].id].un = name
    utils.sendToAll(clients, {
      type: 'server',
      info: clients[id].un == null ? 'connection' : 'update',
      user: {
        id: clients[id].id,
        oldun: clients[id].un,
        un: name,
        role: clients[id].role
      }
    })
    clients[id].un = name
  } else {
    let motive = 'format'
    let check = false

    if (!name.match(alphanumeric)) motive = 'format'
    if (name.length < 3 || name.length > 16) motive = 'length'
    if (utils.checkUser(clients, name) || name === 'Console' || name === 'System') motive = 'taken'
    if (clients[id].un != null) check = true

    clients[id].con.write(
      JSON.stringify({
        type: 'server',
        info: 'rejected',
        reason: motive,
        keep: check
      })
    )
    if (clients[id].un == null) clients[id].con.close()
  }
}

function handleSocket (user, message) {
  const data = JSON.parse(message)

  data.id = user.id
  data.user = user.un
  data.type = s.escapeHTML(data.type)
  data.message = s.escapeHTML(data.message)
  data.mid = (Math.random() + 1).toString(36).substr(2, 5)

  switch (data.type) {
    case 'pm':
      if (data.extra !== data.user && utils.checkUser(clients, data.extra)) {
        utils.sendToOne(clients, users, data, data.extra, 'message')
        data.subtxt = `PM to ${data.extra}`
        utils.sendBack(clients, data, user)
      } else {
        data.type = 'light'
        data.subtxt = null
        data.message = utils.checkUser(clients, data.extra)
          ? "You can't PM yourself"
          : 'User not found'
        utils.sendBack(clients, data, user)
      }
      break

    case 'global':
    case 'kick':
    case 'ban':
    case 'role':
      if (user.role > 0) {
        if (data.type === 'global') {
          if (user.role === 3) {
            return utils.sendToAll(clients, data)
          }
          data.subtxt = null
          data.message = "You don't have permission to do that"
          return utils.sendBack(clients, data, user)
        }
        data.subtxt = null
        if (data.message !== data.user) {
          if (utils.checkUser(clients, data.message)) {
            const time = parseInt(data.extra)

            switch (data.type) {
              default:
                break

              case 'ban':
                if (!isNaN(time) && time > 0) {
                  if (
                    user.role > 1 &&
                    utils.getUserByName(clients, data.message).role === 0
                  ) {
                    for (const client in clients) {
                      if (clients[client].un === data.message) {
                        bans.push([
                          clients[client].ip,
                          Date.now(),
                          time * 1000 * 60
                        ])

                        logger.info({
                          context: 'user',
                          message: 'User banned',
                          admin: data.user,
                          minutes: time,
                          user: {
                            role: clients[client].role,
                            username: clients[client].un,
                            id: clients[client].id,
                            ip: clients[client].ip
                          }
                        })
                      }
                    }

                    data.extra = data.message
                    data.message = `${data.user} banned ${data.message} from the server for ${time} minutes`

                    return utils.sendToAll(clients, data)
                  }
                  data.message = "You don't have permission to do that"
                  return utils.sendBack(clients, data, user)
                }
                data.type = 'light'
                data.message = 'Use /ban [user] [minutes]'
                return utils.sendToOne(
                  clients,
                  users,
                  data,
                  data.user,
                  'message'
                )

              case 'role':
                if (data.extra > -1 && data.extra < 4) {
                  if (user.role === 3) {
                    let role
                    data.role = data.extra
                    data.extra = data.message

                    if (data.role === 0) role = 'User'
                    if (data.role === 1) role = 'Helper'
                    if (data.role === 2) role = 'Moderator'
                    if (data.role === 3) role = 'Administrator'
                    data.message = `${data.user} set ${data.message}'s role to ${role}`

                    utils.sendToOne(
                      clients,
                      users,
                      data,
                      JSON.parse(message).message,
                      'role'
                    )
                    utils.sendToAll(clients, {
                      type: 'server',
                      info: 'clients',
                      clients: users
                    })
                  } else {
                    data.message = "You don't have permission to do that"
                    return utils.sendBack(clients, data, user)
                  }
                } else {
                  data.type = 'light'
                  data.message = 'Use /role [user] [0-3]'
                  return utils.sendToOne(
                    clients,
                    users,
                    data,
                    data.user,
                    'message'
                  )
                }
                break

              case 'kick':
                if (
                  user.role > 1 &&
                  utils.getUserByName(clients, data.message).role === 0
                ) {
                  data.extra = data.message
                  data.message = `${data.user} kicked ${data.message} from the server`

                  for (const client in clients) {
                    if (clients[client].un === data.message) {
                      logger.info({
                        context: 'user',
                        message: 'User kicked',
                        admin: data.user,
                        minutes: time,
                        user: {
                          role: clients[client].role,
                          username: clients[client].un,
                          id: clients[client].id,
                          ip: clients[client].ip
                        }
                      })
                    }
                  }
                } else {
                  data.message = "You don't have permission to do that"
                  return utils.sendBack(clients, data, user)
                }
                break
            }
            utils.sendToAll(clients, data)
          } else {
            data.type = 'light'
            data.message = 'User not found'
            utils.sendBack(clients, data, user)
          }
        } else {
          data.message = "You can't do that to yourself"
          utils.sendBack(clients, data, user)
        }
      } else {
        data.message = "You don't have permission to do that"
        utils.sendBack(clients, data, user)
      }
      break

    default:
      utils.sendToAll(clients, data)
      break
  }
}

/* Internal */
function readLine () {
  rl.on('line', (line) => {
    const data = {}
    if (line.indexOf('/role') === 0) {
      const string = `Console gave ${line.substring(
        6
      )} administrator permissions`

      data.message = string
      data.user = 'Console'
      data.type = 'role'
      data.extra = line.substring(6)
      data.role = 3

      utils.sendToAll(clients, data)
      utils.sendToOne(clients, users, data, line.substring(6), data.type)
    }

    rl.prompt()
  }).on('close', () => {
    logger.info({
      context: 'server',
      message: 'Server is shutting down'
    })
    process.exit(0)
  })
}

if (config.readline.use) {
  readLine()
}

if (!config.ssl.use) {
  server = http.createServer(app)
} else {
  const opt = {
    key: fs.readFileSync(config.ssl.key),
    cert: fs.readFileSync(config.ssl.cert)
  }

  server = https.createServer(opt, app)
}

function onError (error) {
  if (error.syscall !== 'listen') {
    throw error
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`)
      process.exit(1)

    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`)
      process.exit(1)

    default:
      throw error
  }
}

function onListening () {
  const addr = server.address()
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`
  logger.info({
    context: 'server',
    message: `Server is listening at ${bind}`
  })
}

chat.installHandlers(server, { prefix: '/socket', log () {} })

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)
