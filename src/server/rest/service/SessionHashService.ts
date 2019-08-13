import { NextFunction, Request, Response } from 'express';
import HttpStatus from 'http-status-codes';
import AppError from '../../../exception/AppError';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import global from '../../../types/GlobalType';
import Logging from '../../../utils/Logging';
import Tenant from '../../../types/Tenant';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';

export default class SessionHashService {
  // Check if Session has been updated and require new login
  static isSessionHashUpdated(req: Request, res: Response, next: NextFunction) {
    // Get tenant id, user id and hash ID
    const userID = req.user.id;
    const tenantID = req.user.tenantID;
    const userHashID = req.user.userHashID;
    const tenantHashID = req.user.tenantHashID;

    try {
      // Check User's Hash
      if (global.userHashMapIDs.has(`${tenantID}#${userID}`) &&
        global.userHashMapIDs.get(`${tenantID}#${userID}`) !== userHashID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'User has been updated and will be logged off',
          HttpStatus.FORBIDDEN,
          'SessionHashService', 'isSessionHashUpdated',
          req.user
        );
      }
      if (global.tenantHashMapIDs.has(`${tenantID}`) &&
        global.tenantHashMapIDs.get(`${tenantID}`) !== tenantHashID) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Tenant has been updated and all users will be logged off',
          HttpStatus.FORBIDDEN,
          'SessionHashService', 'isSessionHashUpdated',
          req.user
        );
      }
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse('SessionHashService', err, req, res, next);
      return true;
    }
    return false;
  }

  // Build User Hash ID
  static buildUserHashID(user: User) {
    // Get all field that need to be hashed
    const tags = user.tagIDs && user.tagIDs.length > 0 ? user.tagIDs.sort().join('-') : '';
    const data = `${user.locale.substring(0, 2)}/${user.role}/${user.status}/${tags}`;
    return Cypher.hash(data);
  }

  // Build Tenant Hash ID
  static buildTenantHashID(tenant: Tenant) {
    // Get all field that need to be hashed
    const data = JSON.stringify(Utils.getTenantActiveComponents(tenant));
    return Cypher.hash(data);
  }

  // Rebuild and store User Hash ID
  static async rebuildUserHashID(tenantID: string, userID: string) {
    // Build User hash
    const user = await UserStorage.getUser(tenantID, userID);
    if (user) {
      global.userHashMapIDs.set(`${tenantID}#${userID}`, SessionHashService.buildUserHashID(user));
    } else {
      global.userHashMapIDs.delete(`${tenantID}#${userID}`);
    }
  }

  // Rebuild and store Tenant Hash ID
  static async rebuildTenantHashID(tenantID: string) {
    // Build Tenant hash
    const tenant = await TenantStorage.getTenant(tenantID);
    if (tenant) {
      global.tenantHashMapIDs.set(`${tenantID}`, SessionHashService.buildTenantHashID(tenant));
    } else {
      global.tenantHashMapIDs.delete(`${tenantID}`);
    }
  }
}
