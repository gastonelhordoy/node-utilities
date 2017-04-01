'use strict'

const fs = require('fs')
const download = require('download')
const tmp = require('./tmp')

function tmpFile (url) {
  return tmp.file()
  .then(tmpFile => {
    return download(url)
    .then(data => {
      return fs.writeFileAsync(tmpFile.path, data)
    })
    .then(() => {
      return tmpFile
    })
  })
}

module.exports = {
  image: require('./image-downloader'),
  file: download,
  tmpFile: tmpFile
}
