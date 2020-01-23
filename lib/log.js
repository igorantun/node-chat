const winston = require('winston')
const { format } = require('logform')

const filenameIndex = process.argv.indexOf('--filename')
const filename = filenameIndex > 0 ? process.argv[filenameIndex + 1] : 'app'

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  format.align(),
  format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
)

const fileFormat = format.combine(
  format.timestamp(),
  format.json()
)

const options = {
  console: {
    level: 'debug',
    format: consoleFormat,
    handleExceptions: true
  },
  file: {
    level: 'info',
    format: fileFormat,
    handleExceptions: true,
    filename: `${filename}.log`,
    maxsize: 5242880 // 5MB
  }
}

const logger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(options.console),
    new winston.transports.File(options.file)
  ]
})

module.exports = logger
