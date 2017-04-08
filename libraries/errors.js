'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const util = require('util')
const rollbar = require('rollbar')

const STATUS_CODES = {
  400: 'BadRequest',
  401: 'InvalidCredentials',
  402: 'PaymentRequired',
  403: 'Forbidden',
  404: 'NotFound',
  405: 'NotSupported',
  409: 'Conflict',
  500: 'Internal',
  502: 'BadGateway',
  503: 'ServiceUnavailable'
}

let BERR_PREFIX = 'BERR-'
let berrMap = {}

function isBerrCode (code) {
  return _.startsWith(code, BERR_PREFIX)
}
function isExistentBerrCode (code) {
  return isBerrCode(code) && !!berrMap[code]
}
function getBerrMessage (code) {
  return berrMap[code]
}
function getStatusName (status) {
  return STATUS_CODES[status]
}

function bootstrap (nconf, berrCodes) {
  berrMap = berrCodes || {}
  if (nconf.get('ERRORS:BERR_PREFIX')) {
    BERR_PREFIX = nconf.get('ERRORS:BERR_PREFIX')
  }

  const isProd = process.env.NODE_ENV === 'production'
  const rollbarToken = nconf.get('ERRORS:ROLLBAR_TOKEN')
  if (!isProd || _.isEmpty(rollbarToken)) {
    module.exports.handleError = _.noop
    module.exports.handleErrorWithPayloadData = _.noop
    return
  }

  var options = {
    // Call process.exit(1) when an uncaught exception occurs but after reporting all
    // pending errors to Rollbar.
    exitOnUncaughtException: true,
    scrubHeaders: ['Authorization']
  }
  rollbar.handleUncaughtExceptionsAndRejections(rollbarToken, options)

  module.exports.handleError = rollbar.handleError
  module.exports.handleErrorWithPayloadData = rollbar.handleErrorWithPayloadData
}

module.exports = {
  bootstrap,
  isExistentBerrCode,
  getBerrMessage,
  getStatusName
}

_.each(STATUS_CODES, (name, statusCode) => {
  statusCode = parseInt(statusCode)

  const HttpError = function (message, extras) {
    extras = extras || {}
    delete extras.statusCode

    if (isExistentBerrCode(message)) {
      this.berrCode = message
      message = berrMap[message]
    }
    this.message = message
    _.defaults(this, extras)

    Error.captureStackTrace(this, this.constructor)
    Error.call(message)
  }
  HttpError.displayName = name
  HttpError.prototype.name = name
  HttpError.prototype.statusCode = statusCode
  util.inherits(HttpError, Error)

  module.exports[name] = HttpError
  module.exports['reject' + name] = (message, extras) => {
    return Promise.reject(new module.exports[name](message, extras))
  }
})
