'use strict'

// extend lodash with lodash-deep mixins
require('lodash').mixin(require('lodash-deep'))

// instantiate all the utilities
module.exports = require('./libraries')
