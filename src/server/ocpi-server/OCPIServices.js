const OCPIService2_1_1 = require('./ocpi-services-impl/ocpi-2_1_1/OCPIService2_1_1.js');
const OCPIService2_0 = require('./ocpi-services-impl/ocpi-2_0/OCPIService2_0.js');

require('source-map-support').install();

const _ocpiServices = [];

class OCPIServices {
  // Create OCPI Service
  constructor(ocpiRestConfig) {
    // add available OCPI services
    // version 2.1.1
    _ocpiServices.push(new OCPIService2_1_1(ocpiRestConfig));

    // version 2.0
    _ocpiServices.push(new OCPIService2_0(ocpiRestConfig));
  }
  /**
   * Get all implemented versions of OCPI
   */
  getVersions(req, res) {
    const versions = [];

    _ocpiServices.forEach(ocpiService => {
      versions.push({ "version": ocpiService.getVersion() , "url": ocpiService.getServiceUrl()});
    })

    // send available versions
    res.json(versions);
  }

  // Return all OCPI Service Implementation
  getOCPIServiceImplementations() {
    return _ocpiServices;
  }
}

module.exports = OCPIServices;