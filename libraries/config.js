'use strict'

/*
The goal of this is to remove all secrets/passwords from source control, and
so that configs can be overridden using environment variables,

@TODO: Look into extending konphyg with env vars

env:
  ("HOST" is not set)
  PORT=80
  HOME=/Users/sample

defaults:
  {
    HOST: 'localhost',
    PORT: 3000
  }

expected results:
  nconf.get('HOST') === 'localhost'
  nconf.get('PORT') === 80
  nconf.get('HOME') === undefined

*/

const _ = require('lodash')
const nconf = require('nconf')
const konphyg = require('konphyg')

module.exports = function (appName, options) {
  options = options || {}
  var path = options.path || './configs'
  var separator = options.separator || '__'

  // Let konphyg grab the default config for the current NODE_ENV
  const defaults = konphyg(path, options.environment)(appName)
  const whitelist = []

  // Convert all keys to flat ENV_const format
  // {A: 1, FOO: {BAR: 2}} ==> A=1, FOO__BAR=2
  // (Assuming just one level deep)
  for (let key in defaults) {
    const value = defaults[key]
    if (typeof value === 'object') {
      for (let subkey in value) {
        whitelist.push([key, separator, subkey].join(''))
      }
    } else {
      whitelist.push(key)
    }
  }

  // Load ’em up in nconf
  nconf
    .env({
      whitelist: whitelist,
      separator: separator
    })
    .defaults(defaults)

  nconf.isTrue = function isTrue (key) {
    const value = nconf.get(key)
    if (_.isNil(value)) {
      return false
    }
    if (_.isString(value)) {
      return value.toLowerCase() === 'true'
    }
    if (_.isBoolean(value)) {
      return value
    }
    throw new Error('Unexpected value type for nconf.isTrue')
  }

  nconf.asInt = function asInt (key) {
    return parseInt(nconf.get(key))
  }

  nconf.asFloat = function asFloat (key) {
    return parseFloat(nconf.get(key))
  }

  return nconf
}
