import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './contextProvider/ChargingStationContext';
import Factory from '../factories/Factory';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class OCPPCommonTests {

  public tenantContext: any;
  public chargingStationContext: ChargingStationContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;

  public currentPricingSetting;
  public priceKWH = 2;
  public chargingStationConnector1: any;
  public chargingStationConnector2: any;
  public transactionStartUser: any;
  public transactionStartUserService: any;
  public transactionStopUser: any;
  public transactionStartMeterValue: any;
  public transactionStartSoC: any;
  public transactionMeterValues: any;
  public transactionMeterSoCValues: any;
  public transactionSignedData: any;
  public transactionEndSignedData: any;
  public transactionMeterValueIntervalSecs: any;
  public transactionStartTime: any;
  public transactionTotalConsumption: any;
  public transactionEndMeterValue: any;
  public transactionEndSoC: any;
  public transactionTotalInactivity: any;
  public totalPrice: any;
  public newTransaction: any;
  public transactionCurrentTime: any;

  public createAnyUser = false;
  public numberTag: any;
  public validTag: any;
  public invalidTag: any;
  public anyUser: any;
  public createdUsers: any[] = [];

  public constructor(tenantContext, centralUserContext, createAnyUser = false) {
    expect(tenantContext).to.exist;
    this.tenantContext = tenantContext;
    this.centralUserContext = centralUserContext;
    expect(centralUserContext).to.exist;
    this.centralUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.centralUserContext);
    this.createAnyUser = createAnyUser;
  }

  public setChargingStation(chargingStationContext) {
    expect(chargingStationContext).to.exist;
    this.chargingStationContext = chargingStationContext;
  }

  public setUsers(startUserContext, stopUserContext?) {
    expect(startUserContext).to.exist;
    this.transactionStartUser = startUserContext;
    if (stopUserContext) {
      this.transactionStopUser = stopUserContext;
    } else {
      this.transactionStopUser = this.transactionStartUser;
    }
    this.transactionStartUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.transactionStartUser);
  }

  public async assignAnyUserToSite(siteContext) {
    expect(siteContext).to.exist;
    if (this.anyUser) {
      await this.centralUserService.siteApi.addUsersToSite(siteContext.getSite().id, [this.anyUser.id]);
    }
  }

  public async before() {
    const allSettings = await this.centralUserService.settingApi.readAll({});
    this.currentPricingSetting = allSettings.data.result.find((s) => {
      return s.identifier === 'pricing';
    });
    if (this.currentPricingSetting) {
      await this.centralUserService.updatePriceSetting(this.priceKWH, 'EUR');
    }
    // Default Connector values
    this.chargingStationConnector1 = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    this.chargingStationConnector2 = {
      connectorId: 2,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    // Set meter value start
    this.transactionStartMeterValue = 0;
    this.transactionSignedData = 'DT785uwRY0zBF9ZepmQV94mK08l4ovYHgsraT8Z00l1p7jVRgq';
    this.transactionEndSignedData = 'WZ2eLegGcstPRqYpsu7JQEMZSnUP6XTNzJJfBDKpAYgtXrNQSM';
    this.transactionMeterValues = Array.from({ length: 12 }, () => {
      return faker.random.number({
        min: 200,
        max: 500
      });
    }).concat([0, 0]);
    this.transactionMeterSoCValues = Array.from({ length: 8 }, () => {
      return faker.random.number({
        min: 10,
        max: 90
      });
    }).concat([8, 8, 98, 99, 100, 100]).sort((a, b) => {
      return (a - b);
    });
    this.transactionStartSoC = this.transactionMeterSoCValues[0];
    this.transactionMeterValueIntervalSecs = 60;
    this.transactionStartTime = moment().subtract(this.transactionMeterValues.length * this.transactionMeterValueIntervalSecs + 1, 'seconds');
    this.transactionTotalConsumption = this.transactionMeterValues.reduce((sum, meterValue) => {
      return sum + meterValue;
    });
    this.transactionEndMeterValue = this.transactionStartMeterValue + this.transactionTotalConsumption;
    this.transactionEndSoC = 100;
    this.transactionTotalInactivity = this.transactionMeterValues.reduce(
      (sum, meterValue) => {
        return (meterValue === 0 ? sum + this.transactionMeterValueIntervalSecs : sum);
      }, 0);
    this.totalPrice = this.priceKWH * (this.transactionTotalConsumption / 1000);

    this.validTag = faker.random.alphaNumeric(20).toString();
    this.invalidTag = faker.random.alphaNumeric(21).toString();
    this.numberTag = faker.random.number(10000);
    if (this.createAnyUser) {
      this.anyUser = await this.createUser(Factory.user.build({ tagIDs: [this.validTag, this.invalidTag, this.numberTag.toString()] }));
      if (!this.createdUsers) {
        this.createdUsers = [];
      }
      this.createdUsers.push(this.anyUser);
    }
  }

  public async after() {
    if (this.currentPricingSetting) {
      await this.centralUserService.settingApi.update(this.currentPricingSetting);
    }
    if (this.createdUsers && Array.isArray(this.createdUsers)) {
      this.createdUsers.forEach(async (user) => {
        await this.centralUserService.deleteEntity(
          this.centralUserService.userApi, user);
      });
    }
  }

  public async testConnectorStatus() {
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    expect(response.data).to.eql({});
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector2);
    expect(response.data).to.eql({});
    // Attention: connector status is always 'Unavailable', if too much time has passed since last heartbeat!!
    response = await this.chargingStationContext.sendHeartbeat();
    // Now we can test the connector status!
    response = await this.chargingStationContext.readChargingStation();
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    // Check both Connectors
    const foundChargingStation = response.data;
    // Check
    expect(foundChargingStation.connectors).to.not.be.null;
    expect(foundChargingStation.connectors[0]).to.include({ status: this.chargingStationConnector1.status, errorCode: this.chargingStationConnector1.errorCode });
    expect(foundChargingStation.connectors[1]).to.include({ status: this.chargingStationConnector2.status, errorCode: this.chargingStationConnector2.errorCode });
  }

  public async testChangeConnectorStatus() {
    // Set it to Occupied
    this.chargingStationConnector1.status = 'Occupied';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
    // To be sure send a heartbeat
    response = await this.chargingStationContext.sendHeartbeat();
    // Check the connectors
    response = await this.chargingStationContext.readChargingStation();
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    const foundChargingStation = response.data;
    // Check Connector 1
    expect(foundChargingStation.connectors[0]).to.include({ status: this.chargingStationConnector1.status, errorCode: this.chargingStationConnector1.errorCode });
    // Connector 2 should be still 'Available'
    expect(foundChargingStation.connectors[1]).to.include({ status: this.chargingStationConnector2.status, errorCode: this.chargingStationConnector2.errorCode });
    // Reset Status of Connector 1
    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
  }

  public async testHeartbeat() {
    // Update Status of Connector 1
    const response = await this.chargingStationContext.sendHeartbeat();
    // Check
    expect(response.data).to.have.property('currentTime');
  }

  public async testDataTransfer() {
    // Check
    const response = await this.chargingStationContext.transferData({
      'vendorId': 'Schneider Electric',
      'messageId': 'Detection loop',
      'data': '{\\"connectorId\\":2,\\"name\\":\\"Vehicle\\",\\"state\\":\\"0\\",\\"timestamp\\":\\"2018-08-08T10:21:11Z:\\"}',
      'chargeBoxID': this.chargingStationContext.getChargingStation().id,
      'timestamp': new Date().toDateString()
    });
    // Check
    expect(response.data).to.have.property('status');
    expect(response.data.status).to.equal('Accepted');
  }

  public async testAuthorizeUsers() {
    // Asserts that the start user is authorized.
    await this.testAuthorize(this.transactionStartUser.tagIDs[0], 'Accepted');
    // Asserts that the stop user is authorized.
    await this.testAuthorize(this.transactionStopUser.tagIDs[0], 'Accepted');
    // Asserts that the user with a too long tag is not authorized.
    await this.testAuthorize('ThisIsATooTooTooLongTag', 'Invalid');
  }

  public async testStartTransaction(withSoC = false, validTransaction = true) {
    // Start a new Transaction
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.transactionStartUser.tagIDs[0],
      this.transactionStartMeterValue,
      this.transactionStartTime
    );
    if (validTransaction) {
      expect(response).to.be.transactionValid;
      const transactionId = response.data.transactionId;
      await this.validateStartedTransaction(
        response,
        this.chargingStationConnector1,
        this.transactionStartMeterValue,
        this.transactionStartTime);
      this.newTransaction = (await this.centralUserService.transactionApi.readById(transactionId)).data;
      expect(this.newTransaction).to.not.be.null;
    } else {
      this.newTransaction = null;
      expect(response).to.be.transactionStatus('Invalid');
    }
  }

  public async testStartSecondTransaction(withSoC = false) {
    // Check on current transaction
    expect(this.newTransaction).to.not.be.null;
    // Set
    const transactionId = this.newTransaction.id;
    this.transactionStartTime = moment().subtract(1, 'h');
    // Clear old one
    this.newTransaction = null;
    // Start the 2nd Transaction
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.transactionStartUser.tagIDs[0],
      this.transactionStartMeterValue,
      this.transactionStartTime
    );
    const secondTransactionId = response.data.transactionId;
    await this.validateStartedTransaction(
      response,
      this.chargingStationConnector1,
      this.transactionStartMeterValue,
      this.transactionStartTime);
    // Check if the Transaction exists
    this.newTransaction = (await this.centralUserService.transactionApi.readById(secondTransactionId)).data;
    // Check
    expect(this.newTransaction).to.not.be.null;
    expect(this.newTransaction.id).to.not.equal(transactionId);
  }

  public async testSendMeterValues(withSoC = false, withSignedData = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Current Time matches Transaction one
    this.transactionCurrentTime = moment(this.newTransaction.timestamp);
    // Start Meter Value matches Transaction one
    let transactionCurrentMeterValue = this.transactionStartMeterValue;
    // Send Transaction.Begin
    let response = await this.chargingStationContext.sendBeginMeterValue(
      this.newTransaction.connectorId,
      this.newTransaction.transactionId,
      transactionCurrentMeterValue,
      this.transactionStartSoC,
      this.transactionSignedData,
      this.transactionCurrentTime,
      withSoC,
      withSignedData);
    if (response) {
      expect(response.data).to.eql({});
    }
    // Check Transaction
    response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    // Send Meter Values (except the last one which will be used in Stop Transaction)
    for (let index = 0; index <= this.transactionMeterValues.length - 2; index++) {
      // Set new meter value
      transactionCurrentMeterValue += this.transactionMeterValues[index];
      // Add time
      this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');
      // Send consumption meter value
      response = await this.chargingStationContext.sendConsumptionMeterValue(
        this.newTransaction.connectorId,
        this.newTransaction.transactionId,
        transactionCurrentMeterValue,
        this.transactionCurrentTime,
        withSoC,
        this.transactionMeterSoCValues[index]);
      expect(response.data).to.eql({});
      // Check the Consumption
      response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
      expect(response.data).to.deep.include({
        currentConsumption: (this.transactionMeterValues[index] * this.transactionMeterValueIntervalSecs),
        currentTotalConsumption: (transactionCurrentMeterValue - this.transactionStartMeterValue)
      });
      if (withSoC) {
        expect(response.data).to.deep.include({
          currentStateOfCharge: this.transactionMeterSoCValues[index]
        });
      } else {
        expect(response.data).to.deep.include({
          stateOfCharge: this.newTransaction.stateOfCharge
        });
      }
    }
    // Send Transaction.End
    response = await this.chargingStationContext.sendEndMeterValue(
      this.newTransaction.connectorId,
      this.newTransaction.transactionId,
      this.transactionEndMeterValue,
      this.transactionEndSoC,
      this.transactionEndSignedData,
      moment(this.transactionCurrentTime),
      withSoC,
      withSignedData);
    if (response) {
      expect(response.data).to.eql({});
    }
    // Check the Transaction End
    response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    if (withSoC) {
      expect(response.data).to.deep.include({
        currentStateOfCharge: this.transactionEndSoC
      });
    } else {
      expect(response.data).to.deep.include({
        stateOfCharge: this.newTransaction.stateOfCharge
      });
    }
  }

  public async testStopTransaction(withSoC = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    expect(this.transactionCurrentTime).to.not.be.null;

    // Set end time
    this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');

    // Stop the Transaction
    let response = await this.chargingStationContext.stopTransaction(this.newTransaction.id, this.transactionStopUser.tagIDs[0], this.transactionEndMeterValue, this.transactionCurrentTime);
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');

    // Set the connector to Available
    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Check the Transaction
    response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    expect(response.data).to.deep['containSubset']({
      'isLoading': false,
      //      'stateOfCharge': (withSoC ? this.transactionStartSoC : 0),
      'stop': {
        'meterStop': this.transactionEndMeterValue,
        'totalConsumption': this.transactionTotalConsumption,
        'totalInactivitySecs': this.transactionTotalInactivity,
        'totalDurationSecs': moment.duration(moment(this.transactionCurrentTime).diff(this.newTransaction.timestamp)).asSeconds(),
        'price': this.totalPrice,
        'priceUnit': 'EUR',
        'pricingSource': 'simple',
        'roundedPrice': parseFloat(this.totalPrice.toFixed(2)),
        'tagID': this.transactionStopUser.tagIDs[0],
        'timestamp': this.transactionCurrentTime.toISOString(),
        'stateOfCharge': (withSoC ? this.transactionEndSoC : 0),
        'user': {
          'id': this.transactionStopUser.id,
          'name': this.transactionStopUser.name,
          'firstName': this.transactionStopUser.firstName
        }
      }
    });
  }

  public async testTransactionMetrics(withSoC = false, withSignedData = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;

    // Get the Consumption
    if (!this.newTransaction.id) {
      console.log(this.newTransaction);
    }
    const response = await this.centralUserService.transactionApi.readAllConsumption({ TransactionId: this.newTransaction.id });
    expect(response.status).to.equal(200);
    // Check Headers
    expect(response.data).to.deep['containSubset']({
      'chargeBoxID': this.newTransaction.chargeBoxID,
      'connectorId': this.newTransaction.connectorId,
      //      'stateOfCharge': (withSoC ? this.transactionStartSoC : 0),
      'signedData': (withSignedData ? this.transactionSignedData : ''),
      'stop': {
        'price': this.totalPrice,
        'pricingSource': 'simple',
        'roundedPrice': parseFloat(this.totalPrice.toFixed(2)),
        'tagID': this.transactionStopUser.tagIDs[0],
        'totalConsumption': this.transactionTotalConsumption,
        'totalInactivitySecs': this.transactionTotalInactivity,
        'stateOfCharge': (withSoC ? this.transactionEndSoC : 0),
        'signedData': (withSignedData ? this.transactionEndSignedData : ''),
        'user': {
          'id': this.transactionStopUser.id,
          'name': this.transactionStopUser.name,
          'firstName': this.transactionStopUser.firstName
        }
      },
      'id': this.newTransaction.id,
      'user': {
        'id': this.transactionStartUser.id,
        'name': this.transactionStartUser.name,
        'firstName': this.transactionStartUser.firstName
      }
    });
    // Init
    const transactionCurrentTime = moment(this.newTransaction.timestamp);
    let transactionCumulatedConsumption = this.transactionStartMeterValue;
    // Check Consumption
    for (let i = 0; i < response.data.values.length; i++) {
      // Get the value
      const value = response.data.values[i];
      // Check
      expect(value).to.include({
        'chargeBoxID': this.newTransaction.chargeBoxID,
        'connectorId': this.newTransaction.connectorId,
        'date': transactionCurrentTime.toISOString(),
        'value': (i > 0 ? this.transactionMeterValues[i - 1] * this.transactionMeterValueIntervalSecs : this.transactionStartMeterValue),
        'cumulated': transactionCumulatedConsumption
      });
      if (withSoC) {
        // Check
        expect(value).to.include({
          'stateOfCharge': (i > 0 ? this.transactionMeterSoCValues[i - 1] : this.transactionStartSoC)
        });
      }
      // Add time
      transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');
      // Sum
      transactionCumulatedConsumption += this.transactionMeterValues[i];
    }
  }

  public async testDeleteTransaction(noAuthorization = false) {
    // Delete the created entity
    expect(this.newTransaction).to.not.be.null;
    let response = await this.transactionStartUserService.transactionApi.delete(this.newTransaction.id);
    if (noAuthorization) {
      expect(response.status).to.equal(560);
      // Transaction must be deleted by Admin user
      response = await this.centralUserService.transactionApi.delete(this.newTransaction.id);
    }
    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('status');
    expect(response.data.status).to.be.eql('Success');
    this.newTransaction = null;
  }

  public async testConnectorStatusToStopTransaction() {
    // Check on Transaction
    this.newTransaction = null;
    expect(this.chargingStationConnector1.status).to.eql('Available');

    // Start a new Transaction
    await this.testStartTransaction();
    const transactionId = this.newTransaction.id;
    expect(transactionId).to.not.equal(0);

    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.errorCode = 'NoError';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update Status of Connector 1
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
    // Send Heartbeat to have an active charger
    response = await this.chargingStationContext.sendHeartbeat();
    // Now we can test the connector status!
    response = await this.chargingStationContext.readChargingStation();
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    // Check Connector1
    const foundChargingStation = response.data;
    expect(foundChargingStation.connectors).to.not.be.null;
    expect(foundChargingStation.connectors[0]).to.include({ status: this.chargingStationConnector1.status, errorCode: this.chargingStationConnector1.errorCode });
    // Check Transaction
    this.newTransaction = (await this.centralUserService.transactionApi.readById(transactionId)).data;
    expect(this.newTransaction.message).to.contain('does not exist');
  }

  public async testAuthorizeTagAsInteger() {
    await this.testAuthorize(this.numberTag, 'Accepted');
    await this.testAuthorize(this.numberTag.toString(), 'Accepted');
  }

  public async testAuthorizeInvalidTag() {
    await this.testAuthorize(this.invalidTag, 'Invalid');
    await this.testAuthorize('', 'Invalid');
    await this.testAuthorize(null, 'Invalid');
  }

  public async testAuthorizeUnknownTag() {
    const unknownTag = faker.random.alphaNumeric(8);
    await this.testAuthorize(unknownTag, 'Invalid');

    const usersResponse = await this.centralUserService.userApi.getByTag(unknownTag);
    expect(usersResponse.status).eq(200);
    expect(usersResponse.data.count).eq(1);
    const user = usersResponse.data.result[0];
    this.createdUsers.push(user);
    expect(user.name).eq('Unknown');
    expect(user.firstName).eq('User');
    expect(user.email).eq(`${unknownTag}@e-mobility.com`);
    expect(user.role).eq('B');
    expect(user.tagIDs.length).eq(1);
    expect(user.tagIDs[0]).eq(unknownTag);
  }

  public async testStartTransactionWithTagAsInteger() {
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag,
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
    response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
  }

  public async testStartTransactionWithConnectorIdAsString() {
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId.toString(),
      this.numberTag.toString(),
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
  }

  public async testStartTransactionWithMeterStartAsString() {
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      '0',
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
  }

  public async testStartTransactionWithMeterStartGreaterZero() {
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      faker.random.number(100000),
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
  }

  public async testStartTransactionWithInvalidTag() {
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.invalidTag,
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
    response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      '',
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
    response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      null,
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
  }

  public async testStartTransactionWithInvalidConnectorId() {
    let response = await this.chargingStationContext.startTransaction(
      'bla',
      this.numberTag.toString(),
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
    response = await this.chargingStationContext.startTransaction(
      '',
      this.numberTag.toString(),
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
    response = await this.chargingStationContext.startTransaction(
      -1,
      this.numberTag.toString(),
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
    response = await this.chargingStationContext.startTransaction(
      null,
      this.numberTag.toString(),
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
  }

  public async testStartTransactionWithInvalidMeterStart() {
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      'bla',
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
    response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      '',
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
    response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      undefined,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus('Invalid');
  }

  public async testStopTransactionWithoutTransactionData() {
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      this.transactionStartMeterValue,
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    this.transactionCurrentTime = moment();
    const stopValue = this.transactionStartMeterValue + faker.random.number(100000);
    response = await this.chargingStationContext.stopTransaction(transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime);
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
  }

  public async testStopTransactionWithTransactionData() {
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      this.transactionStartMeterValue,
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    this.transactionCurrentTime = moment();
    const stopValue = this.transactionStartMeterValue + faker.random.number(100000);
    let transactionData;
    if (this.chargingStationContext.getChargingStation().ocppVersion === '1.6') {
      transactionData = [
        {
          'timestamp': this.transactionStartTime.toISOString(),
          'sampledValue': [
            {
              'value': this.transactionStartMeterValue,
              'context': 'Transaction.Begin',
              'format': 'Raw',
              'measurand': 'Energy.Active.Import.Register',
              'location': 'Outlet',
              'unit': 'Wh'
            }
          ]
        },
        {
          'timestamp': this.transactionCurrentTime.toISOString(),
          'sampledValue': [
            {
              'value': stopValue,
              'context': 'Transaction.End',
              'format': 'Raw',
              'measurand': 'Energy.Active.Import.Register',
              'location': 'Outlet',
              'unit': 'Wh'
            }
          ]
        }
      ];
    } else {
      transactionData = {
        'values': [
          {
            'timestamp': this.transactionStartTime.toISOString(),
            'value': {
              'attributes': {
                'context': 'Transaction.Begin',
                'format': 'Raw',
                'location': 'Outlet',
                'measurand': 'Energy.Active.Import.Register',
                'unit': 'Wh'
              },
              '$value': this.transactionStartMeterValue,
            }
          },
          {
            'timestamp': this.transactionCurrentTime.toISOString(),
            'value': {
              'attributes': {
                'context': 'Transaction.End',
                'format': 'Raw',
                'location': 'Outlet',
                'measurand': 'Energy.Active.Import.Register',
                'unit': 'Wh'
              },
              '$value': stopValue
            }
          }
        ]
      };
    }
    response = await this.chargingStationContext.stopTransaction(transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime, transactionData);
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
  }

  public async testStopTransactionWithInvalidTransactionData() {
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      this.transactionStartMeterValue,
      this.transactionStartTime
    );
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    this.transactionCurrentTime = moment();
    const stopValue = this.transactionStartMeterValue + faker.random.number(100000);
    let transactionData;
    // Provide TransactionData for wrong OCPP Version
    if (this.chargingStationContext.getChargingStation().ocppVersion === '1.5') {
      transactionData = [
        {
          'timestamp': this.transactionStartTime.toISOString(),
          'sampledValue': [
            {
              'value': this.transactionStartMeterValue,
              'context': 'Transaction.Begin',
              'format': 'Raw',
              'measurand': 'Energy.Active.Import.Register',
              'location': 'Outlet',
              'unit': 'Wh'
            }
          ]
        },
        {
          'timestamp': this.transactionCurrentTime.toISOString(),
          'sampledValue': [
            {
              'value': stopValue,
              'context': 'Transaction.End',
              'format': 'Raw',
              'measurand': 'Energy.Active.Import.Register',
              'location': 'Outlet',
              'unit': 'Wh'
            }
          ]
        }
      ];
    } else {
      transactionData = {
        'values': [
          {
            'timestamp': this.transactionStartTime.toISOString(),
            'value': {
              'attributes': {
                'context': 'Transaction.Begin',
                'format': 'Raw',
                'location': 'Outlet',
                'measurand': 'Energy.Active.Import.Register',
                'unit': 'Wh'
              },
              '$value': this.transactionStartMeterValue,
            }
          },
          {
            'timestamp': this.transactionCurrentTime.toISOString(),
            'value': {
              'attributes': {
                'context': 'Transaction.End',
                'format': 'Raw',
                'location': 'Outlet',
                'measurand': 'Energy.Active.Import.Register',
                'unit': 'Wh'
              },
              '$value': stopValue
            }
          }
        ]
      };
    }
    response = await this.chargingStationContext.stopTransaction(transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime, transactionData);
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Invalid');
    // Now stop the transaction without Transaction Data
    response = await this.chargingStationContext.stopTransaction(transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime);
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
  }

  public async testRetrieveLastRebootDate() {
    const bootNotification = await this.chargingStationContext.sendBootNotification();
    expect(bootNotification.data).to.not.be.null;
    expect(bootNotification.data.status).to.eql('Accepted');
    expect(bootNotification.data).to.have.property('currentTime');
    let chargingStationResponse = await this.chargingStationContext.readChargingStation();
    if (this.chargingStationContext.getChargingStation().ocppVersion === '1.6') {
      expect(bootNotification.data.currentTime).to.equal(chargingStationResponse.data.lastReboot);
    } else {
      expect(bootNotification.data.currentTime.toISOString()).to.equal(chargingStationResponse.data.lastReboot);
    }
    const bootNotification2 = await this.chargingStationContext.sendBootNotification();
    chargingStationResponse = await this.chargingStationContext.readChargingStation();
    if (this.chargingStationContext.getChargingStation().ocppVersion === '1.6') {
      expect(bootNotification2.data.currentTime).to.equal(chargingStationResponse.data.lastReboot);
    } else {
      expect(bootNotification2.data.currentTime.toISOString()).to.equal(chargingStationResponse.data.lastReboot);
    }
    expect(bootNotification.data.currentTime).to.not.equal(bootNotification2.data.currentTime);
    if (this.chargingStationContext.getChargingStation().ocppVersion === '1.6') {
      expect(new Date(bootNotification.data.currentTime)).to.beforeTime(new Date(bootNotification2.data.currentTime));
    } else {
      expect(bootNotification.data.currentTime).to.beforeTime(bootNotification2.data.currentTime);
    }
  }

  public async testTransactionIgnoringClockMeterValues() {
    const meterStart = 0;
    let meterValue = meterStart;
    const currentTime = moment();
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      meterValue,
      currentTime
    );
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      meterValue += 300,
      currentTime.add(1, 'minute').clone()
    );
    expect(response.data).to.eql({});
    response = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      meterValue += 300,
      currentTime.add(1, 'minute').clone()
    );
    expect(response.data).to.eql({});
    response = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      meterValue += 300,
      currentTime.add(1, 'minute').clone()
    );
    expect(response.data).to.eql({});
    response = await this.chargingStationContext.sendClockMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      0,
      currentTime.clone()
    );
    expect(response.data).to.eql({});
    response = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      meterValue += 300,
      currentTime.add(1, 'minute').clone()
    );
    expect(response.data).to.eql({});
    response = await this.chargingStationContext.stopTransaction(
      transactionId,
      this.numberTag.toString(),
      meterValue, currentTime.add(1, 'minute').clone()
    );
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    response = await this.centralUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.deep['containSubset']({
      id: transactionId,
      meterStart: meterStart,
      stop: {
        totalConsumption: meterValue - meterStart,
        totalInactivitySecs: 60
      }
    });
  }

  private async createUser(user = Factory.user.build()) {
    const createdUser = await this.centralUserService.createEntity(this.centralUserService.userApi, user);
    return createdUser;
  }

  private async testAuthorize(tagId, expectedStatus) {
    const response = await this.chargingStationContext.authorize(tagId);
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal(expectedStatus);
  }

  private async validateStartedTransaction(response, chargingStationConnector, startMeterValue, startTime) {
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    expect(response.data).to.have.property('transactionId');
    expect(response.data.transactionId).to.not.equal(0);
    const transactionId = response.data.transactionId;
    // Update connector status
    chargingStationConnector.status = 'Occupied';
    chargingStationConnector.timestamp = new Date().toISOString();
    let responseValidate = await this.chargingStationContext.setConnectorStatus(chargingStationConnector);
    // Check connector status
    expect(responseValidate.data).to.eql({});
    responseValidate = await this.basicTransactionValidation(transactionId, chargingStationConnector.connectorId, startMeterValue, startTime.toISOString());
    expect(responseValidate.data).to.deep.include({
      currentConsumption: 0,
      currentCumulatedPrice: 0,
      currentStateOfCharge: 0,
      currentTotalConsumption: 0,
      currentTotalInactivitySecs: 0,
      isLoading: false,
      price: 0,
      roundedPrice: 0,
    });
  }

  private async basicTransactionValidation(transactionId, connectorId, meterStart, timestamp) {
    const response = await this.centralUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.deep['containSubset']({
      'id': transactionId,
      'timestamp': timestamp,
      'chargeBoxID': this.chargingStationContext.getChargingStation().id,
      'connectorId': connectorId,
      'tagID': this.transactionStartUser.tagIDs[0],
      'meterStart': meterStart,
      'user': {
        'id': this.transactionStartUser.id,
        'name': this.transactionStartUser.name,
        'firstName': this.transactionStartUser.firstName
      }
    });

    return response;
  }

}
