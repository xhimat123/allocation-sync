#!/usr/bin/env node
'use strict';

var bluebird = require('bluebird');
var _ = require('underscore');

var logger = require('../lib/log');
var pouchWrapper = require('../lib/db');
var config = require('../config');
var utility = require('../lib/utility');
var allocationMod = require('../lib/allocation');
var fixture = require('../lib/fixture-parser');
var facilityRegistry = require('../lib/facility-registry');


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

function getByRound(dbUrl, roundId) {
	logger.info('Reading facility allocation from', dbUrl, ' for Round ID : ', roundId);
	var view = 'daily-deliveries/by-round';
	var params = {
		key: roundId,
		include_docs: true
	};
	return pouchWrapper.query(dbUrl, view, params);
}

function extractInfo(resp) {
	logger.info('Extracting Facility Information');
	var docs = pouchWrapper.pluck(resp.rows, 'doc');
	var index = docs.length;
	var DELIVERY_DOC_TYPE = 'dailyDelivery';
	var doc;
	var processed = {};
	var allocationByFacility = {};
	while (index--) {
		doc = docs[index];
		if (doc.doc_type === DELIVERY_DOC_TYPE && doc.facilityRounds) {
			var fr;
			for (var i in doc.facilityRounds) {
				fr = doc.facilityRounds[i];
				if (facilityRegistry.isFacility(fr.facility) && fr.packedProduct) {
					var ddId = fr.facility.id.split(' ').join('-');
					if (!processed[ddId] && VDD_MOVE_FACILITY_MAP[ddId]) {
						var moveHfId = VDD_MOVE_FACILITY_MAP[ddId];
						allocationByFacility[moveHfId] = allocationMod.collateAllocation(fr.packedProduct, productTypeMap);
						processed[ddId] = true;
					}
				}
			}
		}
	}

	var facilityAllocations = fixture.toAllocation('allocation.json');
	allocationByFacility = fixture.getAllocations(facilityAllocations, allocationByFacility);

	return allocationByFacility;
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
	var facilityDB = pouchWrapper.createDB(facilityDBUrl, options);

	return bluebird
			.props({
				appConfig: appConfigDB.bulkDocs(response.appConfigs),
				facility: facilityDB.bulkDocs(response.facilities)
			});
}

function loadFacilityAndAppConfig() {
	return bluebird
			.props({
				facility: pouchWrapper.all(facilityDBUrl),
				appConfig: pouchWrapper.all(appConfigDBUrl)
			})
			.then(function (res) {
				var facilities = pouchWrapper.pluck(res.facility.rows, 'doc');
				var appConfig = pouchWrapper.pluck(res.appConfig.rows, 'doc');
				return {
					facilities: facilities,
					appConfigs: appConfig
				}
			});
}

function UpdateAllocation(allocationByFacility) {
	return loadFacilityAndAppConfig()
			.then(function (result) {

				var hash = utility.hashBy(result.appConfigs, result.facilities);
				var appConfigHash = hash.appConfig;
				var facilityHash = hash.facility;
				var appConfigs = [];
				var facilities = [];

				var alloc;
				for (var facId in allocationByFacility) {
					alloc = allocationByFacility[facId];
					var appCfg = appConfigHash[facId];
					var fac = facilityHash[facId];
					if (appCfg && fac && appCfg.facility) {
						var facilityAlloc = allocationByFacility[fac._id];
						if (facilityAlloc) {
							var allocation = allocationMod.toMoveAllocation(facilityAlloc);
							if (!_.isEmpty(allocation)) {
								appCfg.facility.allocation = allocation;
								fac.allocation = allocation;
								appConfigs.push(appCfg);
								facilities.push(fac);
							}else{
								logger.info('Allocation is empty for ', facId);
							}
						} else {
							logger.info('No Allocation for ', facId);
						}
					} else {
						logger.info('Missing facility or app config', facId);
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