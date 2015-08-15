'use strict';

var fs = require('fs');

var config = require('../config');
var productTypeMap = config.mapping.product.types;

var _this = this;


_this.load = function (fileName) {
	return JSON.parse(fs.readFileSync('./fixtures/' + fileName, 'utf-8'));
};

this.toAllocation = function (fileName) {
	var facilityAllocs = [];
	_this.load(fileName)
			.forEach(function (alloc) {
				if (alloc.facilityId) {
					var facId = alloc.facilityId;
					var fAlloc = { };
					fAlloc[facId] = [];
					for (var k in alloc) {
						if (productTypeMap[k] && productTypeMap[k].moveId) {
							var tempAlloc = {
								productType: k,
								max: alloc[k],
								baseUOM: productTypeMap[k].baseUOM,
								moveId: productTypeMap[k].moveId
							};
							fAlloc[facId].push(tempAlloc);
						}
					}
					facilityAllocs.push(fAlloc);
				}
			});
	return facilityAllocs;
};


_this.getAllocations = function (fixtureAllocations, allocByFacility) {
	var alloc;
	for (var i in fixtureAllocations) {
		alloc = fixtureAllocations[i];
		if (alloc.facility && !allocByFacility[alloc.facility] && alloc) {
			allocByFacility[alloc.facility] = alloc;
		}
	}
	return allocByFacility;
};

module.exports = _this;
