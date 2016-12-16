'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const rollbar = require('rollbar');

const errors = {
  BadRequest        : 400,
  InvalidArgument   : 400,
  InvalidCredentials: 401,
  PaymentRequired   : 402,
  Forbidden         : 403,
  ResourceNotFound  : 404,
  NotSupported      : 405,
  Conflict          : 409,

  Internal          : 500,
  BadGateway        : 502,
  ServiceUnavailable: 503
};

Object.keys(errors).forEach(function(name) {
  const code = errors[name];

  module.exports[name] = function(message) {
    this.constructor.prototype.__proto__ = Error.prototype;
    Error.captureStackTrace(this, this.constructor);

    this.name = name;
    this.code = code;
    this.message = message;
    this.fields = {};

    Error.call(message);
  };

  module.exports['reject' + name] = function(message) {
    return Promise.reject(new module.exports[name](message));
  };
});



module.exports.bootstrap = function bootstrap(nconf) {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    module.exports.handleError = _.noop;
    module.exports.handleErrorWithPayloadData = _.noop;
    return;
  }

  var options = {
    // Call process.exit(1) when an uncaught exception occurs but after reporting all
    // pending errors to Rollbar.
    exitOnUncaughtException: true,
    scrubHeaders: ['Authorization']
  };
  rollbar.handleUncaughtExceptionsAndRejections(nconf.get('ROLLBAR:ACCESS_TOKEN'), options);

  module.exports.handleError = rollbar.handleError;
  module.exports.handleErrorWithPayloadData = rollbar.handleErrorWithPayloadData;
};

