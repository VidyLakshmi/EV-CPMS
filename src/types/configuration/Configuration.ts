import AsyncTaskConfiguration from './AsyncTaskConfiguration';
import AuthorizationConfiguration from './AuthorizationConfiguration';
import AxiosConfiguration from './AxiosConfiguration';
import CacheConfiguration from './CacheConfiguration';
import CentralSystemConfiguration from './CentralSystemConfiguration';
import CentralSystemFrontEndConfiguration from './CentralSystemFrontEndConfiguration';
import CentralSystemRestServiceConfiguration from './CentralSystemRestServiceConfiguration';
import CentralSystemServerConfiguration from './CentralSystemServerConfiguration';
import ChargingStationConfiguration from './ChargingStationConfiguration';
import ChargingStationTemplatesConfiguration from './ChargingStationTemplatesConfiguration';
import CryptoConfiguration from './CryptoConfiguration';
import EVDatabaseConfiguration from './EVDatabaseConfiguration';
import EmailConfiguration from './EmailConfiguration';
import FirebaseConfiguration from './FirebaseConfiguration';
import HealthCheckConfiguration from './HealthCheckConfiguration';
import JsonEndpointConfiguration from './JsonEndpointConfiguration';
import LocalesConfiguration from './LocalesConfiguration';
import LogConfiguration from './LogConfiguration';
import MigrationConfiguration from './MigrationConfiguration';
import MonitoringConfiguration from './MonitoringConfiguration';
import NotificationConfiguration from './NotificationConfiguration';
import OCPIEndpointConfiguration from './OCPIEndpointConfiguration';
import OCPIServiceConfiguration from './OCPIServiceConfiguration';
import ODataServiceConfiguration from './ODataServiceConfiguration';
import OICPEndpointConfiguration from './OICPEndpointConfiguration';
import OICPServiceConfiguration from './OICPServiceConfiguration';
import ShieldConfiguration from './RateLimiterConfiguration';
import SchedulerConfiguration from './SchedulerConfiguration';
import StorageConfiguration from './StorageConfiguration';
import TraceConfiguration from './TraceConfiguration';
import WSDLEndpointConfiguration from './WSDLEndpointConfiguration';

export interface Configuration {
  Crypto: CryptoConfiguration;
  CentralSystemServer: CentralSystemServerConfiguration;
  CentralSystems: CentralSystemConfiguration[];
  CentralSystemRestService: CentralSystemRestServiceConfiguration;
  CentralSystemFrontEnd: CentralSystemFrontEndConfiguration;
  WSDLEndpoint?: WSDLEndpointConfiguration;
  JsonEndpoint: JsonEndpointConfiguration;
  OCPIEndpoint: OCPIEndpointConfiguration;
  OICPEndpoint: OICPEndpointConfiguration;
  OCPIService: OCPIServiceConfiguration;
  OICPService: OICPServiceConfiguration;
  ODataService: ODataServiceConfiguration;
  Firebase: FirebaseConfiguration;
  Email: EmailConfiguration;
  Storage: StorageConfiguration;
  Notification: NotificationConfiguration;
  Authorization: AuthorizationConfiguration;
  ChargingStation: ChargingStationConfiguration;
  Locales?: LocalesConfiguration;
  Scheduler: SchedulerConfiguration;
  Shield: ShieldConfiguration;
  AsyncTask: AsyncTaskConfiguration;
  Logging: LogConfiguration;
  HealthCheck?: HealthCheckConfiguration;
  Migration?: MigrationConfiguration;
  EVDatabase?: EVDatabaseConfiguration;
  ChargingStationTemplates?: ChargingStationTemplatesConfiguration;
  Axios?: AxiosConfiguration;
  Trace?: TraceConfiguration;
  Monitoring?: MonitoringConfiguration;
  Cache?: CacheConfiguration;
}

export type ConfigurationSection =
  | CryptoConfiguration
  | CentralSystemServerConfiguration
  | CentralSystemConfiguration
  | CentralSystemRestServiceConfiguration
  | CentralSystemFrontEndConfiguration
  | WSDLEndpointConfiguration
  | JsonEndpointConfiguration
  | OCPIEndpointConfiguration
  | OCPIServiceConfiguration
  | ODataServiceConfiguration
  | FirebaseConfiguration
  | EmailConfiguration
  | StorageConfiguration
  | NotificationConfiguration
  | AuthorizationConfiguration
  | ChargingStationConfiguration
  | SchedulerConfiguration
  | LocalesConfiguration
  | LogConfiguration
  | HealthCheckConfiguration
  | MigrationConfiguration
  | EVDatabaseConfiguration
  | ChargingStationTemplatesConfiguration
  | AxiosConfiguration
  | CacheConfiguration
  | ShieldConfiguration;
