'use strict'

const isemail = require('isemail')

module.exports = function emailVerifier (email) {
  return new Promise(resolve => {
    isemail.validate(email, { checkDNS: true }, resolve)
  })
}
