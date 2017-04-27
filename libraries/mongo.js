'use strict'

const _ = require('lodash')
const validations = require('./validations')

let mongoose
let config = {}
let errors

function bootstrap (mongooseInstance, newErrors, newConfig) {
  mongoose = mongooseInstance
  errors = newErrors || {}
  config = newConfig || {}
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
  const logger = options.logger || console

  if (err.name === 'ValidationError') {
    // FIXME list all the errors!
    // Just return the first error encountered
    logger.warn(`ValidationError: ${err.errors.length}`)
    const firstKey = Object.keys(err.errors)[0]
    return translateError(err.errors[firstKey], options)
  } else if (err.name === 'ValidatorError') {
    logger.warn(`ValidatorError: ${err.path} | ${err.value}`)
    let msg = errors.isExistentBerrCode(err.message) ? err.message : options.validationFailed || err.message || 'Validation Failed'
    return new errors.BadRequest(msg)
  } else if (err.name === 'CastError') {
    logger.warn(`CastError: ${err.value}`)
    return new errors.BadRequest(options.invalidIdentifier || 'Invalid identifier')
  } else if (err.name === 'MongoError') {
    switch (err.code) {
      case 11000:
        return new errors.Conflict(options.duplicate || 'Duplicate')
      default:
        return new errors.Internal(options.operationFailed || 'Operation failed')
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
      throw new errors.BadRequest(config.noPageSizeBerrCode || 'Page size is required for paginated queries')
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

function isSameIdPredicate (id, field) {
  return function memberPredicate (member) {
    return isSameId(field ? member[field] : member, id)
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

function validatorItem (validator, msg) {
  // aligned with errors module which generates errors with a business code useful for i18n
  return {
    validator: validator,
    msg: msg
  }
}

function nonEmptyValidatorItem (msg) {
  return validatorItem(validations.nonEmpty, msg)
}

function emailValidatorItem (msg) {
  return validatorItem(validations.email, msg)
}

function objectIdValidatorItem (msg) {
  return validatorItem(isObjectId, msg)
}

function enumValidatorItem (list, msg) {
  return validatorItem(validations.enum(list), msg)
}

function mapValidatorItem (map, msg) {
  return validatorItem(validations.map(map), msg)
}

function minValidatorItem (min, msg) {
  return validatorItem(validations.min(min), msg)
}

function maxValidatorItem (max, msg) {
  return validatorItem(validations.max(max), msg)
}

function betweenValidatorItem (min, max, msg) {
  return validatorItem(validations.between(min, max), msg)
}

function compositeValidatorItem (msg, ...validators) {
  return validatorItem(validations.composite(...validators), msg)
}

module.exports = {
  bootstrap,

  translateError,
  setQueryOptions: setOptions,

  asObjectId,
  isObjectId,
  isSameId,
  isSameIdPredicate,

  toRegex,
  toRegexIfString,

  validateNonEmpty: nonEmptyValidatorItem,
  validateEmail: emailValidatorItem,
  validateObjectId: objectIdValidatorItem,
  validateEnum: enumValidatorItem,
  validateMap: mapValidatorItem,
  validateMin: minValidatorItem,
  validateMax: maxValidatorItem,
  validateBetween: betweenValidatorItem,
  validateComposite: compositeValidatorItem
}
