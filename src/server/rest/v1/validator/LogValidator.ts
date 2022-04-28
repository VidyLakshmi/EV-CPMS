import { HttpLogRequest, HttpLogsRequest } from '../../../../types/requests/HttpLogRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class LogValidator extends SchemaValidator {
  private static instance: LogValidator|null = null;
  private logsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/log/logs-get.json`, 'utf8'));
  private logGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/log/log-get.json`, 'utf8'));

  private constructor() {
    super('LogValidator');
  }

  public static getInstance(): LogValidator {
    if (!LogValidator.instance) {
      LogValidator.instance = new LogValidator();
    }
    return LogValidator.instance;
  }

  public validateLogsGetReq(data: Record<string, unknown>): HttpLogsRequest {
    return this.validate(this.logsGet, data);
  }

  public validateLogGetReq(data: Record<string, unknown>): HttpLogRequest {
    return this.validate(this.logGet, data);
  }
}
