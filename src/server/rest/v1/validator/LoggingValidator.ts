import { HttpLogRequest, HttpLogsRequest } from '../../../../types/requests/HttpLoggingRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class LoggingValidator extends SchemaValidator {
  private static instance: LoggingValidator|null = null;
  private loggingsGet: Schema;
  private loggingGet: Schema;

  private constructor() {
    super('LoggingValidator');
    this.loggingsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/logging/loggings-get.json`, 'utf8'));
    this.loggingGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/logging/logging-get.json`, 'utf8'));
  }

  public static getInstance(): LoggingValidator {
    if (!LoggingValidator.instance) {
      LoggingValidator.instance = new LoggingValidator();
    }
    return LoggingValidator.instance;
  }

  public validateLoggingsGetReq(data: unknown): HttpLogsRequest {
    return this.validate('validateLoggingsGetReq', this.loggingsGet, data);
  }

  public validateLoggingGetReq(data: unknown): HttpLogRequest {
    return this.validate('validateLoggingGetReq', this.loggingGet, data);
  }
}
