'use strict'

const _ = require('lodash')

const promisificationOptions = {
  multiArgs: true,
  filter: function promisificationSyncFilter (name) {
    return !_.endsWith(name, 'Sync')
  }
}

const Promise = require('bluebird')
const tmp = Promise.promisifyAll(require('tmp'), promisificationOptions)

module.exports = {
  file: function createTempFile (extension) {
    return tmp.fileAsync({
      prefix: 'facturero-',
      postfix: '.' + (extension || 'tmp')
    })
    .spread(function (path, fd, cleaner) {
      return {
        path: path,
        fd: fd,
        cleaner: cleaner
      }
    })
  }
}
