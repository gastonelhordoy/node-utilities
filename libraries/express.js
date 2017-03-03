'use strict';

const _ = require('lodash');
const basicAuth = require('basic-auth');
const isJSON = require('is-json');

const errors = require('./errors');
const entityParser = require('./entity-parser');

const BOOLEAN_REGEX = /^(true|yes|1)$/i;



function parseQueryStringParam(req, key, flexible, logger) {
  logger = logger || console;
  if (flexible && !isJSON(req.query.populate)) {
    return true;
  }

  try {
    if (_.isString(req.query[key])) {
      // http://stackoverflow.com/questions/26878788/is-there-a-way-to-get-angular-http-params-to-match-the-nodejs-querystring-forma
      req.query[key] = JSON.parse(req.query[key]);
    }

    return true;
  } catch(err) {
    logger.error(err);
  }
}

// Middleware to be used mainly for counting or reporting services.
// Parses conditions and boolean filters, removes it from req.query.conditions
// and introduces a new req.conditions field.
// Also, req.query.q is moved to req.qTerm.
function buildQuerifyConditions(options) {
  options = options || {};

  return function querifyConditionsMiddleware(req, res, next) {
    if (!parseQueryStringParam(req, 'conditions', false, options.logger)) {
      return next(new errors.BadRequest('Condiciones de búsqueda no válidas'));
    }

    req.conditions = _.deepMapValues(req.query.conditions || {}, (value, path) => {
      if (_.isString(value) && !_.startsWith(path, '_') && !_.includes(path, '._')) {
        if (_.endsWith(path, '.$exists') && _.isString(value)){
          value = BOOLEAN_REGEX.test(value);
        } else {
          value = entityParser.momentsParser(value);
        }
      }
      return value;
    });
    delete req.query.conditions;

    req.qTerm = req.query.q;
    delete req.query.q;

    next();
  };
}

// Middleware to be used maily for getting ONE entity (by id or something).
// Parses the 'populate' option and optionally removes the 'sort', 'page' and 'limit' options
function buildQuerifyOptions(options) {
  options = options || {};
  options.cleanup = options.cleanup || false;

  return function querifyOptionsMiddleware(req, res, next) {
    if (_.isString(req.query.populate) && !parseQueryStringParam(req, 'populate', true, options.logger)) {
      return next(new errors.BadRequest('Opciones de búsqueda no válidas'));
    }

    if (options.cleanup) {
      _.each(['sort', 'page', 'limit'], key => {
        delete req.query[key];
      });
    }

    next();
  };
}

// Middlewware that covers the full range of options for a query,
// including conditions, pagination, sorting, population and field selection
function buildQuerify(options) {
  options = options || {};
  options.maxQueryResults = options.maxQueryResults || 500;

  const querifyOptions = buildQuerifyOptions({
    cleanup: false,
    logger: options.logger
  });
  const querifyConditions = buildQuerifyConditions({
    logger: options.logger
  });

  return function querifyMiddleware(req, res, next) {
    req.query.page = req.query.page && parseInt(req.query.page);
    if (req.query.page && req.query.page < 0) {
      return next(new errors.BadRequest('El número de página a obtener debe ser mayor a 0 (cero)'));
    }

    // always limit the number of information that can be retrieved
    req.query.limit = req.query.limit && parseInt(req.query.limit);
    if (!req.query.limit || req.query.limit > options.maxQueryResults) {
      req.query.limit = options.maxQueryResults;
    } else if (req.query.limit < 0) {
      return next(new errors.BadRequest('La cantidad de registros a obtener debe ser mayor a 0 (cero)'));
    }

    if (!parseQueryStringParam(req, 'sort', false, options.logger)) {
      return next(new errors.BadRequest('Ordenamiento de búsqueda no válido'));
    }

    querifyConditions(req, res, function(err) {
      if (err) {
        return next(err);
      }
      querifyOptions(req, res, next);
    });
  };
}




// based on
// https://davidbeath.com/posts/expressjs-40-basicauth.html
// this can be used for generating credentials with format name:pass
// http://www.motobit.com/util/base64-decoder-encoder.asp
function buildBasicAuth(config) {
  if (!config.name || !config.pass) {
    throw new Error('BasicAuth middleware requires name and pass');
  }

  return function basicAuthMiddleware(req, res, next) {
    const credentials = basicAuth(req);

    if (credentials && credentials.name === config.name && credentials.pass === config.pass) {
      return next();
    }
    next(new errors.InvalidCredentials('Autenticación inválida'));
  };
}

function buildBodyCleaner(options) {
  options = options || {};
  _.defaults(options, {
    errMessage: 'Missing body',
    berrCode: ''
  });
  let fields = ['id', '_id', 'createdAt', 'modifiedAt', 'createdBy', 'modifiedBy', '__t', '__v', '_action', '_version'];
  if (!_.isEmpty(options.fields)) {
    fields = fields.concat(options.fields);
  }


  return function bodyCleanerMiddleware(req, res, next) {
    if (!req.body || _.isEmpty(req.body)) {
      next(new errors.BadRequest(options.errMessage));
    } else {
      _.each(fields, field => {
        delete req.body[field];
      });
      next();
    }
  };
}

function buildRequestParser(field, parser) {
  return function requestParserMiddleware(req, res, next) {
    try {
      parser(req[field]);
    } catch (err) {
      return next(err);
    }
    next();
  };
}

function buildErrorLogger(logger) {
  return function errorLoggerMiddleware(err, req, res, next) {
    errors.handleError(err, req);
    logger.error(err.stack);
    if (err.errors) {
      logger.error(err.errors);
    }
    next(err);
  };
}

function unauthorizedErrorMiddleware(err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    err.statusCode = 401;
  }
  next(err);
}

function buildReplyError(berrCode) {
  // do NOT remove `next`, express needs it to consider this an error middleware
  return function replyErrorMiddleware(err, req, res, next) {
    const msg = err.message || berrCode;
    res.status(err.statusCode).send({
      name: err.name,
      message: msg,
      berrCode: err.berrCode || berrCode,
      data: err.data,
      thing: err.thing
    });
  };
}

module.exports = function buildMiddlewares(options) {
  return {
    basicAuth: buildBasicAuth(options.basicAuth),
    bodyCleaner: buildBodyCleaner(options.bodyCleaner),
    requestParser: buildRequestParser(options.requestParser),
    errorLogger: buildErrorLogger(options.errorLogger),
    unauthorizedErrorMiddleware: unauthorizedErrorMiddleware
  };
};

module.exports.buildQuerify = buildQuerify;
module.exports.buildQuerifyOptions = buildQuerifyOptions;
module.exports.buildQuerifyConditions = buildQuerifyConditions;

module.exports.buildBasicAuth = buildBasicAuth;
module.exports.buildBodyCleaner = buildBodyCleaner;
module.exports.buildRequestParser = buildRequestParser;

module.exports.buildErrorLogger = buildErrorLogger;
module.exports.unauthorizedErrorMiddleware = unauthorizedErrorMiddleware;
module.exports.buildReplyError = buildReplyError;