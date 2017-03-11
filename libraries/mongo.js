'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const errors = require('./errors');
const validations = require('./validations');


function bootstrap(nconf, options) {
  options = options || {};
  const logger = options.logger || console;
  const mongoose = require('mongoose');

  // http://mongoosejs.com/docs/promises.html
  mongoose.Promise = require('bluebird');
  if (options.beforeConnect) {
    options.beforeConnect(mongoose);
  }

  let connectionResolved = false;

  return new Promise((resolve, reject) => {
    const connectionUrl = nconf.get('MONGODB_URL');
    const connectionOptions = {
      config: {
        // http://mongoosejs.com/docs/guide.html#indexes
        // https://github.com/Automattic/mongoose/issues/1875
        autoIndex: nconf.isTrue('MONGODB_INDEXES')
      },
      // mLab recommended mongoose connection options
      // http://blog.mlab.com/2014/04/mongodb-driver-mongoose/
      server: {
        socketOptions: {
          keepAlive: 300000,
          connectTimeoutMS: 30000
        }
      },
      replset: {
        socketOptions: {
          keepAlive: 300000,
          connectTimeoutMS : 30000
        }
      }
    };


    mongoose.connect(connectionUrl, connectionOptions);

    const conn = mongoose.connection;
    conn.on('connected', () => {
      logger.info('MONGO: ready');
      connectionResolved = true;
      resolve();
    });
    conn.on('error', err => {
      logger.error('MONGO:', err.message);
      // retry if mongo is not ready on startup
      mongoose.disconnect();
      setTimeout(() => {
        mongoose.connect(connectionUrl, connectionOptions);
      }, 5000);
      if (!connectionResolved) {
        reject(err);
      }
    });
    conn.on('disconnected', () => {
      logger.warn('MONGO: disconnected...');
    });
    conn.on('reconnected', () => {
      logger.info('MONGO: reconnected...');
    });
  });
}


// Parse errors from mongoose so that a useful error code and message gets returned.
function translateError(err, options) {
  options = options || {};
  if (err.name === 'ValidationError') {
    // FIXME list all the errors!
    // Just return the first error encountered
    const firstKey = Object.keys(err.errors)[0];
    return translateError(err.errors[firstKey]);

  } else if (err.name === 'CastError') {
    const msg = '"' + err.value + '"' + ' is not a valid identifier';
    return new errors.BadRequest(msg, options.invalidIdentifier);
  } else if (err.name === 'MongoError') {
    switch (err.code) {
      case 11000:
        return new errors.Conflict('Duplicate', options.duplicate);
      default:
        return new errors.Internal('Operation failed', options.operationFailed);
    }
  }
}


function setOptions(query, options) {
  if (!options) {
    return query;
  }

  if (options.populate) {
    let populates = options.populate;

    // ?populate=foo,bar
    if (typeof populates === 'string') {
      populates = _.compact(populates.split(','));
    }

    // ?populate[0]=foo&populate[1]=bar or from above
    if (Array.isArray(populates)) {
      populates.forEach(function(name) {
        query.populate(name);
      });

    // ?populate[foo]=a,b&populate[bar]=c
    } else if (typeof populates === 'object') {
      _.each(populates, function(value, key) {
        let fields = (typeof value === 'string')
          ? _.compact(value.split(',')) : value;

        fields = Array.isArray(fields)
          ? fields.join(' ')
          : null;

        query.populate(key, fields);
      });
    }

  }

  if (options.select) {
    query.select(options.select);
  }

  if (options.sort) {
    query.sort(options.sort);
  }

  if (options.page) {
    // when pagination is required, then both page and limit must be defined.
    if (!options.limit) {
      //throw new errors.BadRequest('Se debe indicar la cantidad de registros por página para búsquedas paginadas');
    }
    // this is a quick way to achieve pagination, but for high volume data it might not scale properly
    query.skip((options.page - 1) * options.limit);
  }

  if (options.limit) {
    query.limit(options.limit);
  }

  if (options.lean) {
    // Documents returned from queries with the lean option enabled are plain javascript objects
    // http://www.tothenew.com/blog/high-performance-find-query-using-lean-in-mongoose-2/
    query.lean();
  }

  return query;
}


function isObjectId(value) {
  const mongoose = require('mongoose');
  return value instanceof mongoose.Types.ObjectId;
}

function asObjectId(value) {
  const mongoose = require('mongoose');
  return mongoose.Types.ObjectId(value);
}

function isSameId(id1, id2) {
  id1 = id1 && (id1._id || id1);
  id2 = id2 && (id2._id || id2);
  return id1 && id2 && id1.toString() === id2.toString();
}

function isSameIdPredicate(field, id) {
  return function memberPredicate(doc) {
    return isSameId(doc[field], id);
  };
}


function toRegex(value) {
  return { $regex: new RegExp(_.escapeRegExp(value), 'i') };
}

function toRegexIfString(conditions, key) {
  if (_.isString(conditions[key])) {
    conditions[key] = toRegex(conditions[key]);
  }
}




function validatorItem(validator, msg, berrCode) {
  // aligned with errors module which generates errors with a business code useful for i18n
  return {
    validator: validator,
    msg: msg,
    berrCode: berrCode
  };
}

function nonEmptyValidatorItem(msg, berrCode) {
  return validatorItem(validations.nonEmpty, msg, berrCode);
}

function emailValidatorItem(msg, berrCode) {
  return validatorItem(validations.email, msg, berrCode);
}

function requiredValidatorItem(msg, berrCode) {
  return validatorItem(validations.required, msg, berrCode);
}


module.exports = {
  bootstrap: bootstrap,

  translateError: translateError,
  setQueryOptions: setOptions,

  asObjectId: asObjectId,
  isObjectId: isObjectId,
  isSameId: isSameId,
  isSameIdPredicate: isSameIdPredicate,

  toRegex: toRegex,
  toRegexIfString: toRegexIfString,

  nonEmptyValidator: validations.nonEmpty,
  emailValidator: validations.email,
  requiredValidator: validations.required,

  nonEmptyValidatorItem: nonEmptyValidatorItem,
  emailValidatorItem: emailValidatorItem,
  requiredValidatorItem: requiredValidatorItem
};
