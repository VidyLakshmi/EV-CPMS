import fs from 'fs';
import WebSocket from 'ws';
import https from 'https';
import http from 'http';
import cluster from 'cluster';
import Logging from '../../../utils/Logging';
import Constants from '../../../utils/Constants';

const MODULE_NAME = "WSServer";
export default class WSServer extends WebSocket.Server {
  private httpServer: any;
  private serverName: any;
  private serverConfig: any;
  private keepAliveIntervalValue: any;
  public on: any;
  private keepAliveInterval: any;
  public clients: any;

  /**
   * Create a new `WSServer`.
   *
   * @param {Object} httpServer
   * @param {String} serverName
   * @param {Object} serverConfig
   * @param {Function} verifyClientCb
   * @param {Function} handleProtocolsCb
   */
  constructor(httpServer, serverName, serverConfig, verifyClientCb: any = () => { }, handleProtocolsCb: any = () => { }) {
    // Create the Web Socket Server
    super({
      server: httpServer,
      verifyClient: verifyClientCb,
      handleProtocols: handleProtocolsCb
    });
    this.httpServer = httpServer;
    this.serverName = serverName;
    this.serverConfig = serverConfig;
    this.keepAliveIntervalValue = (this.serverConfig.hasOwnProperty('keepaliveinterval') ?
      this.serverConfig.keepaliveinterval : Constants.WS_DEFAULT_KEEPALIVE) * 1000; // ms
    this.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
    });
    this.keepAliveInterval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (ws.isAlive === false)
          return ws.terminate();
        ws.isAlive = false;
        ws.ping(() => { });
      });
    }, this.keepAliveIntervalValue);
  }

  static createHttpServer(serverConfig) {
    // Create HTTP server
    let httpServer;
    // Secured protocol?
    if (serverConfig.protocol === "wss") {
      // Create the options
      const options: any = {};
      // Set the keys
      options.key = fs.readFileSync(serverConfig["ssl-key"]);
      options.cert = fs.readFileSync(serverConfig["ssl-cert"]);
      // Https server
      httpServer = https.createServer(options, (req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    } else {
      // Http server
      httpServer = http.createServer((req, res) => {
        res.writeHead(200);
        res.end('No support\n');
      });
    }
    return httpServer;
  }

  broadcastToClients(message) {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  start() {
    // Log
    let logMsg;
    if (cluster.isWorker) {
      logMsg = `Starting ${this.serverName} Json ${MODULE_NAME} in worker ${cluster.worker.id}...`;
    } else {
      logMsg = `Starting ${this.serverName} Json ${MODULE_NAME} in master...`;
    }
    // eslint-disable-next-line no-console
    console.log(logMsg);
    // Make server to listen
    this._startListening();
  }

  _startListening() {
    // Start listening
    this.httpServer.listen(this.serverConfig.port, this.serverConfig.host, () => {
      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "_startListening", action: "Startup",
        message: `${this.serverName} Json ${MODULE_NAME} listening on '${this.serverConfig.protocol}://${this.httpServer.address().address}:${this.httpServer.address().port}'`
      });
      // eslint-disable-next-line no-console
      console.log(`${this.serverName} Json ${MODULE_NAME} listening on '${this.serverConfig.protocol}://${this.httpServer.address().address}:${this.httpServer.address().port}' ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}`);
    });
  }
}

