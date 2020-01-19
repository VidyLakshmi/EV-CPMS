import AbstractOCPIService from '../../AbstractOCPIService';
import { NextFunction, Request, Response } from 'express';
import { Configuration } from '../../../../types/configuration/Configuration';

const VERSION = '2.0';

/**
 * OCPI Service 2.0 - Not Implemented - Only used for testing multiple Services declaration
 */
export default class OCPIService extends AbstractOCPIService {
  // Create OCPI Service
  constructor(ocpiRestConfig: Configuration['OCPIService'], path: string) {
    super(ocpiRestConfig, path, VERSION);
  }

  // Rest Service Implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async restService(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Not implemented
    res.sendStatus(501);
  }
}

