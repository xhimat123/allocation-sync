'use strict';

var utility = require('../lib/utility');
var should = require('should');

describe('utility', function() {
  describe('setDeep', function() {
    it('should create nested objects from a string', function() {
      var actual = utility.setDeep({}, 'foo/bar', 1);
      var expected = {
        foo: {
          bar: 1
        }
      };
      actual.should.eql(expected);
    });

    it('should recurse into n levels deep', function() {
      var actual = utility.setDeep({}, 'foo/bar/baz', 1);
      var expected = {
        foo: {
          bar: {
            baz: 1
          }
        }
      };
      actual.should.eql(expected);
    });
  });

  describe('isEmptyObject', function(){


    it('should return TRUE', function(){
      var emptyObj = {};
      var result = utility.isEmptyObject(emptyObj);
      result.should.be.True;
    });

    it('Should return FALSE', function(){
      var obj = { name: 'not empty' };
      var result = utility.isEmptyObject(obj);
      result.should.not.be.True;
    });
  });

  describe('isDate', function() {
    it('Should return TRUE', function() {
      var date = new Date().toJSON();
      var result = utility.isDate(date);
      result.should.be.True;
    });

    it('Should return False if date is NULL', function() {
      var invalid = null;
      var result = utility.isDate(invalid);
      result.should.be.False;
    });

    it('Should return False if date is undefined', function() {
      var invalid;
      var result = utility.isDate(invalid);
      result.should.be.False;
    });

  });

});
