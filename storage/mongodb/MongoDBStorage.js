var mongoose = require('mongoose');
var MDBConfiguration = require('./model/MDBConfiguration');
var MDBUser = require('./model/MDBUser');
var MDBLog = require('./model/MDBLog');
var MDBFirmwareStatusNotification = require('./model/MDBFirmwareStatusNotification');
var MDBDiagnosticsStatusNotification = require('./model/MDBDiagnosticsStatusNotification');
var MDBChargingStation = require('./model/MDBChargingStation');
var MDBAuthorize = require('./model/MDBAuthorize');
var MDBBootNotification = require('./model/MDBBootNotification');
var MDBStatusNotification = require('./model/MDBStatusNotification');
var MDBMeterValue = require('./model/MDBMeterValue');
var MDBStartTransaction = require('./model/MDBStartTransaction');
var MDBStopTransaction = require('./model/MDBStopTransaction');
var MDBDataTransfer = require('./model/MDBDataTransfer');
var User = require('../../model/User');
var ChargingStation = require('../../model/ChargingStation');
var Utils = require('../../utils/Utils');
var Storage = require('../Storage');
var Logging = require('../../utils/Logging');

class MongoDBStorage extends Storage {
  constructor(dbConfig) {
    super(dbConfig);

    // Keep local
    this.dbConfig = dbConfig;

    // Connect
    mongoose.Promise = global.Promise;
    mongoose.connect(`mongodb://${dbConfig.host}:${dbConfig.port}/${dbConfig.schema}`, function(err, db) {
      if (err) {
        console.log(`MongoDB: Error when connecting: ${err.toString()}`);
        return;
      }
      // Log
      Logging.logInfo({
        source: "Central Server", module: "MongoDBStorage", method: "constructor",
        message: `Connected to MongoDB on '${dbConfig.host}:${dbConfig.port}' and using schema '${dbConfig.schema}'` });
      console.log(`Connected to MongoDB on '${dbConfig.host}:${dbConfig.port}' and using schema '${dbConfig.schema}'`);
    });
  }

  getConfigurationParamValue(chargeBoxIdentity, paramName, configDate, action) {
    // Check
    action = action || "Unknown";

    // Get the config
    return this.getConfiguration(chargeBoxIdentity, configDate, action).then((configuration) => {
      var value = null;
      if (configuration) {
        // Get the value
        configuration.configuration.every((param) => {
          // Check
          if (param.key === paramName) {
            // Found!
            value = param.value;
            // Break
            return false;
          } else {
            // Continue
            return true;
          }
        });

        if (!value) {
          // Log
          Logging.logWarning({
            source: chargeBoxIdentity, module: "MongoDBStorage", method: "getConfigurationParamValue",
            action: action,
            message: `Cannot find a Value &{value} for the Param ${paramName} in the configuration` });
        }
      }

      return value;
    }, (err) => {
      // Log
      Logging.logError({
        source: "CS", module: "MongoDBStorage", method: "getConfigurationParamValue",
        action: action,
        message: `Error in reading, from the Charge Box ${chargeBoxIdentity}, the Configuration value ${paramName}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: "CS", module: "MongoDBStorage", method: "getConfigurationParamValue",
        action: action,
        message: `Error in reading, from the Charge Box ${chargeBoxIdentity}, the Configuration value ${paramName}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  getLogs(numberOfLogging) {
    if (!numberOfLogging || isNaN(numberOfLogging)) {
      numberOfLogging = 100;
    }
    // Exec request
    return MDBLog.find({}).sort({timestamp: -1}).limit(numberOfLogging).exec().then((loggingsMongoDB) => {
      var loggings = [];
      loggingsMongoDB.forEach(function(loggingMongoDB) {
        var logging = {};
        // Set
        Utils.updateLoggingObject(loggingMongoDB, logging);
        // Set the model
        loggings.push(logging);
      });
      // Ok
      return loggings;
    }, (err) => {
      // Log
      Logging.logError({
        source: "Central Server", module: "MongoDBStorage", method: "getLogging",
        message: `Error in reading the Logs: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: "Central Server", module: "MongoDBStorage", method: "getLogging",
        message: `Error in reading the Logs: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  getConfiguration(chargeBoxIdentity, configDate, action) {
    // Check
    action = action || "Unknown";

    if (!configDate) {
      configDate = new Date();
    }
    // Exec request
    return MDBConfiguration.find({"chargeBoxIdentity": chargeBoxIdentity, timestamp: { $lte: configDate } })
        .sort({timestamp: -1}).limit(1).exec().then((configurationMongoDB) => {
      var configuration = {};
      if (configurationMongoDB[0]) {
        // Set values
        Utils.updateConfiguration(configurationMongoDB[0], configuration);
      } else {
        // Log
        Logging.logError({
          source: chargeBoxIdentity, module: "MongoDBStorage", method: "getConfiguration",
          action: action,
          message: `No Configuration found for Charging Station ${chargeBoxIdentity}` });
      }
      // Ok
      return configuration;
    }, (err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "getConfiguration",
        action: action,
        message: `Error in reading, from the Charge Box ${chargeBoxIdentity}, the Configuration list: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "getConfiguration",
        action: action,
        message: `Error in reading, from the Charge Box ${chargeBoxIdentity}, the Configuration list: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  getStatusNotifications(chargeBoxIdentity, connectorId, action) {
    // Check
    action = action || "Unknown";

    var filter = {};
    if (chargeBoxIdentity) {
      filter.chargeBoxIdentity = chargeBoxIdentity;
    }
    if (connectorId) {
      filter.connectorId = connectorId;
    }
    // Exec request
    return MDBStatusNotification.find(filter).sort({timestamp: 1}).exec().then((statusNotificationsMongoDB) => {
      var statusNotifications = [];
      // Create
      statusNotificationsMongoDB.forEach((statusNotificationMongoDB) => {
        var statusNotification = {};
        // Set values
        Utils.updateStatusNotification(statusNotificationMongoDB, statusNotification);
        // Add
        statusNotifications.push(statusNotification);
      });
      // Ok
      return statusNotifications;
    }, (err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "getStatusNotifications",
        action: action,
        message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Status Notification: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "getStatusNotifications",
        action: action,
        message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Status Notification: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  getLastStatusNotification(chargeBoxIdentity, connectorId, action) {
    // Check
    action = action || "Unknown";

    // Get the Status Notification
    var filter = {};
    var statusNotification = {};

    // Must be provided
    if(chargeBoxIdentity && connectorId) {
      filter.chargeBoxIdentity = chargeBoxIdentity;
      filter.connectorId = connectorId;

      // Exec request
      return MDBStatusNotification.find(filter).sort({timestamp: -1}).limit(1).exec().then((statusNotificationsMongoDB) => {
        // At least one
        if (statusNotificationsMongoDB[0]) {
          // Set values
          Utils.updateStatusNotification(statusNotificationsMongoDB[0], statusNotification);
        }
        // Ok
        return statusNotification;
      }, (err) => {
        // Log
        Logging.logError({
          source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getLastStatusNotification",
          action: action,
          message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Last Status Notification: ${err.toString()}`,
          detailedMessages: err.stack });
        return Promise.reject(err);
      }).catch((err) => {
        // Log
        Logging.logError({
          source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getLastStatusNotification",
          action: action,
          message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Last Status Notification: ${err.toString()}`,
          detailedMessages: err.stack });
        return Promise.reject(err);
      });
    } else {
      // Ok
      return statusNotification;
    }
  }

  getMeterValues(chargeBoxIdentity, connectorId, transactionId, startDateTime, endDateTime, action) {
    // Check
    action = action || "Unknown";

    // Build filter
    var filter = {};
    // Mandatory filters
    filter.chargeBoxIdentity = chargeBoxIdentity;
    filter.connectorId = connectorId;

    if (transactionId) {
      filter.transactionId = transactionId;
    }
    if (startDateTime || endDateTime) {
      filter.timestamp = {};
    }
    if (startDateTime) {
      filter.timestamp["$gte"] = new Date(startDateTime);
    }
    if (endDateTime) {
      filter.timestamp["$lte"] = new Date(endDateTime);
    }

    // Exec request
    return MDBMeterValue.find(filter).sort( {timestamp: 1} ).exec().then((meterValuesMongoDB) => {
      var meterValues = [];
      // Create
      meterValuesMongoDB.forEach((meterValueMongoDB) => {
        var meterValue = {};
        // Set values
        Utils.updateMeterValue(meterValueMongoDB, meterValue);
        // Add
        meterValues.push(meterValue);
      });
      // Ok
      return meterValues;
    }, (err) => {
      // Log
      Logging.logError({
        source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getMeterValues",
        action: action,
        message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Meter Values: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: `${chargeBoxIdentity} - ${connectorId}`, module: "MongoDBStorage", method: "getMeterValues",
        action: action,
        message: `Error in getting, from the Charge Box ${chargeBoxIdentity} Connector ID ${connectorId}, the Meter Values: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveBootNotification(bootNotification) {
    // Get
    return this._getChargingStationMongoDB(bootNotification.chargeBoxIdentity, "BootNotification").then((chargingStationMongoDB) => {
      // Create model
      var bootNotificationMongoDB = new MDBBootNotification(bootNotification);
      if (chargingStationMongoDB) {
        // Set the ID
        bootNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
      }
      // Create new
      return bootNotificationMongoDB.save().then((results) => {
        // Log
        Logging.logInfo({
          source: bootNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveBootNotification",
          action: "BootNotification",
          message: `Boot Notification of ${bootNotification.chargeBoxIdentity} created with success`,
          detailedMessages: JSON.stringify(bootNotification) });
      });
    }, (err) => {
      // Log
      Logging.logError({
        source: bootNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveBootNotification",
        action: "BootNotification",
        message: `Error when creating Boot Notication of ${bootNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: bootNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveBootNotification",
        action: "BootNotification",
        message: `Error when creating Boot Notication of ${bootNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveDataTransfer(dataTransfer) {
    // Get
    return this._getChargingStationMongoDB(dataTransfer.chargeBoxIdentity, "DataTransfer").then((chargingStationMongoDB) => {
      if (chargingStationMongoDB) {
        // Create model
        var dataTransferMongoDB = new MDBDataTransfer(dataTransfer);
        // Set the ID
        dataTransferMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return dataTransferMongoDB.save().then((results) => {
          // Log
          Logging.logInfo({
            source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
            action: "DataTransfer",
            message: `Data Transfer of ${dataTransfer.chargeBoxIdentity} created with success`,
            detailedMessages: JSON.stringify(dataTransfer) });
        });
      } else {
        // Log
        Logging.logError({
          source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
          action: "DataTransfer",
          message: `Charging Station ${dataTransfer.chargeBoxIdentity} not found: Cannot add Data Transfer` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
        action: "DataTransfer",
        message: `Error when creating Data Transfer of ${dataTransfer.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: dataTransfer.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDataTransfer",
        action: "DataTransfer",
        message: `Error when creating Data Transfer of ${dataTransfer.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveConfiguration(configuration) {
    // Get
    return this._getChargingStationMongoDB(configuration.chargeBoxIdentity, "Configuration").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var configurationMongoDB = new MDBConfiguration(configuration);
        // Set the ID
        configurationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        configurationMongoDB.configuration = configuration.configurationKey;
        // Create new
        return configurationMongoDB.save().then((results) => {
          // Log
          Logging.logInfo({
            source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
            action: "Configuration",
            message: `Configuration of ${configurationMongoDB.chargeBoxIdentity} created with success`,
            detailedMessages: JSON.stringify(configuration) });
        });
      } else {
        // Log
        Logging.logError({
          source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
          action: "Configuration",
          message: `Charging Station ${configurationMongoDB.chargeBoxIdentity} not found: Cannot save Configuration` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
        action: "Configuration",
        message: `Error when creating the Configuration of ${configurationMongoDB.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: configuration.chargeBoxIdentity, module: "MongoDBStorage", method: "saveConfiguration",
        action: "Configuration",
        message: `Error when creating the Configuration of ${configurationMongoDB.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveStatusNotification(statusNotification) {
    // Get
    return this._getChargingStationMongoDB(statusNotification.chargeBoxIdentity, "StatusNotification").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var statusNotificationMongoDB = new MDBStatusNotification(statusNotification);
        // Set the ID
        statusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return statusNotificationMongoDB.save().then((results) => {
          // Log
          Logging.logInfo({
            source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
            action: "StatusNotification",
            message: `Status Notification of ${statusNotification.chargeBoxIdentity} created with success`,
            detailedMessages: JSON.stringify(statusNotification) });
        });
      } else {
        // Log
        Logging.logError({
          source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
          action: "StatusNotification",
          message: `Charging Station ${statusNotification.chargeBoxIdentity} not found: Cannot add Status Notification` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
        action: "StatusNotification",
        message: `Error when creating the Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: statusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveStatusNotification",
        action: "StatusNotification",
        message: `Error when creating the Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Get
    return this._getChargingStationMongoDB(diagnosticsStatusNotification.chargeBoxIdentity, "DiagnosticsStatusNotification").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var diagnosticsStatusNotificationMongoDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);
        // Set the ID
        diagnosticsStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return diagnosticsStatusNotificationMongoDB.save().then((results) => {
          // Log
          Logging.logInfo({
            source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
            action: "DiagnosticsStatusNotification",
            message: `Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity} created with success`,
            detailedMessages: JSON.stringify(diagnosticsStatusNotification) });
        });
      } else {
        // Log
        Logging.logError({
          source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
          action: "DiagnosticsStatusNotification",
          message: `Charging Station ${diagnosticsStatusNotification.chargeBoxIdentity} not found: Cannot create Diagnostics Status Notification request` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
        action: "DiagnosticsStatusNotification",
        message: `Error when creating an Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: diagnosticsStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveDiagnosticsStatusNotification",
        action: "DiagnosticsStatusNotification",
        message: `Error when creating an Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveFirmwareStatusNotification(firmwareStatusNotification) {
    // Get
    return this._getChargingStationMongoDB(firmwareStatusNotification.chargeBoxIdentity, "FirmwareStatusNotification").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Create model
        var firmwareStatusNotificationMongoDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);
        // Set the ID
        firmwareStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        // Create new
        return firmwareStatusNotificationMongoDB.save().then((results) => {
          // Log
          Logging.logInfo({
            source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
            action: "FirmwareStatusNotification",
            message: `Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity} created with success`,
            detailedMessages: JSON.stringify(firmwareStatusNotification) });
        });
      } else {
        // Log
        Logging.logError({
          source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
          action: "FirmwareStatusNotification",
          message: `Charging Station ${firmwareStatusNotification.chargeBoxIdentity} not found: Cannot create Firmware Status Notification request` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
        action: "FirmwareStatusNotification",
        message: `Error when creating an Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: firmwareStatusNotification.chargeBoxIdentity, module: "MongoDBStorage", method: "saveFirmwareStatusNotification",
        action: "FirmwareStatusNotification",
        message: `Error when creating an Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveLog(log) {
    // Create model
    var logMongoDB = new MDBLog(log);

    // Save
    return logMongoDB.save((err, results) => {
      if (err) {
        console.log(`MongoDB: Error when creating a Log: ${err.toString()}`);
      }
    });
  }

  saveAuthorize(authorize) {
    // Get
    return this._getChargingStationMongoDB(authorize.chargeBoxIdentity, "Authorize").then((chargingStationMongoDB) => {
      if (chargingStationMongoDB) {
        // Get User
        return this._getUserByTagIdMongoDB(authorize.idTag, "Authorize").then((userMongoDB) => {
          // Found?
          if (userMongoDB) {
            // Create model
            var authorizeMongoDB = new MDBAuthorize(authorize);
            // Set the ID
            authorizeMongoDB.chargeBoxID = chargingStationMongoDB._id;
            // Create new
            return authorizeMongoDB.save().then((results) => {
              // Log
              Logging.logInfo({
                source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
                action: "Authorize",
                message: `Authorize request of ${authorize.chargeBoxIdentity} created with success for User ${userMongoDB.name} with ID Tag ${authorize.idTag}`,
                detailedMessages: JSON.stringify(authorize) });
            });
          } else {
            // Log
            Logging.logError({
              source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
              action: "Authorize",
              message: `User with Tag ID ${authorize.idTag} not found: Cannot create Authorize request` });
            return Promise.reject();
          }
        });
      } else {
        // Log
        Logging.logError({
          source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
          action: "Authorize",
          message: `Charging Station ${authorize.chargeBoxIdentity} not found: Cannot create Authorize request` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
        action: "Authorize",
        message: `Error when creating an Authorize request for ${authorize.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: `${authorize.chargeBoxIdentity} - ${authorize.idTag}`, module: "MongoDBStorage", method: "saveAuthorize",
        action: "Authorize",
        message: `Error when creating an Authorize request for ${authorize.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveStartTransaction(startTransaction) {
    // Get
    return this._getChargingStationMongoDB(startTransaction.chargeBoxIdentity, "StartTransaction").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Get User
        return this._getUserByTagIdMongoDB(startTransaction.idTag, "StartTransaction").then((userMongoDB) => {
          // Found?
          if (userMongoDB) {
            // Create model
            var startTransactionMongoDB = new MDBStartTransaction(startTransaction);
            // Set the IDs
            startTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;
            startTransactionMongoDB.userID = userMongoDB._id;
            // Create new
            return startTransactionMongoDB.save().then((results) => {
              // Log
              Logging.logInfo({
                source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
                action: "StartTransaction",
                message: `Start Transaction created with success on ${startTransaction.chargeBoxIdentity} for User ${userMongoDB.name} with ID Tag ${startTransaction.idTag}`,
                detailedMessages: JSON.stringify(startTransaction) });
            });
          } else {
            // Log
            Logging.logError({
              source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
              action: "StartTransaction",
              message: `User with Tag ID ${startTransaction.idTag} not found: Cannot create Start Transaction` });
            return Promise.reject();
          }
        });
      } else {
        // Log
        Logging.logError({
          source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
          action: "StartTransaction",
          message: `Charging Station ${startTransaction.chargeBoxIdentity} not found: Cannot create Start Transaction` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
        action: "StartTransaction",
        message: `Error when creating Start Transaction of ${startTransaction.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: `${startTransaction.chargeBoxIdentity} - ${startTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
        action: "StartTransaction",
        message: `Error when creating Start Transaction of ${startTransaction.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveStopTransaction(stopTransaction) {
    // Get
    return this._getChargingStationMongoDB(stopTransaction.chargeBoxIdentity, "StopTransaction").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Get User
        return this._getUserByTagIdMongoDB(stopTransaction.idTag, "StopTransaction").then((userMongoDB) => {
          // Found?
          if (userMongoDB) {
            // Create model
            var stopTransactionMongoDB = new MDBStopTransaction(stopTransaction);
            // Set the ID
            stopTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;
            // Create new
            return stopTransactionMongoDB.save().then((results) => {
              // Log
              Logging.logInfo({
                source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
                action: "StopTransaction",
                message: `Stop Transaction created with success on ${stopTransaction.chargeBoxIdentity} for User ${userMongoDB.name} with ID Tag ${stopTransaction.idTag}`,
                detailedMessages: JSON.stringify(stopTransaction) });
            });
          } else {
            // Log
            Logging.logError({
              source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
              action: "StopTransaction",
              message: `User ${stopTransaction.idTag} not found: Cannot create Stop Transaction` });
            return Promise.reject();
          }
        });
      } else {
        // Log
        Logging.logError({
          source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStartTransaction",
          action: "StopTransaction",
          message: `Charging Station ${stopTransaction.chargeBoxIdentity} not found: Cannot create Stop Transaction` });
        return Promise.reject();
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStopTransaction",
        action: "StopTransaction",
        message: `Error when creating Stop Transaction of ${stopTransaction.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: `${stopTransaction.chargeBoxIdentity} - ${stopTransaction.idTag}`, module: "MongoDBStorage", method: "saveStopTransaction",
        action: "StopTransaction",
        message: `Error when creating Stop Transaction of ${stopTransaction.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveMeterValues(meterValues) {
    // Get
    return this._getChargingStationMongoDB(meterValues.chargeBoxIdentity, "MeterValues").then((chargingStationMongoDB) => {
      // Found?
      if (chargingStationMongoDB) {
        // Save all
        Promise.all(meterValues.values.map(meterValue => {
          // Create
          return new Promise((resolve, reject) => {
            // Create model
            var meterValueMongoDB = new MDBMeterValue(meterValue);
            // Set the ID
            meterValueMongoDB.chargeBoxID = chargingStationMongoDB._id;
            // Save
            return meterValueMongoDB.save().then((results) => {
              // Log
              Logging.logInfo({
                source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
                action: "MeterValues",
                message: `Save Meter of ${meterValues.chargeBoxIdentity} created with success`,
                detailedMessages: JSON.stringify(meterValue) });
            });
          });
        }));
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
        action: "MeterValues",
        message: `Error when saving Meter Value of ${meterValues.chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
       // Log
       Logging.logError({
         source: meterValues.chargeBoxIdentity, module: "MongoDBStorage", method: "saveMeterValues",
         action: "MeterValues",
         message: `Error when saving Meter Value of ${meterValues.chargeBoxIdentity}: ${err.toString()}`,
         detailedMessages: err.stack });
       return Promise.reject(err);
    });
  }

  saveChargingStation(chargingStation, action) {
    // Check
    action = action || "Unknown";
    // Get
    return this._getChargingStationMongoDB(chargingStation.getChargeBoxIdentity(), action).then((chargingStationMongoDB) => {
      // Found?
      if (!chargingStationMongoDB) {
        // No: Create it
        var newChargingStationMongoDB = new MDBChargingStation(chargingStation.getModel());
        // Create new
        return newChargingStationMongoDB.save().then((results) => {
          // Log
          Logging.logInfo({
            source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
            action: action,
            message: `Charging Station ${chargingStation.getChargeBoxIdentity()} created with success`,
            detailedMessages: JSON.stringify(chargingStation) });
        });
      } else {
        // Set data
        Utils.updateChargingStationObject(chargingStation.getModel(), chargingStationMongoDB);
        // No: Update it
        return chargingStationMongoDB.save((err, results) => {
          // Log
          Logging.logInfo({
            source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
            action: action,
            message: `Charging Station ${chargingStation.getChargeBoxIdentity()} updated with success`,
            detailedMessages: JSON.stringify(chargingStation)});
        });
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
        action: action,
        message: `Error when saving Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: chargingStation.getChargeBoxIdentity(), module: "MongoDBStorage", method: "saveChargingStation",
        action: action,
        message: `Error when saving Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  getChargingStations() {
    // Exec request
    return MDBChargingStation.find({}).sort( {chargeBoxIdentity: 1} ).exec().then((chargingStationsMongoDB) => {
      var chargingStations = [];
      // Create
      chargingStationsMongoDB.forEach((chargingStationMongoDB) => {
        chargingStations.push(new ChargingStation(chargingStationMongoDB));
      });
      // Ok
      return chargingStations;
    });
  }

  getChargingStation(chargeBoxIdentity, action) {
    // Check
    action = action || "Unknown";

    // Get
    return this._getChargingStationMongoDB(chargeBoxIdentity, action).then((chargingStationMongoDB) => {
      var chargingStation = null;
      // Found
      if (chargingStationMongoDB != null) {
        // Create
        chargingStation = new ChargingStation(chargingStationMongoDB);
      }
      return chargingStation;
    }, (err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "getChargingStations",
        action: action,
        message: `Error in reading the Charging Station ${chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "getChargingStations",
        action: action,
        message: `Error in reading the Charging Station ${chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  _getChargingStationMongoDB(chargeBoxIdentity, action) {
    // Check
    action = action || "Unknown";

    // Exec request
    return MDBChargingStation.find({"chargeBoxIdentity": chargeBoxIdentity}).then(chargingStationsMongoDB => {
      var chargingStationMongoDB = null;
      // Check
      if (chargingStationsMongoDB.length > 0) {
        chargingStationMongoDB = chargingStationsMongoDB[0];
      } else {
        // Log
        Logging.logWarning({
          source: chargeBoxIdentity, module: "MongoDBStorage", method: "_getChargingStationMongoDB",
          action: action,
          message: `Charging Station ${chargeBoxIdentity} does not exist` });
      }
      // Ok
      return chargingStationMongoDB;
    }, (err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "_getChargingStationMongoDB",
        action: action,
        message: `Error in reading the Charging Station ${chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: chargeBoxIdentity, module: "MongoDBStorage", method: "_getChargingStationMongoDB",
        action: action,
        message: `Error in reading the Charging Station ${chargeBoxIdentity}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  getUsers(action) {
    // Check
    action = action || "Unknown";

    // Exec request
    return MDBUser.find({}).sort( {name: 1} ).exec().then((usersMongoDB) => {
      var users = [];
      // Create
      usersMongoDB.forEach((userMongoDB) => {
        users.push(new User(userMongoDB));
      });
      // Ok
      return users;
    }, (err) => {
      // Log
      Logging.logError({
        source: "Central Server", module: "MongoDBStorage", method: "getUsers",
        action: action,
        message: `Error in reading the Users: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);

    }).catch((err) => {
      // Log
      Logging.logError({
        source: "Central Server", module: "MongoDBStorage", method: "getUsers",
        action: action,
        message: `Error in reading the Users: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  saveUser(user, action) {
    // Check
    action = action || "Unknown";

    // Check
    if (!user.getTagID()) {
      // Log
      Logging.logError({
        source: `NoTagID - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
        action: action,
        message: `Error in saving the User: User has no Tag ID and cannot be created or updated` });
      return Promise.reject({message: "Error in saving the User: User has no Tag ID and cannot be created or updated"});
    }
    // Get User
    return this._getUserByTagIdMongoDB(user.getTagID(), action).then((userMongoDB) => {
      // Found?
      if (!userMongoDB) {
        // No: Create it
        var newUserMongoDB = new MDBUser(user.getModel());
        // Create new
        return newUserMongoDB.save().then((results) => {
          // Log
          Logging.logInfo({
            source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
            action: action,
            message: `User ${user.getName()} created with success`,
            detailedMessages: JSON.stringify(user) });
        });
      } else {
        // Set data
        Utils.updateUser(user.getModel(), userMongoDB);

        // No: Update it
        return userMongoDB.save().then(() => {
          // Log
          Logging.logInfo({
            source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
            action: action,
            message: `User ${user.getName()} updated with success`,
            detailedMessages: JSON.stringify(user) });
        });
      }
    }, (err) => {
      // Log
      Logging.logError({
        source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
        action: action,
        message: `Error when updating User ${user.getName()}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);

    }).catch((err) => {
      // Log
      Logging.logError({
        source: `${user.getTagID()} - ${user.getName()}`, module: "MongoDBStorage", method: "saveUser",
        action: action,
        message: `Error when creating User  ${user.getName()}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime, action) {
    // Check
    action = action || "Unknown";
    // // Get the Charging Station
    // return new Promise((resolve, reject) => {
    //     // Build filter
    //     var filter = {};
    //     if (chargeBoxIdentity) {
    //       filter.chargeBoxIdentity = chargeBoxIdentity;
    //     }
    //     if (connectorId) {
    //       filter.connectorId = connectorId;
    //     }
    //     if (startDateTime || endDateTime) {
    //       filter.timestamp = {};
    //     }
    //     if (startDateTime) {
    //       filter.timestamp["$gte"] = new Date(startDateTime);
    //     }
    //     if (endDateTime) {
    //       filter.timestamp["$lte"] = new Date(endDateTime);
    //     }
    //
    //     // Get the Start Transaction
    //     MDBStartTransaction.find(filter).sort( {timestamp: -1} ).exec((err, transactionsMongoDB) => {
    //         var transactions = [];
    //
    //         if (err) {
    //             reject(err);
    //         } else {
    //             // Create
    //             transactionsMongoDB.forEach((transactionMongoDB) => {
    //               var transaction = {};
    //               // Set
    //               Utils.updateStartTransaction(transactionMongoDB, transaction);
    //               // Add
    //               transactions.push(transaction);
    //             });
    //             // Ok
    //             resolve(transactions);
    //         }
    //     // Get the Users
    //   }).then((transactions) => {
    //       var userPromises = [];
    //
    //       // Get the user for each transaction
    //       for (var i = 0; i < transactions.length; i++) {
    //         // Call in a function to pass the index in the Promise
    //         ((transaction) => {
    //           // Get the user
    //           userPromises.push(
    //             // Get the user
    //             this.getUserByTagId(transaction.idTag).then((user) => {
    //               // Set
    //               if(user) {
    //                 // Set the User
    //                 transaction.user = user.getModel();
    //               }
    //               return transaction;
    //             })
    //           );
    //         })(transactions[i]);
    //       }
    //
    //       Promise.all(userPromises).then((transactions) => {
    //         fullfill(transactions);
    //       });
    //     });
    // });
  }

  getUserByTagId(tagID, action) {
    // Check
    action = action || "Unknown";

    // Get
    return this._getUserByTagIdMongoDB(tagID, action).then((userMongoDB) => {
      var user = null;
      // Found
      if (userMongoDB != null) {
        user = new User(userMongoDB);
      }
      return user;
    }).catch((err) => {
      // Log
      Logging.logError({
        source: tagID, module: "MongoDBStorage", method: "getUserByTagId",
        action: action,
        message: `Error in reading the User with Tag ID ${tagID}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }

  _getUserByTagIdMongoDB(tagID, action) {
    // Check
    action = action || "Unknown";

    // Exec request
    return MDBUser.find({"tagID": tagID}).then((usersMongoDB) => {
      var userMongoDB = null;
      // Check
      if (usersMongoDB.length > 0) {
        userMongoDB = usersMongoDB[0];
      } else {
        Logging.logWarning({
          source: tagID, module: "MongoDBStorage", method: "_getUserByTagIdMongoDB",
          action: action,
          message: `User with Tag ID ${tagID} does not exist!` });
      }
      // Ok
      return userMongoDB;
    }, (err) => {
      // Log
      Logging.logError({
        source: tagID, module: "MongoDBStorage", method: "_getUserByTagIdMongoDB",
        action: action,
        message: `Error in getting the User with Tag ID ${tagID}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    }).catch((err) => {
      // Log
      Logging.logError({
        source: tagID, module: "MongoDBStorage", method: "_getUserByTagIdMongoDB",
        action: action,
        message: `Error in getting the User with Tag ID ${tagID}: ${err.toString()}`,
        detailedMessages: err.stack });
      return Promise.reject(err);
    });
  }
}

module.exports = MongoDBStorage;
