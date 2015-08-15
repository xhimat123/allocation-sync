'use strict';

var config = require('../config');

var _this = this;
var productTypeMap = config.mapping.product.types;


_this.toMoveAllocation = function (ddAllocations) {
	var allocations = [];
	var ddAlloc;
	for (var i in ddAllocations) {
		ddAlloc = ddAllocations[i];
		var ddPtype = productTypeMap[ddAlloc.productType];
		if (ddPtype && ddPtype.moveId) {
			ddAlloc.productType = ddPtype.moveId;
			allocations.push(ddAlloc);
		}
	}
	return allocations;
};

_this.collateAllocation = function (packedProducts, pTypeMap) {
	var pt;
	var allocations = [];
	for (var i in packedProducts) {
		pt = packedProducts[i];
		var alloc = {
			productType: pt.productID,
			max: pt.expectedQty,
			baseUOM: pt.baseUOM,
			moveId: pTypeMap[pt.productID].moveId
		};
		allocations.push(alloc);
	}
	return allocations;
};


module.exports = _this;