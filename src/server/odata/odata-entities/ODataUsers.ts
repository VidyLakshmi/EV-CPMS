import AbstractODataEntities from './AbstractODataEntities';
import User from '../../../types/User';

export default class ODataUsers extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  static getObjectKey(user: User) {
    return user.id;
  }

  static async getUsers(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = ODataUsers.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getUsers(params);
      // Return response
      ODataUsers.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}

