import { Action, AuthorizationContext, AuthorizationDefinition, Entity } from '../types/Authorization';
import { IDictionary, IFunctionCondition } from 'role-acl';

export const AUTHORIZATION_DEFINITION: AuthorizationDefinition = {
  superAdmin: {
    grants: [
      {
        resource: Entity.USERS, action: Action.LIST,
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn', 'createdBy',
          'lastChangedOn', 'lastChangedBy', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn'
        ]
      },
      {
        resource: Entity.USER, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['-OwnUser']
          }
        }
      },
      {
        resource: Entity.USER, action: [Action.READ, Action.CREATE, Action.UPDATE],
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ]
      },
      { resource: Entity.LOGGINGS, action: Action.LIST },
      { resource: Entity.LOGGING, action: Action.READ },
      { resource: Entity.TENANTS, action: Action.LIST },
      { resource: Entity.TENANT, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      {
        resource: Entity.CAR_CATALOGS, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      { resource: Entity.CAR_CATALOGS, action: Action.SYNCHRONIZE },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      },
    ]
  },
  admin: {
    grants: [
      {
        resource: Entity.USERS, action: Action.SYNCHRONIZE_BILLING_USERS,
      },
      {
        resource: Entity.USERS,
        action: [
          Action.LIST, Action.EXPORT, Action.IMPORT
        ],
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn', 'createdBy',
          'lastChangedOn', 'lastChangedBy', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn', 'technical'
        ]
      },
      {
        resource: Entity.USERS, action: Action.IN_ERROR,
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer',
          'createdOn', 'lastChangedOn', 'errorCodeDetails', 'errorCode'
        ]
      },
      { resource: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER },
      {
        resource: Entity.USER, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['-OwnUser']
          }
        }
      },
      {
        resource: Entity.USER, action: [Action.READ, Action.CREATE, Action.UPDATE],
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address', 'technical'
        ]
      },
      {
        resource: Entity.COMPANIES, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.TAGS, action: Action.LIST,
        attributes: [
          'id', 'userID', 'active', 'ocpiToken', 'description', 'visualID', 'issuer', 'default',
          'user.name', 'user.firstName', 'user.email', 'createdOn', 'lastChangedOn'
        ]
      },
      { resource: Entity.TAGS, action: [Action.IMPORT, Action.EXPORT] },
      {
        resource: Entity.TAG, action: Action.READ,
        attributes: [
          'id', 'userID', 'issuer', 'active', 'description', 'visualID', 'default', 'user.id',
          'user.name', 'user.firstName', 'user.email'
        ]
      },
      { resource: Entity.TAG, action: [Action.CREATE, Action.UPDATE, Action.DELETE] },
      { resource: Entity.CHARGING_PROFILES, action: Action.LIST },
      { resource: Entity.CHARGING_PROFILE, action: [Action.READ] },
      {
        resource: Entity.COMPANY, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'logo', 'address'
        ]
      },
      {
        resource: Entity.COMPANY,
        action: [
          Action.CREATE, Action.UPDATE, Action.DELETE
        ]
      },
      {
        resource: Entity.SITES, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName'
        ]
      },
      {
        resource: Entity.SITE, action: Action.READ,
        attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn'
        ]
      },
      {
        resource: Entity.SITE,
        action: [
          Action.CREATE, Action.UPDATE, Action.DELETE, Action.EXPORT_OCPP_PARAMS, Action.GENERATE_QR
        ]
      },
      {
        resource: Entity.SITE_AREAS, action: Action.LIST,
        attributes: [
          'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'site.id', 'site.name', 'issuer', 'distanceMeters', 'createdOn', 'createdBy', 'lastChangedOn', 'lastChangedBy'
        ]
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'image', 'address', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID', 'site.name'
        ]
      },
      {
        resource: Entity.SITE_AREA,
        action: [
          Action.CREATE, Action.UPDATE, Action.DELETE, Action.ASSIGN_ASSETS_TO_SITE_AREA,
          Action.UNASSIGN_ASSETS_TO_SITE_AREA, Action.ASSIGN_CHARGING_STATIONS_TO_SITE_AREA,
          Action.UNASSIGN_CHARGING_STATIONS_TO_SITE_AREA, Action.EXPORT_OCPP_PARAMS, Action.GENERATE_QR
        ]
      },
      {
        resource: Entity.CHARGING_STATIONS, action: [Action.LIST, Action.IN_ERROR],
        attributes: [
          'id', 'inactive', 'public', 'chargingStationURL', 'issuer', 'maximumPower', 'excludeFromSmartCharging', 'lastReboot',
          'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.smartCharging', 'siteArea.siteID',
          'site.id', 'site.name', 'siteID', 'voltage', 'coordinates', 'forceInactive', 'manualConfiguration', 'firmwareUpdateStatus',
          'capabilities', 'endpoint', 'chargePointVendor', 'chargePointModel', 'ocppVersion', 'ocppProtocol', 'lastSeen',
          'firmwareVersion', 'currentIPAddress', 'ocppStandardParameters', 'ocppVendorParameters', 'connectors', 'chargePoints',
          'createdOn', 'chargeBoxSerialNumber', 'chargePointSerialNumber', 'powerLimitUnit'
        ]
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [
          Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.RESET, Action.CLEAR_CACHE,
          Action.GET_CONFIGURATION, Action.CHANGE_CONFIGURATION, Action.REMOTE_START_TRANSACTION,
          Action.REMOTE_STOP_TRANSACTION, Action.STOP_TRANSACTION, Action.START_TRANSACTION,
          Action.UNLOCK_CONNECTOR, Action.AUTHORIZE, Action.SET_CHARGING_PROFILE, Action.GET_COMPOSITE_SCHEDULE,
          Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE, Action.EXPORT,
          Action.CHANGE_AVAILABILITY, Action.TRIGGER_DATA_TRANSFER
        ]
      },
      { resource: Entity.TRANSACTIONS, action: [Action.LIST, Action.EXPORT, Action.IN_ERROR] },
      {
        resource: Entity.TRANSACTION,
        action: [
          Action.READ, Action.UPDATE, Action.DELETE, Action.REFUND_TRANSACTION
        ]
      },
      { resource: Entity.REPORT, action: [Action.READ] },
      { resource: Entity.LOGGINGS, action: Action.LIST },
      { resource: Entity.LOGGING, action: Action.READ },
      { resource: Entity.PRICING, action: [Action.READ, Action.UPDATE] },
      { resource: Entity.BILLING, action: [Action.CHECK_CONNECTION, Action.CLEAR_BILLING_TEST_DATA] },
      { resource: Entity.TAXES, action: [Action.LIST] },
      // ---------------------------------------------------------------------------------------------------
      // TODO - no use-case so far - clarify whether a SYNC INVOICES and CREATE INVOICE makes sense or not!
      // ---------------------------------------------------------------------------------------------------
      // { resource: Entity.INVOICES, action: [Action.LIST, Action.SYNCHRONIZE] },
      // { resource: Entity.INVOICE, action: [Action.DOWNLOAD, Action.CREATE] },
      { resource: Entity.INVOICES, action: [Action.LIST] },
      { resource: Entity.INVOICE, action: [Action.DOWNLOAD, Action.READ] },
      {
        resource: Entity.ASSET, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE,
          Action.CHECK_CONNECTION, Action.RETRIEVE_CONSUMPTION, Action.CREATE_CONSUMPTION]
      },
      {
        resource: Entity.ASSETS, action: [Action.LIST, Action.IN_ERROR],
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'usesPushAPI', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge', 'issuer'
        ]
      },
      { resource: Entity.SETTINGS, action: Action.LIST },
      { resource: Entity.SETTING, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      { resource: Entity.TOKENS, action: Action.LIST },
      { resource: Entity.TOKEN, action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE] },
      { resource: Entity.OCPI_ENDPOINTS, action: Action.LIST },
      {
        resource: Entity.OCPI_ENDPOINT,
        action: [
          Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.PING, Action.GENERATE_LOCAL_TOKEN,
          Action.REGISTER, Action.TRIGGER_JOB
        ],
      },
      { resource: Entity.OICP_ENDPOINTS, action: Action.LIST },
      {
        resource: Entity.OICP_ENDPOINT,
        action: [
          Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.PING, Action.REGISTER,
          Action.TRIGGER_JOB
        ],
      },
      { resource: Entity.CONNECTIONS, action: Action.LIST },
      { resource: Entity.CONNECTION, action: [Action.CREATE, Action.READ, Action.DELETE] },
      {
        resource: Entity.CAR_CATALOGS, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      },
      { resource: Entity.CAR, action: [Action.CREATE, Action.UPDATE, Action.DELETE] },
      {
        resource: Entity.CAR, action: Action.READ,
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase',
          'user.id', 'user.name', 'user.firstName', 'userID', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID'
        ]
      },
      {
        resource: Entity.CARS, action: Action.LIST,
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName',
          'user.id', 'user.name', 'user.firstName', 'userID'
        ]
      },
      { resource: Entity.NOTIFICATION, action: Action.CREATE },
      {
        resource: Entity.USERS_SITES, action: Action.LIST,
        attributes: [
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
        ]
      },
      { resource: Entity.USERS_SITES, action: [Action.ASSIGN, Action.UNASSIGN] },
      { resource: Entity.PAYMENT_METHODS, action: Action.LIST },
      { resource: Entity.PAYMENT_METHOD, action: [Action.READ, Action.CREATE, Action.DELETE] },
    ]
  },
  basic: {
    grants: [
      {
        resource: Entity.USER, action: [Action.READ, Action.UPDATE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['BasicUser'],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'issuer', 'locale',
          'notificationsActive', 'notifications', 'phone', 'mobile',
          'iNumber', 'costCenter', 'address'
        ]
      },
      { resource: Entity.SETTING, action: Action.READ },
      {
        resource: Entity.CAR_CATALOGS, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      },
      {
        resource: Entity.CARS, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName',
          'user.id', 'user.name', 'user.firstName', 'userID'
        ],
      },
      {
        resource: Entity.CAR, action: Action.CREATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['-PoolCar', 'OwnUser'],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.CAR, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase',
          'user.id', 'user.name', 'user.firstName', 'userID', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID'
        ],
      },
      {
        resource: Entity.CAR, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.CAR, action: Action.UPDATE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['-PoolCar', 'OwnUser'],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.COMPANIES, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSitesCompanies', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn'
        ]
      },
      {
        resource: Entity.COMPANY, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSitesCompanies', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'issuer', 'logo', 'address'
        ]
      },
      { resource: Entity.INVOICES, action: [Action.LIST] },
      {
        resource: Entity.INVOICE, action: [Action.DOWNLOAD, Action.READ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      { resource: Entity.PAYMENT_METHODS, action: Action.LIST },
      { resource: Entity.PAYMENT_METHOD, action: [Action.READ, Action.CREATE, Action.DELETE] },
      {
        resource: Entity.SITES, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ],
      },
      {
        resource: Entity.SITE, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ],
      },
      {
        resource: Entity.SITE_AREAS, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'site.id', 'site.name', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn'
        ],
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'issuer', 'image', 'address', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID', 'site.name'
        ],
      },
      {
        resource: Entity.CHARGING_STATIONS, action: Action.LIST,
        attributes: [
          'id', 'inactive', 'public', 'chargingStationURL', 'issuer', 'maximumPower', 'excludeFromSmartCharging', 'lastReboot',
          'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.smartCharging', 'siteArea.siteID',
          'site.id', 'site.name', 'siteID', 'voltage', 'coordinates', 'forceInactive', 'manualConfiguration', 'firmwareUpdateStatus',
          'capabilities', 'endpoint', 'chargePointVendor', 'chargePointModel', 'ocppVersion', 'ocppProtocol', 'lastSeen',
          'firmwareVersion', 'currentIPAddress', 'ocppStandardParameters', 'ocppVendorParameters', 'connectors', 'chargePoints',
          'createdOn', 'chargeBoxSerialNumber', 'chargePointSerialNumber', 'powerLimitUnit'
        ]
      },
      { resource: Entity.CHARGING_STATION, action: [Action.READ] },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.REMOTE_START_TRANSACTION, Action.AUTHORIZE, Action.START_TRANSACTION],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'site': null }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'sites': '$.site'
              }
            }
          ]
        }
      },
      {
        resource: Entity.TAGS, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'userID', 'active', 'description', 'visualID', 'issuer', 'default',
          'createdOn', 'lastChangedOn'
        ],
      },
      {
        resource: Entity.TAG, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'userID', 'issuer', 'active', 'description', 'visualID', 'default',
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.issuer'
        ],
      },
      {
        resource: Entity.TAGS, action: Action.UNASSIGN,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['OwnUser'],
            filters: ['OwnUser']
          }
        }
      },
      {
        resource: Entity.TAG, action: Action.UNASSIGN,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['OwnUser'],
            filters: ['OwnUser'],
          }
        }
      },
      {
        resource: Entity.TAG, action: Action.UPDATE_BY_VISUAL_ID,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['OwnUser'],
            filters: ['OwnUser'],
          }
        }
      },
      {
        resource: Entity.TAG, action: Action.ASSIGN,
        attributes: [
          'userID', 'description', 'visualID', 'default',
          'user.name', 'user.firstName', 'user.email', 'createdOn', 'lastChangedOn'
        ]
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.REMOTE_STOP_TRANSACTION, Action.STOP_TRANSACTION],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
      },
      { resource: Entity.TRANSACTIONS, action: [Action.LIST, Action.EXPORT] },
      {
        resource: Entity.TRANSACTION, action: [Action.READ],
        condition: {
          Fn: 'OR',
          args: [
            {
              Fn: 'EQUALS',
              args: { 'user': '$.owner' }
            },
            {
              Fn: 'LIST_CONTAINS',
              args: {
                'tagIDs': '$.tagID'
              }
            }
          ]
        }
      },
      { resource: Entity.CONNECTIONS, action: Action.LIST },
      { resource: Entity.CONNECTION, action: [Action.CREATE] },
      {
        resource: Entity.CONNECTION, action: [Action.READ, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        }
      },
      { resource: Entity.NOTIFICATION, action: Action.CREATE },
    ]
  },
  demo: {
    grants: [
      {
        resource: Entity.USER, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['OwnUser']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'issuer', 'locale', 'notificationsActive',
          'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ],
      },
      {
        resource: Entity.ASSETS, action: Action.LIST,
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge'
        ]
      },
      { resource: Entity.ASSET, action: Action.READ },
      { resource: Entity.SETTING, action: Action.READ },
      {
        resource: Entity.CAR_CATALOGS, action: Action.LIST,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed', 'performanceTopspeed',
          'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'image',
          'chargeStandardPower', 'chargeStandardPhase', 'chargeStandardPhaseAmp', 'chargeAlternativePower', 'chargeOptionPower',
          'chargeOptionPhaseAmp', 'chargeOptionPhase', 'chargeAlternativePhaseAmp', 'chargeAlternativePhase', 'chargePlug', 'fastChargePlug',
          'fastChargePowerMax', 'drivetrainPowerHP'
        ]
      },
      {
        resource: Entity.CAR_CATALOG, action: Action.READ,
        attributes: [
          'id', 'vehicleModel', 'vehicleMake', 'vehicleModelVersion', 'batteryCapacityFull', 'fastchargeChargeSpeed',
          'performanceTopspeed', 'performanceAcceleration', 'rangeWLTP', 'rangeReal', 'efficiencyReal', 'drivetrainPropulsion',
          'drivetrainTorque', 'batteryCapacityUseable', 'chargePlug', 'fastChargePlug', 'fastChargePowerMax', 'chargePlugLocation',
          'drivetrainPowerHP', 'chargeStandardChargeSpeed', 'chargeStandardChargeTime', 'miscSeats', 'miscBody', 'miscIsofix', 'miscTurningCircle',
          'miscSegment', 'miscIsofixSeats', 'chargeStandardPower', 'chargeStandardPhase', 'chargeAlternativePower', 'hash',
          'chargeAlternativePhase', 'chargeOptionPower', 'chargeOptionPhase', 'image', 'chargeOptionPhaseAmp', 'chargeAlternativePhaseAmp'
        ]
      }, {
        resource: Entity.CAR, action: Action.READ,
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase'
        ]
      },
      {
        resource: Entity.CARS, action: Action.LIST,
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull'
        ]
      },
      {
        resource: Entity.COMPANIES, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'logo', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn'
        ]
      },
      {
        resource: Entity.COMPANY, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'logo', 'address'
        ]
      },
      {
        resource: Entity.SITES, action: Action.LIST,
        attributes: [
          'id', 'name', 'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ]
      },
      {
        resource: Entity.SITE, action: Action.READ,
        attributes: [
          'id', 'name', 'address', 'companyID', 'company.name', 'autoUserSiteAssignment', 'issuer',
          'autoUserSiteAssignment', 'distanceMeters', 'public', 'createdOn', 'lastChangedOn',
        ]
      },
      {
        resource: Entity.SITE_AREAS, action: Action.LIST,
        attributes: [
          'id', 'name', 'siteID', 'maximumPower', 'voltage', 'numberOfPhases', 'accessControl', 'smartCharging',
          'address.address1', 'address.address2', 'address.postalCode', 'address.city', 'address.country',
          'address.coordinates', 'site.id', 'site.name', 'issuer', 'distanceMeters', 'createdOn', 'lastChangedOn'
        ]
      },
      {
        resource: Entity.SITE_AREA, action: Action.READ,
        attributes: [
          'id', 'name', 'issuer', 'image', 'address', 'maximumPower', 'numberOfPhases',
          'voltage', 'smartCharging', 'accessControl', 'connectorStats', 'siteID', 'site.name'
        ]
      },
      {
        resource: Entity.CHARGING_STATIONS, action: Action.LIST,
        attributes: [
          'id', 'inactive', 'public', 'chargingStationURL', 'issuer', 'maximumPower', 'excludeFromSmartCharging', 'lastReboot',
          'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.smartCharging', 'siteArea.siteID',
          'site.id', 'site.name', 'siteID', 'voltage', 'coordinates', 'forceInactive', 'manualConfiguration', 'firmwareUpdateStatus',
          'capabilities', 'endpoint', 'chargePointVendor', 'chargePointModel', 'ocppVersion', 'ocppProtocol', 'lastSeen',
          'firmwareVersion', 'currentIPAddress', 'ocppStandardParameters', 'ocppVendorParameters', 'connectors', 'chargePoints',
          'createdOn', 'chargeBoxSerialNumber', 'chargePointSerialNumber', 'powerLimitUnit'
        ]
      },
      { resource: Entity.CHARGING_STATION, action: Action.READ },
      { resource: Entity.TRANSACTIONS, action: Action.LIST },
      { resource: Entity.TRANSACTION, action: Action.READ },
    ]
  },
  siteAdmin: {
    '$extend': {
      'basic': {}
    },
    grants: [
      {
        resource: Entity.TAG, action: [Action.ASSIGN, Action.UNASSIGN, Action.UPDATE_BY_VISUAL_ID],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['ExcludeAction'],
          }
        }
      },
      {
        resource: Entity.TAGS, action: [Action.UNASSIGN],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['ExcludeAction']
          }
        }
      },
      {
        resource: Entity.USERS, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn',
          'lastChangedOn', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn', 'technical'
        ],
      },
      {
        resource: Entity.USER, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address', 'technical'
        ],
      },
      {
        resource: Entity.USER, action: [Action.CREATE, Action.UPDATE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['BasicUser'],
            filters: ['SitesAdmin'],
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'locale', 'plateID',
          'notificationsActive', 'notifications', 'phone', 'mobile', 'iNumber', 'costCenter', 'address', 'technical'
        ],
      },
      { resource: Entity.USER, action: Action.SYNCHRONIZE_BILLING_USER },
      {
        resource: Entity.USER, action: Action.DELETE,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: ['BasicUser'],
            filters: ['-OwnUser', 'SitesAdmin']
          }
        }
      },
      {
        resource: Entity.USERS_SITES, action: [Action.LIST, Action.UNASSIGN],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
        attributes: [
          'user.id', 'user.name', 'user.firstName', 'user.email', 'user.role', 'siteAdmin', 'siteOwner', 'siteID'
        ]
      },
      {
        resource: Entity.SITE, action: [Action.UPDATE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
      },
      { resource: Entity.SITE_AREA, action: Action.CREATE },
      {
        resource: Entity.SITE_AREA,
        action: [
          Action.UPDATE, Action.DELETE, Action.UNASSIGN_ASSETS_TO_SITE_AREA, Action.UNASSIGN_CHARGING_STATIONS_TO_SITE_AREA
        ],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
      },
      {
        resource: Entity.ASSETS, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge'
        ],
      },
      {
        resource: Entity.ASSET, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['AssignedSites', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'siteAreaID', 'siteArea.id', 'siteArea.name', 'siteArea.siteID', 'siteID', 'assetType', 'coordinates',
          'dynamicAsset', 'connectionID', 'meterID', 'currentInstantWatts', 'currentStateOfCharge'
        ],
      },
      {
        resource: Entity.CARS, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn',
          'carCatalog.id', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion',
          'carCatalog.image', 'carCatalog.fastChargePowerMax', 'carCatalog.batteryCapacityFull',
          'createdBy.name', 'createdBy.firstName', 'lastChangedBy.name', 'lastChangedBy.firstName',
          'user.id', 'user.name', 'user.firstName', 'userID'
        ],
      },
      { resource: Entity.CAR, action: Action.CREATE },
      {
        resource: Entity.CAR, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        },
        attributes: [
          'id', 'type', 'vin', 'licensePlate', 'converter', 'default', 'createdOn', 'lastChangedOn', 'user.id', 'user.name', 'user.firstName',
          'carCatalogID', 'carCatalog.vehicleMake', 'carCatalog.vehicleModel', 'carCatalog.vehicleModelVersion', 'carCatalog.image',
          'carCatalog.chargeStandardPower', 'carCatalog.chargeStandardPhaseAmp', 'carCatalog.chargeStandardPhase',
          'carCatalog.chargeAlternativePower', 'carCatalog.chargeAlternativePhaseAmp', 'carCatalog.chargeAlternativePhase',
          'carCatalog.chargeOptionPower', 'carCatalog.chargeOptionPhaseAmp', 'carCatalog.chargeOptionPhase', 'carConnectorData.carConnectorID', 'carConnectorData.carConnectorMeterID'
        ],
      },
      {
        resource: Entity.CAR, action: [Action.UPDATE, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin']
          }
        }
      },
      {
        resource: Entity.CHARGING_STATION,
        action: [Action.UPDATE, Action.DELETE, Action.RESET, Action.CLEAR_CACHE, Action.GET_CONFIGURATION,
          Action.CHANGE_CONFIGURATION, Action.SET_CHARGING_PROFILE, Action.GET_COMPOSITE_SCHEDULE,
          Action.CLEAR_CHARGING_PROFILE, Action.GET_DIAGNOSTICS, Action.UPDATE_FIRMWARE, Action.REMOTE_STOP_TRANSACTION,
          Action.STOP_TRANSACTION, Action.EXPORT, Action.CHANGE_AVAILABILITY],
        condition: {
          Fn: 'LIST_CONTAINS',
          args: { 'sitesAdmin': '$.site' }
        },
      },
      { resource: Entity.CHARGING_PROFILES, action: Action.LIST },
      {
        resource: Entity.CHARGING_PROFILE, action: [Action.READ],
        condition: {
          Fn: 'LIST_CONTAINS',
          args: { 'sitesAdmin': '$.site' }
        },
      },
      {
        resource: Entity.TRANSACTION, action: [Action.READ],
        condition: {
          Fn: 'LIST_CONTAINS',
          args: { 'sitesAdmin': '$.site' }
        },
      },
      { resource: Entity.REPORT, action: [Action.READ] },
      { resource: Entity.LOGGINGS, action: Action.LIST },
      {
        resource: Entity.LOGGING,
        action: Action.READ,
        args: { 'sites': '$.site' }
      },
      { resource: Entity.TOKENS, action: Action.LIST },
      {
        resource: Entity.TOKEN,
        action: [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE],
        args: { 'sites': '$.site' }
      },
      {
        resource: Entity.TAGS, action: [Action.LIST, Action.EXPORT],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'userID', 'active', 'ocpiToken', 'description', 'visualID', 'issuer', 'default',
          'user.name', 'user.firstName', 'user.email', 'createdOn', 'lastChangedOn'
        ],
      },
      { resource: Entity.TAG, action: Action.CREATE },
      {
        resource: Entity.TAG, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer'],
            metadata: {
              userID: {
                visible: true,
                enabled: true,
                mandatory: true,
                values: [],
                defaultValue: null,
              }
            },
          }
        },
        attributes: [
          'id', 'userID', 'issuer', 'active', 'description', 'visualID', 'default', 'user.id',
          'user.name', 'user.firstName', 'user.email'
        ],
      },
      {
        resource: Entity.TAG, action: [Action.UPDATE, Action.DELETE],
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesAdmin', 'LocalIssuer']
          }
        }
      },
    ]
  },
  siteOwner: {
    '$extend': {
      'basic': {}
    },
    grants: [
      {
        resource: Entity.USERS, action: Action.LIST,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesOwner', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'role', 'status', 'issuer', 'createdOn',
          'lastChangedOn', 'eulaAcceptedOn', 'eulaAcceptedVersion', 'locale',
          'billingData.customerID', 'billingData.lastChangedOn'
        ],
      },
      {
        resource: Entity.USER, action: Action.READ,
        condition: {
          Fn: 'custom:dynamicAuthorizations',
          args: {
            asserts: [],
            filters: ['SitesOwner', 'LocalIssuer']
          }
        },
        attributes: [
          'id', 'name', 'firstName', 'email', 'issuer', 'locale', 'notificationsActive', 'notifications',
          'phone', 'mobile', 'iNumber', 'costCenter', 'address'
        ],
      },
      {
        resource: Entity.TRANSACTION, action: [Action.READ, Action.REFUND_TRANSACTION],
        condition: {
          Fn: 'LIST_CONTAINS',
          args: { 'sitesOwner': '$.site' }
        }
      },
      { resource: Entity.REPORT, action: [Action.READ] },
    ]
  },
};

export const AUTHORIZATION_CONDITIONS: IDictionary<IFunctionCondition> = {
  dynamicAuthorizations: (context: Record<string, any>, args: AuthorizationContext): boolean => {
    // Pass the dynamic filters to the context
    // Used by the caller to execute dynamic filters
    if (context) {
      // Filters
      if (!context.filters) {
        context.filters = [];
      }
      if (!context.filtersSet && args.filters) {
        context.filters = [
          ...args.filters
        ];
        context.filtersSet = true;
      }
      // Assertions
      if (!context.asserts) {
        context.asserts = [];
      }
      if (!context.assertsSet && args.asserts) {
        context.asserts = [
          ...args.asserts
        ];
        context.assertsSet = true;
      }
      // Metadata
      if (!context.metadata) {
        context.metadata = {};
      }
      if (!context.metadataSet && args.metadata) {
        context.metadata = args.metadata;
        context.metadataSet = true;
      }
    }
    return true;
  }
};
