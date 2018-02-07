const ChargingStation = require('../../model/ChargingStation');
const CentralRestServerAuthentication = require('./CentralRestServerAuthentication');
const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
const CentralRestServerService = require('./CentralRestServerService');
const Utils = require('../../utils/Utils');
const Configuration = require('../../utils/Configuration');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const bodyParser = require("body-parser");
require('body-parser-xml')(bodyParser);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const locale = require('locale');
const express = require('express');
const app = require('express')();
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('source-map-support').install();

let _centralSystemRestConfig;
let _io;
let _currentNotifications = [];

class CentralSystemRestServer {
	// Create the rest server
	constructor(centralSystemRestConfig) {
		// Body parser
		app.use(bodyParser.json({limit: '1mb'}));
		app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }));
		app.use(bodyParser.xml());

		// Use
		app.use(locale(Configuration.getLocalesConfig().supported));

		// log to console
		if (centralSystemRestConfig.debug) {
			app.use(morgan('dev'));
		}

		// Cross origin headers
		app.use(cors());

		// Secure the application
		app.use(helmet());

		// Authentication
		app.use(CentralRestServerAuthentication.initialize());

		// Auth services
		app.use('/client/auth', CentralRestServerAuthentication.authService);

		// Secured API
		app.use('/client/api', CentralRestServerAuthentication.authenticate(), CentralRestServerService.restServiceSecured);

		// Util API
		app.use('/client/util', CentralRestServerService.restServiceUtil);

		// Check if the front-end has to be served also
		let centralSystemConfig = Configuration.getCentralSystemFrontEndConfig();
		// Server it?
		if (centralSystemConfig.distEnabled) {
			// Serve all the static files of the front-end
			app.get(/^\/(?!client\/)(.+)$/, function(req, res, next) {
				// Filter to not handle other server requests
				if(!res.headersSent) {
					// Not already processed: serve the file
					res.sendFile(path.join(__dirname, centralSystemConfig.distPath, req.params[0]));
				}
			});
			// Default, serve the index.html
			app.get('/', function(req, res, next) {
				// Return the index.html
				res.sendFile(path.join(__dirname, centralSystemConfig.distPath, 'index.html'));
			});
		}

		// Keep params
		_centralSystemRestConfig = centralSystemRestConfig;
	}

	// Start the server (to be defined in sub-classes)
	start() {
		var server;
		// Create the HTTP server
		if (_centralSystemRestConfig.protocol === "https") {
			// Create the options
			var options = {
				key: fs.readFileSync(_centralSystemRestConfig["ssl-key"]),
				cert: fs.readFileSync(_centralSystemRestConfig["ssl-cert"])
			};
			// Intermediate cert?
			if (_centralSystemRestConfig["ssl-ca"]) {
				// Array?
				if (Array.isArray(_centralSystemRestConfig["ssl-ca"])) {
					options.ca = [];
					// Add all
					for (var i = 0; i < _centralSystemRestConfig["ssl-ca"].length; i++) {
						options.ca.push(fs.readFileSync(_centralSystemRestConfig["ssl-ca"][i]));
					}
				} else {
					// Add one
					options.ca = fs.readFileSync(_centralSystemRestConfig["ssl-ca"]);
				}
			}
			// Https server
			server = https.createServer(options, app);
		} else {
			// Http server
			server = http.createServer(app);
		}

		// Init Socket IO
		_io = require("socket.io")(server);

		// Handle Socket IO connection
		_io.on("connection", (socket) => {
			// Handle Socket IO connection
			socket.on("disconnect", () =>{
				// Nothing to do
			});
		});

		// Listen
		server.listen(_centralSystemRestConfig.port, _centralSystemRestConfig.host, () => {
			// Check and send notif
			setInterval(() => {
				// Send
				for (var i = _currentNotifications.length-1; i >= 0; i--) {
					// send
					this.notifyAllWebSocketClients(_currentNotifications[i]);
					// Remove
					_currentNotifications.splice(i, 1);
				}
			}, _centralSystemRestConfig.webSocketNotificationIntervalSecs * 1000);

			// Log
			Logging.logInfo({
				module: "CentralServerRestServer", method: "start", action: "Startup",
				message: `Central Rest Server (Front-End) started on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'` });
			console.log(`Central Rest Server (Front-End) started on '${_centralSystemRestConfig.protocol}://${server.address().address}:${server.address().port}'`);
		});
	}

	notifyUserUpdated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_USER,
			"action": CentralRestServerAuthorization.ACTION_UPDATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_USERS
		});
	}

	notifyUserCreated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_USER,
			"action": CentralRestServerAuthorization.ACTION_CREATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_USERS
		});
	}

	notifyUserDeleted(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_USER,
			"action": CentralRestServerAuthorization.ACTION_DELETE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_USERS
		});
	}

	notifySiteCreated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE,
			"action": CentralRestServerAuthorization.ACTION_CREATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITES
		});
	}

	notifySiteUpdated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE,
			"action": CentralRestServerAuthorization.ACTION_UPDATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITES
		});
	}

	notifySiteDeleted(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE,
			"action": CentralRestServerAuthorization.ACTION_DELETE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITES
		});
	}

	notifySiteAreaCreated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE_AREA,
			"action": CentralRestServerAuthorization.ACTION_CREATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE_AREAS
		});
	}

	notifySiteAreaUpdated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE_AREA,
			"action": CentralRestServerAuthorization.ACTION_UPDATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE_AREAS
		});
	}

	notifySiteAreaDeleted(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE_AREA,
			"action": CentralRestServerAuthorization.ACTION_DELETE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_SITE_AREAS
		});
	}
	
	notifyCompanyCreated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_COMPANY,
			"action": CentralRestServerAuthorization.ACTION_CREATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_COMPANIES
		});
	}

	notifyCompanyUpdated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_COMPANY,
			"action": CentralRestServerAuthorization.ACTION_UPDATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_COMPANIES
		});
	}

	notifyCompanyDeleted(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_COMPANY,
			"action": CentralRestServerAuthorization.ACTION_DELETE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_COMPANIES
		});
	}

	notifyTransactionUpdated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_TRANSACTION,
			"action": CentralRestServerAuthorization.ACTION_UPDATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_TRANSACTIONS
		});
	}

	notifyTransactionCreated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_TRANSACTION,
			"action": CentralRestServerAuthorization.ACTION_CREATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_TRANSACTIONS
		});
	}

	notifyTransactionDeleted(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_TRANSACTION,
			"action": CentralRestServerAuthorization.ACTION_DELETE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_TRANSACTIONS
		});
	}

	notifyChargingStationUpdated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
			"action": CentralRestServerAuthorization.ACTION_UPDATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS
		});
	}

	notifyChargingStationCreated(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
			"action": CentralRestServerAuthorization.ACTION_CREATE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS
		});
	}

	notifyChargingStationDeleted(data) {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATION,
			"action": CentralRestServerAuthorization.ACTION_DELETE,
			"data": data
		});
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS
		});
	}

	notifyLoggingCreated() {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_LOGGING,
			"action": CentralRestServerAuthorization.ACTION_CREATE,
		});
	}

	notifyLoggingDeleted() {
		// Add in buffer
		this.addNotificationInBuffer({
			"entity": CentralRestServerAuthorization.ENTITY_LOGGING,
			"action": CentralRestServerAuthorization.ACTION_DELETE,
		});
	}

	addNotificationInBuffer(notification) {
		let dups = false;
		// Add in buffer
		for (var i = 0; i < _currentNotifications.length; i++) {
			if (_currentNotifications[i].entity === notification.entity &&
					_currentNotifications[i].action === notification.action) {

				if (_currentNotifications[i].data &&
					_currentNotifications[i].data.id === notification.data.id &&
					_currentNotifications[i].data.type === notification.data.type) {
					dups = true;
				} else {
					dups = true;
				}
			}
		}
		// Found dups?
		if (!dups) {
			// No: Add it
			_currentNotifications.push(notification);
		}
	}

	notifyAllWebSocketClients(notification) {
		_io.sockets.emit(notification.entity, notification);
	}
}

module.exports = CentralSystemRestServer;
