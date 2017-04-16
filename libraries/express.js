'use strict'

const _ = require('lodash')
const basicAuth = require('basic-auth')
const isJSON = require('is-json')
const entityParser = require('./entity-parser')

const BOOLEAN_REGEX = /^(true|yes|1)$/i

let errors

function parseQueryStringParam (req, key, flexible, logger) {
  logger = logger || console
  if (flexible && !isJSON(req.query.populate)) {
    return true
  }

  try {
    if (_.isString(req.query[key])) {
      // http://stackoverflow.com/questions/26878788/is-there-a-way-to-get-angular-http-params-to-match-the-nodejs-querystring-forma
      req.query[key] = JSON.parse(req.query[key])
    }

    return true
  } catch (err) {
    logger.error(err)
  }
}

// Middleware to be used mainly for counting or reporting services.
// Parses conditions and boolean filters, removes it from req.query.conditions
// and introduces a new req.conditions field.
// Also, req.query.q is moved to req.qTerm.
function buildQuerifyConditions (options) {
  options = options || {}
  options.errMessage = options.errMessage || 'Invalid query conditions'

  // create middleware
  return function querifyConditionsMiddleware (req, res, next) {
    if (!parseQueryStringParam(req, 'conditions', false, options.logger)) {
      return next(new errors.BadRequest(options.berrCode))
    }

    req.conditions = _.deepMapValues(req.query.conditions || {}, (value, path) => {
      if (_.isString(value) && !_.startsWith(path, '_') && !_.includes(path, '._')) {
        if (_.endsWith(path, '.$exists') && _.isString(value)) {
          value = BOOLEAN_REGEX.test(value)
        } else {
          value = entityParser.momentsParser(value)
        }
      }
      return value
    })
    delete req.query.conditions

    req.qTerm = req.query.q
    delete req.query.q

    next()
  }
}

// Middleware to be used maily for getting ONE entity (by id or something).
// Parses the 'populate' option and optionally removes the 'sort', 'page' and 'limit' options
function buildQuerifyOptions (options) {
  options = options || {}
  options.cleanup = options.cleanup || false
  options.errMessage = options.errMessage || 'Invalid query options'

  // create middleware
  return function querifyOptionsMiddleware (req, res, next) {
    if (_.isString(req.query.populate) && !parseQueryStringParam(req, 'populate', true, options.logger)) {
      return next(new errors.BadRequest(options.berrCode))
    }

    if (options.cleanup) {
      _.each(['sort', 'page', 'limit'], key => {
        delete req.query[key]
      })
    }

    next()
  }
}

// Middlewware that covers the full range of options for a query,
// including conditions, pagination, sorting, population and field selection
function buildQuerify (options) {
  // assign defaults
  options = options || {}
  _.defaults(options, {
    maxQueryResults: 500,
    errs: {
      invalidPageMessage: 'Page number must be greater then 0 (zero)',
      queryResultsMessage: 'Number of query results must be greater then 0 (zero)',
      sortOrderMessage: 'Invalid query sort order'
    }
  })

  // pre-build middlewares for parsing options and conditions
  const querifyOptions = buildQuerifyOptions({
    cleanup: false,
    logger: options.logger,
    berrCode: options.errs.queryOptionsBerrCode
  })
  const querifyConditions = buildQuerifyConditions({
    logger: options.logger,
    berrCode: options.errs.queryConditionsBerrCode
  })

  // create middleware
  return function querifyMiddleware (req, res, next) {
    req.query.page = req.query.page && parseInt(req.query.page)
    if (!_.isNil(req.query.page) && req.query.page < 1) {
      return next(new errors.BadRequest(options.errs.invalidPageBerrCode))
    }

    // always limit the number of information that can be retrieved
    req.query.limit = req.query.limit && parseInt(req.query.limit)
    if (!req.query.limit || req.query.limit > options.maxQueryResults) {
      req.query.limit = options.maxQueryResults
    } else if (req.query.limit < 0) {
      return next(new errors.BadRequest(options.errs.queryResultsBerrCode))
    }

    if (!parseQueryStringParam(req, 'sort', false, options.logger)) {
      return next(new errors.BadRequest(options.errs.sortOrderBerrCode))
    }

    querifyConditions(req, res, function (err) {
      if (err) {
        return next(err)
      }
      querifyOptions(req, res, next)
    })
  }
}

// based on
// https://davidbeath.com/posts/expressjs-40-basicauth.html
// this can be used for generating credentials with format name:pass
// http://www.motobit.com/util/base64-decoder-encoder.asp
function buildBasicAuth (options) {
  options = options || {}
  options.errMessage = options.errMessage || 'Invalid credentials'

  if (!options.name || !options.pass) {
    throw new Error('BasicAuth middleware requires name and pass')
  }

  return function basicAuthMiddleware (req, res, next) {
    const credentials = basicAuth(req)

    if (credentials && credentials.name === options.name && credentials.pass === options.pass) {
      return next()
    }
    next(new errors.InvalidCredentials(options.berrCode))
  }
}

function buildBodyCleaner (options) {
  options = options || {}
  _.defaults(options, {
    errMessage: 'Missing information for the operation'
  })

  let fields = ['id', '_id', 'createdAt', 'modifiedAt', 'createdBy', 'modifiedBy', '__t', '__v', '_action', '_version']
  if (!_.isEmpty(options.fields)) {
    fields = fields.concat(options.fields)
  }

  return function bodyCleanerMiddleware (req, res, next) {
    if (!req.body || _.isEmpty(req.body)) {
      next(new errors.BadRequest(options.berrCode))
    } else {
      _.each(fields, field => {
        delete req.body[field]
      })
      next()
    }
  }
}

function buildRequestParser (field, parser) {
  return function requestParserMiddleware (req, res, next) {
    try {
      parser(req[field])
    } catch (err) {
      return next(err)
    }
    next()
  }
}

function buildErrorLogger (logger) {
  return function errorLoggerMiddleware (err, req, res, next) {
    errors.handleError(err, req)
    logger.error(err.stack)
    if (err.errors) {
      logger.error(err.errors)
    }
    next(err)
  }
}

function buildUnauthErrorMiddleware (options) {
  options = options || {}

  return function unauthErrorMiddleware (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
      err.name = errors.getStatusName(401)
      err.statusCode = 401
      err.berrCode = options.berrCode
      err.message = (options.berrCode && errors.getBerrMessage(options.berrCode)) || err.message
    }
    next(err)
  }
}

function buildReplyError (options) {
  options = options || {}
  options.errMessage = options.errMessage || 'Unexpected error'

  // do NOT remove `next`, express needs it to consider this an error middleware
  return function replyErrorMiddleware (err, req, res, next) {
    const msg = err.message || options.errMessage
    res.status(err.statusCode).send({
      name: err.name,
      message: msg,
      berrCode: err.berrCode || options.berrCode,
      data: err.data,
      thing: err.thing
    })
  }
}

module.exports = function initExpressUtils (_errors) {
  errors = _errors

  module.exports.buildQuerify = buildQuerify
  module.exports.buildQuerifyOptions = buildQuerifyOptions
  module.exports.buildQuerifyConditions = buildQuerifyConditions

  module.exports.buildBasicAuth = buildBasicAuth
  module.exports.buildBodyCleaner = buildBodyCleaner
  module.exports.buildRequestParser = buildRequestParser

  module.exports.buildErrorLogger = buildErrorLogger
  module.exports.buildUnauthErrorMiddleware = buildUnauthErrorMiddleware
  module.exports.buildReplyError = buildReplyError
}
