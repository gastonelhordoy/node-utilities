'use strict'

const _ = require('lodash')
const emailValidator = require('email-validator').validate

function nonEmptyValidator (value) {
  return !_.isEmpty(value)
}

function requiredValidator (value) {
  return !_.isNil(value)
}

function buildEnumValidator (list) {
  return value => {
    if (!_.isArray(value)) {
      return _.includes(list, value)
    }
    // https://github.com/lodash/lodash/issues/1743#issuecomment-170598139
    return _.difference(value, list).length === 0
  }
}

function buildMinValidator (min) {
  return value => {
    return value >= min
  }
}

function buildMaxValidator (max) {
  return value => {
    return value <= max
  }
}

function buildBetweenValidator (min, max) {
  return value => {
    return value >= min && value <= max
  }
}

module.exports = {
  email: emailValidator,
  nonEmpty: nonEmptyValidator,
  required: requiredValidator,

  enum: buildEnumValidator,
  min: buildMinValidator,
  max: buildMaxValidator,
  between: buildBetweenValidator
}
