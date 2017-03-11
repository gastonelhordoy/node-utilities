'use strict';

const _ = require('lodash');
const emailValidator = require('email-validator').validate;


function nonEmptyValidator(value) {
  return !_.isEmpty(value);
}

function requiredValidator(value) {
  return !_.isNil(value);
}


module.exports = {
  email: emailValidator,
  nonEmpty: nonEmptyValidator,
  required: requiredValidator
};
