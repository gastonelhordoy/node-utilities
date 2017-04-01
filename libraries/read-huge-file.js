'use strict'

const fs = require('fs')
const es = require('event-stream')
const Promise = require('bluebird')

function readHugeFile (filePath, processLine, options) {
  return new Promise(function (resolve, reject) {
    // based on http://stackoverflow.com/a/23695940
    let lineNr = 0
    const s = fs.createReadStream(filePath)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        // pause the readstream
        s.pause()
        lineNr += 1

        if (!options.startAfterLine || lineNr > options.startAfterLine) {
          // process line here and call s.resume() when rdy
          // function below was for logging memory usage
          processLine(lineNr, line)
          .then(function () {
            // resume the readstream
            s.resume()
          })
          .catch(function (err) {
            s.end()
            reject(err)
          })
        } else if (lineNr === options.startAfterLine) {
          console.log('Last line skipped: #' + lineNr, line)
          s.resume()
        } else {
          s.resume()
        }
      })
      .on('error', function (err) {
        reject(err)
      })
      .on('end', function () {
        resolve()
      })
    )
  })
}

module.exports = readHugeFile
