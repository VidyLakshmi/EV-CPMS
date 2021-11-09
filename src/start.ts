import CentralSystemConfiguration, { CentralSystemImplementation } from './types/configuration/CentralSystemConfiguration';
import { ServerAction, ServerType } from './types/Server';

import AsyncTaskManager from './async-task/AsyncTaskManager';
import CentralRestServer from './server/rest/CentralRestServer';
import CentralSystemRestServiceConfiguration from './types/configuration/CentralSystemRestServiceConfiguration';
import ChargingStationConfiguration from './types/configuration/ChargingStationConfiguration';
import ChargingStationStorage from './storage/mongodb/ChargingStationStorage';
import { ChargingStationTemplate } from './types/ChargingStation';
import Configuration from './utils/Configuration';
import Constants from './utils/Constants';
import I18nManager from './utils/I18nManager';
import JsonCentralSystemServer from './server/ocpp/json/JsonCentralSystemServer';
import Logging from './utils/Logging';
import MigrationConfiguration from './types/configuration/MigrationConfiguration';
import MigrationHandler from './migration/MigrationHandler';
import MongoDBStorage from './storage/mongodb/MongoDBStorage';
import OCPIServer from './server/ocpi/OCPIServer';
import OCPIServiceConfiguration from './types/configuration/OCPIServiceConfiguration';
import ODataServer from './server/odata/ODataServer';
import ODataServiceConfiguration from './types/configuration/ODataServiceConfiguration';
import OICPServer from './server/oicp/OICPServer';
import OICPServiceConfiguration from './types/configuration/OICPServiceConfiguration';
import SchedulerManager from './scheduler/SchedulerManager';
import SoapCentralSystemServer from './server/ocpp/soap/SoapCentralSystemServer';
import StorageConfiguration from './types/configuration/StorageConfiguration';
import Utils from './utils/Utils';
import chalk from 'chalk';
import fs from 'fs';
import global from './types/GlobalType';

const MODULE_NAME = 'Bootstrap';

export default class Bootstrap {
  private static centralSystemRestConfig: CentralSystemRestServiceConfiguration;
  private static centralRestServer: CentralRestServer;
  private static chargingStationConfig: ChargingStationConfiguration;
  private static storageConfig: StorageConfiguration;
  private static centralSystemsConfig: CentralSystemConfiguration[];
  private static SoapCentralSystemServer: SoapCentralSystemServer;
  private static JsonCentralSystemServer: JsonCentralSystemServer;
  private static ocpiConfig: OCPIServiceConfiguration;
  private static ocpiServer: OCPIServer;
  private static oicpConfig: OICPServiceConfiguration;
  private static oicpServer: OICPServer;
  private static oDataServerConfig: ODataServiceConfiguration;
  private static oDataServer: ODataServer;
  private static database: MongoDBStorage;
  private static migrationConfig: MigrationConfiguration;

  public static async start(): Promise<void> {
    let serverStarted: ServerType[] = [];
    let startTimeMillis: number;
    const startTimeGlobalMillis = await this.logAndGetStartTimeMillis('e-Mobility Server is starting...');
    try {
      // Setup i18n
      await I18nManager.initialize();
      console.log(`NodeJS is started in '${process.env.NODE_ENV || 'development'}' mode`);
      // Get all configs
      Bootstrap.storageConfig = Configuration.getStorageConfig();
      Bootstrap.centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
      Bootstrap.centralSystemsConfig = Configuration.getCentralSystemsConfig();
      Bootstrap.chargingStationConfig = Configuration.getChargingStationConfig();
      Bootstrap.ocpiConfig = Configuration.getOCPIServiceConfig();
      Bootstrap.oicpConfig = Configuration.getOICPServiceConfig();
      Bootstrap.oDataServerConfig = Configuration.getODataServiceConfig();
      Bootstrap.migrationConfig = Configuration.getMigrationConfig();

      // -------------------------------------------------------------------------
      // Connect to the DB
      // -------------------------------------------------------------------------
      // Check database implementation
      startTimeMillis = await this.logAndGetStartTimeMillis('Connecting to the Database...');
      switch (Bootstrap.storageConfig.implementation) {
        // MongoDB?
        case 'mongodb':
          // Create MongoDB
          Bootstrap.database = new MongoDBStorage(Bootstrap.storageConfig);
          break;
        default:
          console.error(chalk.red(`Storage Server implementation '${Bootstrap.storageConfig.implementation}' not supported!`));
      }
      // Connect to the Database
      await Bootstrap.database.start();
      // Log
      await this.logDuration(startTimeMillis, 'Connected to the Database successfully');

      // -------------------------------------------------------------------------
      // Start DB Migration
      // -------------------------------------------------------------------------
      if (Bootstrap.migrationConfig.active) {
        startTimeMillis = await this.logAndGetStartTimeMillis('Migration is starting...');
        // Check and trigger migration (only master process can run the migration)
        await MigrationHandler.migrate();
        // Log
        await this.logDuration(startTimeMillis, 'Migration has been run successfully');
      }
      // Listen to promise failure
      process.on('unhandledRejection', (reason: any, p: any): void => {
        // eslint-disable-next-line no-console
        console.error(chalk.red(`Unhandled Rejection: ${p?.toString()}, reason: ${reason as string}`));
        void Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.UNKNOWN_ACTION,
          module: MODULE_NAME, method: 'start',
          message: `Unhandled Rejection: ${(reason ? (reason.message ?? reason) : 'Not provided')}`,
          detailedMessages: (reason ? reason.stack : null)
        });
      });

      // -------------------------------------------------------------------------
      // Start all the Servers
      // -------------------------------------------------------------------------
      startTimeMillis = await this.logAndGetStartTimeMillis('Server is starting...');
      // Start the Servers
      serverStarted = await Bootstrap.startServersListening();
      // Log
      await this.logDuration(startTimeMillis, `Server ${serverStarted.join(', ')} has been started successfully`);

      // -------------------------------------------------------------------------
      // Init the Scheduler
      // -------------------------------------------------------------------------
      startTimeMillis = await this.logAndGetStartTimeMillis('Scheduler is starting...');
      // Start the Scheduler
      await SchedulerManager.init();
      // Log
      await this.logDuration(startTimeMillis, 'Scheduler has been started successfully');

      // -------------------------------------------------------------------------
      // Init the Async Task
      // -------------------------------------------------------------------------
      startTimeMillis = await this.logAndGetStartTimeMillis('Async Task manager is starting...');
      // Start the Async Manager
      await AsyncTaskManager.init();
      // Log
      await this.logDuration(startTimeMillis, 'Async Task manager has been started successfully');

      // -------------------------------------------------------------------------
      // Update Charging Station Templates
      // -------------------------------------------------------------------------
      startTimeMillis = await this.logAndGetStartTimeMillis('Charging Station templates is being updated...');
      // Load and Save the Charging Station templates
      await this.updateChargingStationTemplatesFromFile();
      // Log
      await this.logDuration(startTimeMillis, 'Charging Station templates have been updated successfully');

      // Keep the server names globally
      if (serverStarted.length === 1) {
        global.serverType = serverStarted[0];
      } else {
        global.serverType = ServerType.CENTRAL_SERVER;
      }
      // Log
      await this.logDuration(startTimeGlobalMillis, `${serverStarted.join(', ')} server has been started successfuly`, ServerAction.BOOTSTRAP_STARTUP);
    } catch (error) {
      console.error(chalk.red(error));
      global.database && await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.BOOTSTRAP_STARTUP,
        module: MODULE_NAME, method: 'start',
        message: `Unexpected exception in ${serverStarted.join(', ')}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private static async updateChargingStationTemplatesFromFile(): Promise<void> {
    // Read File
    let chargingStationTemplates: ChargingStationTemplate[];
    try {
      chargingStationTemplates = JSON.parse(fs.readFileSync(Configuration.getChargingStationTemplatesConfig().templatesFilePath, 'utf8'));
    } catch (error) {
      await Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
      return;
    }
    // Delete all previous templates
    await ChargingStationStorage.deleteChargingStationTemplates();
    // Update Templates
    for (const chargingStationTemplate of chargingStationTemplates) {
      try {
        // Set the hashes
        chargingStationTemplate.hash = Utils.hash(JSON.stringify(chargingStationTemplate));
        chargingStationTemplate.hashTechnical = Utils.hash(JSON.stringify(chargingStationTemplate.technical));
        chargingStationTemplate.hashCapabilities = Utils.hash(JSON.stringify(chargingStationTemplate.capabilities));
        chargingStationTemplate.hashOcppStandard = Utils.hash(JSON.stringify(chargingStationTemplate.ocppStandardParameters));
        chargingStationTemplate.hashOcppVendor = Utils.hash(JSON.stringify(chargingStationTemplate.ocppVendorParameters));
        // Save
        await ChargingStationStorage.saveChargingStationTemplate(chargingStationTemplate);
      } catch (error) {
        error.message = `Charging Station Template ID '${chargingStationTemplate.id}' is not valid: ${error.message as string}`;
        await Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT, ServerAction.UPDATE_CHARGING_STATION_TEMPLATES, error);
        Utils.isDevelopmentEnv() && console.error(chalk.red(error.message));
      }
    }
  }

  private static async logAndGetStartTimeMillis(logMessage: string): Promise<number> {
    const timeStartMillis = Date.now();
    console.log(chalk.green(logMessage));
    if (global.database) {
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'start',
        message: logMessage
      });
    }
    return timeStartMillis;
  }

  private static async logDuration(timeStartMillis: number, logMessage: string, action: ServerAction = ServerAction.STARTUP): Promise<void> {
    const timeDurationSecs = Utils.createDecimal(Date.now() - timeStartMillis).div(1000).toNumber();
    logMessage = `${logMessage} in ${timeDurationSecs} secs`;
    console.log(chalk.green(logMessage));
    if (global.database) {
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action,
        module: MODULE_NAME, method: 'start',
        message: logMessage
      });
    }
  }

  private static async startServersListening(): Promise<ServerType[]> {
    const serverTypes: ServerType[] = [];
    try {
      // -------------------------------------------------------------------------
      // REST Server (Front-End)
      // -------------------------------------------------------------------------
      if (Bootstrap.centralSystemRestConfig) {
        // Create the server
        if (!Bootstrap.centralRestServer) {
          Bootstrap.centralRestServer = new CentralRestServer(Bootstrap.centralSystemRestConfig);
        }
        // Start it
        await Bootstrap.centralRestServer.start();
        serverTypes.push(ServerType.REST_SERVER);
      }
      // -------------------------------------------------------------------------
      // Central Server (Charging Stations)
      // -------------------------------------------------------------------------
      if (Bootstrap.centralSystemsConfig) {
        // Start
        for (const centralSystemConfig of Bootstrap.centralSystemsConfig) {
          // Check implementation
          switch (centralSystemConfig.implementation) {
            // SOAP
            case CentralSystemImplementation.SOAP:
              // Create implementation
              Bootstrap.SoapCentralSystemServer = new SoapCentralSystemServer(centralSystemConfig, Bootstrap.chargingStationConfig);
              // Start
              await Bootstrap.SoapCentralSystemServer.start();
              serverTypes.push(ServerType.SOAP_SERVER);
              break;
            case CentralSystemImplementation.JSON:
              // Create implementation
              Bootstrap.JsonCentralSystemServer = new JsonCentralSystemServer(centralSystemConfig, Bootstrap.chargingStationConfig);
              // Start
              await Bootstrap.JsonCentralSystemServer.start();
              serverTypes.push(ServerType.JSON_SERVER);
              break;
            // Not Found
            default:
              // eslint-disable-next-line no-console
              console.log(`Central System Server implementation '${centralSystemConfig.implementation}' not found!`);
          }
        }
      }
      // -------------------------------------------------------------------------
      // OCPI Server
      // -------------------------------------------------------------------------
      if (Bootstrap.ocpiConfig) {
        // Create server instance
        Bootstrap.ocpiServer = new OCPIServer(Bootstrap.ocpiConfig);
        // Start server instance
        await Bootstrap.ocpiServer.start();
        serverTypes.push(ServerType.OCPI_SERVER);
      }
      // -------------------------------------------------------------------------
      // OICP Server
      // -------------------------------------------------------------------------
      if (Bootstrap.oicpConfig) {
        // Create server instance
        Bootstrap.oicpServer = new OICPServer(Bootstrap.oicpConfig);
        // Start server instance
        await Bootstrap.oicpServer.start();
        serverTypes.push(ServerType.OICP_SERVER);
      }
      // -------------------------------------------------------------------------
      // OData Server
      // -------------------------------------------------------------------------
      if (Bootstrap.oDataServerConfig) {
        // Create server instance
        Bootstrap.oDataServer = new ODataServer(Bootstrap.oDataServerConfig);
        // Start server instance
        await Bootstrap.oDataServer.start();
        serverTypes.push(ServerType.ODATA_SERVER);
      }
    } catch (error) {
      console.error(chalk.red(error.stack));
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'startServersListening',
        message: `Unexpected exception in ${serverTypes.join(', ')}: ${error.toString()}`,
        detailedMessages: { error: error.stack }
      });
    }
    // Batch server only
    if (Utils.isEmptyArray(serverTypes)) {
      serverTypes.push(ServerType.BATCH_SERVER);
    }
    return serverTypes;
  }
}

// Start
Bootstrap.start().catch(
  (error) => {
    console.error(chalk.red(error));
  }
);
