const User = require('../../../model/User');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Authorizations = require('../../../authorization/Authorizations');
const ChargingStationSecurity = require('./security/ChargingStationSecurity');
const ChargingStationStorage = require('../../../storage/mongodb/ChargingStationStorage'); 
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage'); 

class ChargingStationService {

	static async handleUpdateChargingStationParams(action, req, res, next) {
		try {
				// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationParamsUpdateRequest( req.body, req.user );
			// Check email
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.id);
			if (!chargingStation) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station with ID '${filteredRequest.id}' does not exist`, 550, 
					'ChargingStationService', 'handleUpdateChargingStationParams', req.user);
			}
			// Check Auth
			if (!Authorizations.canUpdateChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE, Constants.ENTITY_CHARGING_STATION,
					site.getID(), 560, 
					'ChargingStationService', 'handleUpdateChargingStationParams',
					req.user);
			}
			// Update URL
			chargingStation.setChargingStationURL(filteredRequest.chargingStationURL);
			// Update Nb Phase
			chargingStation.setNumberOfConnectedPhase(filteredRequest.numberOfConnectedPhase);
			// Update Power
			await chargingStation.updateConnectorsPower();
			// Update timestamp
			chargingStation.setLastChangedBy(new User({'id': req.user.id}));
			chargingStation.setLastChangedOn(new Date());
			// Update
			let updatedChargingStation = await chargingStation.save();
			// Log
			Logging.logSecurityInfo({
				source: updatedChargingStation.getID(),
				user: req.user, module: 'ChargingStationService',
				method: 'handleUpdateChargingStationParams',
				message: `Parameters have been updated successfully`,
				action: action, detailedMessages: {
					'numberOfConnectedPhase': updatedChargingStation.getNumberOfConnectedPhase(),
					'chargingStationURL': updatedChargingStation.getChargingStationURL()
				}
			});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetChargingStationConfiguration(action, req, res, next) {
		try {
				// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ChargeBoxID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station ID is mandatory`, 500, 
					'ChargingStationService', 'handleGetChargingStationConfiguration', req.user);
			}
			// Get the Charging Station`
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.ChargeBoxID);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`,	550, 
					'ChargingStationService', 'handleGetChargingStationConfiguration', req.user);
			}
			// Check auth
			if (!Authorizations.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ, Constants.ENTITY_CHARGING_STATION,
					chargingStation.getID(), 560, 
					'ChargingStationService', 'handleGetChargingStationConfiguration',
					req.user);
			}
			// Get the Config
			let configuration = await chargingStation.getConfiguration();
			// Return the result
			res.json(configuration);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleRequestChargingStationConfiguration(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationConfigurationRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ChargeBoxID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station ID is mandatory`, 500, 
					'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
			}
			// Get the Charging Station
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.ChargeBoxID);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`,	550, 
					'ChargingStationService', 'handleRequestChargingStationConfiguration', req.user);
			}
			// Check auth
			if (!Authorizations.canReadChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_CHARGING_STATION,
					chargingStation.getID(), 560, 
					'ChargingStationService', 'handleGetChargingStationConfiguration',
					req.user);
			}
			// Get the Config
			let result = await chargingStation.requestAndSaveConfiguration();
			// Return the result
			res.json(result);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleDeleteChargingStation(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationDeleteRequest(req.query, req.user);
			// Check Mandatory fields
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station ID is mandatory`, 500, 
					'ChargingStationService', 'handleDeleteChargingStation', req.user);
			}
			// Get
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.ID);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.ID}' does not exist`, 550, 
					'ChargingStationService', 'handleDeleteChargingStation', req.user);
			}
			// Check auth
			if (!Authorizations.canDeleteChargingStation(req.user, chargingStation.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_CHARGING_STATION,
					chargingStation.getID(), 560, 
					'ChargingStationService', 'handleDeleteChargingStation',
					req.user);
			}
			// Remove Site Area
			chargingStation.setSiteArea(null);
			// Delete
			await chargingStation.delete();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'ChargingStationService', method: 'handleDeleteChargingStation',
				message: `Charging Station '${chargingStation.getID()}' has been deleted successfully`,
				action: action, detailedMessages: chargingStation});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetChargingStation(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Charging Station ID is mandatory`, 500, 
					'ChargingStationService', 'handleGetChargingStation', req.user);
			}
			// Get it
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.ID);
			if (chargingStation) {
				// Return
				res.json(
					// Filter
					ChargingStationSecurity.filterChargingStationResponse(
						chargingStation.getModel(), req.user)
				);
			} else {
				res.json({});
			}
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetChargingStations(action, req, res, next) {
		try {
				// Check auth
			if (!Authorizations.canListChargingStations(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_CHARGING_STATIONS,
					null, 560, 
					'ChargingStationService', 'handleGetChargingStations',
					req.user);
			}
			// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationsRequest(req.query, req.user);
			// Get the charging stfoundChargingStationsations
			let chargingStations = await ChargingStationStorage.getChargingStations(
				{ 'search': filteredRequest.Search, 'withNoSiteArea': filteredRequest.WithNoSiteArea },
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Set
			chargingStations.result = chargingStations.result.map((chargingStation) => chargingStation.getModel());
			// Filter
			chargingStations.result = ChargingStationSecurity.filterChargingStationsResponse(chargingStations.result, req.user);
			// Return
			res.json(chargingStations);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleAction(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationActionRequest( req.body, action, req.user );
			// Charge Box is mandatory
			if(!filteredRequest.chargeBoxID) {
				Logging.logActionExceptionMessageAndSendResponse(
					action, new Error(`The Charging Station ID is mandatory`), req, res, next);
				return;
			}
			// Get the Charging station
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.chargeBoxID);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`, 550, 
					'ChargingStationService', 'handleAction', req.user);
			}
			let result;
			if (action === 'StopTransaction' ||
					action === 'UnlockConnector') {
				// Get Transaction
				let transaction = await TransactionStorage.getTransaction(filteredRequest.args.transactionId);
				if (!transaction) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`Transaction with ID '${filteredRequest.TransactionId}' does not exist`, 560, 
						'ChargingStationService', 'handleAction', req.user);
				}
				// Add connector ID
				filteredRequest.args.connectorId = transaction.connectorId;
				// Check if user is authorized
				await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(action, chargingStation, transaction.tagID, req.user.tagIDs[0]);
				// Set the tag ID to handle the Stop Transaction afterwards
				transaction.remotestop = {};
				transaction.remotestop.tagID = req.user.tagIDs[0];
				transaction.remotestop.timestamp = new Date().toISOString();
				// Save Transaction
				await TransactionStorage.saveTransaction(transaction);
				// Ok: Execute it
				result = await chargingStation.handleAction(action, filteredRequest.args);
			} else if (action === 'StartTransaction') {
				// Check if user is authorized
				await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(action, chargingStation, filteredRequest.args.tagID);
				// Ok: Execute it
				result = await chargingStation.handleAction(action, filteredRequest.args);
			} else {
				// Check auth
				if (!Authorizations.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action)) {
					// Not Authorized!
					throw new AppAuthError(action,
						Constants.ENTITY_CHARGING_STATION,
						chargingStation.getID(),
						560, 'ChargingStationService', 'handleAction',
						req.user);
				}
				// Execute it
				result = await chargingStation.handleAction(action, filteredRequest.args);
			}
			// Ok
			Logging.logSecurityInfo({
				source: chargingStation.getID(), user: req.user, action: action,
				module: 'ChargingStationService', method: 'handleAction',
				message: `'${action}' has been executed successfully`,
				detailedMessages: result });
			// Return the result
			res.json(result);
			next();
		} catch(err) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		}
	}

	static async handleActionSetMaxIntensitySocket(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = ChargingStationSecurity.filterChargingStationSetMaxIntensitySocketRequest( req.body, req.user );
			// Charge Box is mandatory
			if(!filteredRequest.chargeBoxID) {
					// Not Found!
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The Charging Station ID is mandatory`, 500, 
						'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
			}
			// Get the Charging station
			let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.chargeBoxID);
			// Found?
			if (!chargingStation) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Charging Station with ID '${filteredRequest.chargeBoxID}' does not exist`, 550, 
					'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
			}
			// Check auth
			if (!Authorizations.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), 'ChangeConfiguration')) {
				// Not Authorized!
				throw new AppAuthError(action,
					Constants.ENTITY_CHARGING_STATION,
					chargingStation.getID(),
					560, 'ChargingStationService', 'handleActionSetMaxIntensitySocket',
					req.user);
			}
			// Get the Config
			let chargerConfiguration = await chargingStation.getConfiguration();
			// Check
			if (!chargerConfiguration) {
				// Not Found!
				throw new AppError(
					chargingStation.getID(),
					`Cannot retrieve the configuration`, 550, 
					'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
			}
			let maxIntensitySocketMax = null;
			// Fill current params
			for (let i = 0; i < chargerConfiguration.configuration.length; i++) {
				// Max Intensity?
				if (chargerConfiguration.configuration[i].key.startsWith('currentpb')) {
					// Set
					maxIntensitySocketMax = Number(chargerConfiguration.configuration[i].value);
				}
			}
			if (!maxIntensitySocketMax) {
				// Not Found!
				throw new AppError(
					chargingStation.getID(),
					`Cannot retrieve the max intensity socket from the configuration`, 550, 
					'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
			}
			// Check
			let result;
			if (filteredRequest.maxIntensity && filteredRequest.maxIntensity >= 0 && filteredRequest.maxIntensity <= maxIntensitySocketMax) {
				// Log
				Logging.logSecurityInfo({
					user: req.user, module: 'ChargingStationService', method: 'handleActionSetMaxIntensitySocket',
					action: action, source: chargingStation.getID(),
					message: `Max Instensity Socket has been set to '${filteredRequest.maxIntensity}'`});
				// Change the config
				result = await chargingStation.requestChangeConfiguration('maxintensitysocket', filteredRequest.maxIntensity);
			} else {
				// Invalid value
				throw new AppError(
					chargingStation.getID(),
					`Invalid value for Max Intensity Socket: '${filteredRequest.maxIntensity}'`, 500, 
					'ChargingStationService', 'handleActionSetMaxIntensitySocket', req.user);
			}
			// Return the result
			res.json(result);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}
module.exports = ChargingStationService;
