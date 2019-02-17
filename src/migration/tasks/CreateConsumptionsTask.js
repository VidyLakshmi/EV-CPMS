const Tenant = require('../../entity/Tenant');
const PricingStorage = require('../../storage/mongodb/PricingStorage');
const DatabaseUtils = require('../../storage/mongodb/DatabaseUtils');
const moment = require('moment');
const Transaction = require('../../entity/Transaction');
const Logging = require('../../utils/Logging');
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const pLimit = require('p-limit');
const MigrationTask = require('../MigrationTask');

const DEFAULT_CONSUMPTION_ATTRIBUTE = {
  unit: 'Wh',
  location: 'Outlet',
  measurand: 'Energy.Active.Import.Register',
  format: 'Raw',
  context: 'Sample.Periodic'
};

class CreateConsumptionsTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    this.totalCount = 0;
    this.done = 0;
    this.startTime = moment();
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        "stop": {
          $exists: true
        }
      }
    });
    // Add Charger
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    aggregation.push({
      $unwind: {"path": "$chargeBox", "preserveNullAndEmptyArrays": true}
    });
    // Add Site Area
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'siteareas'),
        localField: 'chargeBox.siteAreaID',
        foreignField: '_id',
        as: 'siteArea'
      }
    });
    aggregation.push({
      $unwind: {"path": "$siteArea", "preserveNullAndEmptyArrays": true}
    });
    // Add Consumption
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'consumptions'),
        localField: '_id',
        foreignField: 'transactionId',
        as: 'consumptions'
      }
    });
    aggregation.push({
      $match: { "consumptions": { $eq: [] } }
    });
    // Read all transactions
    const transactionsMDB = await global.database.getCollection(tenant.getID(), 'transactions')
      .aggregate(aggregation).toArray();
    // Add Site ID and Site Area ID in Transaction
    const transactions = transactionsMDB.map(transaction => {
      // Create
      return new Transaction(tenant.getID(), transaction);
    });
    // Get the price
    const pricing = await PricingStorage.getPricing(tenant.getID());
    // Limit promise execution in //
    const limit = pLimit(1);
    this.totalCount = transactions.length;
    // Create promises
    const promises = transactions.map(
      transaction => limit(() => this.computeConsumptions(transaction, pricing)));
    // Execute them all
    // eslint-disable-next-line no-undef
    await Promise.all(promises);
    // Get the end time
    const endTime = moment();
    // Log
    if (transactions.length > 0) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: "CreateConsumptionsTask", action: "Migration",
        module: "CreateConsumptionsTask", method: "migrate",
        message: `Tenant ${tenant.getName()} (${tenant.getID()}): ${transactions.length} transactions migrated after ${moment.duration(endTime.diff(this.startTime)).format("mm:ss.SS", {trim: false})}`
      });
    }
  }

  async computeConsumptions(transaction, pricing) {
    let lastConsumption = null;
    const newConsumptions = [];
    // Get the consumption (old method)
    const consumptions = await this.getConsumptions(transaction)
    // Build the new consumptions
    for (const consumption of consumptions) {
      // Create consumption
      const newConsumption = { 
        "userID" : transaction.getUserID(), 
        "chargeBoxID" : transaction.getChargeBoxID(), 
        "siteID" : transaction.getSiteID(), 
        "siteAreaID" : transaction.getSiteAreaID(), 
        "connectorId" : transaction.getConnectorId(), 
        "transactionId" : transaction.getID(), 
        "startedAt" : (lastConsumption ? lastConsumption.endedAt : transaction.getStartDate()), 
        "endedAt" : consumption.date, 
        "cumulatedConsumption" : consumption.cumulated, 
        "consumption" : consumption.valueWh, 
        "instantPower" : consumption.value,
        "totalInactivitySecs": (lastConsumption ? lastConsumption.totalInactivitySecs : 0) 
      }
      // Check inactivity
      if (consumption.value === 0) {
        // Set it
        consumption.totalInactivitySecs += moment(consumption.endedAt).diff(consumption.startedAt, 's');
      }
      // Check Pricing
      if (pricing) {
        // Compute
        newConsumption.pricingSource = "simple";
        newConsumption.amount = (consumption.valueWh / 1000 ) * pricing.priceKWH;
        newConsumption.roundedAmount = (newConsumption.amount).toFixed(6); 
        newConsumption.currencyCode = pricing.priceUnit;
        if (lastConsumption) {
          // Add
          newConsumption.cumulatedAmount = lastConsumption.cumulatedAmount + newConsumption.amount; 
        } else {
          // Init
          newConsumption.cumulatedAmount = 0; 
        }
      }
      // Keep
      lastConsumption = newConsumption;
      // Add
      newConsumptions.push(newConsumption);
    }
    // Save All
    this.insertMany(transaction.getTenantID(), newConsumptions);
  }

  async insertMany(tenantID, consumptions) {
    // Transfer
    const consumptionsMDB = consumptions.map(consumption => {
      const consumptionMDB = {};
      // Update
      Database.updateConsumption(consumption, consumptionMDB, false);
      // Return
      return consumptionMDB;
    });
    // Insert
    await global.database.getCollection(tenantID, 'consumptions').insertMany(consumptionsMDB);
  }

  async getConsumptions(transaction) {
    let firstMeterValue = false;
    let lastMeterValue;
    let cumulatedConsumption = 0;
    const consumptions = [];
    // Get Meter Values
    let meterValues = await transaction.getMeterValues();
    // Add first Meter Value
    meterValues.splice(0, 0, {
      id: '666',
      connectorId: transaction.getConnectorId(),
      transactionId: transaction.getID(),
      timestamp: transaction.getStartDate(),
      value: transaction.getMeterStart(),
      attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
    });
    // Add last Meter Value
    if (transaction.isFinished()) {
      // Add the missing Meter Value
      meterValues.push({
        id: '6969',
        connectorId: transaction.getConnectorId(),
        transactionId: transaction.getID(),
        timestamp: transaction.getEndDate(),
        value: transaction.getMeterStop(),
        attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
      });
    }
    // Build the model
    for (let meterValueIndex = 0; meterValueIndex < meterValues.length; meterValueIndex++) {
      const meterValue = meterValues[meterValueIndex];
      // Meter Value Consumption?
      if (transaction.isConsumptionMeterValue(meterValue)) {
        // First value?
        if (!firstMeterValue) {
          // No: Keep the first value
          lastMeterValue = meterValue;
          // Ok
          firstMeterValue = true;
          // Calculate the consumption with the last value provided
        } else {
          // Last value is > ?
          if (lastMeterValue.value > meterValue.value) {
            // Yes: reinit it (the value has started over from 0)
            lastMeterValue.value = 0;
          }
          // Get the diff
          const diffSecs = moment(meterValue.timestamp).diff(lastMeterValue.timestamp, 's');
          // Sample multiplier
          const sampleMultiplier = 3600 / diffSecs;
          // Consumption
          const consumptionWh = meterValue.value - lastMeterValue.value;
          // compute
          const currentConsumption = consumptionWh * sampleMultiplier;
          // Set cumulated
          cumulatedConsumption += consumptionWh;
          // Check last Meter Value
          if (consumptions.length > 0 &&
            consumptions[consumptions.length - 1].date.getTime() === meterValue.timestamp.getTime()) {
            // Same timestamp: Update the latest
            consumptions[consumptions.length - 1].value = currentConsumption;
            consumptions[consumptions.length - 1].cumulated = cumulatedConsumption;
          } else {
            // Add the consumption
            consumptions.push({
              date: meterValue.timestamp,
              value: currentConsumption,
              cumulated: cumulatedConsumption,
              valueWh: consumptionWh,
              stateOfCharge: 0
            });
          }
          lastMeterValue = meterValue;
        }
        // Meter Value State of Charge?
      } else if (transaction.isSocMeterValue(meterValue)) {
        // Set the last SoC
        consumptions.stateOfCharge = meterValue.value;
        // Check last Meter Value
        if (consumptions.length > 0 &&
          consumptions[consumptions.length - 1].date.getTime() === meterValue.timestamp.getTime()) {
          // Same timestamp: Update the latest
          consumptions[consumptions.length - 1].stateOfCharge = meterValue.value;
        } else {
          // Add the consumption
          consumptions.push({
            date: meterValue.timestamp,
            stateOfCharge: meterValue.value,
            value: 0,
            valueWh: 0,
            cumulated: 0
          });
        }
      }
    }
    return consumptions;
  }

  isAsynchronous() {
    return true;
  }

  getVersion() {
    return "1.0";
  }

  getName() {
    return "CreateConsumptionsTask";
  }
}

module.exports = CreateConsumptionsTask;
