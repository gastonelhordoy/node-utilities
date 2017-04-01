'use strict'

const _ = require('lodash')

module.exports = {

  round: function round (number, decimals) {
    decimals = _.isNil(decimals) ? 2 : decimals

    // http://stackoverflow.com/a/18358056/2115580
    return +(Math.round(number + 'e+' + decimals) + 'e-' + decimals)
  }

}
