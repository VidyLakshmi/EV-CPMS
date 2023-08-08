import { RecognizedString, WebSocket } from 'uWebSockets.js';
import { ServerAction, WSServerProtocol } from '../../../../types/Server';
import { WebSocketAction, WebSocketCloseEventStatusCode } from '../../../../types/WebSocket';

import { Command } from '../../../../types/ChargingStation';
import Constants from '../../../../utils/Constants';
import { CounterClearableMetric } from '../../../../monitoring/CounterClearableMetric';
import Logging from '../../../../utils/Logging';
import LoggingHelper from '../../../../utils/LoggingHelper';
import { OCPPPayload } from '../../../../types/ocpp/OCPPCommon';
import { PerformanceRecordGroup } from '../../../../types/Performance';
import Utils from '../../../../utils/Utils';
import WSConnection from './WSConnection';

const MODULE_NAME = 'WSWrapper';

export default class WSWrapper {
  public guid: string;
  public tokenID: string;
  public url: string;
  public clientIP: string | string[];
  public protocol: WSServerProtocol;
  public remoteAddress: string;
  public wsConnection: WSConnection;
  public firstConnectionDate: Date;
  public nbrPingFailed: number;
  public lastMessageDate: Date;
  public lastPingDate: Date;
  public lastPongDate: Date;

  private ws: WebSocket;
  private _closed: boolean;
  private _ocppOpenWebSocketMetricCounter: CounterClearableMetric;
  private _ocppClosedWebSocketMetricCounter: CounterClearableMetric;
  private _ocppKilledWebSocketMetricCounter: CounterClearableMetric;

  public constructor(url: string) {
    this.url = url;
    this.guid = Utils.generateShortNonUniqueID();
    this.firstConnectionDate = new Date();
    this.nbrPingFailed = 0;
    this._closed = false;
    if (this.url.startsWith('/OCPP16')) {
      this.protocol = WSServerProtocol.OCPP16;
    } else if (this.url.startsWith('/REST')) {
      this.protocol = WSServerProtocol.REST;
    }
  }

  public isClosed(): boolean {
    return this._closed;
  }

  public isValid(): boolean {
    return !!this.wsConnection;
  }

  public setWebSocket(ws: WebSocket) {
    this.ws = ws;
    this.remoteAddress = Utils.convertBufferArrayToString(ws.getRemoteAddressAsText()).toString();
  }

  public setConnection(wsConnection: WSConnection) {
    this.wsConnection = wsConnection;
    if (this.protocol !== WSServerProtocol.REST && Utils.isMonitoringEnabled()) {
      // Initialize Metrics
      const labelValues = { tenant: wsConnection.getTenant().subdomain };
      this._ocppOpenWebSocketMetricCounter = global.monitoringServer.getCounterClearableMetric(PerformanceRecordGroup.OCPP, 'OpenedWebSocket', 'Opened web sockets', labelValues);
      this._ocppClosedWebSocketMetricCounter = global.monitoringServer.getCounterClearableMetric(PerformanceRecordGroup.OCPP, 'ClosedWebSocket', 'Closed web sockets', labelValues);
      this._ocppKilledWebSocketMetricCounter = global.monitoringServer.getCounterClearableMetric(PerformanceRecordGroup.OCPP, 'KilledWebSocket', 'Killed web sockets', labelValues);
      // Increment counter
      this._ocppOpenWebSocketMetricCounter?.inc();
    }
  }

  public unsetConnection(): void {
    this.wsConnection = null;
  }

  public send(messageToSend: string, initialCommand: Command, initialCommandPayload?: OCPPPayload, isBinary?: boolean, compress?: boolean): boolean {
    let sent = false ;
    if (this.canSendMessage(WebSocketAction.MESSAGE, messageToSend, initialCommand, initialCommandPayload)) {
      // Sends a message.
      // Returns
      // - 1 for success,
      // - 2 for dropped due to backpressure limit,
      // - 0 for built up backpressure that will drain over time.
      // Todo: check backpressure before or after sending by calling getBufferedAmount()
      const returnedCode = this.ws.send(messageToSend, isBinary, compress);
      if (typeof returnedCode === 'boolean') {
        // Returns a boolean in production - to be clarified
        return returnedCode;
      }
      // Handle back pressure
      if (returnedCode === 1) {
        sent = true;
      } else {
        Logging.beWarning()?.log({
          ...LoggingHelper.getWSWrapperProperties(this),
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.WS_SERVER_MESSAGE,
          module: MODULE_NAME, method: 'send',
          message: `WS Message returned a backpressure code '${returnedCode}'`,
          detailedMessages: {
            message: messageToSend,
            returnedCode,
            wsWrapper: this.toJson()
          }
        });
      }
    }
    return sent;
  }

  public close(): void {
    if (!this._closed) {
      this._closed = true;
      // Local ref to the Web Socket
      const ws = this.ws;
      if (ws) {
        try {
          // Clear the reference to the WebSocket!
          this.ws = null;
          // Forcefully closes this WebSocket. Immediately calls the close handler.
          ws.close();
        } catch (error) {
          // Do nothing
        } finally {
          // Increment specific counter to detect WS forcefully closed
          this._ocppKilledWebSocketMetricCounter?.inc();
        }
      }
    }
  }

  public end(code: number, shortMessage: RecognizedString): void {
    if (!this._closed) {
      this._closed = true;
      // Local ref to the Web Socket
      const ws = this.ws;
      if (ws) {
        try {
          // Clear the reference to the WebSocket!
          this.ws = null;
          // Close WS
          ws.end(code, shortMessage);
        } catch (error) {
          // Do nothing
        } finally {
          if (code !== WebSocketCloseEventStatusCode.CLOSE_NORMAL) {
            // Increment counter close counter when code is an error
            this._ocppClosedWebSocketMetricCounter?.inc();
          }
        }
      }
    }
  }

  public ping(message: RecognizedString) : boolean {
    if (this._closed) {
      return false;
    }
    const returnedCode = this.ws.ping(message);
    // Return a boolean in production
    if (typeof returnedCode === 'boolean') {
      return returnedCode;
    }
    // Handle back pressure
    if (returnedCode !== 1) {
      Logging.beWarning()?.log({
        ...LoggingHelper.getWSWrapperProperties(this),
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_CONNECTION_PING,
        module: MODULE_NAME, method: 'ping',
        message: `WS Ping returned a backpressure code '${returnedCode}'`,
        detailedMessages: {
          message,
          returnedCode,
          wsWrapper: this.toJson()
        }
      });
    }
    return true;
  }

  public getRemoteAddress(): string {
    return this.remoteAddress;
  }

  public toJson(): Record<string, any> {
    return {
      key: this.wsConnection?.getID(),
      guid: this.guid,
      nbrPingFailed: this.nbrPingFailed,
      ...LoggingHelper.getWSConnectionProperties(this.wsConnection),
      tokenID: this.tokenID,
      url: this.url,
      clientIP: this.clientIP,
      closed: this._closed,
      protocol: this.protocol,
      remoteAddress: this.remoteAddress,
      firstConnectionDate: this.firstConnectionDate,
      durationSecs: Utils.computeTimeDurationSecs(new Date(this.firstConnectionDate).getTime()),
      lastMessageDate: this.lastMessageDate,
      lastPingDate: this.lastPingDate,
      lastPongDate: this.lastPongDate,
    };
  }

  private canSendMessage(wsAction: WebSocketAction, messageToSend: string, initialCommand?: Command, initialCommandPayload?: OCPPPayload): boolean {
    if (this._closed) {
      Logging.beWarning()?.log({
        ...LoggingHelper.getWSWrapperProperties(this),
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.WS_SERVER_MESSAGE,
        module: MODULE_NAME, method: 'canSendMessage',
        message: `'${wsAction}' > Cannot send message '${messageToSend}', WS Connection ID '${this.guid}' is already closed ('${this.url}'`,
        detailedMessages: {
          initialCommand,
          initialCommandPayload
        }
      });
      return false;
    }
    return true;
  }
}
