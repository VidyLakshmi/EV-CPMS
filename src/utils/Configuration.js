const cfenv = require('cfenv');
const url = require('url');
let config = require('../config.json');

require('source-map-support').install();

// Cloud Foundry App Env
let _appEnv = cfenv.getAppEnv();

class Configuration {
	// Read the config file
	static getConfig() {
		return config;
	}

	// Scheduler config
	static getSchedulerConfig() {
		// Read conf
		return Configuration.getConfig().Scheduler;
	}

	// Central System config
	static getCentralSystemsConfig() {
		let centralSystems = Configuration.getConfig().CentralSystems;
		// Check Cloud Foundry
		if (centralSystems && !_appEnv.isLocal) {
      console.log("=======================================");
      console.log("Host: " + _appEnv.host);
      console.log("=======================================");
      console.log("Bind: " + _appEnv.bind);
      console.log("=======================================");
      console.log("Bind: " + _appEnv);
      console.log("=======================================");
            
			// Change host/port
			for (const centralSystem of centralSystems) {
        // CF Environment: Override
				centralSystem.port = _appEnv.port;
				centralSystem.host = _appEnv.host;
			}
		}
		// Read conf
		return centralSystems;
	}

	// Notification config
	static getNotificationConfig() {
		// Read conf
		return Configuration.getConfig().Notification;
	}

	// Authorization config
	static getAuthorizationConfig() {
		// Read conf
		return Configuration.getConfig().Authorization;
	}

	static isCloudFoundry() {
		return !_appEnv.isLocal;
	}

	// Central System REST config
	static getCentralSystemRestServiceConfig() {
		let centralSystemRestService = Configuration.getConfig().CentralSystemRestService;
		// Check Cloud Foundry
		if (centralSystemRestService && !_appEnv.isLocal) {
			// CF Environment: Override
			centralSystemRestService.port = _appEnv.port;
			centralSystemRestService.host = _appEnv.host;
		}
		// Read conf
		return centralSystemRestService;
	}

	// Central System REST config
	static getWSDLEndpointConfig() {
		return Configuration.getConfig().WSDLEndpoint;
	}

	// Central System Front-End config
	static getCentralSystemFrontEndConfig() {
		// Read conf
		return Configuration.getConfig().CentralSystemFrontEnd;
	}

	// Email config
	static getEmailConfig() {
		// Read conf
		return Configuration.getConfig().Email;
	}

	// Advanced config
	static getAdvancedConfig() {
		// Read conf
		return Configuration.getConfig().Advanced;
	}

	static saveAdvancedConfig(advancedConfig) {
		// Read conf
		let config = Configuration.getConfig();
		// Set
		config.Advanced = advancedConfig;
		// Save Config
		Configuration.saveConfig(config);
	}

	// Locale config
	static getLocalesConfig() {
		// Read conf
		return Configuration.getConfig().Locales;
	}

	// DB config
	static getStorageConfig() {
		let storage = Configuration.getConfig().Storage;
		// Check Cloud Foundry
		if (storage && !_appEnv.isLocal) {
			// CF Environment: Override
			let mongoDBService = _appEnv.services.mongodb[0];
			// Set MongoDB URI
			storage.uri = mongoDBService.credentials.uri;
			storage.port = mongoDBService.credentials.port;
			storage.user = mongoDBService.credentials.username;
			storage.password = mongoDBService.credentials.password;
			storage.replicaSet = mongoDBService.credentials.replicaset;
		}
		// Read conf
		return storage;
	}

	// Central System config
	static getChargingStationConfig() {
		// Read conf
		return Configuration.getConfig().ChargingStation;
	}

	// Logging
	static getLoggingConfig() {
		// Read conf
		return Configuration.getConfig().Logging;
	}
}

module.exports=Configuration;
