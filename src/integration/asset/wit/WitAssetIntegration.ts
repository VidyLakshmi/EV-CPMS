import Asset, { AssetType, WitDataSet } from '../../../types/Asset';
import { AssetConnectionSetting, AssetConnectionTokenSetting, AssetSettings } from '../../../types/Setting';

import { AbstractCurrentConsumption } from '../../../types/Consumption';
import AssetIntegration from '../AssetIntegration';
import AxiosFactory from '../../../utils/AxiosFactory';
import { AxiosInstance } from 'axios';
import BackendError from '../../../exception/BackendError';
import Constants from '../../../utils/Constants';
import Cypher from '../../../utils/Cypher';
import Logging from '../../../utils/Logging';
import { ServerAction } from '../../../types/Server';
import SettingStorage from '../../../storage/mongodb/SettingStorage';
import Tenant from '../../../types/Tenant';
import Utils from '../../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'WitAssetIntegration';

export default class WitAssetIntegration extends AssetIntegration<AssetSettings> {
  private axiosInstance: AxiosInstance;

  public constructor(tenant: Tenant, settings: AssetSettings, connection: AssetConnectionSetting) {
    super(tenant, settings, connection);
    this.axiosInstance = AxiosFactory.getAxiosInstance(tenant.id);
  }

  public async checkConnection(): Promise<void> {
    await this.connect();
  }

  public async retrieveConsumptions(asset: Asset, manualCall: boolean): Promise<AbstractCurrentConsumption[]> {
    // Check if refresh interval of connection is exceeded
    if (!manualCall && !this.checkIfIntervalExceeded(asset)) {
      return [];
    }
    // Set new Token
    const token = await this.connect();
    const request = manualCall ?
      `${this.connection.url}/${asset.meterID}?From=${moment().subtract(this.connection.refreshIntervalMins, 'minutes').toISOString()}` :
      // Check if it is first consumption for this asset
      `${this.connection.url}/${asset.meterID}?From=${(asset.lastConsumption?.timestamp) ? asset.lastConsumption.timestamp.toISOString() : moment().startOf('day').toISOString()}`;
    try {
      // Get consumption
      const response = await this.axiosInstance.get(
        request,
        {
          headers: this.buildAuthHeader(token)
        }
      );
      await Logging.logDebug({
        tenantID: this.tenant.id,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: `${asset.name} > WIT web service has been called successfully`,
        module: MODULE_NAME, method: 'retrieveConsumption',
        detailedMessages: { response: response.data }
      });
      return this.filterConsumptionRequest(asset, response.data, manualCall);
    } catch (error) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'retrieveConsumption',
        action: ServerAction.RETRIEVE_ASSET_CONSUMPTION,
        message: 'Error while retrieving the asset consumption',
        detailedMessages: { request, token, error: error.stack, asset }
      });
    }
  }

  private filterConsumptionRequest(asset: Asset, data: WitDataSet[], manualCall: boolean): AbstractCurrentConsumption[] {
    const consumptions: AbstractCurrentConsumption[] = [];
    if (!Utils.isEmptyArray(data)) {
      for (const dataSet of data) {
        const consumption = {} as AbstractCurrentConsumption;
        // Create helper which contains minutes from last consumption.
        const timePeriod = moment(dataSet.T).diff(consumptions[consumptions.length - 1]?.lastConsumption?.timestamp ?? (asset.lastConsumption?.timestamp ?? dataSet.T), 'minutes');
        switch (asset.assetType) {
          case AssetType.CONSUMPTION:
            consumption.currentInstantWatts = Utils.createDecimal(dataSet.V).mul(1000).toNumber();
            break;
          case AssetType.PRODUCTION:
            consumption.currentInstantWatts = Utils.createDecimal(dataSet.V).mul(-1000).toNumber();
            break;
          case AssetType.CONSUMPTION_AND_PRODUCTION:
            throw new Error('Asset connection does not support producing and consuming assets');
        }
        if (asset.siteArea?.voltage) {
          consumption.currentInstantAmps = Utils.createDecimal(consumption.currentInstantWatts).div(asset.siteArea.voltage).toNumber();
        }
        // Calculate consumption wh with period in minutes from last consumption
        consumption.currentConsumptionWh = Utils.createDecimal(consumption.currentInstantWatts).mul(Utils.createDecimal(timePeriod / 60)).toNumber();
        consumption.lastConsumption = {
          timestamp: dataSet.T,
          value: consumption.currentConsumptionWh
        };
        consumptions.push(consumption);
      }
    }
    if (manualCall) {
      return !Utils.isEmptyArray(consumptions) ? [consumptions[consumptions.length - 1]] : [];
    }
    return consumptions;
  }

  private async fetchNewToken(credentials: URLSearchParams) {
    const now = new Date();
    const response = await Utils.executePromiseWithTimeout(5000,
      this.axiosInstance.post(`${this.connection.witConnection.authenticationUrl}/token`,
        credentials,
        {
          'axios-retry': {
            retries: 0
          },
          headers: this.buildFormHeaders()
        }),
      `Time out error (5s) when getting the token with the connection URL '${this.connection.witConnection.authenticationUrl}/token'`
    );
    const data = response.data;
    const expireTime = moment().add(data.expires_in, 'seconds').toDate();
    this.connection.token = {
      accessToken: await Cypher.encrypt(this.tenant, data.access_token),
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      issued: now,
      expires: expireTime,
    };
    await SettingStorage.saveAssetSettings(this.tenant, this.settings);
  }

  private async connect(): Promise<string> {
    if (!this.checkIfTokenExpired(this.connection.token)) {
      return Cypher.decrypt(this.tenant, this.connection.token.accessToken);
    }
    // Check if connection is initialized
    this.checkConnectionIsProvided();
    // Get credential params
    const credentials = await this.getCredentialURLParams();
    await this.fetchNewToken(credentials);
    return Cypher.decrypt(this.tenant, this.connection.token.accessToken);
  }

  private async getCredentialURLParams(): Promise<URLSearchParams> {
    const params = new URLSearchParams();
    params.append('client_id', this.connection.witConnection.clientId);
    params.append('client_secret', await Cypher.decrypt(this.tenant, this.connection.witConnection.clientSecret));
    params.append('grant_type', 'password');
    params.append('username', this.connection.witConnection.user);
    params.append('password', await Cypher.decrypt(this.tenant, this.connection.witConnection.password));
    params.append('scope', 'https://api.wit-datacenter.com');
    return params;
  }

  private checkConnectionIsProvided(): void {
    if (!this.connection) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'checkConnectionIsProvided',
        action: ServerAction.CHECK_CONNECTION,
        message: 'No connection provided'
      });
    }
  }

  private buildFormHeaders(): any {
    return {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  private buildAuthHeader(token: string): any {
    return {
      'Authorization': 'Bearer ' + token
    };
  }
}
