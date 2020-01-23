// Requires
const chalk = require('chalk')

// Utilities
function getTime () {
  const now = new Date()
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]

  for (let i = 0; i < 3; i++) {
    if (time[i] < 10) {
      time[i] = `0${time[i]}`
    }
  }

  return `[${time.join(':')}] `
}

// Exports
module.exports = (type, message) => {
  switch (type) {
    case 'start':
      type = chalk.bold.green.dim('[Start] ')
      break

    case 'stop':
      type = chalk.bold.red.dim('[Stop] ')
      break

    case 'error':
      type = chalk.bold.red.dim('[Error] ')
      break

    case 'info':
      type = chalk.bold.blue('[Info] ')
      break

    case 'socket':
      type = chalk.bold.magenta('[Socket] ')
      break

    case 'pm':
      type = chalk.bold.yellow.dim('[PM] ')
      break

    case 'message':
      type = chalk.bold.cyan.dim('[Message] ')
      break
  }

  console.log(getTime() + type + message)
}
