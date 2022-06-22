import { BillingAccount, BillingInvoice, BillingInvoiceStatus, BillingTransfer } from '../../types/Billing';
import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'BillingStorage';

export default class BillingStorage {
  public static async getInvoice(tenant: Tenant, id: string = Constants.UNKNOWN_OBJECT_ID, params: { userIDs?: string[] } = {}, projectFields?: string[]): Promise<BillingInvoice> {
    const invoicesMDB = await BillingStorage.getInvoices(tenant, {
      invoiceIDs: [id], userIDs: params.userIDs
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return invoicesMDB.count === 1 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoiceByInvoiceID(tenant: Tenant, id: string): Promise<BillingInvoice> {
    const invoicesMDB = await BillingStorage.getInvoices(tenant, {
      billingInvoiceID: id
    }, Constants.DB_PARAMS_SINGLE_RECORD);
    return invoicesMDB.count === 1 ? invoicesMDB.result[0] : null;
  }

  public static async getInvoices(tenant: Tenant,
      params: {
        invoiceIDs?: string[]; billingInvoiceID?: string; search?: string; userIDs?: string[]; invoiceStatus?: BillingInvoiceStatus[];
        startDateTime?: Date; endDateTime?: Date; liveMode?: boolean
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingInvoice>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Search filters
    const filters: FilterParams = {};
    // Search
    // Filter by other properties
    if (params.search) {
      filters.$or = [
        { 'number': { $regex: params.search, $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.invoiceIDs)) {
      filters._id = {
        $in: params.invoiceIDs.map((invoiceID) => DatabaseUtils.convertToObjectID(invoiceID))
      };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.userID = {
        $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID))
      };
    }
    if (params.billingInvoiceID) {
      filters.invoiceID = { $eq: params.billingInvoiceID };
    }
    // liveMode (to clear test data)
    if (params.liveMode) {
      filters.liveMode = { $eq: params.liveMode };
    }
    // Status
    if (!Utils.isEmptyArray(params.invoiceStatus)) {
      filters.status = {
        $in: params.invoiceStatus
      };
    }
    if (params.startDateTime || params.endDateTime) {
      filters.createdOn = {};
    }
    // Start date
    if (params.startDateTime) {
      filters.createdOn.$gte = Utils.convertToDate(params.startDateTime);
    }
    // End date
    if (params.endDateTime) {
      filters.createdOn.$lte = Utils.convertToDate(params.endDateTime);
    }
    // Set filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const invoicesCountMDB = await global.database.getCollection<any>(tenant.id, 'invoices')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getInvoices', startTime, aggregation, invoicesCountMDB);
      return {
        count: (invoicesCountMDB.length > 0 ? invoicesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { _id: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'userID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'userID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const invoicesMDB = await global.database.getCollection<any>(tenant.id, 'invoices')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as BillingInvoice[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getInvoices', startTime, aggregation, invoicesMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(invoicesCountMDB[0]),
      result: invoicesMDB
    };
  }

  public static async saveInvoice(tenant: Tenant, invoiceToSave: BillingInvoice): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Build Request
    // Properties to save
    const invoiceMDB: any = {
      _id: invoiceToSave.id ? DatabaseUtils.convertToObjectID(invoiceToSave.id) : new ObjectId(),
      invoiceID: invoiceToSave.invoiceID,
      // eslint-disable-next-line id-blacklist
      number: invoiceToSave.number,
      liveMode: Utils.convertToBoolean(invoiceToSave.liveMode),
      userID: invoiceToSave.userID ? DatabaseUtils.convertToObjectID(invoiceToSave.userID) : null,
      customerID: invoiceToSave.customerID,
      amount: Utils.convertToFloat(invoiceToSave.amount),
      amountPaid: Utils.convertToFloat(invoiceToSave.amountPaid),
      status: invoiceToSave.status,
      currency: invoiceToSave.currency,
      createdOn: Utils.convertToDate(invoiceToSave.createdOn),
      downloadable: Utils.convertToBoolean(invoiceToSave.downloadable),
      downloadUrl: invoiceToSave.downloadUrl,
      payInvoiceUrl: invoiceToSave.payInvoiceUrl
    };
    if (invoiceToSave.sessions) {
      invoiceMDB.sessions = invoiceToSave.sessions;
    }
    if (invoiceToSave.lastError) {
      invoiceMDB.lastError = invoiceToSave.lastError;
    }
    // Modify and return the modified document
    await global.database.getCollection<any>(tenant.id, 'invoices').findOneAndUpdate(
      { _id: invoiceMDB._id },
      { $set: invoiceMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveInvoice', startTime, invoiceMDB);
    return invoiceMDB._id.toString();
  }

  public static async deleteInvoice(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete the Invoice
    await global.database.getCollection<any>(tenant.id, 'invoices')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteInvoice', startTime, { id });
  }

  public static async deleteInvoiceByInvoiceID(tenant: Tenant, id: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Delete the Invoice
    await global.database.getCollection<any>(tenant.id, 'invoices')
      .findOneAndDelete({ 'invoiceID': id });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteInvoiceByInvoiceID', startTime, { id });
  }

  public static async saveSubAccount(tenant: Tenant, subAccount: BillingAccount): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Build Request
    // Properties to save
    const subAccountMDB: any = {
      _id: subAccount.id ? DatabaseUtils.convertToObjectID(subAccount.id) : new ObjectId(),
      accountExternalID: subAccount.accountExternalID,
      status: subAccount.status,
      businessOwnerID: DatabaseUtils.convertToObjectID(subAccount.businessOwnerID)
    };
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(subAccountMDB, subAccount);
    // Save
    await global.database.getCollection<any>(tenant.id, 'billingsubaccounts').findOneAndUpdate(
      { _id: subAccountMDB._id },
      { $set: subAccountMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveSubAccount', startTime, subAccountMDB);
    return subAccountMDB._id.toString();
  }

  public static async getSubAccounts(tenant: Tenant,
      params: {
        IDs?: string[], accountExternalIDs?: string[], search?: string, userIDs?: string[], status?: string[]
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingAccount>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Search filters
    const filters: FilterParams = {};
    // Search
    // Filter by other properties
    if (params.search) {
      filters.$or = [
        { 'accountExternalID': { $regex: params.search, $options: 'i' } }
      ];
    }
    if (!Utils.isEmptyArray(params.IDs)) {
      filters._id = {
        $in: params.IDs.map((id) => DatabaseUtils.convertToObjectID(id))
      };
    }
    if (!Utils.isEmptyArray(params.accountExternalIDs)) {
      filters.accountExternalID = {
        $in: params.accountExternalIDs
      };
    }
    if (!Utils.isEmptyArray(params.userIDs)) {
      filters.businessOwnerID = {
        $in: params.userIDs.map((userID) => DatabaseUtils.convertToObjectID(userID))
      };
    }
    // Set filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const subAccountCountMDB = await global.database.getCollection<any>(tenant.id, 'billingsubaccounts')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSubAccounts', startTime, aggregation, subAccountCountMDB);
      return {
        count: (subAccountCountMDB.length > 0 ? subAccountCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { _id: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add Users
    DatabaseUtils.pushUserLookupInAggregation({
      tenantID: tenant.id, aggregation: aggregation, asField: 'user', localField: 'businessOwnerID',
      foreignField: '_id', oneToOneCardinality: true, oneToOneCardinalityNotNull: false
    });
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'businessOwnerID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const subAccountMDB = await global.database.getCollection<any>(tenant.id, 'billingsubaccounts')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as BillingAccount[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getSubAccounts', startTime, aggregation, subAccountMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(subAccountCountMDB[0]),
      result: subAccountMDB
    };
  }

  public static async getSubAccountByID(tenant: Tenant, id: string, projectFields?: string[]): Promise<BillingAccount> {
    const subAccountMDB = await BillingStorage.getSubAccounts(tenant, {
      IDs: [id]
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return subAccountMDB.count === 1 ? subAccountMDB.result[0] : null;
  }

  public static async saveTransfer(tenant: Tenant, transfer: BillingTransfer): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Build Request
    // Properties to save
    const transferMDB: any = {
      _id: transfer.id ? DatabaseUtils.convertToObjectID(transfer.id) : new ObjectId(),
      status: transfer.status,
      totalAmount: transfer.totalAmount,
      transferAmount: transfer.transferAmount,
      accountID: DatabaseUtils.convertToObjectID(transfer.accountID),
      transferExternalID: transfer.transferExternalID,
      sessions: transfer.sessions.map((session) => ({
        transactionID: session.transactionID,
        invoiceID: session.invoiceID,
        invoiceNumber: session.invoiceNumber,
        amountAsDecimal: session.amountAsDecimal,
        amount: session.amount,
        roundedAmount: session.roundedAmount,
        platformFeeStrategy: session.platformFeeStrategy,
      }))
    };
    if (transfer.platformFeeData) {
      transferMDB.platformFeeData = {
        taxExternalID: transfer.platformFeeData.taxExternalID,
        feeAmount: transfer.platformFeeData.feeAmount,
        feeTaxAmount: transfer.platformFeeData.feeTaxAmount,
        invoiceExternalID: transfer.platformFeeData.invoiceExternalID
      };
    }
    // Check Created/Last Changed By
    DatabaseUtils.addLastChangedCreatedProps(transferMDB, transfer);
    // Save
    await global.database.getCollection<any>(tenant.id, 'billingtransfers').findOneAndUpdate(
      { _id: transferMDB._id },
      { $set: transferMDB },
      { upsert: true, returnDocument: 'after' }
    );
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'saveTransfer', startTime, transferMDB);
    return transferMDB._id.toString();
  }

  public static async getTransfers(tenant: Tenant,
      params: {
        IDs?: string[], status?: string[], accountIDs?: string[], search?: string, transferExternalIDs?: string[]
      } = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<BillingTransfer>> {
    const startTime = Logging.traceDatabaseRequestStart();
    DatabaseUtils.checkTenantObject(tenant);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Search filters
    const filters: FilterParams = {};
    // Search
    // Filter by other properties
    if (params.search) {
      filters.$or = [
        { 'id': { $regex: params.search, $options: 'i' } },
        { 'accountID': { $regex: params.search, $options: 'i' } },
        { 'transferExternalID': { $regex: params.search, $options: 'i' } },
      ];
    }
    if (!Utils.isEmptyArray(params.IDs)) {
      filters._id = {
        $in: params.IDs.map((id) => DatabaseUtils.convertToObjectID(id))
      };
    }
    if (!Utils.isEmptyArray(params.status)) {
      filters.status = {
        $in: params.status
      };
    }
    if (!Utils.isEmptyArray(params.accountIDs)) {
      filters.accountID = {
        $in: params.accountIDs.map((accountID) => DatabaseUtils.convertToObjectID(accountID))
      };
    }
    if (!Utils.isEmptyArray(params.transferExternalIDs)) {
      filters.transferExternalID = {
        $in: params.transferExternalIDs.map((transferExternalID) => DatabaseUtils.convertToObjectID(transferExternalID))
      };
    }
    // Set filters
    if (!Utils.isEmptyJSon(filters)) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const transferCountMDB = await global.database.getCollection<any>(tenant.id, 'billingtransfers')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransfers', startTime, aggregation, transferCountMDB);
      return {
        count: (transferCountMDB.length > 0 ? transferCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { _id: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Add Last Changed / Created
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenant.id, aggregation);
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Convert Object ID to string
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'accountID');
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const transferMDB = await global.database.getCollection<any>(tenant.id, 'billingtransfers')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as BillingTransfer[];
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'getTransfers', startTime, aggregation, transferMDB);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(transferCountMDB[0]),
      result: transferMDB
    };
  }

  public static async getTransferByID(tenant: Tenant, id: string, projectFields?: string[]): Promise<BillingTransfer> {
    const transferMDB = await BillingStorage.getTransfers(tenant, {
      IDs: [id]
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return transferMDB.count === 1 ? transferMDB.result[0] : null;
  }
}
