'use strict'

const noDiacritics = require('diacritics').remove
const uuid = require('uuid/v4')
const shortid = require('shortid').generate

module.exports = {
  uuid,
  noDiacritics,
  shortid,
  uniqueid: shortid
}
