'use strict'

const _ = require('lodash')
const moment = require('moment')
const Big = require('big.js')
const momentsJsonParser = require('moment-json-parser')

const DATES_FORMAT = 'YYYY-MM-DDTHH:mm:ssZ'
const DATES_DEFAULT_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSZ'
const DATES_FORMAT_ERROR = 'Fecha inválida, formato esperado ' + DATES_FORMAT + '. Valor recibido: '
const AMOUNT_ERROR = 'El monto especificado es inválido. Valor recibido: '
let parseMomentsEnabled = false

function parseEntity (src, parsers) {
  _.each(parsers, function (parser) {
    parser(src)
  })
}

function parseComposite (parsers) {
  return function compositeParser (src) {
    parseEntity(src, parsers)
  }
}

function parseMoments (paths) {
  if (_.isString(paths)) {
    paths = [paths]
  } else if (!_.isArray(paths) || _.isEmpty(paths)) {
    throw new Error('parseMoments requires either a String or a non-empty Array')
  }

  return function momentsParser (src) {
    if (!parseMomentsEnabled) {
      return
    }

    _.each(paths, path => {
      const value = _.get(src, path)

      if (value) {
        let date
        if (_.isString(value)) {
          date = moment.utc(value, DATES_FORMAT, true)
        } else {
          try {
            date = moment.utc(value)
          } catch (err) {
            if (value._d) {
              date = moment.utc(value._d, DATES_DEFAULT_FORMAT, true)
            } else {
              console.warn('Error parsing date for path', path)
            }
          }
        }
        if (!date || !date.isValid()) {
          throw new Error(DATES_FORMAT_ERROR + value)
        }

        _.set(src, path, date)
      }
    })
  }
}

function parseAmounts (paths) {
  if (_.isString(paths)) {
    paths = [paths]
  } else if (!_.isArray(paths) || _.isEmpty(paths)) {
    throw new Error('parseAmounts requires either a String or a non-empty Array')
  }

  return function amountsParser (src) {
    _.each(paths, function (path) {
      const value = _.get(src, path)
      let amount

      if (_.isUndefined(value) || _.isNull(value)) {
        return
      }

      if (_.isString(value) || _.isNumber(value)) {
        amount = new Big(value)
      } else {
        throw new Error(AMOUNT_ERROR + value)
      }

      _.set(src, path, amount)
    })
  }
}

function parseCollectionItems (collectionPath, parser) {
  if (!_.isString(collectionPath) || _.isEmpty(collectionPath)) {
    throw new Error('parseCollectionItems requires a non-empty String')
  } else if (!_.isFunction(parser)) {
    throw new Error('parseCollectionItems requires a parser Function')
  }

  return function collectionItemsParser (src) {
    const value = _.get(src, collectionPath)
    if (value) {
      _.each(value, parser)
    }
  }
}

module.exports = {
  setMomentsSerializationFormat: function setMomentsSerializationFormat () {
    // change default serialization format for moments
    // http://momentjs.com/docs/#/displaying/as-json/
    moment.fn.toJSON = function () {
      return this.format(DATES_FORMAT)
    }
    momentsJsonParser.overrideDefault()
  },

  enableMomentsParsing: function enableMomentsParsing () {
    parseMomentsEnabled = true
  },

  momentsParser: momentsJsonParser.parseValue,
  parseMoments: parseMoments,
  parseAmounts: parseAmounts,
  parseCollectionItems: parseCollectionItems,
  parseComposite: parseComposite,
  parseEntity: parseEntity
}
