const Database = require('../../utils/Database');
const Utils = require('../../utils/Utils');
const Logging = require('../../utils/Logging');
const Consumption = require('../../entity/Consumption');
const crypto = require('crypto');

class ConsumptionStorage {
  /**
   *
   * @param tenantID
   * @param consumptionToSave
   * @returns {Promise<Consumption>}
   */
  static async saveConsumption(tenantID, consumptionToSave) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'saveConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Set the ID
    if (!consumptionToSave.id) {
      // Set the ID
      const timestamp = Utils.convertToDate(consumptionToSave.endedAt);
      consumptionToSave.id = crypto.createHash('sha256')
        .update(`${consumptionToSave.transactionId}~${timestamp.toISOString()}`)
        .digest("hex");
    }
    // Transfer
    const consumption = {};
    Database.updateConsumption(consumptionToSave, consumption, false);
    // Modify
    const result = await global.database.getCollection(tenantID, 'consumptions').findOneAndUpdate(
      { "_id": consumptionToSave.id },
      {
        $set: consumption
      },
      { upsert: true, new: true, returnOriginal: false });
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'saveConsumption', uniqueTimerID, { consumptionToSave: consumptionToSave });
    // Return
    return new Consumption(tenantID, result.value);
  }

  static async deleteConsumptions(tenantID, transactionId) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'deleteConsumptions');
    // Check
    await Utils.checkTenant(tenantID);
    // Delete
    await global.database.getCollection(tenantID, 'consumptions')
      .deleteMany({ 'transactionId': transactionId });
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'deleteConsumptions', uniqueTimerID, { transactionId });
  }

  /**
   * Get the unique consumption of a transaction at a given point of time
   * @param tenantID {string}
   * @param transactionId {number}
   * @param timestamp{Date}
   * @returns {Promise<Consumption>}
   */
  static async getConsumption(tenantID, transactionId, endedAt) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'getConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(transactionId),
        endedAt: new Date(endedAt)
      }
    });
    // Read DB
    const consumptionsMDB = await global.database.getCollection(tenantID, 'consumptions')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'getConsumption', uniqueTimerID, { transactionId, endedAt });
    // Found?
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      return new Consumption(tenantID, consumptionsMDB[0]);
    }
    return null;
  }

  /**
   *
   * @param tenantID
   * @param transactionId
   * @returns {Promise<Consumption[]>}
   */
  static async getConsumptions(tenantID, transactionId) {
    // Debug
    const uniqueTimerID = Logging.traceStart('ConsumptionStorage', 'getConsumption');
    // Check
    await Utils.checkTenant(tenantID);
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        transactionId: Utils.convertToInt(transactionId)
      }
    });
    // Triming excess values
    aggregation.push({
      $group: {
        _id: {
          cumulatedConsumption: "$cumulatedConsumption",
          consumption: "$consumption"
        },
        userID: { $last: "$userID" },
        chargeBoxID: { $last: "$chargeBoxID" },
        siteID: { $last: "$siteID" },
        siteAreaID: { $last: "$siteAreaID" },
        connectorId: { $last: "$connectorId" },
        transactionId: { $last: "$transactionId" },
        endedAt: { $max: "$endedAt" },
        startedAt: { $min: "$startedAt" },
        cumulatedConsumption: { $last: "$cumulatedConsumption" },
        consumption: { $last: "$consumption" },
        instantPower: { $max: "$instantPower" },
        totalInactivitySecs: { $max: "$totalInactivitySecs" },
        pricingSource: {$last: "$pricingSource" },
        amount: { $last: "$amount" },
        cumulatedAmount: { $last: "$cumulatedAmount" },
        roundedAmount: { $last: "$roundedAmount" },
        currencyCode: { $last: "$currencyCode" }
      }
    })
    // Sort values
    aggregation.push({ $sort: { endedAt: 1 } });
    // Read DB
    const consumptionsMDB = await global.database.getCollection(tenantID, 'consumptions')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd('ConsumptionStorage', 'getConsumption', uniqueTimerID, { transactionId });
    // Found?
    if (consumptionsMDB && consumptionsMDB.length > 0) {
      return consumptionsMDB.map(c => new Consumption(tenantID, c));
    }
    return null;
  }
}

module.exports = ConsumptionStorage;
