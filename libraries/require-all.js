'use strict'

const fs = require('fs')
const _ = require('lodash')

module.exports = function (path, options) {
  options = options || {}
  const modules = {}
  const files = fs.readdirSync(path)

  files.forEach(function (file) {
    if (/\.js$/.test(file) && file !== 'index.js') {
      let name = file

      // This smells a little too specific
      if (options.stripFromName) {
        name = name.replace(options.stripFromName, '')
      }

      // Convert "something-controller.js" to "somethingControlller"
      name = name.replace(/\.js/, '')
      if (!options.preserveName) {
        name = _.camelCase(name)
      }

      modules[name] = require(path + '/' + file)
    }
  })

  return modules
}
