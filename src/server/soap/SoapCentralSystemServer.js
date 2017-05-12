var Logging = require('../../utils/Logging');
var centralSystemService12 = require('./services/centralSystemService1.2');
var centralSystemService15 = require('./services/centralSystemService1.5');
var centralSystemService16 = require('./services/centralSystemService1.6');
var fs = require('fs');
var soap = require('strong-soap').soap;
var path = require('path');
var http = require('http');
var express = require('express')();
var CentralSystemServer = require('../CentralSystemServer');

let _serverConfig;
let _chargingStationConfig;

class SoapCentralSystemServer extends CentralSystemServer {
    constructor(serverConfig, chargingStationConfig) {
      // Call parent
      super(serverConfig, chargingStationConfig, express);

      // Keep local
      _serverConfig = serverConfig;
      _chargingStationConfig = chargingStationConfig;
    }

    /*
      Start the server and listen to all SOAP OCCP versions
      Listen to external command to send request to charging stations
    */
    start() {
      // Create the HTTP server
      var httpServer = http.createServer(express);

      // Read the WSDL files
      var centralSystemWsdl12 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.2.wsdl'), 'UTF-8');
      var centralSystemWsdl15 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.5.wsdl'), 'UTF-8');
      var centralSystemWsdl16 = fs.readFileSync(
        path.join(__dirname, '/wsdl/OCPP_CentralSystemService1.6.wsdl'), 'UTF-8');

      // Create Soap Servers
      // OCPP 1.2 -----------------------------------------
      var soapServer12 = soap.listen(httpServer, '/OCPP12', centralSystemService12, centralSystemWsdl12);
      // OCPP 1.5 -----------------------------------------
      var soapServer15 = soap.listen(httpServer, '/OCPP15', centralSystemService15, centralSystemWsdl15);
      // OCPP 1.6 -----------------------------------------
      var soapServer16 = soap.listen(httpServer, '/OCPP16', centralSystemService16, centralSystemWsdl16);

      // Listen
      httpServer.listen(_serverConfig.port, function(req, res) {
        // Log
        Logging.logInfo({
          source: "Central Server", module: "SoapCentralSystemServer", method: "start",
          message: `Central Server started on 'localhost:${_serverConfig.port}'` });
        console.log(`Central Server started on 'localhost:${_serverConfig.port}'`);
      });
    }
}

module.exports = SoapCentralSystemServer;
