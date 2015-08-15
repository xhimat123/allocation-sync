'use strict';

var _ = require('underscore');
var _this = this;


_this.getSourceRefs = function (link) {
	var strs = link.split('@');
	var endStr = strs[1];
	var startStr = strs[0].split(':');
	startStr = [startStr[0], '//'].join(':');
	return [startStr, endStr].join('');
};

_this.isFacility = function (fac) {
	return (_.isString(fac.name) && _.isString(fac.zone) && _.isString(fac.ward) && _.isString(fac.id) && fac.id !== '');
};

_this.getIdBy = function (identifiers, context) {
	var id;
	if (identifiers) {
		for (var i in identifiers) {
			var identifier = identifiers[i];
			if (identifier && identifier.context === context) {
				id = identifier.id;
				break;
			}
		}
	}
	return id;
};


_this.convertToRegistryFormat = function (docId, fr, DD_LOMIS_HF_MAP, dbUrl) {
	var ddId = fr.facility.id.split(' ').join('-');
	var moveHfId = DD_LOMIS_HF_MAP[ddId] || '';

	var facDoc = {
		doc_type: 'facility-registry',
		_id: ddId,
		active: true,
		properties: {},
		identifiers: []
	};
	facDoc.name = fr.facility.name;
	facDoc.location = {
		ward: fr.facility.ward,
		lga: fr.facility.lga,
		zone: fr.facility.zone
	};
	facDoc.identifiers = [
		{agency: 'EHA', context: 'move', id: moveHfId},
		{agency: 'EHA', context: 'vdd', id: ddId},
		{agency: 'EHA', context: 'kano-connect', id: ''}
	];

	var link = [_this.getSourceRefs(dbUrl), docId, fr.id].join('/');
	facDoc.source = {
		href: link,
		importedAt: new Date().toISOString()
	};

	return facDoc;
};

module.exports = _this;