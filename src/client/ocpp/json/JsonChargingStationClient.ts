import { OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPDeleteCertificateCommandParam, OCPPDeleteCertificateCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPGetInstalledCertificateIdsCommandParam, OCPPGetInstalledCertificateIdsCommandResult, OCPPInstallCertificateCommandParam, OCPPInstallCertificateCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';

import ChargingStationClient from '../../ocpp/ChargingStationClient';
import { Command } from '../../../types/ChargingStation';
import JsonWSConnection from '../../../server/ocpp/json/JsonWSConnection';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'JsonChargingStationClient';

export default class JsonChargingStationClient extends ChargingStationClient {
  public tagID: string;
  public type: string;
  public key: string;
  private chargingStationID: string;
  private tenantID: string;

  private wsConnection: JsonWSConnection;

  constructor(wsConnection: JsonWSConnection, tenantID: string, chargingStationID: string) {
    super();
    this.wsConnection = wsConnection;
    this.tenantID = tenantID;
    this.chargingStationID = chargingStationID;
  }

  getChargingStationID(): string {
    return this.wsConnection.getChargingStationID();
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.REMOTE_START_TRANSACTION);
  }

  public async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.RESET);
  }

  public async clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this.sendMessage({}, OCPPMessageType.CALL_MESSAGE, Command.CLEAR_CACHE);
  }

  public async getConfiguration(params: OCPPGetConfigurationCommandParam = {}): Promise<OCPPGetConfigurationCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.GET_CONFIGURATION);
  }

  public async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.CHANGE_CONFIGURATION);
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.REMOTE_STOP_TRANSACTION);
  }

  public async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.UNLOCK_CONNECTOR);
  }

  public async setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.SET_CHARGING_PROFILE);
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.GET_COMPOSITE_SCHEDULE);
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.CLEAR_CHARGING_PROFILE);
  }

  public async changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.CHANGE_AVAILABILITY);
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.GET_DIAGNOSTICS);
  }

  public async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.UPDATE_FIRMWARE);
  }

  public async installCertificate(params: OCPPInstallCertificateCommandParam): Promise<OCPPInstallCertificateCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.INSTALL_CERTIFICATE);
  }

  public async deleteCertificate(params: OCPPDeleteCertificateCommandParam): Promise<OCPPDeleteCertificateCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.DELETE_CERTIFICATE);
  }

  public async getInstalledCertificateIds(params: OCPPGetInstalledCertificateIdsCommandParam): Promise<OCPPGetInstalledCertificateIdsCommandResult> {
    return this.sendMessage(params, OCPPMessageType.CALL_MESSAGE, Command.GET_INSTALLED_CERTIFICATE_IDS);
  }

  private async sendMessage(params: any, messageType: OCPPMessageType, commandName: Command): Promise<any> {
    // Log
    await Logging.logChargingStationClientSendAction(MODULE_NAME, this.tenantID, this.chargingStationID, `ChargingStation${commandName}` as ServerAction, params);
    // Execute
    const result = await this.wsConnection.sendMessage(Utils.generateUUID(), params, messageType, commandName);
    // Log
    await Logging.logChargingStationClientReceiveAction(MODULE_NAME, this.tenantID, this.chargingStationID, `ChargingStation${commandName}` as ServerAction, result);
    return result;
  }
}
