const BackendError = require('../../../exception/BackendError');
const ChargingStation = require('../../../entity/ChargingStation');
const Constants = require('../../../utils/Constants');

require('source-map-support').install();

class OCPPUtils {
  static async checkAndGetChargingStation(chargeBoxIdentity, tenantID) {
    // Get the charging station
    const chargingStation = await ChargingStation.getChargingStation(tenantID, chargeBoxIdentity);
    // Found?
    if (!chargingStation) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station does not exist`,
        "ChargingStationService", "_checkAndGetChargingStation");
    }
    // Found?
    if (chargingStation.isDeleted()) {
      // Error
      throw new BackendError(chargeBoxIdentity, `Charging Station is deleted`,
        "ChargingStationService", "_checkAndGetChargingStation");
    }
    return chargingStation;
  }

  static async checkAndFreeConnector(chargingStation, connectorId, saveOtherConnectors = false) {
    // Cleanup connector transaction data
    OCPPUtils.cleanupConnectorTransactionInfo(chargingStation, connectorId);
    // Check if Charger can charge in //
    if (!chargingStation.canChargeInParallel()) {
      // Set all the other connectors to Available
      chargingStation.getConnectors().forEach(async (connector) => {
        // Only other Occupied connectors
        if ((connector.status === Constants.CONN_STATUS_OCCUPIED ||
             connector.status === Constants.CONN_STATUS_UNAVAILABLE) &&
            connector.connectorId !== connectorId) {
          // Set connector Available again
          connector.status = Constants.CONN_STATUS_AVAILABLE;
          // Save other updated connectors?
          if (saveOtherConnectors) {
            await chargingStation.saveChargingStationConnector(connector.connectorId);
          }
        }
      });
    }
  }

  static cleanupConnectorTransactionInfo(chargingStation, connectorId) {
    const connector = chargingStation.getConnector(connectorId);
    // Clear
    connector.currentConsumption = 0;
    connector.totalConsumption = 0;
    connector.currentStateOfCharge = 0;
    connector.activeTransactionID = 0;
  }

  static async updateConnectorsPower(chargingStation) {
    let voltageRerefence = 0;
    let current = 0;
    let nbPhase = 0;
    let power = 0;
    let totalPower = 0;

    // Only for Schneider
    if (chargingStation.getChargePointVendor() === 'Schneider Electric') {
      // Get the configuration
      const configuration = await chargingStation.getConfiguration();
      // Config Provided?
      if (configuration && configuration.configuration) {
        // Search for params
        for (let i = 0; i < configuration.configuration.length; i++) {
          // Check
          switch (configuration.configuration[i].key) {
            // Voltage
            case 'voltagererefence':
              // Get the meter interval
              voltageRerefence = parseInt(configuration.configuration[i].value);
              break;

            // Current
            case 'currentpb1':
              // Get the meter interval
              current = parseInt(configuration.configuration[i].value);
              break;

            // Nb Phase
            case 'nbphase':
              // Get the meter interval
              nbPhase = parseInt(configuration.configuration[i].value);
              break;
          }
        }
        // Override?
        if (chargingStation.getNumberOfConnectedPhase()) {
          // Yes
          nbPhase = chargingStation.getNumberOfConnectedPhase();
        }
        // Compute it
        if (voltageRerefence && current && nbPhase) {
          // One Phase?
          if (nbPhase == 1) {
            power = Math.floor(230 * current);
          } else {
            power = Math.floor(400 * current * Math.sqrt(nbPhase));
          }
        }
      }
      // Set Power
      for (const connector of chargingStation.getConnectors()) {
        if (connector) {
          connector.power = power;
          totalPower += power;
        }
      }
      // Set total power
      if (totalPower && !chargingStation.getMaximumPower()) {
        // Set
        chargingStation.setMaximumPower(totalPower);
      }
    }
  }
}

module.exports = OCPPUtils;
