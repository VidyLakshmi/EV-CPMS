import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import AppAuthError from '../../../exception/AppAuthError';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import Constants from '../../../utils/Constants';
import ERPService from '../../../integration/pricing/convergent-charging/ERPService';
import Logging from '../../../utils/Logging';
import NotificationHandler from '../../../notification/NotificationHandler';
import RatingService from '../../../integration/pricing/convergent-charging/RatingService';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import UserSecurity from './security/UserSecurity';
import UserStorage from '../../../storage/mongodb/UserStorage';
import Utils from '../../../utils/Utils';
import UtilsService from './UtilsService';

export default class UserService {

  public static async handleAssignSitesToUser(action: string, req: Request, res: Response, next: NextFunction) {
    UtilsService.assertComponentIsActiveFromToken(
      req.user, Constants.COMPONENTS.ORGANIZATION,
      Constants.ACTION_UPDATE, Constants.ENTITY_SITES, 'SiteService', 'handleAssignSitesToUser');
    // Filter
    const filteredRequest = UserSecurity.filterAssignSitesToUserRequest(req.body);
    // Check Mandatory fields
    if (!filteredRequest.userID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleAssignSitesToUser', req.user);
    }
    if (!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Site\'s IDs must be provided', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleAssignSitesToUser', req.user);
    }
    // Check auth
    if (!Authorizations.canUpdateUser(req.user, filteredRequest.userID)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_USER,
        filteredRequest.userID,
        Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleAssignSitesToUser',
        req.user);
    }
    // Get the User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.userID);
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${filteredRequest.userID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleAssignSitesToUser', req.user);
    }
    // Get Sites
    for (const siteID of filteredRequest.siteIDs) {
      if (!SiteStorage.siteExists(req.user.tenantID, siteID)) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Site with ID '${siteID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleAssignSitesToUser', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateSite(req.user, siteID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE,
          siteID,
          Constants.HTTP_AUTH_ERROR,
          'UserService', 'handleAssignSitesToUser',
          req.user, user);
      }
    }
    // Save
    if (action.toLowerCase().includes('add')) {
      await UserStorage.addSitesToUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
    } else {
      await UserStorage.removeSitesFromUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, module: 'UserService', method: 'handleAssignSitesToUser',
      message: 'User\'s Sites have been assigned successfully', action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleDeleteUser(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const id = UserSecurity.filterUserByIDRequest(req.query);
    // Check Mandatory fields
    if (!id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleDeleteUser', req.user);
    }
    // Check auth
    if (!Authorizations.canDeleteUser(req.user, id)) {
      throw new AppAuthError(
        Constants.ACTION_DELETE,
        Constants.ENTITY_USER,
        id,
        Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleDeleteUser',
        req.user);
    }
    // Check Mandatory fields
    if (id === req.user.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User cannot delete himself', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleDeleteUser', req.user);
    }
    // Check user
    const user = await UserStorage.getUser(req.user.tenantID, id);
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleDeleteUser', req.user);
    }
    // Deleted
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${id}' is already deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleDeleteUser', req.user);
    }
    if (req.user.activeComponents.includes(Constants.COMPONENTS.ORGANIZATION)) {
      // Delete from site
      // TODO: Add argument to getSites to be able to only query IDs
      const siteIDs: string[] = (await UserStorage.getSites(req.user.tenantID, { userID: id },
        Constants.DB_PARAMS_MAX_LIMIT)).result.map(
        (siteUser) => {
          return siteUser.site.id;
        }
      );
      await UserStorage.removeSitesFromUser(req.user.tenantID, user.id, siteIDs);
    }
    // Delete User
    await UserStorage.deleteUser(req.user.tenantID, user.id);
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: 'UserService', method: 'handleDeleteUser',
      message: `User with ID '${user.id}' has been deleted successfully`,
      action: action
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUpdateUser(action: string, req: Request, res: Response, next: NextFunction) {
    let statusHasChanged = false;
    // Filter
    const filteredRequest = UserSecurity.filterUserUpdateRequest(req.body, req.user);
    // Check Mandatory fields
    if (!filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleDeleteUser', req.user);
    }
    // Check auth
    if (!Authorizations.canUpdateUser(req.user, filteredRequest.id)) {
      throw new AppAuthError(
        Constants.ACTION_UPDATE,
        Constants.ENTITY_USER,
        filteredRequest.id,
        Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleUpdateUser',
        req.user);
    }
    // Get User
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.id);
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleUpdateUser', req.user);
    }
    // Deleted?
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${filteredRequest.id}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleUpdateUser', req.user);
    }
    // Check email
    const userWithEmail = await UserStorage.getUserByEmail(req.user.tenantID, filteredRequest.email);
    // Check if EMail is already taken
    if (userWithEmail && user.id !== userWithEmail.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Email '${filteredRequest.email}' already exists`, Constants.HTTP_USER_EMAIL_ALREADY_EXIST_ERROR,
        'UserService', 'handleUpdateUser', req.user);
    }
    // Check if Status has been changed
    if (filteredRequest.status &&
      filteredRequest.status !== user.status) {
      statusHasChanged = true;
    }
    // Check the password
    if (filteredRequest.password && filteredRequest.password.length > 0) {
      // Update the password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
      filteredRequest.password = newPasswordHashed;
    }
    // Update timestamp
    filteredRequest.lastChangedBy = { id: req.user.id };
    filteredRequest.lastChangedOn = new Date();
    // Clean up request
    delete filteredRequest.passwords;
    // Check Mandatory fields
    Utils.checkIfUserValid(filteredRequest, user, req);
    // Update User
    await UserStorage.saveUser(req.user.tenantID, { ...filteredRequest, tagIDs: [] }, true);
    // Update Tag IDs
    if (Authorizations.isAdmin(req.user.role) || Authorizations.isSuperAdmin(req.user.role)) {
      let newTagIDs = (typeof filteredRequest.tagIDs === 'string') ? [] : filteredRequest.tagIDs;
      // Check types
      newTagIDs = newTagIDs.filter((newTagID) => {
        return typeof newTagID === 'string';
      });
      // Save
      await UserStorage.saveUserTags(req.user.tenantID, filteredRequest.id, newTagIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: user,
      module: 'UserService', method: 'handleUpdateUser',
      message: 'User has been updated successfully',
      action: action
    });
    // Notify
    if (statusHasChanged) {
      // Send notification
      NotificationHandler.sendUserAccountStatusChanged(
        req.user.tenantID,
        Utils.generateGUID(),
        user,
        {
          'user': user,
          'evseDashboardURL': Utils.buildEvseURL((await TenantStorage.getTenant(req.user.tenantID)).subdomain)
        },
        user.locale
      );
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleGetUser(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const id = UserSecurity.filterUserByIDRequest(req.query);
    // User mandatory
    if (!id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleGetUser', req.user);
    }
    // Check auth
    if (!Authorizations.canReadUser(req.user, id)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_USER,
        id,
        Constants.HTTP_AUTH_ERROR, 'UserService', 'handleGetUser',
        req.user);
    }
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, id);
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleGetUser', req.user);
    }
    // Deleted?
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${id}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleGetUser', req.user);
    }
    // Ok
    res.json(
      // Filter
      UserSecurity.filterUserResponse(
        user, req.user)
    );
    next();
  }

  public static async handleGetUserImage(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = { ID: UserSecurity.filterUserByIDRequest(req.query) };
    // User mandatory
    if (!filteredRequest.ID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleGetUser', req.user);
    }
    // Check auth
    if (!Authorizations.canReadUser(req.user, filteredRequest.ID)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_USER,
        filteredRequest.ID,
        Constants.HTTP_AUTH_ERROR, 'UserService', 'handleGetUserImage',
        req.user);
    }
    // Get the logged user
    const user = await UserStorage.getUser(req.user.tenantID, filteredRequest.ID);
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleGetUserImage', req.user);
    }
    // Deleted?
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${filteredRequest.ID}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleGetUserImage', req.user);
    }
    // Get the user image
    const userImage = await UserStorage.getUserImage(req.user.tenantID, filteredRequest.ID);
    // Ok
    res.json(userImage);
    next();
  }

  public static async handleGetUsers(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListUsers(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_USERS,
        null,
        Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleGetUsers',
        req.user);
    }
    // Filter
    const filteredRequest = UserSecurity.filterUsersRequest(req.query);
    // Check component
    if (filteredRequest.SiteID || filteredRequest.ExcludeSiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user,
        Constants.COMPONENTS.ORGANIZATION, Constants.ACTION_READ, Constants.ENTITY_USER, 'UserService', 'handleGetUsers');
    }
    // Get users
    const users = await UserStorage.getUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        statuses: (filteredRequest.Status ? filteredRequest.Status.split('|') : null),
        excludeSiteID: filteredRequest.ExcludeSiteID,
      },
      {
        limit: filteredRequest.Limit,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort,
        onlyRecordCount: filteredRequest.OnlyRecordCount
      }
    );
    // Filter
    UserSecurity.filterUsersResponse(users, req.user);
    // Ok
    res.json(users);
    next();
  }

  public static async handleGetUsersInError(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canListUsers(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_LIST,
        Constants.ENTITY_USERS,
        null,
        Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleGetUsersInError',
        req.user);
    }
    // Filter
    const filteredRequest = UserSecurity.filterUsersRequest(req.query);
    // Check component
    if (filteredRequest.SiteID || filteredRequest.ExcludeSiteID) {
      UtilsService.assertComponentIsActiveFromToken(req.user,
        Constants.COMPONENTS.ORGANIZATION, Constants.ACTION_READ, Constants.ENTITY_USER, 'UserService', 'handleGetUsersInError');
    }
    // Get users
    const users = await UserStorage.getUsers(req.user.tenantID,
      {
        search: filteredRequest.Search,
        siteIDs: (filteredRequest.SiteID ? filteredRequest.SiteID.split('|') : null),
        roles: (filteredRequest.Role ? filteredRequest.Role.split('|') : null),
        statuses: [Constants.USER_STATUS_BLOCKED, Constants.USER_STATUS_INACTIVE, Constants.USER_STATUS_LOCKED, Constants.USER_STATUS_PENDING]
      },
      {
        limit: filteredRequest.Limit,
        onlyRecordCount: filteredRequest.OnlyRecordCount,
        skip: filteredRequest.Skip,
        sort: filteredRequest.Sort
      }
    );
    // Filter
    UserSecurity.filterUsersResponse(users, req.user);
    // Return
    res.json(users);
    next();
  }

  public static async handleCreateUser(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Check auth
    if (!Authorizations.canCreateUser(req.user)) {
      throw new AppAuthError(
        Constants.ACTION_CREATE,
        Constants.ENTITY_USER,
        null,
        Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleCreateUser',
        req.user);
    }
    // Filter
    const filteredRequest = UserSecurity.filterUserCreateRequest(req.body, req.user);
    // Check Mandatory fields
    Utils.checkIfUserValid(filteredRequest, null, req);
    // Get the email
    const foundUser = await UserStorage.getUserByEmail(req.user.tenantID, filteredRequest.email);
    if (foundUser) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Email '${filteredRequest.email}' already exists`, Constants.HTTP_USER_EMAIL_ALREADY_EXIST_ERROR,
        'UserService', 'handleCreateUser', req.user);
    }
    // Clean request
    delete filteredRequest.passwords;
    // Set the password
    if (filteredRequest.password) {
      // Generate a hash for the given password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
      // Generate a hash
      filteredRequest.password = newPasswordHashed;
    }
    // Set timestamp
    filteredRequest.createdBy = { id: req.user.id };
    filteredRequest.createdOn = new Date();
    // Set default
    if (!filteredRequest.notificationsActive) {
      filteredRequest.notificationsActive = true;
    }
    filteredRequest.createdOn = new Date();
    // Create the User
    const newUserId = await UserStorage.saveUser(req.user.tenantID, { ...filteredRequest, tagIDs: [] }, true);
    // Save the Tag IDs
    if (Authorizations.isAdmin(req.user.role) || Authorizations.isSuperAdmin(req.user.role)) {
      let newTagIDs = (typeof filteredRequest.tagIDs === 'string') ? [] : filteredRequest.tagIDs;
      // Check types
      newTagIDs = newTagIDs.filter((newTagID) => {
        return typeof newTagID === 'string';
      });
      // Save
      await UserStorage.saveUserTags(req.user.tenantID, newUserId, newTagIDs);
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: req.user.tenantID,
      user: req.user, actionOnUser: filteredRequest,
      module: 'UserService', method: 'handleCreateUser',
      message: `User with ID '${newUserId}' has been created successfully`,
      action: action
    });
    // Ok
    res.json(Object.assign({ id: newUserId }, Constants.REST_RESPONSE_SUCCESS));
    next();
  }

  public static async handleGetUserInvoice(action: string, req: Request, res: Response, next: NextFunction): Promise<void> {
    // Filter
    const id = UserSecurity.filterUserByIDRequest(req.query);
    // User mandatory
    if (!id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User\'s ID must be provided', Constants.HTTP_GENERAL_ERROR,
        'UserService', 'handleGetUserInvoice', req.user);
    }
    // Check auth
    if (!Authorizations.canReadUser(req.user, id)) {
      throw new AppAuthError(
        Constants.ACTION_READ,
        Constants.ENTITY_USER,
        id,
        Constants.HTTP_AUTH_ERROR, 'UserService', 'handleGetUserInvoice',
        req.user);
    }
    // Get the user
    const user = await UserStorage.getUser(req.user.tenantID, id);
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleGetUserInvoice', req.user);
    }
    // Deleted?
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with ID '${id}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'UserService', 'handleGetUserInvoice', req.user);
    }
    // Get the settings
    const setting = await SettingStorage.getSettingByIdentifier(req.user.tenantID, Constants.COMPONENTS.PRICING);
    let settingInner = setting.content.convergentCharging;
    if (!setting) {
      Logging.logException({ 'message': 'Convergent Charging setting is missing' }, 'UserInvoice', Constants.CENTRAL_SERVER, 'UserService', 'handleGetUserInvoice', req.user.tenantID, req.user);
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'An issue occurred while creating the invoice', Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleGetUserInvoice', req.user);
    }
    // Create services
    const ratingService = new RatingService(settingInner.url, settingInner.user, settingInner.password);
    const erpService = new ERPService(settingInner.url, settingInner.user, settingInner.password);
    let invoiceNumber;
    try {
      await ratingService.loadChargedItemsToInvoicing();
      invoiceNumber = await erpService.createInvoice(req.user.tenantID, user);
    } catch (exception) {
      Logging.logException(exception, 'UserInvoice', Constants.CENTRAL_SERVER, 'UserService', 'handleGetUserInvoice', req.user.tenantID, req.user);
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'An issue occurred while creating the invoice', Constants.HTTP_AUTH_ERROR,
        'UserService', 'handleGetUserInvoice', req.user);
    }
    if (!invoiceNumber) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'No invoices available', 404,
        'UserService', 'handleGetUserInvoice', req.user);
    }
    try {
      const invoiceHeader = await erpService.getInvoiceDocumentHeader(invoiceNumber);
      let invoice = await erpService.getInvoiceDocument(invoiceHeader, invoiceNumber);
      if (!invoice) {
        // Retry to get invoice
        invoice = await erpService.getInvoiceDocument(invoiceHeader, invoiceNumber);
      }
      if (!invoice) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `An error occurred while requesting invoice ${invoiceNumber}`,
          Constants.HTTP_PRICING_REQUEST_INVOICE_ERROR,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      const filename = 'invoice.pdf';
      fs.writeFile(filename, invoice, (err) => { // TODO: potential problem at sccale; two pple generating invoice at same time?
        if (err) {
          throw err;
        }
        res.download(filename, (err) => {
          if (err) {
            throw err;
          }
          fs.unlink(filename, (err) => {
            if (err) {
              throw err;
            }
          });
        });
      });
    } catch (e) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `An error occurred while requesting invoice ${invoiceNumber}`,
        Constants.HTTP_PRICING_REQUEST_INVOICE_ERROR,
        'UserService', 'handleGetUserInvoice', req.user);
    }
  }

}
