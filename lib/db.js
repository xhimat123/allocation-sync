'use strict';

var PouchDB = require('pouchdb');

exports.createDB = function (dbName, options) {
  if (!dbName) {
    throw new Error('dbName is not defined. dbName: ' + dbName);
  }
  var opts = options || { auto_compaction: true };
  return new PouchDB(dbName, opts);
};

exports.get = function (id, dbName) {
  var db = exports.createDB(dbName);
  return db.get(id);
};

exports.remove = function (doc, dbName) {
  var db = exports.createDB(dbName);
  return db.get(doc._id)
      .then(function (_doc) {
        return db.remove(_doc);
      });
};

exports.query = function (dbName, view, params) {
  var db = exports.createDB(dbName);
  return db.query(view, params);
};

exports.all = function(dbName, options){
  var db = exports.createDB(dbName);
  var params = options || { include_docs: true };
  return db.allDocs(params);
};

exports.pluck = function (list, key) {
  return list.map(function (row) {
    return row[key];
  });
};
