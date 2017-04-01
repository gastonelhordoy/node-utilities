'use strict'

const _ = require('lodash')

function defaultComparator (a, b) {
  return a === b ? 0 : a > b ? 1 : -1
}

// based on this
// http://stackoverflow.com/a/31310853/2115580
module.exports = function mergeSort (a, b, comparator, options) {
  const result = []
  let i = a.length - 1
  let j = b.length - 1
  let k = a.length + b.length

  if (!comparator) {
    console.warn('No comparator provided for Merge Sort')
    comparator = defaultComparator
  }
  options = options || {}
  const mapperA = options.mapper || _.identity
  const mapperB = options.mapperB || mapperA

  while (k > 0) {
    result[--k] = (j < 0 || (i >= 0 && comparator(a[i], b[j]) >= 0)) ? mapperA(a[i--]) : mapperB(b[j--])
  }

  return result
}
