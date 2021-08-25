import { OCPP15MeterValuesRequest, OCPPAuthorizeRequest, OCPPAuthorizeResponse, OCPPBootNotificationRequest, OCPPBootNotificationResponse, OCPPDataTransferRequest, OCPPDataTransferResponse, OCPPDiagnosticsStatusNotificationRequest, OCPPDiagnosticsStatusNotificationResponse, OCPPFirmwareStatusNotificationRequest, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatRequest, OCPPHeartbeatResponse, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPStartTransactionRequest, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionRequest, OCPPStopTransactionResponse, OCPPVersion } from '../../../../src/types/ocpp/OCPPServer';
import { OCPPIncomingRequest, OCPPMessageType } from '../../../../src/types/ocpp/OCPPCommon';
import { ServerAction, WSServerProtocol } from '../../../../src/types/Server';

import ChargingStation from '../../../types/ChargingStation';
import OCPPService from '../OCPPService';
import Utils from '../../../../src/utils/Utils';
import WSClient from '../../../../src/client/websocket/WSClient';
import { WSClientOptions } from '../../../../src/types/WebSocket';
import config from '../../../config';
import { performance } from 'perf_hooks';

export default class OCPPJsonService16 extends OCPPService {
  private wsSessions: Map<string, { connection: WSClient, requests: any }>;
  private requestHandler: any;

  public constructor(serverUrl: string, requestHandler) {
    super(serverUrl);
    this.wsSessions = new Map<string, { connection: WSClient, requests: any }>();
    this.requestHandler = requestHandler;
  }

  public getVersion(): OCPPVersion {
    return OCPPVersion.VERSION_16;
  }

  public async openConnection(chargingStation: ChargingStation): Promise<{ connection: WSClient, requests: any }> {
    return new Promise((resolve, reject) => {
      // Create WS
      const sentRequests = {};
      const wsClientOptions: WSClientOptions = {
        protocols: WSServerProtocol.OCPP16,
        autoReconnectTimeout: config.get('wsClient').autoReconnectTimeout,
        autoReconnectMaxRetries: config.get('wsClient').autoReconnectMaxRetries
      };
      const wsConnection = new WSClient(`${this.serverUrl}/${chargingStation.id}/${chargingStation.siteAreaID}/${chargingStation.siteID}/${chargingStation.companyID}`, wsClientOptions, false);
      // Opened
      wsConnection.onopen = () => {
        // Connection is opened and ready to use
        resolve({ connection: wsConnection, requests: sentRequests });
      };
      // Handle Error Message
      wsConnection.onerror = (error: Error) => {
        // An error occurred when sending/receiving data
        reject(error);
      };
      wsConnection.onclose = (code: number) => {
        for (const property in sentRequests) {
          sentRequests[property].reject(code);
        }
        reject(code);
      };
      wsConnection.onmaximum = (error: Error) => {
        reject(error);
      };
      // Handle Server Message
      wsConnection.onmessage = async (message) => {
        const t1 = performance.now();
        try {
          // Parse the message
          const [messageType, messageId, commandName, commandPayload]: OCPPIncomingRequest = JSON.parse(message.data) as OCPPIncomingRequest;
          // Check if this corresponds to a request
          if (messageType === OCPPMessageType.CALL_RESULT_MESSAGE && sentRequests[messageId]) {
            const response: any = {};
            // Set the data
            response.responseMessageId = messageId;
            response.executionTime = t1 - sentRequests[messageId].t0;
            response.data = commandName;
            // Respond to the request
            sentRequests[messageId].resolve(response);
          } else if (messageType === OCPPMessageType.CALL_MESSAGE) {
            await this.handleRequest(chargingStation, messageId, commandName, commandPayload);
          }
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  public async handleRequest(chargingStation: ChargingStation, messageId: string, commandName: ServerAction, commandPayload: Record<string, unknown> | string): Promise<void> {
    let result = {};
    const methodName = `handle${commandName}`;
    if (this.requestHandler && typeof this.requestHandler[methodName] === 'function') {
      result = await this.requestHandler[methodName](commandPayload);
    }
    await this.send(chargingStation, this.buildResponse(messageId, result));
  }

  public closeConnection(): void {
    // Close
    if (this.wsSessions) {
      this.wsSessions.forEach((session) => session.connection.close());
      this.wsSessions = null;
    }
  }

  public async executeAuthorize(chargingStation: ChargingStation, authorize: OCPPAuthorizeRequest): Promise<OCPPAuthorizeResponse> {
    const response = await this.send(chargingStation, this.buildRequest('Authorize', authorize));
    return response.data;
  }

  public async executeStartTransaction(chargingStation: ChargingStation, startTransaction: OCPPStartTransactionRequest): Promise<OCPPStartTransactionResponse> {
    const response = await this.send(chargingStation, this.buildRequest('StartTransaction', startTransaction));
    return response.data;
  }

  public async executeStopTransaction(chargingStation: ChargingStation, stopTransaction: OCPPStopTransactionRequest): Promise<OCPPStopTransactionResponse> {
    const response = await this.send(chargingStation, this.buildRequest('StopTransaction', stopTransaction));
    return response.data;
  }

  public async executeHeartbeat(chargingStation: ChargingStation, heartbeat: OCPPHeartbeatRequest): Promise<OCPPHeartbeatResponse> {
    const response = await this.send(chargingStation, this.buildRequest('Heartbeat', heartbeat));
    return response.data;
  }

  public async executeMeterValues(chargingStation: ChargingStation, meterValue: OCPPMeterValuesRequest | OCPP15MeterValuesRequest): Promise<OCPPMeterValuesResponse> {
    const response = await this.send(chargingStation, this.buildRequest('MeterValues', meterValue));
    return response.data;
  }

  public async executeBootNotification(chargingStation: ChargingStation, bootNotification: OCPPBootNotificationRequest): Promise<OCPPBootNotificationResponse> {
    const response = await this.send(chargingStation, this.buildRequest('BootNotification', bootNotification));
    return response.data;
  }

  public async executeStatusNotification(chargingStation: ChargingStation, statusNotification: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse> {
    const response = await this.send(chargingStation, this.buildRequest('StatusNotification', statusNotification));
    return response.data;
  }

  public async executeFirmwareStatusNotification(chargingStation: ChargingStation, firmwareStatusNotification: OCPPFirmwareStatusNotificationRequest): Promise<OCPPFirmwareStatusNotificationResponse> {
    const response = await this.send(chargingStation, this.buildRequest('FirmwareStatusNotification', firmwareStatusNotification));
    return response.data;
  }

  public async executeDiagnosticsStatusNotification(chargingStation: ChargingStation, diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequest): Promise<OCPPDiagnosticsStatusNotificationResponse> {
    const response = await this.send(chargingStation, this.buildRequest('DiagnosticsStatusNotification', diagnosticsStatusNotification));
    return response.data;
  }

  public async executeDataTransfer(chargingStation: ChargingStation, dataTransfer: OCPPDataTransferRequest): Promise<OCPPDataTransferResponse> {
    const response = await this.send(chargingStation, this.buildRequest('DataTransfer', dataTransfer));
    return response.data;
  }

  private async send(chargingStation: ChargingStation, message: any): Promise<any> {
    // Debug
    if (config.trace_logs) {
      console.debug('OCPP Request ====================================');
      console.debug({ chargeBoxIdentity: chargingStation.id, message });
      console.debug('====================================');
    }
    // WS Opened?
    if (!this.wsSessions?.get(chargingStation.id)?.connection?.isConnectionOpen()) {
      // Open WS
      const ws = await this.openConnection(chargingStation);
      this.wsSessions.set(chargingStation.id, ws);
    }
    // Send
    const t0 = performance.now();
    this.wsSessions.get(chargingStation.id).connection.send(JSON.stringify(message), {}, (error?: Error) => {
      config.trace_logs && console.debug(`Sending error to '${chargingStation.id}', error '${JSON.stringify(error)}', message: '${JSON.stringify(message)}'`);
    });
    if (message[0] === OCPPMessageType.CALL_MESSAGE) {
      // Return a promise
      return new Promise((resolve, reject) => {
        // Set the resolve function
        this.wsSessions.get(chargingStation.id).requests[message[1]] = { resolve, reject, t0: t0 };
      });
    }
  }

  private buildRequest(command: string, payload: any) {
    // Build the request
    return [
      OCPPMessageType.CALL_MESSAGE,
      Utils.generateUUID(),
      command,
      payload];
  }

  private buildResponse(messageId, payload: any) {
    // Build the request
    return [
      OCPPMessageType.CALL_MESSAGE,
      messageId,
      payload];
  }
}
