import * as uWS from 'uWebSockets.js';

import { App, HttpRequest, HttpResponse, WebSocket, us_socket_context_t } from 'uWebSockets.js';
import FeatureToggles, { Feature } from '../../../utils/FeatureToggles';
import { OCPPIncomingRequest, OCPPIncomingResponse, OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import { ServerAction, ServerType, WSServerProtocol } from '../../../types/Server';
import { WebSocketAction, WebSocketCloseEventStatusCode, WebSocketPingResult } from '../../../types/WebSocket';

import CentralSystemConfiguration from '../../../types/configuration/CentralSystemConfiguration';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationClient from '../../../client/ocpp/ChargingStationClient';
import ChargingStationConfiguration from '../../../types/configuration/ChargingStationConfiguration';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import JsonRestWSConnection from './web-socket/JsonRestWSConnection';
import JsonWSConnection from './web-socket/JsonWSConnection';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import OCPPServer from '../OCPPServer';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';
import WSConnection from './web-socket/WSConnection';
import WSWrapper from './web-socket/WSWrapper';
import global from '../../../types/GlobalType';
import sizeof from 'object-sizeof';

const MODULE_NAME = 'JsonOCPPServer';

export default class JsonOCPPServer extends OCPPServer {
  private waitingWSMessages = 0;
  private runningWSMessages = 0;
  private runningWSRequestsMessages: Record<string, boolean> = {};
  private jsonWSConnections: Map<string, JsonWSConnection> = new Map();
  private jsonRestWSConnections: Map<string, JsonRestWSConnection> = new Map();

  public constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
    super(centralSystemConfig, chargingStationConfig);
    if (FeatureToggles.isFeatureActive(Feature.WS_SEND_PING_AUTOMATICALLY)) {
      // Nothing to do - the uWS layer takes care to ping the WS for us!
    } else {
      // Start job to ping and clean WS connections (if necessary)
      this.checkAndCleanupAllWebSockets();
    }
    // Monitor WS activity
    this.monitorWSConnections();
    // Monitor Memory Usage
    if (FeatureToggles.isFeatureActive(Feature.OCPP_MONITOR_MEMORY_USAGE)) {
      this.monitorMemoryUsage();
    }
  }

  public start(): void {
    // Keep it global
    global.centralSystemJsonServer = this;
    // uWS can send pings automatically before the idleTimeout is reached
    let idleTimeout: number;
    const sendPingsAutomatically = FeatureToggles.isFeatureActive(Feature.WS_SEND_PING_AUTOMATICALLY);
    if (sendPingsAutomatically) {
      idleTimeout = 2 * 60; // 2 minutes of inactivity close
    } else {
      idleTimeout = 3600; // 1 hour of inactivity ==> close
    }
    // Start the WS server
    Logging.logConsoleDebug(`Starting ${ServerType.JSON_SERVER} Server...`);
    App({}).ws('/*', {
      compression: uWS.SHARED_COMPRESSOR,
      maxPayloadLength: 64 * 1024, // 64 KB per request
      idleTimeout,
      sendPingsAutomatically,
      upgrade: (res: HttpResponse, req: HttpRequest, context: us_socket_context_t) => {
        // Delegate
        this.onUpgrade(res, req, context);
      },
      open: (ws: WebSocket) => {
        // Delegate
        this.onOpen(ws).catch(() => { /* Intentional */ });
      },
      message: (ws: WebSocket, message: ArrayBuffer, isBinary: boolean) => {
        // Delegate
        const messageStr = Utils.convertBufferArrayToString(message);
        this.onMessage(ws, messageStr, isBinary).catch(() => { /* Intentional */ });
      },
      close: (ws: WebSocket, code: number, message: ArrayBuffer) => {
        const wsWrapper = ws.wsWrapper as WSWrapper;
        try {
          // Convert right away
          const reason = Utils.convertBufferArrayToString(message);
          // Close
          wsWrapper.closed = true;
          this.logWSConnectionClosed(wsWrapper, ServerAction.WS_SERVER_CONNECTION_CLOSE, code,
            `${WebSocketAction.CLOSE} > WS Connection ID '${wsWrapper.guid}' closed by charging station with code '${code}', reason: '${!Utils.isNullOrEmptyString(reason) ? reason : 'No reason given'}'`);
        } finally {
          // Remove connection
          this.removeWSWrapper(WebSocketAction.CLOSE, ServerAction.WS_SERVER_CONNECTION_CLOSE, wsWrapper);
        }
      },
      ping: (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Update
        if (ws.wsWrapper) {
          (ws.wsWrapper as WSWrapper).lastPingDate = new Date();
        }
        // Get the WS
        if (ws.wsWrapper.wsConnection) {
          ws.wsWrapper.wsConnection.onPing(ocppMessage);
        }
      },
      pong: (ws: WebSocket, message: ArrayBuffer) => {
        // Convert
        const ocppMessage = Utils.convertBufferArrayToString(message);
        // Update
        if (ws.wsWrapper) {
          (ws.wsWrapper as WSWrapper).lastPongDate = new Date();
        }
        // Get the WS
        if (ws.wsWrapper.wsConnection) {
          ws.wsWrapper.wsConnection.onPong(ocppMessage);
        }
      }
    }).any(Constants.HEALTH_CHECK_ROUTE, (res: HttpResponse) => {
      res.onAborted(() => {
        res.aborted = true;
      });
      if (FeatureToggles.isFeatureActive(Feature.HEALTH_CHECK_PING_DATABASE)) {
        global.database.ping().then((pingSuccess) => {
          if (!res.aborted) {
            if (pingSuccess) {
              res.end('OK');
            } else {
              res.writeStatus('500');
              res.end('KO');
            }
          }
        }).catch(() => { /* Intentional */ });
      } else {
        // TODO - FIND ANOTHER METRIC TO CHECK THE READINESS and LIVENESS PROBE
        res.end('OK');
      }
    }).any('/*', (res: HttpResponse) => {
      res.writeStatus('404');
      res.end();
    }).listen(this.centralSystemConfig.port, (token) => {
      if (token) {
        Logging.logConsoleDebug(
          `${ServerType.JSON_SERVER} Server listening on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      } else {
        Logging.logConsoleError(
          `${ServerType.JSON_SERVER} Server failed to listen on 'http://${this.centralSystemConfig.host}:${this.centralSystemConfig.port}'`);
      }
    });
  }

  public getChargingStationClient(tenant: Tenant, chargingStation: ChargingStation): ChargingStationClient {
    // Get the Json Web Socket
    const jsonWebSocket = this.jsonWSConnections.get(`${tenant.id}~${chargingStation.id}`);
    if (!jsonWebSocket) {
      const message = 'No opened Web Socket connection found';
      Logging.beError()?.log({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenant.id,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_SERVER_CONNECTION, message
      });
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: chargingStation.id,
        module: MODULE_NAME, method: 'getChargingStationClient',
        action: ServerAction.WS_SERVER_CONNECTION, message
      });
      return;
    }
    // Return the client
    return jsonWebSocket.getChargingStationClient();
  }

  public hasChargingStationConnected(tenant: Tenant, chargingStation: ChargingStation): boolean {
    return this.jsonWSConnections.has(`${tenant.id}~${chargingStation.id}`);
  }

  private onUpgrade(res: uWS.HttpResponse, req: uWS.HttpRequest, context: uWS.us_socket_context_t) {
    // Check for WS connection over HTTP
    const url = req.getUrl();
    try {
      // You MUST register an abort handler to know if the upgrade was aborted by peer
      res.onAborted(() => {
        // If no handler here, it crashes!!!
      });
      // INFO: Cannot use Logging in this method as uWebSocket will fail in using req/res objects :S
      // Check URI (/OCPP16/<TENANT_ID>/<TOKEN_ID>/<CHARGING_STATION_ID> or /REST/<TENANT_ID>/<TOKEN_ID>/<CHARGING_STATION_ID>)
      if (!url.startsWith('/OCPP16') && !url.startsWith('/REST')) {
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_SERVER_CONNECTION,
          message: `${WebSocketAction.UPGRADE} > WS Connection with URL '${url}' is invalid: No 'OCPP16' or 'REST' in path`
        });
        res.close();
        return;
      }
      // Check Protocol (ocpp1.6 / rest)
      const protocol = req.getHeader('sec-websocket-protocol');
      if (url.startsWith('/OCPP16') && (protocol !== WSServerProtocol.OCPP16)) {
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_SERVER_CONNECTION,
          message: `${WebSocketAction.UPGRADE} > WS Connection with URL '${url}' is invalid, expected protocol 'ocpp1.6' but got '${protocol}'`,
          detailedMessages: { protocol }
        });
        res.close();
        return;
      }
      if (url.startsWith('/REST') && (protocol !== WSServerProtocol.REST)) {
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          module: MODULE_NAME, method: 'onUpgrade',
          action: ServerAction.WS_SERVER_CONNECTION,
          message: `${WebSocketAction.UPGRADE} > WS Connection with URL '${url}' is invalid, expected protocol 'rest' but got '${protocol}'`,
          detailedMessages: { protocol }
        });
        res.close();
        return;
      }
      res.upgrade(
        { url },
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        context
      );
    } catch (error) {
      const message = `${WebSocketAction.UPGRADE} > New WS Connection with URL '${url}' failed with error: ${error.message as string}`;
      res.writeStatus('500');
      res.end(message);
      this.isDebug() && Logging.logConsoleDebug(message);
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION,
        module: MODULE_NAME, method: 'onUpgrade',
        message, detailedMessages: { error: error.stack }
      });
    }
  }

  private async onOpen(ws: uWS.WebSocket) {
    // Create WS Wrapper
    const wsWrapper = new WSWrapper(ws);
    // Keep it on the ws
    ws.wsWrapper = wsWrapper;
    // Lock incoming WS messages
    await this.acquireLockForWSRequest(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, wsWrapper);
    try {
      this.runningWSMessages++;
      // Path must contain /OCPP16 or /REST as it is already checked during the Upgrade process
      // Check OCPP16 connection
      if (wsWrapper.url.startsWith('/OCPP16')) {
        // Create and Initialize WS Connection
        await this.checkAndStoreWSOpenedConnection(WSServerProtocol.OCPP16, wsWrapper);
      }
      // Check REST connection
      if (wsWrapper.url.startsWith('/REST')) {
        // Create and Initialize WS Connection
        await this.checkAndStoreWSOpenedConnection(WSServerProtocol.REST, wsWrapper);
      }
    } catch (error) {
      Logging.logException(error as Error, ServerAction.WS_SERVER_CONNECTION_OPEN, MODULE_NAME, 'onOpen', Constants.DEFAULT_TENANT_ID);
      if (wsWrapper.tenantID) {
        Logging.logException(error as Error, ServerAction.WS_SERVER_CONNECTION_OPEN, MODULE_NAME, 'onOpen', wsWrapper.tenantID);
      }
      // Close WS
      this.closeWebSocket(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, wsWrapper, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}' has been rejected and closed by server due to an exception: ${error.message as string}`);
    } finally {
      this.runningWSMessages--;
      this.releaseLockForWSMessageRequest(wsWrapper);
    }
  }

  private async checkAndStoreWSOpenedConnection(protocol: WSServerProtocol, wsWrapper: WSWrapper): Promise<void> {
    let wsConnection: WSConnection;
    const timeStart = Date.now();
    // Set the protocol
    wsWrapper.protocol = protocol;
    // Create a WebSocket connection object
    if (protocol === WSServerProtocol.OCPP16) {
      wsConnection = new JsonWSConnection(wsWrapper);
    }
    if (protocol === WSServerProtocol.REST) {
      wsConnection = new JsonRestWSConnection(wsWrapper);
    }
    Logging.beDebug()?.log({
      tenantID: Constants.DEFAULT_TENANT_ID,
      action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'checkAndStoreWSOpenedConnection',
      message: `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}'  is being checked ('${wsWrapper.url}')`,
      detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
    });
    // Initialize (check of Tenant, Token, Charging Station -> Can take time)
    await wsConnection.initialize();
    // Check if WS is still opened (long time initialization when thousand of WS are connecting at the same time)
    if (!wsWrapper.closed) {
      // Keep common data (Set here to get Tenant info in case of exception in Logs)
      wsWrapper.key = wsConnection.getID();
      wsWrapper.chargingStationID = wsConnection.getChargingStationID();
      wsWrapper.tenantID = wsConnection.getTenantID();
      wsWrapper.tokenID = wsConnection.getTokenID();
      wsWrapper.siteID = wsConnection.getSiteID();
      wsWrapper.siteAreaID = wsConnection.getSiteAreaID();
      wsWrapper.companyID = wsConnection.getCompanyID();
      // Check already existing WS Connection
      this.checkAndCloseIdenticalOpenedWSConnection(wsWrapper, wsConnection);
      const message = `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}' has been accepted in ${Utils.computeTimeDurationSecs(timeStart)} secs`;
      Logging.beInfo()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'checkAndStoreWSOpenedConnection',
        message, detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      Logging.beInfo()?.log({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action: ServerAction.WS_SERVER_CONNECTION_OPEN, module: MODULE_NAME, method: 'checkAndStoreWSOpenedConnection',
        message, detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      // Keep WS connection in cache
      this.setWSConnection(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, wsConnection, wsWrapper);
    } else {
      this.logWSConnectionClosed(wsWrapper, ServerAction.WS_SERVER_CONNECTION_OPEN, WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        `${WebSocketAction.OPEN} > WS Connection ID '${wsWrapper.guid}' has been closed during initialization in ${Utils.computeTimeDurationSecs(timeStart)} secs ('${wsWrapper.url}')`);
    }
  }

  private checkAndCloseIdenticalOpenedWSConnection(wsWrapper: WSWrapper, wsConnection: WSConnection): void {
    // Get connection
    const existingWSConnection =
      this.getWSConnectionFromProtocolAndID(wsConnection.getWS().protocol, wsConnection.getID());
    // Found existing WS Connection?
    if (existingWSConnection) {
      // Still opened WS?
      const existingWSWrapper = existingWSConnection.getWS();
      if (!existingWSWrapper.closed) {
        // Ping WS
        const result = this.pingWebSocket(existingWSWrapper);
        if (result.ok) {
          // Close the old WS and keep the new incoming one
          Logging.beWarning()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action: ServerAction.WS_SERVER_CONNECTION, module: MODULE_NAME, method: 'checkAndCloseIdenticalOpenedWSConnection',
            message: `${WebSocketAction.OPEN} > Existing WS Connection ID '${existingWSWrapper.guid}' will be closed and replaced by new incoming one with ID '${wsWrapper.guid}'`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
          this.closeWebSocket(WebSocketAction.OPEN, ServerAction.WS_SERVER_CONNECTION_OPEN, existingWSConnection.getWS(), WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
            `${WebSocketAction.OPEN} > Existing WS Connection ID '${existingWSWrapper.guid}' has been closed successfully by the server`);
        }
      }
    }
  }

  private async acquireLockForWSRequest(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper, ocppMessageType?: OCPPMessageType): Promise<void> {
    // Only lock requests, not responses
    if (ocppMessageType && ocppMessageType !== OCPPMessageType.CALL_MESSAGE) {
      return;
    }
    // Wait for Init (avoid WS connection with same URL), ocppMessageType only provided when a WS Message is received
    await this.waitForWSLockToRelease(wsAction, action, wsWrapper);
    // Lock
    this.runningWSRequestsMessages[wsWrapper.url] = true;
  }

  private releaseLockForWSMessageRequest(wsWrapper: WSWrapper, ocppMessageType?: OCPPMessageType): void {
    // Only lock requests, not responses
    if (ocppMessageType && (ocppMessageType !== OCPPMessageType.CALL_MESSAGE)) {
      return;
    }
    // Unlock
    delete this.runningWSRequestsMessages[wsWrapper.url];
  }

  private async onMessage(ws: uWS.WebSocket, message: string, isBinary: boolean): Promise<void> {
    const wsWrapper: WSWrapper = ws.wsWrapper;
    try {
      // Extract the OCPP Message Type
      const ocppMessage: OCPPIncomingRequest|OCPPIncomingResponse = JSON.parse(message);
      const ocppMessageType = ocppMessage[0];
      // Lock incoming WS messages
      await this.acquireLockForWSRequest(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsWrapper, ocppMessageType);
      try {
        this.runningWSMessages++;
        // Check if connection is available in Map
        this.checkWSConnectionFromOnMessage(wsWrapper);
        // OCPP Request?
        if (wsWrapper.wsConnection) {
          await wsWrapper.wsConnection.handleIncomingOcppMessage(wsWrapper, ocppMessage);
        } else {
          Logging.beError()?.log({
            ...LoggingHelper.getWSWrapperProperties(wsWrapper),
            action: ServerAction.WS_SERVER_MESSAGE,
            module: MODULE_NAME, method: 'onMessage',
            message: 'Unexpected situation - message is received but wsConnection is not set',
            detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
        }
      } finally {
        this.runningWSMessages--;
        this.releaseLockForWSMessageRequest(wsWrapper, ocppMessageType);
      }
    } catch (error) {
      const logMessage = `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' got error while processing WS Message: ${error.message as string}`;
      Logging.beError()?.log({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'onMessage',
        message: logMessage,
        detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
      });
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'onMessage',
        message: logMessage,
        detailedMessages: { message, isBinary, wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
      });
    }
  }

  private checkWSConnectionFromOnMessage(wsWrapper: WSWrapper) {
    // Get WS Connection
    const wsConnection = wsWrapper.wsConnection;
    // Get WS Connection from cache
    const wsExistingConnection =
      this.getWSConnectionFromProtocolAndID(wsWrapper.protocol, wsWrapper.key);
    if (!wsExistingConnection) {
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
        message: `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' has sent a WS Message on an unreferenced WS Connection, it will be then added in the WS cache`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      // Add WS connection from OnMessage in cache
      this.setWSConnection(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsConnection, wsWrapper);
      return;
    }
    // Should have the same GUID
    const wsExistingWrapper = wsExistingConnection.getWS();
    if (wsExistingWrapper.guid !== wsWrapper.guid) {
      Logging.beError()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
        message: `${WebSocketAction.MESSAGE} > WS Connection ID '${wsWrapper.guid}' has sent a WS Message on an already referenced WS Connection ID '${wsExistingWrapper.guid}' in WS cache, ping will be performed...`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), wsExistingWrapper: this.getWSWrapperData(wsExistingWrapper) }
      });
      // Ping
      const result = this.pingWebSocket(wsExistingWrapper);
      if (result.ok) {
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action: ServerAction.WS_SERVER_MESSAGE,
          module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
          message: `${WebSocketAction.MESSAGE} > Existing WS Connection ID '${wsExistingWrapper.guid}' ping succeded meaning multiple WS connections are opened by the same charging station, existing one will be closed and replaced by new one with ID '${wsWrapper.guid}'`,
          detailedMessages: { wsExistingWrapper: this.getWSWrapperData(wsExistingWrapper), wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
        // Close WS
        this.closeWebSocket(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsExistingWrapper,
          WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, `${WebSocketAction.MESSAGE} > Existing WS Connection ID '${wsExistingWrapper.guid}' has been closed successfully by server (duplicate WS Connection)`);
      } else {
        Logging.beWarning()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action: ServerAction.WS_SERVER_MESSAGE,
          module: MODULE_NAME, method: 'checkWSConnectionFromOnMessage',
          message: `${WebSocketAction.MESSAGE} > Existing WS Connection ID '${wsExistingWrapper.guid}' ping failed, new WS Connection ID '${wsWrapper.guid}' will be then added in the WS cache`,
          detailedMessages: { wsExistingWrapper: this.getWSWrapperData(wsExistingWrapper), wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
      }
      // Keep WS connection in cache
      this.setWSConnection(WebSocketAction.MESSAGE, ServerAction.WS_SERVER_MESSAGE, wsConnection, wsWrapper);
    }
  }

  private logWSConnectionClosed(wsWrapper: WSWrapper, action: ServerAction, code: number, message: string): void {
    this.isDebug() && Logging.logConsoleDebug(message);
    if (wsWrapper.tenantID) {
      Logging.beInfo()?.log({
        ...LoggingHelper.getWSWrapperProperties(wsWrapper),
        action, module: MODULE_NAME, method: 'logWSConnectionClosed',
        message: message, detailedMessages: { code, message, wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
    }
    Logging.beInfo()?.log({
      tenantID: Constants.DEFAULT_TENANT_ID,
      chargingStationID: wsWrapper.chargingStationID,
      action, module: MODULE_NAME, method: 'logWSConnectionClosed',
      message: message, detailedMessages: { code, message, wsWrapper: this.getWSWrapperData(wsWrapper) }
    });
  }

  private async waitForWSLockToRelease(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper): Promise<boolean> {
    // Wait for init to handle multiple same WS Connection
    if (this.runningWSRequestsMessages[wsWrapper.url]) {
      const maxNumberOfTrials = 10;
      let numberOfTrials = 0;
      const timeStart = Date.now();
      Logging.beWarning()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action, module: MODULE_NAME, method: 'waitForWSLockToRelease',
        message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' - Lock is taken: Wait and try to acquire the lock after ${Constants.WS_LOCK_TIME_OUT_MILLIS} ms...`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
      this.waitingWSMessages++;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Wait
        await Utils.sleep(Constants.WS_LOCK_TIME_OUT_MILLIS);
        numberOfTrials++;
        // Message has been processed
        if (!this.runningWSRequestsMessages[wsWrapper.url]) {
          Logging.beInfo()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action, module: MODULE_NAME, method: 'waitForWSLockToRelease',
            message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' - Lock has been acquired successfully after ${numberOfTrials} trial(s) and ${Utils.computeTimeDurationSecs(timeStart)} secs`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
          // Free the lock
          this.waitingWSMessages--;
          break;
        }
        // Handle remaining trial
        if (numberOfTrials >= maxNumberOfTrials) {
          // Abnormal situation: The lock should not be taken for so long!
          Logging.beError()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action, module: MODULE_NAME, method: 'waitForWSLockToRelease',
            message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' - Cannot acquire the lock after ${numberOfTrials} trial(s) and ${Utils.computeTimeDurationSecs(timeStart)} secs - Lock will be forced to be released`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
          // Free the lock
          this.waitingWSMessages--;
          break;
        }
      }
    }
    return true;
  }

  private pingWebSocket(wsWrapper: WSWrapper): WebSocketPingResult {
    try {
      // Ping the WS
      wsWrapper.ping();
      // Reset
      wsWrapper.nbrPingFailed = 0;
      return {
        ok: true
      };
    } catch (error) {
      wsWrapper.nbrPingFailed++;
      // Close WS
      if (wsWrapper.nbrPingFailed >= Constants.WS_MAX_NBR_OF_FAILED_PINGS) {
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action: ServerAction.WS_SERVER_CONNECTION_PING, module: MODULE_NAME, method: 'pingWebSocket',
          message: `${WebSocketAction.PING} > Failed to ping the WS Connection ID '${wsWrapper.guid}' after ${wsWrapper.nbrPingFailed} trial(s), will be removed from WS cache`,
          detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
        });
        this.closeWebSocket(WebSocketAction.PING, ServerAction.WS_SERVER_CONNECTION_PING, wsWrapper,
          WebSocketCloseEventStatusCode.CLOSE_ABNORMAL, `${WebSocketAction.PING} > WS Connection ID '${wsWrapper.guid}' has been closed by server after ${wsWrapper.nbrPingFailed} failed ping`);
      } else {
        Logging.beWarning()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action: ServerAction.WS_SERVER_CONNECTION_PING, module: MODULE_NAME, method: 'pingWebSocket',
          message: `${WebSocketAction.PING} > Failed to ping the WS Connection ID '${wsWrapper.guid}' after ${wsWrapper.nbrPingFailed} trial(s) (${Constants.WS_MAX_NBR_OF_FAILED_PINGS - wsWrapper.nbrPingFailed} remaining)`,
          detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), error: error.stack }
        });
      }
      return {
        ok: false,
        errorCode: WebSocketCloseEventStatusCode.CLOSE_ABNORMAL,
        errorMessage: error?.message
      };
    }
  }

  private closeWebSocket(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper, code: WebSocketCloseEventStatusCode, message: string): void {
    // Close WS
    if (!wsWrapper.closed) {
      try {
        wsWrapper.close(code, message);
        this.logWSConnectionClosed(wsWrapper, action, code, message);
      } catch (error) {
        // Just log and ignore issue
        Logging.beError()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action, module: MODULE_NAME, method: 'closeWebSocket',
          message: `${wsAction} > Failed to close WS Connection ID '${wsWrapper.guid}': ${error.message as string}`,
          detailedMessages: { error: error.stack, wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
      }
    }
    // Remove connection
    this.removeWSWrapper(wsAction, action, wsWrapper);
  }

  private setWSConnection(wsAction: WebSocketAction, action: ServerAction, wsConnection: WSConnection, wsWrapper: WSWrapper) {
    // Reference a Json WebSocket connection object
    if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
      this.jsonWSConnections.set(wsConnection.getID(), wsConnection as JsonWSConnection);
      Logging.beDebug()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action, module: MODULE_NAME, method: 'setWSConnection',
        message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' has been added in the WS cache`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
    }
    if (wsWrapper.protocol === WSServerProtocol.REST) {
      this.jsonRestWSConnections.set(wsConnection.getID(), wsConnection as JsonRestWSConnection);
      Logging.beDebug()?.log({
        tenantID: Constants.DEFAULT_TENANT_ID,
        chargingStationID: wsWrapper.chargingStationID,
        action, module: MODULE_NAME, method: 'setWSConnection',
        message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' has been added in the WS cache`,
        detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
      });
    }
    wsWrapper.wsConnection = wsConnection;
  }

  private getWSConnectionFromProtocolAndID(protocol: WSServerProtocol, wsConnectionID: string): WSConnection {
    if (protocol === WSServerProtocol.OCPP16) {
      return this.jsonWSConnections.get(wsConnectionID);
    }
    if (protocol === WSServerProtocol.REST) {
      return this.jsonRestWSConnections.get(wsConnectionID);
    }
  }

  private removeWSWrapper(wsAction: WebSocketAction, action: ServerAction, wsWrapper: WSWrapper): void {
    if (wsWrapper.protocol === WSServerProtocol.OCPP16) {
      this.removeWSConnection(
        wsAction, action, wsWrapper.wsConnection, this.jsonWSConnections);
    }
    if (wsWrapper.protocol === WSServerProtocol.REST) {
      this.removeWSConnection(
        wsAction, action, wsWrapper.wsConnection, this.jsonRestWSConnections);
    }
  }

  private removeWSConnection(wsAction: WebSocketAction, action: ServerAction, wsConnection: WSConnection, wsConnections: Map<string, WSConnection>): void {
    if (wsConnection) {
      const wsWrapper = wsConnection.getWS();
      const existingWsConnection = wsConnections.get(wsConnection.getID());
      if (existingWsConnection) {
        const existingWsWrapper = existingWsConnection.getWS();
        // Check id same WS Connection
        if (existingWsWrapper.guid === wsWrapper.guid) {
          // Remove from WS Cache
          wsConnections.delete(wsConnection.getID());
          Logging.beDebug()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action, module: MODULE_NAME, method: 'setWSConnection',
            message: `${wsAction} > WS Connection ID '${wsWrapper.guid}' has been removed from the WS cache`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
          });
        } else {
          // WS Connection not identical
          Logging.beWarning()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            chargingStationID: wsWrapper.chargingStationID,
            action, module: MODULE_NAME, method: 'removeWSConnection',
            message: `${wsAction} > Failed to remove WS Connection ID '${wsWrapper.guid}' from WS cache due to an already existing WS with different ID '${existingWsWrapper.guid}'`,
            detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper), existingWsWrapper: this.getWSWrapperData(existingWsWrapper) }
          });
        }
      } else {
        // WS Connection not found
        Logging.beWarning()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          chargingStationID: wsWrapper.chargingStationID,
          action, module: MODULE_NAME, method: 'removeWSConnection',
          message: `${wsAction} > Failed to remove WS Connection ID '${wsWrapper.guid}' from WS cache as it does not exist anymore in it`,
          detailedMessages: { wsWrapper: this.getWSWrapperData(wsWrapper) }
        });
      }
    }
  }

  private isDebug(): boolean {
    return this.centralSystemConfig.debug || Utils.isDevelopmentEnv();
  }

  private monitorWSConnections() {
    setInterval(() => {
      try {
        // Log size of WS Json Connections (track leak)
        let sizeOfCurrentRequestsBytes = 0, numberOfCurrentRequests = 0;
        for (const jsonWSConnection of Array.from(this.jsonWSConnections.values())) {
          const currentOcppRequests = jsonWSConnection.getCurrentOcppRequests();
          sizeOfCurrentRequestsBytes += sizeof(currentOcppRequests);
          numberOfCurrentRequests += Object.keys(currentOcppRequests).length;
        }
        // Log Stats on number of WS Connections
        Logging.beDebug()?.log({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.WS_SERVER_CONNECTION, module: MODULE_NAME, method: 'monitorWSConnections',
          message: `${this.jsonWSConnections.size} WS connections, ${this.jsonRestWSConnections.size} REST connections, ${this.runningWSMessages} Messages, ${Object.keys(this.runningWSRequestsMessages).length} Requests, ${this.waitingWSMessages} queued WS Message(s)`,
          detailedMessages: [
            `${numberOfCurrentRequests} JSON WS Requests cached`,
            `${sizeOfCurrentRequestsBytes / 1000} kB used in JSON WS cache`
          ]
        });
        if (this.isDebug()) {
          Logging.logConsoleDebug('=====================================');
          Logging.logConsoleDebug(`** ${this.jsonWSConnections.size} JSON Connection(s)`);
          Logging.logConsoleDebug(`** ${numberOfCurrentRequests} JSON WS Requests in cache with a size of ${sizeOfCurrentRequestsBytes / 1000} kB`);
          Logging.logConsoleDebug(`** ${this.jsonRestWSConnections.size} REST Connection(s)`);
          Logging.logConsoleDebug(`** ${Object.keys(this.runningWSRequestsMessages).length} running WS Requests`);
          Logging.logConsoleDebug(`** ${this.runningWSMessages} running WS Messages (Requests + Responses)`);
          Logging.logConsoleDebug(`** ${this.waitingWSMessages} queued WS Message(s)`);
          Logging.logConsoleDebug('=====================================');
        }
      } catch (error) {
        /* Intentional */
      }
    }, Configuration.getChargingStationConfig().monitoringIntervalOCPPJSecs * 1000);
  }

  private monitorMemoryUsage() {
    setInterval(() => {
      try {
        // get Node memory usage
        const beginDate = new Date().getTime();
        const memoryUsage = process.memoryUsage();
        const elapsedTime = new Date().getTime() - beginDate;
        const memoryUsagePercentage = ((memoryUsage.heapUsed / memoryUsage.rss) * 100);
        const usagePercentage = memoryUsagePercentage.toFixed(2);
        const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const external = (memoryUsage.external / 1024 / 1024).toFixed(2);
        const rss = (memoryUsage.rss / 1024 / 1024).toFixed(2); // total amount of memory allocated to the process - to be clarified!
        const message = `Memory Usage ${usagePercentage}% - total heap: ${heapTotal} MiB - heap used: ${heapUsed} MiB - rss: ${rss} MiB - external: ${external} MiB - elapsed time: ${elapsedTime}`;
        const dataToLog = {
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.PERFORMANCES, module: MODULE_NAME, method: 'monitorMemoryUsage',
          message
        };
        // TODO - remove it - JUST FOR TROUBLESHOOTING STRESS TESTS
        Logging.beError()?.log(dataToLog);
        // if (memoryUsagePercentage > 90) {
        //   Logging.beError()?.log(dataToLog);
        // } else if (memoryUsagePercentage > 80) {
        //   Logging.beWarning()?.log(dataToLog);
        // } else {
        //   Logging.beDebug()?.log(dataToLog);
        // }
        if (this.isDebug()) {
          Logging.logConsoleDebug(message);
        }
      } catch (error) {
        /* Intentional */
      }
    }, 5 * 60 * 1000); // every minute - TODO - add new configuration for it!
  }

  private checkAndCleanupAllWebSockets() {
    setInterval(() => {
      try {
        // Check Json connections
        this.checkAndCleanupWebSockets(this.jsonWSConnections, 'CS');
        // Check Rest connections
        this.checkAndCleanupWebSockets(this.jsonRestWSConnections, 'REST');
      } catch (error) {
        /* Intentional */
      }
    }, Configuration.getChargingStationConfig().pingIntervalOCPPJSecs * 1000);
  }

  private checkAndCleanupWebSockets(wsConnections: Map<string, WSConnection>, type: 'CS'|'REST'): void {
    const validConnections: Record<string, any>[] = [], invalidConnections: Record<string, any>[] = [];
    const timeStart = Date.now();
    const wsConnectionKeys = Array.from(wsConnections.keys());
    if (!Utils.isEmptyArray(wsConnectionKeys)) {
      for (const wsConnectionKey of wsConnectionKeys) {
        const wsConnection = wsConnections.get(wsConnectionKey);
        if (wsConnection) {
          // Get the WS
          const wsWrapper = wsConnection.getWS();
          // Check WS
          const result = this.pingWebSocket(wsWrapper);
          if (result.ok) {
            validConnections.push(this.getWSWrapperData(wsWrapper));
          } else {
            invalidConnections.push(this.getWSWrapperData(wsWrapper));
          }
        }
      }
      if (validConnections.length || invalidConnections.length) {
        const message = `Total of ${wsConnectionKeys.length} ${type} WS connection(s) pinged in ${Utils.computeTimeDurationSecs(timeStart)} secs: ${validConnections.length} valid,  ${invalidConnections.length} invalid`;
        this.isDebug() && Logging.logConsoleDebug(message);
        if (invalidConnections.length) {
          Logging.beError()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'checkAndCleanupWebSockets',
            action: ServerAction.WS_SERVER_CONNECTION_PING,
            message, /* detailedMessages: { invalidConnections, validConnections } */
          });
        } else {
          Logging.beInfo()?.log({
            tenantID: Constants.DEFAULT_TENANT_ID,
            module: MODULE_NAME, method: 'checkAndCleanupWebSockets',
            action: ServerAction.WS_SERVER_CONNECTION_PING,
            message, /* detailedMessages: { invalidConnections, validConnections } */
          });
        }
      }
    }
  }

  private getWSWrapperData(wsWrapper: WSWrapper): Record<string, any> {
    return {
      key: wsWrapper.key,
      guid: wsWrapper.guid,
      nbrPingFailed: wsWrapper.nbrPingFailed,
      siteID: wsWrapper.siteID,
      siteAreaID: wsWrapper.siteAreaID,
      companyID: wsWrapper.companyID,
      chargingStationID: wsWrapper.chargingStationID,
      tenantID: wsWrapper.tenantID,
      tokenID: wsWrapper.tokenID,
      url: wsWrapper.url,
      clientIP: wsWrapper.clientIP,
      closed: wsWrapper.closed,
      protocol: wsWrapper.protocol,
      remoteAddress: wsWrapper.remoteAddress,
      firstConnectionDate: wsWrapper.firstConnectionDate,
      durationSecs: Utils.computeTimeDurationSecs(new Date(wsWrapper.firstConnectionDate).getTime()),
      lastPingDate: wsWrapper.lastPingDate,
      lastPongDate: wsWrapper.lastPongDate,
    };
  }
}
