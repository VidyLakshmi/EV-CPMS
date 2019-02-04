const AbstractEndpoint = require('../AbstractEndpoint');
const OCPIUtils = require('../../OCPIUtils');
const OCPIMapping = require('./OCPIMapping');
const OCPIClientError = require('../../../../exception/OCPIClientError');
const OCPIServerError = require('../../../../exception/OCPIServerError');
const OCPIEndpoint = require('../../../../entity/OCPIEndpoint');
const Logging = require('../../../../utils/Logging');
const Constants = require("../../../../utils/Constants");
const axios = require('axios');

require('source-map-support').install();

const EP_IDENTIFIER = "credentials";
const EP_VERSION = "2.1.1";
const MODULE_NAME = "CredentialsEndpoint";

/**
 * Credentials Endpoint
 */
class CredentialsEndpoint extends AbstractEndpoint {
  constructor(ocpiService) {
    super(ocpiService, EP_IDENTIFIER, EP_VERSION);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req, res, next, tenant) { // eslint-disable-line
    try {
      switch (req.method) {
        case "POST":
          await this.postCredentials(req, res, next, tenant);
          break;
        case "DELETE":
          await this.deleteCredentials(req, res, next, tenant);
          break;
        default:
          res.sendStatus(501);
          break;
      }
    } catch (error) {
      next(error);
    }
  }


  /**
   * Registration process initiated by IOP
   */
  async deleteCredentials(req, res, next, tenant) { // eslint-disable-line
    // get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    // log body
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'deleteCredentials',
      message: "Received unregister",
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: `deleteCredentials`,
      detailedMessages: token
    });

    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpoint.getOcpiendpointWithToken(tenant.getID(), token);

    // check if ocpiEndpoint available
    if (!ocpiEndpoint || ocpiEndpoint.getStatus() === Constants.OCPI_REGISTERING_STATUS.OCPI_UNREGISTERED) {
      throw new OCPIServerError(
        'DELETE credentials',
        `method not allowed if the client was not registered`, 405,
        EP_IDENTIFIER, 'deleteCredentials', null);
    }

    // save copi endpoint
    ocpiEndpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_UNREGISTERED);
    await ocpiEndpoint.save();

    // respond with credentials
    res.json(OCPIUtils.success());
  }

  /**
   * Registration process initiated by IOP
   */
  async postCredentials(req, res, next, tenant) { // eslint-disable-line
    // get payload
    const credential = req.body;

    // log body
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'postCredentials',
      message: "Received credential object",
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: `postCredentials`,
      detailedMessages: credential
    });

    // check if valid
    if (!OCPIMapping.isValidOCPICredential(credential)) {
      throw new OCPIClientError(
        'POST credentials',
        `Invalid Credential Object`, 500,
        EP_IDENTIFIER, 'postCredentials', null);
    }

    // get token from header
    let token;
    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    // log body
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'postCredentials',
      message: "Received token",
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: `postCredentials`,
      detailedMessages: token
    });

    // Get ocpiEndpoints based on the given token
    const ocpiEndpoint = await OCPIEndpoint.getOcpiendpointWithToken(tenant.getID(), token);

    // check if ocpiEndpoint available
    if (!ocpiEndpoint) {
      throw new OCPIServerError(
        'POST credentials',
        `OCPI Endpoint not available or wrong token`, 500,
        EP_IDENTIFIER, 'postCredentials', null);
    }

    // save information
    ocpiEndpoint.setBaseUrl(credential.url);
    ocpiEndpoint.setToken(credential.token);
    ocpiEndpoint.setCountryCode(credential.country_code);
    ocpiEndpoint.setPartyId(credential.party_id);
    ocpiEndpoint.setBusinessDetails(credential.business_details);

    // log updated ocpi endpoint
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'postCredentials',
      message: "OCPI Server found and updated with credential object",
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: `postCredentials`,
      detailedMessages: ocpiEndpoint.getModel()
    });

    // try to access remote ocpi service versions
    // any error here should result in a 3001 Ocpi result execption based on the specification
    try {
      // access versions API
      const ocpiVersions = await axios.get(ocpiEndpoint.getBaseUrl(), {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      // log Avaialble OCPI Versions
      Logging.logDebug({
        tenantID: tenant.getID(),
        action: 'postCredentials',
        message: "Available OCPI Versions",
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: `postCredentials`,
        detailedMessages: ocpiVersions.data
      });

      // check response
      if (!ocpiVersions.data || !ocpiVersions.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.getBaseUrl()}`);
      }

      // loop through versions and pick the same one
      let versionFound = false;
      for (const version of ocpiVersions.data.data) {
        if (version.version === this.getVersion()) {
          versionFound = true;
          ocpiEndpoint.setVersion(version.version);
          ocpiEndpoint.setVersionUrl(version.url);

          // log correct OCPI service found
          Logging.logDebug({
            tenantID: tenant.getID(),
            action: 'postCredentials',
            message: "Correct OCPI version found",
            source: 'OCPI Server',
            module: MODULE_NAME,
            method: `postCredentials`,
            detailedMessages: `[${ocpiEndpoint.getVersion()}]:${ocpiEndpoint.getVersionUrl()}`
          });
        }
      }

      // if not found trigger exception
      if (!versionFound) {
        throw new Error(`OCPI Endpoint version ${this.getVersion()} not found`);
      }

      // try to read endpoints
      // access versions API
      const endpoints = await axios.get(ocpiEndpoint.getVersionUrl(), {
        headers: {
          'Authorization': `Token ${ocpiEndpoint.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      // log Available OCPI services
      Logging.logDebug({
        tenantID: tenant.getID(),
        action: 'postCredentials',
        message: "Available OCPI services",
        source: 'OCPI Server',
        module: MODULE_NAME,
        method: `postCredentials`,
        detailedMessages: endpoints.data
      });
      // check response
      if (!endpoints.data || !endpoints.data.data) {
        throw new Error(`Invalid response from GET ${ocpiEndpoint.getVersionUrl()}`);
      }

      // set available endpoints
      ocpiEndpoint.setAvailableEndpoints(OCPIMapping.convertEndpoints(endpoints.data.data));
    } catch (error) {
      throw new OCPIServerError(
        'POST credentials',
        `Unable to use client API: ${error.message}`, 500,
        EP_IDENTIFIER, 'postCredentials', Constants.OCPI_STATUS_CODE.CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR);
    }

    // generate new token
    await ocpiEndpoint.generateLocalToken(tenant);
    ocpiEndpoint.setStatus(Constants.OCPI_REGISTERING_STATUS.OCPI_REGISTERED);

    // save copi endpoint
    await ocpiEndpoint.save();

    // get base url
    const versionUrl = this.getBaseUrl(req) + Constants.OCPI_SERVER_BASE_PATH;

    // build credential object
    const respCredential = await OCPIMapping.buildOCPICredentialObject(tenant, ocpiEndpoint.getLocalToken(), versionUrl);

    // log Avaialble OCPI Versions
    Logging.logDebug({
      tenantID: tenant.getID(),
      action: 'postCredentials',
      message: "Response with credential object",
      source: 'OCPI Server',
      module: MODULE_NAME,
      method: `postCredentials`,
      detailedMessages: respCredential
    });

    // respond with credentials
    res.json(OCPIUtils.success(respCredential));
  }
}




module.exports = CredentialsEndpoint;