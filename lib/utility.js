'use strict';

exports.setDeep = function(obj, path, value) {
  var seperator = path.indexOf('/');

  if (seperator > -1) {
    var key = path.slice(0, seperator);
    var subKey = path.slice(seperator + 1);

    if (!obj[key]) {
      obj[key] = {};
    }

    this.setDeep(obj[key], subKey, value);
  } else {
    obj[path] = value;
  }
  return obj;
};

exports.pluck = function(arr, property) {
  function pluckProperty(obj) {
    return obj[property];
  }
  return arr.map(pluckProperty);
};

exports.isEmptyObject = function(obj){
  return Object.keys(obj).length === 0;
};

exports.isDate = function(date){
  if(date === null){
    return false;
  }
  return !isNaN(new Date(date).getTime());
};

exports.hashBy = function(appConfigs, facilities) {
  var appCfgHash = {};
  var facilityHash = {};

  var appCfg;
  for (var i in appConfigs) {
    appCfg = appConfigs[i];
    if (appCfg.facility && appCfg.facility._id) {
      var facilityId = appCfg.facility._id;
      appCfgHash[facilityId] = appCfg;
    }
  }
  //hash facility
  var facility;
  for (var i in facilities) {
    facility = facilities[i];
    if (facility && facility._id) {
      facilityHash[facility._id] = facility;
    }
  }

  return {
    appConfig: appCfgHash,
    facility: facilityHash
  };
};
