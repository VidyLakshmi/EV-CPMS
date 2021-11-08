import AsyncTaskConfiguration from '../types/configuration/AsyncTaskConfiguration';
import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import AxiosConfiguration from '../types/configuration/AxiosConfiguration';
import CentralSystemConfiguration from '../types/configuration/CentralSystemConfiguration';
import CentralSystemFrontEndConfiguration from '../types/configuration/CentralSystemFrontEndConfiguration';
import CentralSystemRestServiceConfiguration from '../types/configuration/CentralSystemRestServiceConfiguration';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServerConfiguration';
import ChargingStationConfiguration from '../types/configuration/ChargingStationConfiguration';
import ChargingStationTemplatesConfiguration from '../types/configuration/ChargingStationTemplatesConfiguration';
import { Configuration as ConfigurationData } from '../types/configuration/Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
import EVDatabaseConfiguration from '../types/configuration/EVDatabaseConfiguration';
import EmailConfiguration from '../types/configuration/EmailConfiguration';
import FirebaseConfiguration from '../types/configuration/FirebaseConfiguration';
import HealthCheckConfiguration from '../types/configuration/HealthCheckConfiguration';
import JsonEndpointConfiguration from '../types/configuration/JsonEndpointConfiguration';
import LoggingConfiguration from '../types/configuration/LoggingConfiguration';
import MigrationConfiguration from '../types/configuration/MigrationConfiguration';
import NotificationConfiguration from '../types/configuration/NotificationConfiguration';
import OCPIEndpointConfiguration from '../types/configuration/OCPIEndpointConfiguration';
import OCPIServiceConfiguration from '../types/configuration/OCPIServiceConfiguration';
import ODataServiceConfiguration from '../types/configuration/ODataServiceConfiguration';
import OICPEndpointConfiguration from '../types/configuration/OICPEndpointConfiguration';
import OICPServiceConfiguration from '../types/configuration/OICPServiceConfiguration';
import SchedulerConfiguration from '../types/configuration/SchedulerConfiguration';
import StorageConfiguration from '../types/configuration/StorageConfiguration';
import WSDLEndpointConfiguration from '../types/configuration/WSDLEndpointConfiguration';
import fs from 'fs';
import global from './../types/GlobalType';

export default class Configuration {
  private static config: ConfigurationData;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getCryptoConfig(): CryptoConfiguration {
    return Configuration.getConfig().Crypto;
  }

  public static getSchedulerConfig(): SchedulerConfiguration {
    return Configuration.getConfig().Scheduler;
  }

  public static getAsyncTaskConfig(): AsyncTaskConfiguration {
    return Configuration.getConfig().AsyncTask;
  }

  public static getFirebaseConfig(): FirebaseConfiguration {
    return Configuration.getConfig().Firebase;
  }

  public static getCentralSystemsConfig(): CentralSystemConfiguration[] {
    return Configuration.getConfig().CentralSystems;
  }

  public static getNotificationConfig(): NotificationConfiguration {
    return Configuration.getConfig().Notification;
  }

  public static getAuthorizationConfig(): AuthorizationConfiguration {
    return Configuration.getConfig().Authorization;
  }

  public static getCentralSystemRestServiceConfig(): CentralSystemRestServiceConfiguration {
    return Configuration.getConfig().CentralSystemRestService;
  }

  public static getOCPIServiceConfig(): OCPIServiceConfiguration {
    return Configuration.getConfig().OCPIService;
  }

  public static getOICPServiceConfig(): OICPServiceConfiguration {
    return Configuration.getConfig().OICPService;
  }

  public static getODataServiceConfig(): ODataServiceConfiguration {
    return Configuration.getConfig().ODataService;
  }

  public static getCentralSystemRestServerConfig(): CentralSystemServerConfiguration {
    return Configuration.getConfig().CentralSystemServer;
  }

  public static getWSDLEndpointConfig(): WSDLEndpointConfiguration {
    return Configuration.getConfig().WSDLEndpoint;
  }

  public static getJsonEndpointConfig(): JsonEndpointConfiguration {
    return Configuration.getConfig().JsonEndpoint;
  }

  public static getOCPIEndpointConfig(): OCPIEndpointConfiguration {
    return Configuration.getConfig().OCPIEndpoint;
  }

  public static getOICPEndpointConfig(): OICPEndpointConfiguration {
    return Configuration.getConfig().OICPEndpoint;
  }

  public static getCentralSystemFrontEndConfig(): CentralSystemFrontEndConfiguration {
    return Configuration.getConfig().CentralSystemFrontEnd;
  }

  public static getEmailConfig(): EmailConfiguration {
    if (Configuration.isUndefined(Configuration.getConfig().Email.disableBackup)) {
      Configuration.getConfig().Email.disableBackup = false;
    }
    return Configuration.getConfig().Email;
  }

  public static getEVDatabaseConfig(): EVDatabaseConfiguration {
    return Configuration.getConfig().EVDatabase;
  }

  public static getStorageConfig(): StorageConfiguration {
    return Configuration.getConfig().Storage;
  }

  public static getChargingStationConfig(): ChargingStationConfiguration {
    // Read conf and set defaults values
    const chargingStationConfiguration: ChargingStationConfiguration = Configuration.getConfig().ChargingStation;
    if (!Configuration.isUndefined(chargingStationConfiguration)) {
      if (Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalOCPPSSecs)) {
        if (!Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalSecs)) {
          chargingStationConfiguration.heartbeatIntervalOCPPSSecs = chargingStationConfiguration.heartbeatIntervalSecs;
        } else {
          chargingStationConfiguration.heartbeatIntervalOCPPSSecs = 180;
        }
      }
      if (Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalOCPPJSecs)) {
        if (!Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalSecs)) {
          chargingStationConfiguration.heartbeatIntervalOCPPJSecs = chargingStationConfiguration.heartbeatIntervalSecs;
        } else {
          chargingStationConfiguration.heartbeatIntervalOCPPJSecs = 3600;
        }
      }
      if (Configuration.isUndefined(chargingStationConfiguration.maxLastSeenIntervalSecs)) {
        if (!Configuration.isUndefined(chargingStationConfiguration.heartbeatIntervalSecs)) {
          chargingStationConfiguration.maxLastSeenIntervalSecs = 3 * chargingStationConfiguration.heartbeatIntervalSecs;
        } else {
          chargingStationConfiguration.maxLastSeenIntervalSecs = 540;
        }
      }
      delete chargingStationConfiguration.heartbeatIntervalSecs;
    }
    return chargingStationConfiguration;
  }

  public static getLoggingConfig(): LoggingConfiguration {
    return Configuration.getConfig().Logging;
  }

  public static getHealthCheckConfig(): HealthCheckConfiguration {
    if (Configuration.isUndefined(Configuration.getConfig().HealthCheck)) {
      Configuration.getConfig().HealthCheck = {} as HealthCheckConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().HealthCheck.enabled)) {
      Configuration.getConfig().HealthCheck.enabled = true;
    }
    return Configuration.getConfig().HealthCheck;
  }

  public static getMigrationConfig(): MigrationConfiguration {
    if (Configuration.isUndefined(Configuration.getConfig().Migration)) {
      Configuration.getConfig().Migration = {} as MigrationConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().Migration.active)) {
      Configuration.getConfig().Migration.active = false;
    }
    return Configuration.getConfig().Migration;
  }

  public static getChargingStationTemplatesConfig(): ChargingStationTemplatesConfiguration {
    if (Configuration.isUndefined(Configuration.getConfig().ChargingStationTemplates)) {
      Configuration.getConfig().ChargingStationTemplates = {} as ChargingStationTemplatesConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().ChargingStationTemplates.templatesFilePath)) {
      Configuration.getConfig().ChargingStationTemplates.templatesFilePath = `${global.appRoot}/assets/charging-station-templates/charging-stations.json`;
    }
    return Configuration.getConfig().ChargingStationTemplates;
  }

  public static getAxiosConfig(): AxiosConfiguration {
    if (Configuration.isUndefined(Configuration.getConfig().Axios)) {
      Configuration.getConfig().Axios = {} as AxiosConfiguration;
    }
    if (Configuration.isUndefined(Configuration.getConfig().Axios.timeout)) {
      Configuration.getConfig().Axios.timeout = Constants.AXIOS_DEFAULT_TIMEOUT;
    }
    if (Configuration.isUndefined(Configuration.getConfig().Axios.retries)) {
      Configuration.getConfig().Axios.retries = 0;
    }
    return Configuration.getConfig().Axios;
  }

  private static getConfig(): ConfigurationData {
    if (!Configuration.config) {
      Configuration.config = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/config.json`, 'utf8')) as ConfigurationData;
    }
    return Configuration.config;
  }

  // Dup method: Avoid circular deps with Utils class
  private static isUndefined(obj: any): boolean {
    return typeof obj === 'undefined';
  }
}

