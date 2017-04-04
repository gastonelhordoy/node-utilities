'use strict'

const _ = require('lodash')
const errors = require('./errors')
const validations = require('./validations')

let mongoose

function init (mongooseInstance) {
  mongoose = mongooseInstance
}
function getMongoose () {
  if (!mongoose) {
    throw new Error('Mongoose has not yet been initialized. Please run mongo.init(mongoose) before using this library.')
  }
  return mongoose
}

// Parse errors from mongoose so that a useful error code and message gets returned.
function translateError (err, options) {
  options = options || {}
  if (err.name === 'ValidationError') {
    // FIXME list all the errors!
    // Just return the first error encountered
    const firstKey = Object.keys(err.errors)[0]
    return translateError(err.errors[firstKey], options)
  } else if (err.name === 'ValidatorError') {
    let msg = 'Invalid value for "' + err.path + '"'
    let berrCode = err.berrCode
    if (err.kind === 'required' && _.startsWith(err.message, 'BERR-')) {
      berrCode = err.message
      if (options.lookup) {
        msg = options.lookup[berrCode]
      }
    }
    return new errors.BadRequest(msg, berrCode)
  } else if (err.name === 'CastError') {
    const msg = '"' + err.value + '"' + ' is not a valid identifier'
    return new errors.BadRequest(msg, options.invalidIdentifier)
  } else if (err.name === 'MongoError') {
    switch (err.code) {
      case 11000:
        return new errors.Conflict('Duplicate', options.duplicate)
      default:
        return new errors.Internal('Operation failed', options.operationFailed)
    }
  }
}

function setOptions (query, options) {
  if (!options) {
    return query
  }

  if (options.populate) {
    let populates = options.populate

    // ?populate=foo,bar
    if (typeof populates === 'string') {
      populates = _.compact(populates.split(','))
    }

    // ?populate[0]=foo&populate[1]=bar or from above
    if (Array.isArray(populates)) {
      populates.forEach(function (name) {
        query.populate(name)
      })

    // ?populate[foo]=a,b&populate[bar]=c
    } else if (typeof populates === 'object') {
      _.each(populates, function (value, key) {
        let fields = (typeof value === 'string')
          ? _.compact(value.split(',')) : value

        fields = Array.isArray(fields)
          ? fields.join(' ')
          : null

        query.populate(key, fields)
      })
    }
  }

  if (options.select) {
    query.select(options.select)
  }

  if (options.sort) {
    query.sort(options.sort)
  }

  if (options.page) {
    // when pagination is required, then both page and limit must be defined.
    if (!options.limit) {
      // throw new errors.BadRequest('Se debe indicar la cantidad de registros por página para búsquedas paginadas');
    }
    // this is a quick way to achieve pagination, but for high volume data it might not scale properly
    query.skip((options.page - 1) * options.limit)
  }

  if (options.limit) {
    query.limit(options.limit)
  }

  if (options.lean) {
    // Documents returned from queries with the lean option enabled are plain javascript objects
    // http://www.tothenew.com/blog/high-performance-find-query-using-lean-in-mongoose-2/
    query.lean()
  }

  return query
}

function isObjectId (value) {
  return value instanceof getMongoose().Types.ObjectId
}

function asObjectId (value) {
  return getMongoose().Types.ObjectId(value)
}

function isSameId (id1, id2) {
  id1 = id1 && (id1._id || id1)
  id2 = id2 && (id2._id || id2)
  return id1 && id2 && id1.toString() === id2.toString()
}

function isSameIdPredicate (field, id) {
  return function memberPredicate (doc) {
    return isSameId(doc[field], id)
  }
}

function toRegex (value) {
  return { $regex: new RegExp(_.escapeRegExp(value), 'i') }
}

function toRegexIfString (conditions, key) {
  if (_.isString(conditions[key])) {
    conditions[key] = toRegex(conditions[key])
  }
}

function validatorItem (validator, msg, berrCode) {
  // aligned with errors module which generates errors with a business code useful for i18n
  return {
    validator: validator,
    msg: msg,
    berrCode: berrCode
  }
}

function nonEmptyValidatorItem (msg, berrCode) {
  return validatorItem(validations.nonEmpty, msg, berrCode)
}

function emailValidatorItem (msg, berrCode) {
  return validatorItem(validations.email, msg, berrCode)
}

function requiredValidatorItem (msg, berrCode) {
  return validatorItem(validations.required, msg, berrCode)
}

function objectIdValidatorItem (msg, berrCode) {
  return validatorItem(isObjectId, msg, berrCode)
}

function enumValidatorItem (list, msg, berrCode) {
  return validatorItem(validations.enum(list), msg, berrCode)
}

function minValidatorItem (min, msg, berrCode) {
  return validatorItem(validations.min(min), msg, berrCode)
}

function maxValidatorItem (max, msg, berrCode) {
  return validatorItem(validations.max(max), msg, berrCode)
}

function betweenValidatorItem (min, max, msg, berrCode) {
  return validatorItem(validations.between(min, max), msg, berrCode)
}

module.exports = {
  init: init,

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
  requiredValidatorItem: requiredValidatorItem,
  objectIdValidatorItem: objectIdValidatorItem,
  enumValidatorItem: enumValidatorItem,
  minValidatorItem: minValidatorItem,
  maxValidatorItem: maxValidatorItem,
  betweenValidatorItem: betweenValidatorItem
}
