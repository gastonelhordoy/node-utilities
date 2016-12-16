'use strict';

// based on http://stackoverflow.com/a/17133012/2115580
//
// another alternative
// https://github.com/mazira/base64-stream
// https://github.com/bendrucker/stream-to-promise
// https://www.npmjs.com/package/pipe-streams-to-promise


// const base64 = require('base64-stream');
const Promise = require('bluebird');
let request = require('request');

request = Promise.promisifyAll(request.defaults({ encoding: null }), { multiArgs: true });


module.exports = function imageDownloader(imgUrl, options) {
  options = options || {};

  return request.getAsync(imgUrl)
  .spread((res, body) => {
    let content = new Buffer(body);
    if (!options.asBuffer) {
      content = content.toString('base64');
    }

    return {
      type: res.headers['content-type'],
      content: content
    };
  });
  // return new Promise(function (resolve, reject) {

  //   http.get(imgUrl, function(res) {
  //     if (res.statusCode === 200) {
  //       res.pipe(base64.encode());
  //     }
  //   });

  // });
};
