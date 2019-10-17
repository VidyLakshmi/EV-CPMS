export default interface OCPIServiceConfiguration {
  protocol: string;
  externalProtocol: string;
  host: string;
  port: number;
  debug: boolean;
  tenantEnabled: string[];
  eMI3id: any;
}