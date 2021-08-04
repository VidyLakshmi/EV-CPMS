import { AnalyticsSettings, AnalyticsSettingsType, AssetSettings, AssetSettingsType, BillingSetting, BillingSettings, BillingSettingsType, CarConnectorSettings, CarConnectorSettingsType, CryptoSetting, CryptoSettings, CryptoSettingsType, PricingSettings, PricingSettingsType, RefundSettings, RefundSettingsType, RoamingSettings, SettingDB, SmartChargingSettings, SmartChargingSettingsType, TechnicalSettings, UserSettings, UserSettingsType } from '../../types/Setting';
import global, { FilterParams } from '../../types/GlobalType';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import { ObjectId } from 'mongodb';
import TenantComponents from '../../types/TenantComponents';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SettingStorage';

export default class SettingStorage {
  public static async getSetting(tenantID: string, id: string = Constants.UNKNOWN_OBJECT_ID, projectFields?: string[]): Promise<SettingDB> {
    const settingMDB = await SettingStorage.getSettings(tenantID,
      { settingID: id },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return settingMDB.count === 1 ? settingMDB.result[0] : null;
  }

  public static async getSettingByIdentifier(tenantID: string, identifier: string = Constants.UNKNOWN_STRING_ID, projectFields?: string[]): Promise<SettingDB> {
    const settingsMDB = await SettingStorage.getSettings(tenantID,
      { identifier: identifier },
      Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return settingsMDB.count === 1 ? settingsMDB.result[0] : null;
  }

  public static async saveSettings(tenantID: string, settingToSave: Partial<SettingDB>): Promise<string> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'saveSetting');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Check if ID is provided
    if (!settingToSave.id && !settingToSave.identifier) {
      // ID must be provided!
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveSetting',
        message: 'Setting has no ID and no Identifier'
      });
    }
    const settingFilter: any = {};
    // Build Request
    if (settingToSave.id) {
      settingFilter._id = DatabaseUtils.convertToObjectID(settingToSave.id);
    } else {
      settingFilter._id = new ObjectId();
    }
    // Properties to save
    const settingMDB = {
      _id: settingFilter._id,
      identifier: settingToSave.identifier,
      content: settingToSave.content,
      sensitiveData: settingToSave.sensitiveData,
      backupSensitiveData: settingToSave.backupSensitiveData
    };
    DatabaseUtils.addLastChangedCreatedProps(settingMDB, settingToSave);
    // Modify
    await global.database.getCollection<SettingDB>(tenantID, 'settings').findOneAndUpdate(
      settingFilter,
      { $set: settingMDB },
      { upsert: true, returnDocument: 'after' });
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'saveSetting', uniqueTimerID, settingMDB);
    // Create
    return settingFilter._id.toString();
  }

  public static async getOCPISettings(tenantID: string): Promise<RoamingSettings> {
    const ocpiSettings = {
      identifier: TenantComponents.OCPI,
    } as RoamingSettings;
    // Get the Ocpi settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.OCPI },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      ocpiSettings.id = settings.result[0].id;
      ocpiSettings.sensitiveData = settings.result[0].sensitiveData;
      ocpiSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // OCPI
      if (config.ocpi) {
        ocpiSettings.ocpi = config.ocpi;
      }
    }
    return ocpiSettings;
  }

  public static async getOICPSettings(tenantID: string): Promise<RoamingSettings> {
    const oicpSettings = {
      identifier: TenantComponents.OICP,
    } as RoamingSettings;
    // Get the oicp settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TenantComponents.OICP }, Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      oicpSettings.id = settings.result[0].id;
      oicpSettings.sensitiveData = settings.result[0].sensitiveData;
      // OICP
      if (config.oicp) {
        oicpSettings.oicp = config.oicp;
      }
    }
    return oicpSettings;
  }

  public static async getAnalyticsSettings(tenantID: string): Promise<AnalyticsSettings> {
    const analyticsSettings = {
      identifier: TenantComponents.ANALYTICS,
    } as AnalyticsSettings;
    // Get the analytics settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.ANALYTICS },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      analyticsSettings.id = settings.result[0].id;
      analyticsSettings.sensitiveData = settings.result[0].sensitiveData;
      analyticsSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // SAP Analytics
      if (config.sac) {
        analyticsSettings.type = AnalyticsSettingsType.SAC;
        analyticsSettings.sac = {
          timezone: config.sac.timezone ? config.sac.timezone : '',
          mainUrl: config.sac.mainUrl ? config.sac.mainUrl : '',
        };
      }
    }
    return analyticsSettings;
  }

  public static async getAssetsSettings(tenantID: string): Promise<AssetSettings> {
    const assetSettings = {
      identifier: TenantComponents.ASSET,
    } as AssetSettings;
    // Get the settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.ASSET },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      assetSettings.id = settings.result[0].id;
      assetSettings.sensitiveData = settings.result[0].sensitiveData;
      assetSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // Asset
      if (config.asset) {
        assetSettings.type = AssetSettingsType.ASSET;
        assetSettings.asset = {
          connections: config.asset.connections ? config.asset.connections : []
        };
      }
    }
    return assetSettings;
  }

  public static async getRefundSettings(tenantID: string): Promise<RefundSettings> {
    const refundSettings = {
      identifier: TenantComponents.REFUND
    } as RefundSettings;
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.REFUND },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      refundSettings.id = settings.result[0].id;
      refundSettings.sensitiveData = settings.result[0].sensitiveData;
      refundSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      if (config.concur) {
        refundSettings.type = RefundSettingsType.CONCUR;
        refundSettings.concur = {
          authenticationUrl: config.concur.authenticationUrl ? config.concur.authenticationUrl : '',
          apiUrl: config.concur.apiUrl ? config.concur.apiUrl : '',
          appUrl: config.concur.appUrl ? config.concur.appUrl : '',
          clientId: config.concur.clientId ? config.concur.clientId : '',
          clientSecret: config.concur.clientSecret ? config.concur.clientSecret : '',
          paymentTypeId: config.concur.paymentTypeId ? config.concur.paymentTypeId : '',
          expenseTypeCode: config.concur.expenseTypeCode ? config.concur.expenseTypeCode : '',
          policyId: config.concur.policyId ? config.concur.policyId : '',
          reportName: config.concur.reportName ? config.concur.reportName : '',
        };
      }
    }
    return refundSettings;
  }

  public static async getCarConnectorSettings(tenantID: string): Promise<CarConnectorSettings> {
    const carConnectorSettings = {
      identifier: TenantComponents.CAR_CONNECTOR,
    } as CarConnectorSettings;
    // Get the settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.CAR_CONNECTOR },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      carConnectorSettings.id = settings.result[0].id;
      carConnectorSettings.sensitiveData = settings.result[0].sensitiveData;
      carConnectorSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // Car Connector
      if (config.carConnector) {
        carConnectorSettings.type = CarConnectorSettingsType.CAR_CONNECTOR;
        carConnectorSettings.carConnector = {
          connections: config.carConnector.connections ? config.carConnector.connections : []
        };
      }
    }
    return carConnectorSettings;
  }

  public static async getPricingSettings(tenantID: string, limit?: number, skip?: number, dateFrom?: Date, dateTo?: Date): Promise<PricingSettings> {
    const pricingSettings = {
      identifier: TenantComponents.PRICING,
    } as PricingSettings;
    // Get the Pricing settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.PRICING, dateFrom: dateFrom, dateTo: dateTo },
      { limit, skip });
    // Get the currency
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      pricingSettings.id = settings.result[0].id;
      pricingSettings.sensitiveData = settings.result[0].sensitiveData;
      pricingSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // Simple price
      if (config.simple) {
        pricingSettings.type = PricingSettingsType.SIMPLE;
        pricingSettings.simple = {
          price: config.simple.price ? Utils.convertToFloat(config.simple.price) : 0,
          currency: config.simple.currency ? config.simple.currency : '',
          last_updated: settings.result[0].lastChangedOn ? Utils.convertToDate(settings.result[0].lastChangedOn) : null,
        };
      }
      // Convergent Charging
      if (config.convergentCharging) {
        pricingSettings.type = PricingSettingsType.CONVERGENT_CHARGING;
        pricingSettings.convergentCharging = {
          url: config.convergentCharging.url ? config.convergentCharging.url : '',
          chargeableItemName: config.convergentCharging.chargeableItemName ? config.convergentCharging.chargeableItemName : '',
          user: config.convergentCharging.user ? config.convergentCharging.user : '',
          password: config.convergentCharging.password ? config.convergentCharging.password : '',
        };
      }
    }
    return pricingSettings;
  }

  public static async getSmartChargingSettings(tenantID: string): Promise<SmartChargingSettings> {
    const smartChargingSettings = {
      identifier: TenantComponents.SMART_CHARGING,
    } as SmartChargingSettings;
    // Get the Smart Charging settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TenantComponents.SMART_CHARGING },
      Constants.DB_PARAMS_MAX_LIMIT);
    // Get the currency
    if (settings && settings.count > 0 && settings.result[0].content) {
      const config = settings.result[0].content;
      // ID
      smartChargingSettings.id = settings.result[0].id;
      smartChargingSettings.sensitiveData = settings.result[0].sensitiveData;
      smartChargingSettings.backupSensitiveData = settings.result[0].backupSensitiveData;
      // SAP Smart Charging
      if (config.sapSmartCharging) {
        smartChargingSettings.type = SmartChargingSettingsType.SAP_SMART_CHARGING;
        smartChargingSettings.sapSmartCharging = {
          optimizerUrl: config.sapSmartCharging.optimizerUrl ? config.sapSmartCharging.optimizerUrl : '',
          user: config.sapSmartCharging.user ? config.sapSmartCharging.user : '',
          password: config.sapSmartCharging.password ? config.sapSmartCharging.password : '',
          stickyLimitation: config.sapSmartCharging.stickyLimitation ? config.sapSmartCharging.stickyLimitation : false,
          limitBufferDC: config.sapSmartCharging.limitBufferDC ? config.sapSmartCharging.limitBufferDC : 0,
          limitBufferAC: config.sapSmartCharging.limitBufferAC ? config.sapSmartCharging.limitBufferAC : 0,
        };
      }
    }
    return smartChargingSettings;
  }

  public static async getCryptoSettings(tenantID: string): Promise<CryptoSettings> {
    // Get the Crypto Key settings
    const settings = await SettingStorage.getSettings(tenantID,
      { identifier: TechnicalSettings.CRYPTO },
      Constants.DB_PARAMS_MAX_LIMIT);
    if (settings.count > 0) {
      const cryptoSetting = {
        key: settings.result[0].content.crypto.key,
        keyProperties: {
          blockCypher: settings.result[0].content.crypto.keyProperties.blockCypher,
          blockSize: settings.result[0].content.crypto.keyProperties.blockSize,
          operationMode: settings.result[0].content.crypto.keyProperties.operationMode,
        },
        migrationToBeDone: settings.result[0].content.crypto.migrationToBeDone
      } as CryptoSetting;
      if (settings.result[0].content.crypto.formerKey) {
        cryptoSetting.formerKey = settings.result[0].content.crypto.formerKey;
        cryptoSetting.formerKeyProperties = {
          blockCypher: settings.result[0].content.crypto.formerKeyProperties?.blockCypher,
          blockSize: settings.result[0].content.crypto.formerKeyProperties?.blockSize,
          operationMode: settings.result[0].content.crypto.formerKeyProperties?.operationMode,
        };
      }
      return {
        id: settings.result[0].id,
        identifier: TechnicalSettings.CRYPTO,
        type: CryptoSettingsType.CRYPTO,
        crypto: cryptoSetting
      };
    }
  }

  public static async getUserSettings(tenantID: string): Promise<UserSettings> {
    let userSettings: UserSettings;
    // Get the user settings
    const settings = await SettingStorage.getSettings(tenantID, { identifier: TechnicalSettings.USER }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (settings.count > 0) {
      userSettings = {
        id: settings.result[0].id,
        identifier: TechnicalSettings.USER,
        type: UserSettingsType.USER,
        user: settings.result[0].content.user,
      };
    }
    return userSettings;
  }

  public static async getSettings(tenantID: string,
      params: {identifier?: string; settingID?: string, dateFrom?: Date, dateTo?: Date},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<SettingDB>> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'getSettings');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Set the filters
    const filters: FilterParams = {};
    // Source?
    if (params.settingID) {
      filters._id = DatabaseUtils.convertToObjectID(params.settingID);
    }
    // Identifier
    if (params.identifier) {
      filters.identifier = params.identifier;
    }
    // Create Aggregation
    const aggregation = [];
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Count Records
    const settingsCountMDB = await global.database.getCollection<any>(tenantID, 'settings')
      .aggregate([...aggregation, { $count: 'count' }], { allowDiskUse: true })
      .toArray();
    // Add Created By / Last Changed By
    DatabaseUtils.pushCreatedLastChangedInAggregation(tenantID, aggregation);
    // Rename ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { identifier: 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    aggregation.push({
      $skip: dbParams.skip
    });
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const settingsMDB = await global.database.getCollection<SettingDB>(tenantID, 'settings')
      .aggregate(aggregation, {
        allowDiskUse: true
      })
      .toArray();
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'getSettings', uniqueTimerID, settingsMDB);
    // Ok
    return {
      count: (settingsCountMDB.length > 0 ? settingsCountMDB[0].count : 0),
      result: settingsMDB
    };
  }

  public static async deleteSetting(tenantID: string, id: string): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(tenantID, MODULE_NAME, 'deleteSetting');
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Delete Component
    await global.database.getCollection<any>(tenantID, 'settings')
      .findOneAndDelete({ '_id': DatabaseUtils.convertToObjectID(id) });
    // Debug
    await Logging.traceEnd(tenantID, MODULE_NAME, 'deleteSetting', uniqueTimerID, { id });
  }

  public static async saveUserSettings(tenantID: string, userSettingToSave: UserSettings): Promise<void> {
    // Build internal structure
    const settingsToSave = {
      id: userSettingToSave.id,
      identifier: TechnicalSettings.USER,
      lastChangedOn: new Date(),
      content: {
        type: UserSettingsType.USER,
        user: userSettingToSave.user
      },
    } as SettingDB;
    // Save
    await SettingStorage.saveSettings(tenantID, settingsToSave);
  }

  public static async saveCryptoSettings(tenantID: string, cryptoSettingsToSave: CryptoSettings): Promise<void> {
    // Build internal structure
    const settingsToSave = {
      id: cryptoSettingsToSave.id,
      identifier: TechnicalSettings.CRYPTO,
      lastChangedOn: new Date(),
      content: {
        type: CryptoSettingsType.CRYPTO,
        crypto: cryptoSettingsToSave.crypto
      },
    } as SettingDB;
    // Save
    await SettingStorage.saveSettings(tenantID, settingsToSave);
  }

  public static async getBillingSetting(tenantID: string): Promise<BillingSettings> {
    // Get BILLING Settings by Identifier
    const setting = await SettingStorage.getSettingByIdentifier(tenantID, TenantComponents.BILLING);
    if (setting) {
      const { id, backupSensitiveData, category } = setting;
      const { createdBy, createdOn, lastChangedBy, lastChangedOn } = setting;
      const { content } = setting;
      const billing: BillingSetting = {
        isTransactionBillingActivated: !!content.billing?.isTransactionBillingActivated,
        immediateBillingAllowed: !!content.billing?.immediateBillingAllowed,
        periodicBillingAllowed: !!content.billing?.periodicBillingAllowed,
        taxID: content.billing?.taxID,
        usersLastSynchronizedOn: content.billing?.usersLastSynchronizedOn,
      };
      const billingSettings: BillingSettings = {
        id,
        identifier: TenantComponents.BILLING,
        type: content.type as BillingSettingsType,
        backupSensitiveData,
        billing,
        category,
        createdBy,
        createdOn,
        lastChangedBy,
        lastChangedOn,
      };
      switch (content.type) {
        // Only STRIPE so far
        case BillingSettingsType.STRIPE:
          billingSettings.stripe = {
            url: content.stripe?.url,
            secretKey: content.stripe?.secretKey,
            publicKey: content.stripe?.publicKey,
          };
          billingSettings.sensitiveData = [ 'stripe.secretKey' ];
          break;
      }
      return billingSettings;
    }
    return null;
  }

  public static async saveBillingSetting(tenantID: string, billingSettings: BillingSettings): Promise<string> {
    const { id, identifier, sensitiveData, backupSensitiveData, category } = billingSettings;
    const { createdBy, createdOn, lastChangedBy, lastChangedOn } = billingSettings;
    const { type, billing, stripe } = billingSettings;
    const setting: SettingDB = {
      id, identifier, sensitiveData, backupSensitiveData,
      content: {
        type,
        billing,
      },
      category, createdBy, createdOn, lastChangedBy, lastChangedOn,
    };
    if (billingSettings.type === BillingSettingsType.STRIPE) {
      setting.sensitiveData = [ 'content.stripe.secretKey' ];
      setting.content.stripe = stripe;
    }
    return SettingStorage.saveSettings(tenantID, setting);
  }
}
