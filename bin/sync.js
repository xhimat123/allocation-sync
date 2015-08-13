#!/usr/bin/env node
'use strict';

var bluebird = require('bluebird');
var _ = require('underscore');

var logger = require('../lib/log');
var pouchWrapper = require('../lib/db');
var config = require('../config');

//config info
var facilityDBUrl = config.mapping.facilityDBUrl;
var appConfigDBUrl = config.mapping.appConfigDBUrl;
var ddDBUrl = config.mapping.directDeliveryUrl;
var productTypeMap = config.mapping.product.types;
var VDD_MOVE_FACILITY_MAP = config.mapping.facilityMapping;
var roundId = config.mapping.roundId;



function log(response) {
	var msg = JSON.stringify(response);
	logger.info(msg);
}

function handleError(error) {
	logger.error(error);
}

function isFacility(fac) {
	return (_.isString(fac.name) && _.isString(fac.zone) && _.isString(fac.ward) && _.isString(fac.id) && fac.id !== '');
}

function getByRound(dbUrl, roundId) {
	logger.info('Reading Facility Information from Round ID : ' + roundId);

	var view = 'daily-deliveries/by-round';
	var params = {
		key: roundId,
		include_docs: true
	};

	return pouchWrapper.query(dbUrl, view, params);
}

function generateAllocation(packedProducts, pTypeMap) {
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
}

function getSourceRefs(link){
	var strs = link.split('@');
	var endStr = strs[1];
	var startStr = strs[0].split(':');
	startStr = [ startStr[0] ,  '//'].join(':');
	return [ startStr, endStr].join('');
}

function convertToRegistryFormat(docId, fr, DD_LOMIS_HF_MAP) {
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
		{ agency: 'EHA', context: 'move', id: moveHfId },
		{ agency: 'EHA', context: 'vdd', id: ddId },
		{ agency: 'EHA', context: 'kano-connect', id: '' }
	];

	var link = [ getSourceRefs(ddDBUrl), docId, fr.id ].join('/');
	facDoc.source = {
		href: link,
		importedAt: new Date().toISOString()
	};

	return facDoc;
}


function extractInfo(resp) {
	logger.info('Extracting Facility Information');
	var docs = pouchWrapper.pluck(resp.rows, 'doc');
	var index = docs.length;
	var DELIVERY_DOC_TYPE = 'dailyDelivery';
	var doc;
	var facilityList = [];
	var processed = {};
	var allocationByFacility = {};
	while (index--) {
		doc = docs[index];
		if (doc.doc_type === DELIVERY_DOC_TYPE && doc.facilityRounds) {
			var fr;
			for (var i in doc.facilityRounds) {
				fr = doc.facilityRounds[i];
				if (isFacility(fr.facility) && fr.packedProduct) {
					var ddId = fr.facility.id.replace(' ', '-');
					if (!processed[ddId]) {

						var facRegistry = convertToRegistryFormat(doc._id, fr, VDD_MOVE_FACILITY_MAP);
						var moveHfId = getFacilityIdBy(facRegistry.identifiers, 'move');
						allocationByFacility[moveHfId] = generateAllocation(fr.packedProduct, productTypeMap);
						facilityList.push(facRegistry);
						processed[ddId] = true;
					}
				}
			}
		}
	}
	return {
		facilityList: facilityList,
		allocationByFacility: allocationByFacility
	};
}

function writeToCouchDB(response) {
	if (!_.isString(facilityDBUrl) || !_.isString(appConfigDBUrl)) {
		throw new Error('Facility or/and App Config DB Url is not defined.');
	}

	logger.info('Writing to CouchDB, App Config: ', appConfigDBUrl, ' Facility URL: ', facilityDBUrl);
	var TWO_MINS = 120000;
	var options = {
		ajax: {
			timeout: TWO_MINS
		}
	};
	var appConfigDB = pouchWrapper.createDB(appConfigDBUrl, options);
	var facilityDB =  pouchWrapper.createDB(facilityDBUrl, options);
	console.log();
	return bluebird
			.props({
				appConfig: appConfigDB.bulkDocs(response.appConfigs),
				facility: facilityDB.bulkDocs(response.facilities)
			});
}

function loadFacilityAndAppConfig(){
	return bluebird
			.props({
				facility: pouchWrapper.all(facilityDBUrl),
				appConfig: pouchWrapper.all(appConfigDBUrl)
			})
			.then(function(res){
				var facilities = pouchWrapper.pluck(res.facility.rows, 'doc');
				var appConfig = pouchWrapper.pluck(res.appConfig.rows, 'doc');
				return {
					facilities: facilities,
					appConfigs: appConfig
				}
			});
}

function hashBy(appConfigs, facilities){
	var appCfgHash = {};
	var facilityHash = {};

	var appCfg;
	for (var i in appConfigs) {
		appCfg = appConfigs[i];
		if(appCfg.facility && appCfg.facility._id){
			var facilityId = appCfg.facility._id;
			appCfgHash[facilityId] = appCfg;
		}
	}
	//hash facility
	var facility;
	for(var i in facilities){
		facility = facilities[i];
		if(facility && facility._id){
			facilityHash[facility._id] = facility;
		}
	}

	return {
		appConfig: appCfgHash,
		facility: facilityHash
	};
}

function getFacilityIdBy(identifiers, context){
	var id;
  if(identifiers){
	  for(var i in identifiers){
		  var identifier = identifiers[i];
		  if(identifier && identifier.context === context){
			  id = identifier.id;
			  break;
		  }
	  }
  }
	return id;
}

function getAllocationBy(moveDDProductMap, ddAllocations){
	var allocations = [];
	var ddAlloc;
	for(var i in ddAllocations){
		ddAlloc = ddAllocations[i];
		var ddPtype = moveDDProductMap[ddAlloc.productType];
		if(ddPtype && ddPtype.moveId){
			ddAlloc.productType = ddPtype.moveId;
			allocations.push(ddAlloc);
		}
	}
	return allocations;
}

function UpdateAllocation(result){
	var docs = result.facilityList;
	var allocationByFacility = result.allocationByFacility;

	return loadFacilityAndAppConfig()
			.then(function(result){
				var hash = hashBy(result.appConfigs, result.facilities);
				var appConfigHash = hash.appConfig;
				var facilityHash = hash.facility;

				var doc;
				var appConfigs = [];
				var facilities = [];
        var type = 'move';
				for(var i in docs){
					doc = docs[i];
					var fRegId = getFacilityIdBy(doc.identifiers, type);
					var appCfg = appConfigHash[fRegId];
					var fac = facilityHash[fRegId];

					if(fRegId && appCfg && fac && appCfg.facility && appCfg.facility.selectedProductProfiles){
						var facilityAlloc = allocationByFacility[fac._id];
						if(facilityAlloc){
							var allocation = getAllocationBy(productTypeMap, facilityAlloc);
							if(!_.isEmpty(allocation)){
								appCfg.facility.allocation = allocation;
								fac.allocation = allocation;
								appConfigs.push(appCfg);
								facilities.push(fac);
							}
						}
					}
				}
				return {
					appConfigs: appConfigs,
					facilities: facilities
				}
			});
}


//Main program
function main() {
	logger.info('Started Direct Delivery Facility Importer');
	getByRound(ddDBUrl, roundId)
			.then(extractInfo)
			.then(UpdateAllocation)
			.then(writeToCouchDB)
			.then(log)
			.catch(handleError);
}

main();