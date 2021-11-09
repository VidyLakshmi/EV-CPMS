import { ServerAction, ServerProtocol, ServerType } from '../types/Server';
import http, { IncomingMessage, ServerResponse } from 'http';

import { AddressInfo } from 'net';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServerConfiguration';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { StatusCodes } from 'http-status-codes';
import Utils from '../utils/Utils';
import https from 'https';

export class ServerUtils {
  public static async defaultListenCb(serverModuleName: string, methodName: string, serverType: ServerType,
      protocol: ServerProtocol, hostname: string, port: number): Promise<void> {
    const logMsg = `${serverType} Server listening on '${protocol}://${hostname}:${port}'`;
    // Log
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: serverModuleName, method: methodName,
      action: ServerAction.STARTUP,
      message: logMsg
    });
    // eslint-disable-next-line no-console
    console.log(logMsg);
  }

  public static createHttpServer(serverConfig: CentralSystemServerConfiguration,
      requestListener: http.RequestListener = ServerUtils.defaultHttpServerRequestListener.bind(this)): http.Server {
    let httpServer: http.Server;
    // Create the HTTP server
    if (serverConfig.protocol === ServerProtocol.HTTPS || serverConfig.protocol === ServerProtocol.WSS) {
      // Create the options
      const options: https.ServerOptions = {};
      // Intermediate cert?
      if (serverConfig.sslCa) {
        // Array?
        if (!Utils.isEmptyArray(serverConfig.sslCa)) {
          options.ca = [];
          // Add all
          for (let i = 0; i < serverConfig.sslCa.length; i++) {
            // FIXME: read certificates directly from config.json file. In the future: config for OICP in default tenant
            if (serverConfig.sslCa[i]) {
              options.ca.push(serverConfig.sslCa[i]);
            }
          }
        } else {
          // Add one
          options.ca = serverConfig.sslCa;
        }
      }
      // Https server
      httpServer = https.createServer(options, requestListener);
    } else {
      // Http server
      httpServer = http.createServer(requestListener);
    }
    return httpServer;
  }

  public static startHttpServer(serverConfig: CentralSystemServerConfiguration, httpServer: http.Server,
      serverModuleName: string, serverType: ServerType, listenCb?: () => void): void {
    let cb: () => void;
    if (listenCb && typeof listenCb === 'function') {
      cb = listenCb;
    } else {
      cb = async () => {
        await ServerUtils.defaultListenCb(serverModuleName, 'startHttpServer', serverType, serverConfig.protocol, ServerUtils.getHttpServerAddress(httpServer), ServerUtils.getHttpServerPort(httpServer));
      };
    }
    // Log
    // eslint-disable-next-line no-console
    console.log(`Starting ${serverType} Server...`);
    // Listen
    if (serverConfig.host && serverConfig.port) {
      httpServer.listen(serverConfig.port, serverConfig.host, cb);
    } else if (!serverConfig.host && serverConfig.port) {
      httpServer.listen(serverConfig.port, cb);
    } else {
      // eslint-disable-next-line no-console
      console.log(`Fail to start ${serverType} Server listening, missing required port configuration`);
    }
  }

  private static getHttpServerPort(httpServer: http.Server): number {
    return (httpServer.address() as AddressInfo).port;
  }

  private static getHttpServerAddress(httpServer: http.Server): string {
    return (httpServer.address() as AddressInfo).address;
  }

  private static defaultHttpServerRequestListener(req: IncomingMessage, res: ServerResponse): void {
    if (Configuration.getHealthCheckConfig().enabled && req.url === Constants.HEALTH_CHECK_ROUTE) {
      res.writeHead(StatusCodes.OK);
      res.end();
    } else {
      res.writeHead(StatusCodes.BAD_REQUEST);
      res.end('Unsupported request\n');
    }
  }
}
