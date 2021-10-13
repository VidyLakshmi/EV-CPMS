import { OCPPCancelReservationCommandParam, OCPPCancelReservationCommandResult, OCPPChangeAvailabilityCommandParam, OCPPChangeAvailabilityCommandResult, OCPPChangeConfigurationCommandParam, OCPPChangeConfigurationCommandResult, OCPPClearCacheCommandResult, OCPPClearChargingProfileCommandParam, OCPPClearChargingProfileCommandResult, OCPPDataTransferCommandParam, OCPPDataTransferCommandResult, OCPPGetCompositeScheduleCommandParam, OCPPGetCompositeScheduleCommandResult, OCPPGetConfigurationCommandParam, OCPPGetConfigurationCommandResult, OCPPGetDiagnosticsCommandParam, OCPPGetDiagnosticsCommandResult, OCPPRemoteStartTransactionCommandParam, OCPPRemoteStartTransactionCommandResult, OCPPRemoteStopTransactionCommandParam, OCPPRemoteStopTransactionCommandResult, OCPPReserveNowCommandParam, OCPPReserveNowCommandResult, OCPPResetCommandParam, OCPPResetCommandResult, OCPPSetChargingProfileCommandParam, OCPPSetChargingProfileCommandResult, OCPPUnlockConnectorCommandParam, OCPPUnlockConnectorCommandResult, OCPPUpdateFirmwareCommandParam } from '../../../types/ocpp/OCPPClient';

import ChargingStationClient from '../../ocpp/ChargingStationClient';
import { Command } from '../../../types/ChargingStation';
import JsonWSConnection from '../../../server/ocpp/json/JsonWSConnection';
import Logging from '../../../utils/Logging';
import { OCPPMessageType } from '../../../types/ocpp/OCPPCommon';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';

const MODULE_NAME = 'JsonChargingStationClient';

export default class JsonChargingStationClient extends ChargingStationClient {
  private chargingStationID: string;
  private siteID: string;
  private siteAreaID: string;
  private companyID: string;
  private tenant: Tenant;
  private wsConnection: JsonWSConnection;

  constructor(wsConnection: JsonWSConnection, tenant: Tenant, chargingStationID: string, chargingStationDetails: {
    siteAreaID: string,
    siteID: string,
    companyID: string,
  }) {
    super();
    this.wsConnection = wsConnection;
    this.tenant = tenant;
    this.chargingStationID = chargingStationID;
    this.siteID = chargingStationDetails.siteID;
    this.siteAreaID = chargingStationDetails.siteAreaID;
    this.companyID = chargingStationDetails.companyID;
  }

  getChargingStationID(): string {
    return this.wsConnection.getChargingStationID();
  }

  public async remoteStartTransaction(params: OCPPRemoteStartTransactionCommandParam): Promise<OCPPRemoteStartTransactionCommandResult> {
    return this.sendMessage(params, Command.REMOTE_START_TRANSACTION);
  }

  public async reset(params: OCPPResetCommandParam): Promise<OCPPResetCommandResult> {
    return this.sendMessage(params, Command.RESET);
  }

  public async clearCache(): Promise<OCPPClearCacheCommandResult> {
    return this.sendMessage({}, Command.CLEAR_CACHE);
  }

  public async getConfiguration(params: OCPPGetConfigurationCommandParam = {}): Promise<OCPPGetConfigurationCommandResult> {
    return this.sendMessage(params, Command.GET_CONFIGURATION);
  }

  public async changeConfiguration(params: OCPPChangeConfigurationCommandParam): Promise<OCPPChangeConfigurationCommandResult> {
    return this.sendMessage(params, Command.CHANGE_CONFIGURATION);
  }

  public async remoteStopTransaction(params: OCPPRemoteStopTransactionCommandParam): Promise<OCPPRemoteStopTransactionCommandResult> {
    return this.sendMessage(params, Command.REMOTE_STOP_TRANSACTION);
  }

  public async unlockConnector(params: OCPPUnlockConnectorCommandParam): Promise<OCPPUnlockConnectorCommandResult> {
    return this.sendMessage(params, Command.UNLOCK_CONNECTOR);
  }

  public async setChargingProfile(params: OCPPSetChargingProfileCommandParam): Promise<OCPPSetChargingProfileCommandResult> {
    return this.sendMessage(params, Command.SET_CHARGING_PROFILE);
  }

  public async getCompositeSchedule(params: OCPPGetCompositeScheduleCommandParam): Promise<OCPPGetCompositeScheduleCommandResult> {
    return this.sendMessage(params, Command.GET_COMPOSITE_SCHEDULE);
  }

  public async clearChargingProfile(params: OCPPClearChargingProfileCommandParam): Promise<OCPPClearChargingProfileCommandResult> {
    return this.sendMessage(params, Command.CLEAR_CHARGING_PROFILE);
  }

  public async changeAvailability(params: OCPPChangeAvailabilityCommandParam): Promise<OCPPChangeAvailabilityCommandResult> {
    return this.sendMessage(params, Command.CHANGE_AVAILABILITY);
  }

  public async getDiagnostics(params: OCPPGetDiagnosticsCommandParam): Promise<OCPPGetDiagnosticsCommandResult> {
    return this.sendMessage(params, Command.GET_DIAGNOSTICS);
  }

  public async updateFirmware(params: OCPPUpdateFirmwareCommandParam): Promise<void> {
    return this.sendMessage(params, Command.UPDATE_FIRMWARE);
  }

  public async dataTransfer(params: OCPPDataTransferCommandParam): Promise<OCPPDataTransferCommandResult> {
    return this.sendMessage(params, Command.DATA_TRANSFER);
  }

  public async reserveNow(params: OCPPReserveNowCommandParam): Promise<OCPPReserveNowCommandResult> {
    return this.sendMessage(params, Command.RESERVE_NOW);
  }

  public async cancelReservation(params: OCPPCancelReservationCommandParam): Promise<OCPPCancelReservationCommandResult> {
    return this.sendMessage(params, Command.CANCEL_RESERVATION);
  }

  private async sendMessage(params: any, command: Command): Promise<any> {
    // Trace
    const startTimestamp = await Logging.traceOcppMessageRequest(MODULE_NAME, this.tenant.id, this.chargingStationID,
      `ChargingStation${command}` as ServerAction, params, '<<', {
        siteAreaID: this.siteAreaID,
        siteID: this.siteID,
        companyID: this.companyID,
      });
    // Execute
    const result = await this.wsConnection.sendMessage(Utils.generateUUID(), params, OCPPMessageType.CALL_MESSAGE, command);
    // Trace
    await Logging.traceOcppMessageResponse(MODULE_NAME, this.tenant, this.chargingStationID,
      `ChargingStation${command}` as ServerAction, params, result, '>>', {
        siteAreaID: this.siteAreaID,
        siteID: this.siteID,
        companyID: this.companyID,
      },
      startTimestamp
    );
    return result;
  }
}
