import ChargingStation, { Command } from '../../../types/ChargingStation';
import { FctOCPPReject, FctOCPPResponse, OCPPErrorType, OCPPIncomingRequest, OCPPIncomingResponse, OCPPMessageType, OCPPRequest } from '../../../types/ocpp/OCPPCommon';

import BackendError from '../../../exception/BackendError';
import Constants from '../../../utils/Constants';
import Logging from '../../../utils/Logging';
import OCPPError from '../../../exception/OcppError';
import OCPPUtils from '../utils/OCPPUtils';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import { WebSocket } from 'uWebSockets.js';

const MODULE_NAME = 'WSConnection';

export default abstract class WSConnection {
  private siteID: string;
  private siteAreaID: string;
  private companyID: string;
  private chargingStationID: string;
  private tenantID: string;
  private tenantSubdomain: string;
  private tokenID: string;
  private url: string;
  private clientIP: string | string[];
  private webSocket: WebSocket;
  private ocppRequests: Record<string, OCPPRequest> = {};

  constructor(webSocket: WebSocket, url: string) {
    // Init
    this.url = url.trim().replace(/\b(\?|&).*/, ''); // Filter trailing URL parameters
    // this.clientIP = Utils.getRequestIP(url);
    this.webSocket = webSocket;
    this.clientIP = Buffer.from(webSocket.getRemoteAddressAsText()).toString();
    void Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT,
      action: ServerAction.WS_CONNECTION,
      module: MODULE_NAME, method: 'constructor',
      message: `WS connection opening attempts with URL: '${url}'`,
    });
    // Check mandatory fields
    this.checkMandatoryFieldsInRequest();
  }

  public async initialize(): Promise<void> {
    // Check and Get Charging Station data
    const { tenant, chargingStation } = await OCPPUtils.checkAndGetChargingStationData(
      ServerAction.WS_CONNECTION, this.getTenantID(), this.getChargingStationID(), this.getTokenID(), false);
    // Set
    this.setTenant(tenant);
    this.setChargingStation(chargingStation);
  }

  public async onMessage(message: string, isBinary: boolean): Promise<void> {
    let responseCallback: FctOCPPResponse;
    let rejectCallback: FctOCPPReject;
    let command: Command, commandPayload: Record<string, any>, errorDetails: Record<string, any>;
    // Parse the data
    const ocppMessage: OCPPIncomingRequest|OCPPIncomingResponse = JSON.parse(message);
    const [messageType, messageID] = ocppMessage;
    try {
      // Check the Type of message
      switch (messageType) {
        // Incoming Message
        case OCPPMessageType.CALL_MESSAGE:
          // Get the data
          [,,command,commandPayload] = ocppMessage as OCPPIncomingRequest;
          // Process the call
          await this.handleRequest(messageID, command, commandPayload);
          break;
        // Outcome Message
        case OCPPMessageType.CALL_RESULT_MESSAGE:
          // Get the data
          [,,commandPayload] = ocppMessage as OCPPIncomingResponse;
          // Respond
          [responseCallback,,command] = this.ocppRequests[messageID];
          if (!responseCallback) {
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME, method: 'onMessage',
              message: `Unknwon OCPP Request for '${message.toString()}'`,
            });
          }
          responseCallback(commandPayload);
          break;
        // Error Message
        case OCPPMessageType.CALL_ERROR_MESSAGE:
          [,,commandPayload,errorDetails] = ocppMessage as OCPPIncomingResponse;
          [,rejectCallback,command] = this.ocppRequests[messageID];
          if (!rejectCallback) {
            throw new BackendError({
              chargingStationID: this.getChargingStationID(),
              siteID: this.getSiteID(),
              siteAreaID: this.getSiteAreaID(),
              companyID: this.getCompanyID(),
              module: MODULE_NAME, method: 'onMessage',
              message: `Unknwon OCPP Request for '${message.toString()}'`,
              detailedMessages: { messageType, messageID, commandPayload, errorDetails }
            });
          }
          rejectCallback(new OCPPError({
            chargingStationID: this.getChargingStationID(),
            siteID: this.getSiteID(),
            siteAreaID: this.getSiteAreaID(),
            companyID: this.getCompanyID(),
            module: MODULE_NAME, method: 'onMessage',
            code: command,
            message: message.toString(),
          }));
          break;
        default:
          throw new BackendError({
            chargingStationID: this.getChargingStationID(),
            siteID: this.getSiteID(),
            siteAreaID: this.getSiteAreaID(),
            companyID: this.getCompanyID(),
            action: OCPPUtils.buildServerActionFromOcppCommand(command),
            module: MODULE_NAME, method: 'onMessage',
            message: `Wrong OCPP Message Type '${messageType as string}' for '${message.toString()}'`,
          });
      }
    } catch (error) {
      await Logging.logError({
        tenantID: this.tenantID,
        siteID: this.siteID,
        siteAreaID: this.siteAreaID,
        companyID: this.companyID,
        chargingStationID: this.chargingStationID,
        action: OCPPUtils.buildServerActionFromOcppCommand(command),
        message: `${error.message as string}`,
        module: MODULE_NAME, method: 'onMessage',
        detailedMessages: { data: message, error: error.stack }
      });
      await this.sendError(messageID, error);
    }
  }

  public getWSConnection(): WebSocket {
    return this.webSocket;
  }

  public getURL(): string {
    return this.url;
  }

  public getClientIP(): string | string[] {
    return this.clientIP;
  }

  public async sendResponse(messageID: string, command: Command, response: Record<string, any>): Promise<Record<string, any>> {
    return this.sendMessage(messageID, OCPPMessageType.CALL_RESULT_MESSAGE, command, response);
  }

  public async sendError(messageID: string, error: OCPPError): Promise<unknown> {
    return this.sendMessage(messageID, OCPPMessageType.CALL_ERROR_MESSAGE, null, null, error);
  }

  public async sendMessage(messageID: string, messageType: OCPPMessageType, command?: Command, data?: Record<string, any>, error?: OCPPError): Promise<unknown> {
    // Create a promise
    return new Promise((resolve, reject) => {
      let messageToSend: string;
      let messageProcessed = false;
      let requestTimeout: NodeJS.Timer;
      // Function that will receive the request's response
      const responseCallback = (payload?: Record<string, unknown> | string): void => {
        if (!messageProcessed) {
          if (requestTimeout) {
            clearTimeout(requestTimeout);
          }
          // Send response
          messageProcessed = true;
          delete this.ocppRequests[messageID];
          resolve(payload);
        }
      };
      // Function that will receive the request's rejection
      const rejectCallback = (reason: string | OCPPError): void => {
        if (!messageProcessed) {
          if (requestTimeout) {
            clearTimeout(requestTimeout);
          }
          // Send error
          messageProcessed = true;
          delete this.ocppRequests[messageID];
          const ocppError = reason instanceof OCPPError ? reason : new Error(reason);
          reject(ocppError);
        }
      };
      // Type of message
      switch (messageType) {
        // Request
        case OCPPMessageType.CALL_MESSAGE:
          // Build request
          this.ocppRequests[messageID] = [responseCallback, rejectCallback, command];
          messageToSend = JSON.stringify([messageType, messageID, command, data]);
          break;
        // Response
        case OCPPMessageType.CALL_RESULT_MESSAGE:
          // Build response
          messageToSend = JSON.stringify([messageType, messageID, data]);
          break;
        // Error Message
        case OCPPMessageType.CALL_ERROR_MESSAGE:
          // Build Error Message
          messageToSend = JSON.stringify([messageType, messageID, error.code ? error.code : OCPPErrorType.GENERIC_ERROR, error.message ? error.message : '', error.details ? error.details : {}]);
          break;
      }
      // Send Message
      try {
        if (!this.webSocket.send(messageToSend)) {
          // TODO: Backpressure to check
          rejectCallback(`Error when sending Message ID '${messageID}' with content '${messageToSend}' (${this.tenantSubdomain})`);
        }
      } catch (wsError) {
        rejectCallback(`Error '${wsError?.message as string ?? 'Unknown'}' when sending Message ID '${messageID}' with content '${messageToSend}' (${this.tenantSubdomain})`);
      }
      // Response?
      if (messageType !== OCPPMessageType.CALL_MESSAGE) {
        responseCallback();
      } else {
        // Trigger timeout
        requestTimeout = setTimeout(() => {
          rejectCallback(`Timeout for Message ID '${messageID}' with content '${messageToSend} (${this.tenantSubdomain})`);
        }, Constants.OCPP_SOCKET_TIMEOUT);
      }
    });
  }

  public setChargingStation(chargingStation: ChargingStation): void {
    this.siteID = chargingStation?.siteID;
    this.siteAreaID = chargingStation?.siteAreaID;
    this.companyID = chargingStation?.companyID;
  }

  public getSiteID(): string {
    return this.siteID;
  }

  public getSiteAreaID(): string {
    return this.siteAreaID;
  }

  public getCompanyID(): string {
    return this.companyID;
  }

  public getChargingStationID(): string {
    return this.chargingStationID;
  }

  public getTenantID(): string {
    return this.tenantID;
  }

  public setTenant(tenant: Tenant): void {
    this.tenantID = tenant.id;
    this.tenantSubdomain = tenant.subdomain;
  }

  public getTenant(): Tenant {
    return {
      id: this.tenantID,
      subdomain: this.tenantSubdomain
    } as Tenant;
  }

  public getTokenID(): string {
    return this.tokenID;
  }

  public getID(): string {
    return `${this.getTenantID()}~${this.getChargingStationID()}`;
  }

  private checkMandatoryFieldsInRequest() {
    // Check URL: remove starting and trailing '/'
    if (this.url.endsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(0, this.url.length - 1);
    }
    if (this.url.startsWith('/')) {
      // Remove '/'
      this.url = this.url.substring(1, this.url.length);
    }
    // Parse URL: should be like /OCPPxx/TENANTID/TOKEN/CHARGEBOXID
    // We support previous format like for existing charging station without token also /OCPPxx/TENANTID/CHARGEBOXID
    const splittedURL = this.getURL().split('/');
    if (splittedURL.length !== 4) {
      throw new BackendError({
        module: MODULE_NAME, method: 'checkMandatoryFieldsInRequest',
        message: `OCPP wrong number of arguments in URL connection '${this.url}'`
      });
    }
    // URL /OCPPxx/TENANTID/TOKEN/CHARGEBOXID
    this.tenantID = splittedURL[1];
    this.tokenID = splittedURL[2];
    this.chargingStationID = splittedURL[3];
    // Check parameters
    OCPPUtils.checkChargingStationOcppParameters(
      ServerAction.WS_CONNECTION, this.tenantID, this.tokenID, this.chargingStationID);
  }

  public abstract handleRequest(messageId: string, command: Command, commandPayload: Record<string, unknown> | string): Promise<void>;

  public abstract onPing(message: string): Promise<void>;

  public abstract onPong(message: string): Promise<void>;
}
