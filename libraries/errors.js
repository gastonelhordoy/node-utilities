'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const util = require('util')
const rollbar = require('rollbar')

const errors = {
  BadRequest: 400,
  InvalidCredentials: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  NotSupported: 405,
  Conflict: 409,

  Internal: 500,
  BadGateway: 502,
  ServiceUnavailable: 503
}

module.exports.map = _.invert(errors)

module.exports.getName = function getName (status) {
  return module.exports.map[status]
}

Object.keys(errors).forEach(function (name) {
  const HttpError = function (message, berrCode, extras) {
    extras = extras || {}
    delete extras.statusCode
    delete extras.berrCode
    delete extras.message

    // Error.captureStackTrace(this, this.constructor)

    this.berrCode = berrCode
    this.message = message
    _.assign(this, extras)

    Error.call(message)
  }
  HttpError.displayName = name
  HttpError.prototype.name = name
  HttpError.prototype.statusCode = errors[name]
  util.inherits(HttpError, Error)

  module.exports[name] = HttpError
  module.exports['reject' + name] = function (message, berrCode, extras) {
    return Promise.reject(new module.exports[name](message, berrCode, extras))
  }
})

module.exports.bootstrap = function bootstrap (nconf) {
  const isProd = process.env.NODE_ENV === 'production'
  const rollbarToken = nconf.get('ROLLBAR:ACCESS_TOKEN')

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
