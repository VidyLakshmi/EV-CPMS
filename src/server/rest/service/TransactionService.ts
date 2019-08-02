import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import moment from 'moment';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import ConcurConnector from '../../../integration/refund/ConcurConnector';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import OCPPService from '../../../server/ocpp/services/OCPPService';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import SynchronizeRefundTransactionsTask from '../../../scheduler/tasks/SynchronizeRefundTransactionsTask';
import Tenant from '../../../entity/Tenant';
import TransactionSecurity from './security/TransactionSecurity';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import OCPPUtils from '../../ocpp/utils/OCPPUtils';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UtilsService from './UtilsService';
import Transaction from '../../../types/Transaction';
import Utils from '../../../utils/Utils';

export default class TransactionService {
  public static async handleSynchronizeRefundedTransactions(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!Authorizations.isAdmin(req.user.role)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_TRANSACTION,
        null,
        Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleSynchronizeRefundedTransactions',
        req.user);
    }

    const tenant = await TenantStorage.getTenant(req.user.tenantID);
    const task = new SynchronizeRefundTransactionsTask();
    await task.processTenant(tenant, null);

    const response: any = {
      ...Constants.REST_RESPONSE_SUCCESS,
    };
    res.json(response);
    next();
  }

  public static async handleRefundTransactions(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterTransactionsRefund(req.body);
    if (!filteredRequest.transactionIds) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Transaction IDs must be provided', Constants.HTTP_GENERAL_ERROR,
        'TransactionService', 'handleRefundTransactions', req.user);
    }
    const transactionsToRefund: Transaction[] = [];
    for (const transactionId of filteredRequest.transactionIds) {
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
      if (!transaction) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: 'TransactionService', method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' does not exist`,
          action: action, detailedMessages: transaction.id
        });
        continue;
      }
      if (transaction.refundData && !!transaction.refundData.refundId && transaction.refundData.status !== Constants.REFUND_STATUS_CANCELLED) {
        Logging.logError({
          tenantID: req.user.tenantID,
          user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
          module: 'TransactionService', method: 'handleRefundTransactions',
          message: `Transaction '${transaction.id}' is already refunded`,
          action: action, detailedMessages: transaction
        });
        continue;
      }
      // Check auth
      if (!Authorizations.canRefundTransaction(req.user, transaction)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_REFUND_TRANSACTION,
          Constants.ENTITY_TRANSACTION,
          transaction.id,
          Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleRefundTransactions',
          req.user);
      }
      transactionsToRefund.push(transaction);
    }
    if (transactionsToRefund.length === 0) {
      res.json({
        ...Constants.REST_RESPONSE_SUCCESS,
        inSuccess: 0,
        inError: filteredRequest.transactionIds.length
      });
      next();
      return;
    }
    // Get Transaction User
    const user = await UserStorage.getUser(req.user.tenantID, req.user.id);
    // Check
    UtilsService.assertObjectExists(user, `User '${req.user.id}' doesn't exist.`, 'TransactionService', 'handleRefundTransactions', req.user);
    if (!transactionsToRefund.every((tr) => tr.userID === req.user.id)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with ID '${req.user.id}' cannot refund another user's transaction`,
        Constants.HTTP_REFUND_SESSION_OTHER_USER_ERROR,
        'TransactionService', 'handleRefundTransactions', req.user);
    }
    let setting = await SettingStorage.getSettingByIdentifier(req.user.tenantID, 'refund');
    setting = setting.getContent()['concur'];
    const connector = new ConcurConnector(req.user.tenantID, setting);
    const refundedTransactions = await connector.refund(user.id, transactionsToRefund);
    // // Transfer it to the Revenue Cloud
    // pragma await Utils.pushTransactionToRevenueCloud(action, transaction, req.user, transaction.getUserJson());

    const response: any = {
      ...Constants.REST_RESPONSE_SUCCESS,
      inSuccess: refundedTransactions.length
    };
    const notRefundedTransactions = transactionsToRefund.length - refundedTransactions.length;
    if (notRefundedTransactions > 0) {
      response.inError = notRefundedTransactions;
    }
    res.json(response);
    next();
  }

  public static async handleDeleteTransaction(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
      // Filter
      const ID = TransactionSecurity.filterTransactionDelete(req.query);
      // Check auth
      if (!Authorizations.canDeleteTransaction(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_TRANSACTION,
          ID,
          Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleDeleteTransaction',
          req.user);
      }
      // Transaction Id is mandatory
      UtilsService.assertIdIsProvided(ID, 'TransactionsService', 'handleDeleteTransaction', req.user);
      // Get Transaction
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, ID);
      // Found?
      UtilsService.assertObjectExists(transaction, `Transaction '${ID}' doesn't exist`, 'TransactionService', 'handleDeleteTransaction', req.user);
      // Handle active transactions
      const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
      if (!transaction.stop) {
        UtilsService.assertObjectExists(chargingStation, `ChargingStation ${transaction.chargeBoxID} doesn't exist`, 'TransactionService', 'handleDeleteTransaction', req.user);
        const foundConnector = chargingStation.connectors.find((connector) => connector.connectorId === transaction.connectorId);
        if (foundConnector && transaction.id === foundConnector.activeTransactionID) {
          OCPPUtils.checkAndFreeChargingStationConnector(req.user.tenantID, chargingStation, transaction.connectorId);
          await ChargingStationStorage.saveChargingStation(req.user.tenantID, chargingStation);
        }
      }
      // Delete Transaction
      await TransactionStorage.deleteTransaction(req.user.tenantID, transaction);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, actionOnUser: (transaction.user ? transaction.user : null),
        module: 'TransactionService', method: 'handleDeleteTransaction',
        message: `Transaction ID '${ID}' on '${transaction.chargeBoxID}'-'${transaction.connectorId}' has been deleted successfully`,
        action: action, detailedMessages: transaction
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
  }

  public static async handleTransactionSoftStop(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
      // Filter
      const transactionId = TransactionSecurity.filterTransactionSoftStop(req.body);
      // Check auth
      if (!Authorizations.canUpdateTransaction(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_TRANSACTION,
          transactionId,
          Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleTransactionSoftStop',
          req.user);
      }
      // Transaction Id is mandatory
      UtilsService.assertIdIsProvided(transactionId, 'TransactionService', 'handleTransactionSoftStop', req.user);
      // Get Transaction
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, transactionId);
      UtilsService.assertObjectExists(transaction, `Transaction ${transactionId} doesn't exist.`, 'TransactionService', 'handleTransactionSoftStop', req.user);
      // Get the Charging Station
      const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, transaction.chargeBoxID);
      UtilsService.assertObjectExists(chargingStation, `Transaction ${transaction.chargeBoxID} doesn't exist.`, 'TransactionService', 'handleTransactionSoftStop', req.user);
      // Check User
      let user: User;
      if (!transaction.user && transaction.userID) {
        // Get Transaction User
        user = await UserStorage.getUser(req.user.tenantID, transaction.userID);
        // Check
        UtilsService.assertObjectExists(user, `User ${transaction.userID} doesn't exist.`, 'TransactionService', 'handleTransactionSoftStop', req.user);
      }
      // Stop Transaction
      const result = await new OCPPService().handleStopTransaction(
        {
          chargeBoxIdentity: chargingStation.id,
          tenantID: req.user.tenantID
        },
        {
          transactionId: transactionId,
          idTag: req.user.tagIDs[0],
          timestamp: transaction.lastMeterValue.timestamp,
          meterStop: transaction.lastMeterValue.value
        },
        true);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID, source: chargingStation.id,
        user: req.user, actionOnUser: user,
        module: 'TransactionService', method: 'handleTransactionSoftStop',
        message: `Transaction ID '${transactionId}' on '${transaction.chargeBoxID}'-'${transaction.connectorId}' has been stopped successfully`,
        action: action, detailedMessages: result
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
  }

  public static async handleGetChargingStationConsumptionFromTransaction(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const filteredRequest = TransactionSecurity.filterChargingStationConsumptionFromTransactionRequest(req.query, req.user);
    // Transaction Id is mandatory
    if (!filteredRequest.TransactionId) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Transaction\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
    }
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.TransactionId);
    if (!transaction) {
      // Not Found!
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Transaction '${filteredRequest.TransactionId}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
    }
    // Check auth
    if (!Authorizations.canReadTransaction(req.user, transaction)) {
      // Not Authorized!
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_TRANSACTION,
        transaction.getID(),
        Constants.HTTP_AUTH_ERROR, 'TransactionService', 'handleGetChargingStationConsumptionFromTransaction',
        req.user);
    }
    // Check dates
    if (filteredRequest.StartDateTime && filteredRequest.EndDateTime && moment(filteredRequest.StartDateTime).isAfter(moment(filteredRequest.EndDateTime))) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The requested start date '${new Date(filteredRequest.StartDateTime).toISOString()}' is after the requested end date '${new Date(filteredRequest.StartDateTime).toISOString()}' `, Constants.HTTP_GENERAL_ERROR,
        'TransactionService', 'handleGetChargingStationConsumptionFromTransaction', req.user);
    }
    // Get the consumption
    let consumptions = await transaction.getConsumptions();

    // Dates provided?
    const startDateTime = filteredRequest.StartDateTime ? filteredRequest.StartDateTime : Constants.MIN_DATE;
    const endDateTime = filteredRequest.EndDateTime ? filteredRequest.EndDateTime : Constants.MAX_DATE;
    // Filter?
    if (consumptions && (filteredRequest.StartDateTime || filteredRequest.EndDateTime)) {
      consumptions = consumptions.filter((consumption) =>
        moment(consumption.getEndedAt()).isBetween(startDateTime, endDateTime, null, '[]'));
    }
    // Return the result
    res.json(TransactionSecurity.filterConsumptionsFromTransactionResponse(transaction, consumptions, req.user));
    next();
  }

  static async handleGetTransaction(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Filter
      const filteredRequest = TransactionSecurity.filterTransactionRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Transaction\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'TransactionService', 'handleRefundTransactions', req.user);
      }
      // Get Transaction
      const transaction = await TransactionStorage.getTransaction(req.user.tenantID, filteredRequest.ID);
      // Found?
      if (!transaction) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Transaction '${filteredRequest.ID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'TransactionService', 'handleGetTransaction', req.user);
      }
      // Check auth
      if (!Authorizations.canReadTransaction(req.user, transaction)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_TRANSACTION,
          transaction.getID(),
          Constants.HTTP_AUTH_ERROR,
          'TransactionService', 'handleGetTransaction',
          req.user);
      }

      // Return
      res.json(
        // Filter
        TransactionSecurity.filterTransactionResponse(
          transaction, req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetChargingStationTransactions(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TRANSACTION,
          null,
          Constants.HTTP_AUTH_ERROR,
          'TransactionService', 'handleGetChargingStationTransactions',
          req.user);
      }
      // Filter
      const filteredRequest = TransactionSecurity.filterChargingStationTransactionsRequest(req.query, req.user);
      // Charge Box is mandatory
      if (!filteredRequest.ChargeBoxID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Charging Station\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'TransactionService', 'handleGetChargingStationTransactions', req.user);
      }
      // Connector Id is mandatory
      if (!filteredRequest.ConnectorId) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'The Connector\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
          'TransactionService', 'handleGetChargingStationTransactions', req.user);
      }
      // Get Charge Box
      const chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.ChargeBoxID);
      // Found?
      if (!chargingStation) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Charging Station with ID '${filteredRequest.ChargeBoxID}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'TransactionService', 'handleGetChargingStationTransactions', req.user);
      }
      // Set the model
      const transactions = await TransactionStorage.getTransactions(req.user.tenantID, {
        chargeBoxID: chargingStation.id, connectorId: filteredRequest.ConnectorId,
        startDateTime: filteredRequest.StartDateTime, endDateTime: filteredRequest.EndDateTime,
        withChargeBoxes: true
      }, Constants.DB_PARAMS_MAX_LIMIT);
      // Filter
      TransactionSecurity.filterTransactionsResponse(transactions, req.user);
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetTransactionYears(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Get Transactions
      const transactionsYears = await TransactionStorage.getTransactionYears(req.user.tenantID);
      const result: any = {};
      if (transactionsYears) {
        result.years = [];
        result.years.push(new Date().getFullYear());
      }
      // Return
      res.json(transactionsYears);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetTransactionsActive(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TRANSACTION,
          null,
          Constants.HTTP_AUTH_ERROR,
          'TransactionService', 'handleGetTransactionsActive',
          req.user);
      }
      const filter: any = { stop: { $exists: false } };
      // Filter
      const filteredRequest = TransactionSecurity.filterTransactionsActiveRequest(req.query, req.user);
      if (filteredRequest.ChargeBoxID) {
        filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
      }
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.SiteID) {
        filter.siteID = filteredRequest.SiteID;
      }
      if (filteredRequest.UserID) {
        filter.userIDs = filteredRequest.UserID.split('|');
      }
      if (Authorizations.isBasic(req.user.role)) {
        filter.userIDs = [req.user.id];
      }
      if (filteredRequest.ConnectorId) {
        filter.connectorId = filteredRequest.ConnectorId;
      }
      // Get Transactions
      const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
        { ...filter, 'withChargeBoxes': true },
        { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
      // Filter
      TransactionSecurity.filterTransactionsResponse(transactions, req.user);
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetTransactionsCompleted(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TRANSACTION,
          null,
          Constants.HTTP_AUTH_ERROR,
          'TransactionService', 'handleGetTransactionsCompleted',
          req.user);
      }
      const filter: any = { stop: { $exists: true } };
      // Filter
      const filteredRequest = TransactionSecurity.filterTransactionsCompletedRequest(req.query, req.user);
      if (filteredRequest.ChargeBoxID) {
        filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
      }
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.UserID) {
        filter.userIDs = filteredRequest.UserID.split('|');
      }
      if (Authorizations.isBasic(req.user.role)) {
        filter.userIDs = [req.user.id];
      }
      if (filteredRequest.StartDateTime) {
        filter.startDateTime = filteredRequest.StartDateTime;
      }
      if (filteredRequest.EndDateTime) {
        filter.endDateTime = filteredRequest.EndDateTime;
      }
      if (filteredRequest.Type) {
        filter.type = filteredRequest.Type;
      }
      if (filteredRequest.MinimalPrice) {
        filter.minimalPrice = filteredRequest.MinimalPrice;
      }
      if (filteredRequest.Statistics) {
        filter.statistics = filteredRequest.Statistics;
      }
      const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
        {
          ...filter,
          'search': filteredRequest.Search,
          'siteID': filteredRequest.SiteID
        },
        { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
      // Filter
      TransactionSecurity.filterTransactionsResponse(transactions, req.user);
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetTransactionsExport(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListTransactions(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TRANSACTIONS,
          null,
          Constants.HTTP_AUTH_ERROR,
          'TransactionService', 'handleGetTransactionsExport',
          req.user);
      }
      const filter: any = { stop: { $exists: true } };
      // Filter
      const filteredRequest = TransactionSecurity.filterTransactionsCompletedRequest(req.query, req.user);
      if (filteredRequest.ChargeBoxID) {
        filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
      }
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.UserID) {
        filter.userIDs = filteredRequest.UserID.split('|');
      }
      if (Authorizations.isBasic(req.user.role)) {
        filter.userIDs = [req.user.id];
      }
      // Date
      if (filteredRequest.StartDateTime) {
        filter.startDateTime = filteredRequest.StartDateTime;
      }
      if (filteredRequest.EndDateTime) {
        filter.endDateTime = filteredRequest.EndDateTime;
      }
      if (filteredRequest.Type) {
        filter.type = filteredRequest.Type;
      }
      const transactions = await TransactionStorage.getTransactions(req.user.tenantID,
        { ...filter, 'search': filteredRequest.Search, 'siteID': filteredRequest.SiteID },
        { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
      // Filter
      TransactionSecurity.filterTransactionsResponse(transactions, req.user);
      // Hash userId and tagId for confidentiality purposes
      for (const transaction of transactions.result) {
        if (transaction.user) {
          transaction.user.id = transaction.user ? Cypher.hash(transaction.user.id) : '';
        }
        transaction.tagID = transaction.tagID ? Cypher.hash(transaction.tagID) : '';
      }

      const filename = 'transactions_export.csv';
      fs.writeFile(filename, TransactionService.convertToCSV(transactions.result), (err) => {
        if (err) {
          throw err;
        }
        res.download(filename, (err2) => {
          if (err2) {
            throw err2;
          }
          fs.unlink(filename, (err3) => {
            if (err3) {
              throw err3;
            }
          });
        });
      });
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetTransactionsInError(action: string, req: Request, res: Response, next: NextFunction) {
    try {
      // Check auth
      if (!Authorizations.canListTransactionsInError(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_TRANSACTION,
          null,
          Constants.HTTP_AUTH_ERROR,
          'TransactionService', 'handleGetTransactionsInError',
          req.user);
      }
      const filter: any = { stop: { $exists: true } };
      // Filter
      const filteredRequest = TransactionSecurity.filterTransactionsInErrorRequest(req.query);
      if (filteredRequest.ChargeBoxID) {
        filter.chargeBoxIDs = filteredRequest.ChargeBoxID.split('|');
      }
      if (filteredRequest.SiteAreaID) {
        filter.siteAreaIDs = filteredRequest.SiteAreaID.split('|');
      }
      if (filteredRequest.UserID) {
        filter.userIDs = filteredRequest.UserID.split('|');
      }
      // Date
      if (filteredRequest.StartDateTime) {
        filter.startDateTime = filteredRequest.StartDateTime;
      }
      if (filteredRequest.EndDateTime) {
        filter.endDateTime = filteredRequest.EndDateTime;
      }
      if (filteredRequest.ErrorType) {
        filter.errorType = filteredRequest.ErrorType.split('|');
      }
      // Site Area
      const transactions = await TransactionStorage.getTransactionsInError(req.user.tenantID,
        { ...filter, 'search': filteredRequest.Search, 'siteID': filteredRequest.SiteID },
        { limit: filteredRequest.Limit, skip: filteredRequest.Skip, sort: filteredRequest.Sort, onlyRecordCount: filteredRequest.OnlyRecordCount });
      // Filter
      TransactionSecurity.filterTransactionsResponse(transactions, req.user);
      // Return
      res.json(transactions);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static convertToCSV(transactions) {
    let csv = 'id,chargeBoxID,connectorID,userID,tagID,startDate,endDate,meterStart,meterStop,totalConsumption,totalDuration,totalInactivity,price,priceUnit\r\n';
    for (const transaction of transactions) {
      csv += `${transaction.id},`;
      csv += `${transaction.chargeBoxID},`;
      csv += `${transaction.connectorId},`;
      csv += `${transaction.user ? transaction.user.id : ''},`;
      csv += `${transaction.tagID},`;
      csv += `${transaction.timestamp},`;
      csv += `${transaction.stop ? transaction.stop.timestamp : ''},`;
      csv += `${transaction.meterStart},`;
      csv += `${transaction.stop ? transaction.stop.meterStop : ''},`;
      csv += `${transaction.stop ? transaction.stop.totalConsumption : ''},`;
      csv += `${transaction.stop ? transaction.stop.totalDurationSecs : ''},`;
      csv += `${transaction.stop ? transaction.stop.totalInactivitySecs : ''},`;
      csv += `${transaction.stop ? transaction.stop.price : ''},`;
      csv += `${transaction.stop ? transaction.stop.priceUnit : ''}\r\n`;
    }
    return csv;
  }
}
