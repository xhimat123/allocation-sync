'use strict';

var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
// added hello here
var env = process.env.NODE_ENV || 'development';
var paths = {
  env: path.join(__dirname, env)
};
paths.mapping = path.join(paths.env, 'mapping.yml');

var mapping = fs.readFileSync(paths.mapping, 'utf8');
mapping = yaml.safeLoad(mapping);

module.exports = {
  mapping: mapping
};
