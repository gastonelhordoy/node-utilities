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
  if (_.isEmpty(list)) {
    throw new Error('Empty list for EnumValidator')
  }
  return value => {
    if (!_.isArray(value)) {
      return _.includes(list, value)
    }
    // https://github.com/lodash/lodash/issues/1743#issuecomment-170598139
    return _.difference(value, list).length === 0
  }
}

function buildMapValidator (map) {
  if (_.isEmpty(map)) {
    throw new Error('Empty map for MapValidator')
  }
  return value => {
    return !_.isNil(value) && !!map[value]
  }
}

function buildMinValidator (min) {
  if (_.isNil(min) || !_.isNumber(min)) {
    throw new Error('Invalid number for MinValidator')
  }
  return value => {
    return value >= min
  }
}

function buildMaxValidator (max) {
  if (_.isNil(max) || !_.isNumber(max)) {
    throw new Error('Invalid number for MaxValidator')
  }
  return value => {
    return value <= max
  }
}

function buildBetweenValidator (min, max) {
  if (_.isNil(min) || !_.isNumber(min) || _.isNil(max) || !_.isNumber(max)) {
    throw new Error('Invalid number for BetweenValidator')
  }
  return value => {
    return value >= min && value <= max
  }
}

function compositeValidator (...validators) {
  if (_.isEmpty(validators)) {
    throw new Error('You need to specify at least one Validator in order to create a Composite Validator')
  }
  return function compositeValidator (value) {
    for (let validator of validators) {
      if (!validator(value)) {
        return false
      }
    }
    return true
  }
}

module.exports = {
  email: emailValidator,
  nonEmpty: nonEmptyValidator,
  required: requiredValidator,

  enum: buildEnumValidator,
  map: buildMapValidator,

  min: buildMinValidator,
  max: buildMaxValidator,
  between: buildBetweenValidator,

  composite: compositeValidator
}
