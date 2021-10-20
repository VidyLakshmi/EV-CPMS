import express, { NextFunction, Request, Response } from 'express';

import CFLog from 'cf-nodejs-logging-support';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { StatusCodes } from 'http-status-codes';
import Utils from '../utils/Utils';
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import locale from 'locale';
import morgan from 'morgan';

bodyParserXml(bodyParser);

export default class ExpressUtils {
  public static initApplication(bodyLimit = '1mb', debug = false): express.Application {
    const app = express();
    // Secure the application
    app.use(helmet());
    // Cross origin headers
    app.use(cors());
    // Body parser
    app.use(bodyParser.json({
      limit: bodyLimit
    }));
    app.use(bodyParser.urlencoded({
      extended: false,
      limit: bodyLimit
    }));
    // Debug
    if (debug || Utils.isDevelopmentEnv()) {
      app.use(morgan((tokens, req: Request, res: Response) =>
        [
          tokens.method(req, res),
          tokens.url(req, res), '-',
          tokens.status(req, res), '-',
          tokens['response-time'](req, res) + 'ms', '-',
          tokens.res(req, res, 'content-length') / 1024 + 'Kb',
        ].join(' ')
      ));
    }
    app.use(hpp());
    app.use(bodyParser['xml']({
      limit: bodyLimit
    }));
    // Health Check Handling
    if (Configuration.getHealthCheckConfig().enabled) {
      app.get(Constants.HEALTH_CHECK_ROUTE, ExpressUtils.healthCheckService.bind(this));
    }
    // Use
    app.use(locale(Constants.SUPPORTED_LOCALES));
    // Check Cloud Foundry
    if (Configuration.isCloudFoundry()) {
      // Bind to express app
      app.use(CFLog.logNetwork);
    }
    return app;
  }

  public static postInitApplication(app: express.Application): void {
    // Log Express Response
    app.use(Logging.traceExpressResponse.bind(this));
    // Error Handling
    app.use(Logging.traceExpressError.bind(this));
  }

  private static healthCheckService(req: Request, res: Response, next: NextFunction): void {
    res.sendStatus(StatusCodes.OK);
  }
}
