const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const Factory = require('../factories/Factory');
const faker = require('faker');
const CentralServerService = require('./client/CentralServerService');
const OCPPJsonService16 = require('./ocpp/json/OCPPJsonService16');
const OCPPJsonService15 = require('./ocpp/soap/OCPPSoapService15');
const config = require('../config');
const Utils = require('../../src/utils/Utils');
const {from} = require('rxjs');
const {mergeMap} = require('rxjs/operators');

class DataHelper {

  constructor(ocppVersion, tenantID, ocppRequestHandler) {
    if (ocppVersion === '1.6') {
      this.ocpp = new OCPPJsonService16(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${tenantID}`, ocppRequestHandler);
    } else if (ocppVersion === '1.5') {
      this.ocpp = new OCPPJsonService15(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${tenantID}`);
    } else {
      throw  new Error('unkown ocpp version');
    }

    this.context = {
      chargingStations: [],
      siteAreas: [],
      sites: [],
      companies: [],
      users: []
    };
  }

  async createUser(user = Factory.user.build()) {
    const createdUser = await CentralServerService.createEntity(CentralServerService.userApi, user);
    this.context.users.push(createdUser);
    return createdUser;
  }

  async createCompany(company = Factory.company.build()) {
    const createdCompany = await CentralServerService.createEntity(CentralServerService.companyApi, company);
    this.context.companies.push(createdCompany);
    return createdCompany;
  }

  async createSite(company, users, site = Factory.site.build({
    companyID: company.id,
    userIDs: users.map(user => user.id)
  })) {
    const createdSite = await CentralServerService.createEntity(CentralServerService.siteApi, site);
    this.context.sites.push(createdSite);
    return createdSite;
  }

  async createSiteArea(site, chargingStations, siteArea = Factory.siteArea.build({
    siteID: site.id,
    chargeBoxIDs: chargingStations.map(chargingStation => chargingStation.id)
  })) {
    const createdSiteArea = await CentralServerService.createEntity(CentralServerService.siteAreaApi, siteArea);
    this.context.siteAreas.push(createdSiteArea);
    return createdSiteArea;
  }

  async createChargingStation(chargingStation = Factory.chargingStation.build({id: faker.random.alphaNumeric(12)}), numberOfConnectors = 2) {
    const response = await this.ocpp.executeBootNotification(
      chargingStation.id, chargingStation);
    expect(response.data).to.not.be.null;
    expect(response.data.status).to.eql('Accepted');
    expect(response.data).to.have.property('currentTime');
    const createdChargingStation = await CentralServerService.getEntityById(
      CentralServerService.chargingStationApi, chargingStation);
    chargingStation.connectors = [];
    for (let i = 0; i < numberOfConnectors; i++) {
      createdChargingStation.connectors[i] = {
        connectorId: i + 1,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: new Date().toISOString()
      };
    }
    for (const connector of createdChargingStation.connectors) {
      await this.ocpp.executeStatusNotification(createdChargingStation.id, connector);
      expect(response).to.not.be.null;
      expect(response.data.status).to.equal('Accepted');
    }

    this.context.chargingStations.push(createdChargingStation);
    return createdChargingStation;
  }

  async destroyData() {
    await this.executeOnAll(this.context.users, user => CentralServerService.deleteEntity(
      CentralServerService.userApi, user));
    this.context.siteAreas.forEach(siteArea => CentralServerService.deleteEntity(
      CentralServerService.siteAreaApi, siteArea));
    this.context.sites.forEach(site => CentralServerService.deleteEntity(
      CentralServerService.siteApi, site));
    this.context.companies.forEach(company => CentralServerService.deleteEntity(
      CentralServerService.companyApi, company));
    this.context.chargingStations.forEach(chargingStation => CentralServerService.deleteEntity(
      CentralServerService.chargingStationApi, chargingStation));
  }

  async executeOnAll(array, method) {
    await from(array).pipe(
      mergeMap(method, 50)
    ).toPromise();
  }

  async close() {
    this.ocpp.closeConnection();
  }

  async startTransaction(chargingStation, connectorId, tagId, meterStart, startDate) {
    const response = await this.ocpp.executeStartTransaction(chargingStation.id, {
      connectorId: chargingStation.connectors[connectorId - 1].connectorId,
      idTag: tagId,
      meterStart: meterStart,
      timestamp: startDate.toISOString()
    });
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    expect(response.data).to.have.property('transactionId');
    expect(response.data.transactionId).to.not.equal(0);
    return response.data.transactionId;
  }

  async stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate) {
    const response = await this.ocpp.executeStopTransaction(chargingStation.id, {
      transactionId: transactionId,
      idTag: tagId,
      meterStop: meterStop,
      timestamp: stopDate.toISOString()
    });
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
  }


  async sendConsumptionMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    const response = await this.ocpp.executeMeterValues(chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: "Raw",
          measurand: "Energy.Active.Import.Register",
          unit: 'Wh',
          location: "Outlet",
          context: "Sample.Periodic"
        }]

      },
    });
    expect(response.data).to.eql({});
  }

  async sendSoCMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    const response = await this.ocpp.executeMeterValues(chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: "Raw",
          measurand: "SoC",
          context: "Sample.Periodic"
        }]

      },
    });
    expect(response.data).to.eql({});
  }

  async sendClockMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    const response = await this.ocpp.executeMeterValues(chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: "Raw",
          measurand: "Energy.Active.Import.Register",
          unit: 'Wh',
          location: "Outlet",
          context: "Sample.Clock"
        }]

      },
    });
    expect(response.data).to.eql({});
  }

  async setConnectorStatus(ocpp, chargingStation, connectorId, status, timestamp) {
    const connector = Utils.duplicateJSON(chargingStation.connectors[connectorId]);
    connector.status = status;
    connector.timestamp = timestamp.toISOString();
    const response = await ocpp.executeStatusNotification(chargingStation.id, connector);
    expect(response.data).to.eql({});
    chargingStation.connectors[connectorId].status = connector.status;
    chargingStation.connectors[connectorId].timestamp = connector.timestamp;
  }

  getConfigurationOf(chargingStation) {
    const configuration = {
      "stationTemplate": {
        "baseName": "CS-" + faker.random.alphaNumeric(10),
        "chargePointModel": chargingStation.chargePointModel,
        "chargePointVendor": chargingStation.chargePointVendor,
        "power": [7200, 16500, 22000, 50000],
        "powerUnit": "W",
        "numberOfConnectors": chargingStation.connectors.length,
        "randomConnectors": false,
        "Configuration": {
          "NumberOfConnectors": chargingStation.connectors.length,
          "param1": "test",
          "meterValueInterval": 60
        },
        "AutomaticTransactionGenerator": {
          "enable": true,
          "minDuration": 70,
          "maxDuration": 180,
          "minDelayBetweenTwoTransaction": 30,
          "maxDelayBetweenTwoTransaction": 60,
          "probabilityOfStart": 1,
          "stopAutomaticTransactionGeneratorAfterHours": 0.3
        },
        "Connectors": {}
      }
    };
    chargingStation.connectors.forEach(connector => {
      configuration.Connectors[connector.connectorId] = {
        "MeterValues": [{
          "unit": "Percent",
          "context": "Sample.Periodic",
          "measurand": "SoC",
          "location": "EV"
        }, {
          "unit": "Wh",
          "context": "Sample.Periodic"
        }]
      };
    });
    return configuration;
  }
}

module.exports = DataHelper;