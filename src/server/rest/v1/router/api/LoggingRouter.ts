/* eslint-disable @typescript-eslint/no-misused-promises */
import { RESTServerRoute, ServerAction } from '../../../../../types/Server';
import express, { NextFunction, Request, Response } from 'express';

import LoggingService from '../../service/LoggingService';
import RouterUtils from '../../../../../utils/RouterUtils';

export default class LoggingRouter {
  private router: express.Router;

  public constructor() {
    this.router = express.Router();
  }

  public buildRoutes(): express.Router {
    this.buildRouteLoggings();
    this.buildRouteLogging();
    this.buildRouteLoggingsExport();
    return this.router;
  }

  private buildRouteLoggings(): void {
    this.router.get(`/${RESTServerRoute.REST_LOGGINGS}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(LoggingService.handleGetLogs.bind(this), ServerAction.LOGGINGS, req, res, next);
    });
  }

  private buildRouteLogging(): void {
    this.router.get(`/${RESTServerRoute.REST_LOGGING}`, async (req: Request, res: Response, next: NextFunction) => {
      req.query.ID = req.params.id;
      await RouterUtils.handleRestServerAction(LoggingService.handleGetLog.bind(this), ServerAction.LOGGING, req, res, next);
    });
  }

  private buildRouteLoggingsExport(): void {
    this.router.get(`/${RESTServerRoute.REST_LOGGINGS_EXPORT}`, async (req: Request, res: Response, next: NextFunction) => {
      await RouterUtils.handleRestServerAction(LoggingService.handleExportLogs.bind(this), ServerAction.LOGGINGS_EXPORT, req, res, next);
    });
  }
}
