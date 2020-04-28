import SettingStorage from '../../storage/mongodb/SettingStorage';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import { PricingSetting, PricingSettingsType } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import Transaction from '../../types/Transaction';
import Utils from '../../utils/Utils';
import ConvergentChargingPricingIntegration from './convergent-charging/ConvergentChargingPricingIntegration';
import PricingIntegration from './PricingIntegration';
import SimplePricingIntegration from './simple-pricing/SimplePricingIntegration';

export default class PricingFactory {
  static async getPricingImpl(tenantID: string, transaction: Transaction): Promise<PricingIntegration<PricingSetting>> {
    // Get the tenant
    const tenant: Tenant = await TenantStorage.getTenant(tenantID);
    // Check if the pricing is active
    if (Utils.isTenantComponentActive(tenant, TenantComponents.PRICING)) {
      // Get the pricing's settings
      const pricingSetting = await SettingStorage.getPricingSettings(tenantID);
      // Check
      if (pricingSetting) {
        // SAP Convergent Charging
        if (pricingSetting.type === PricingSettingsType.CONVERGENT_CHARGING) {
          // Return the CC implementation
          return new ConvergentChargingPricingIntegration(tenantID, pricingSetting.convergentCharging, transaction);
        // Simple Pricing
        } else if (pricingSetting.type === PricingSettingsType.SIMPLE) {
          // Return the Simple Pricing implementation
          return new SimplePricingIntegration(tenantID, pricingSetting.simple, transaction);
        }
      }
    }
    // Pricing is not active
    return null;
  }
}

