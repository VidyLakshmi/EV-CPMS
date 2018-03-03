const mongoose = require('mongoose');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const Database = require('../../../utils/Database');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const MDBCompany = require('../model/MDBCompany');
const MDBSite = require('../model/MDBSite');
const MDBSiteArea = require('../model/MDBSiteArea');
const MDBChargingStation = require('../model/MDBChargingStation');
const MDBCompanyLogo = require('../model/MDBCompanyLogo');
const Company = require('../../../model/Company');
const SiteStorage = require('./SiteStorage');
const ChargingStation = require('../../../model/ChargingStation');
const Site = require('../../../model/Site');
const User = require('../../../model/User');
const SiteArea = require('../../../model/SiteArea');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;

class CompanyStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetCompany(id, withUsers) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: ObjectId(id) }
		});
		if (withUsers) {
			// Add
			aggregation.push({
				$lookup: {
					from: "users",
					localField: "userIDs",
					foreignField: "_id",
					as: "users"
				}
			});
		}
		// Execute
		return MDBCompany.aggregate(aggregation)
				.exec().then((companyMDB) => {
			let company = null;
			// Check
			if (companyMDB && companyMDB.length > 0) {
				// Create
				company = new Company(companyMDB[0]);
				// Set users
				if (companyMDB[0].users) {
					// Create Users
					companyMDB[0].users = companyMDB[0].users.map((user) => {
						return new User(user);
					});
					company.setUsers(companyMDB[0].users)
				}
			}
			return company;
		});
	}

	static handleGetCompanyLogo(id) {
		// Exec request
		return MDBCompanyLogo.findById(id)
				.exec().then((companyLogoMDB) => {
			let companyLogo = null;
			// Set
			if (companyLogoMDB) {
				companyLogo = {
					id: companyLogoMDB._id,
					logo: companyLogoMDB.logo
				};
			}
			return companyLogo;
		});
	}

	static handleGetCompanyLogos() {
		// Exec request
		return MDBCompanyLogo.find({})
				.exec().then((companyLogosMDB) => {
			let companyLogos = [];
			// Add
			companyLogosMDB.forEach((companyLogoMDB) => {
				companyLogos.push({
					id: companyLogoMDB._id,
					logo: companyLogoMDB.logo
				});
			});
			return companyLogos;
		});
	}

	static handleSaveCompany(company) {
		// Check if ID/Name is provided
		if (!company.id && !company.name) {
			// ID must be provided!
			return Promise.reject( new Error(
				"Error in saving the Company: Company has no ID and no Name and cannot be created or updated") );
		} else {
			let companyFilter = {};
			// Build Request
			if (company.id) {
				companyFilter._id = company.id;
			} else {
				companyFilter._id = ObjectId();
			}
			// Check Created By
			if (company.createdBy && typeof company.createdBy == "object") {
				// This is the User Model
				company.createdBy = new ObjectId(company.createdBy.id);
			}
			// Check Last Changed By
			if (company.lastChangedBy && typeof company.lastChangedBy == "object") {
				// This is the User Model
				company.lastChangedBy = new ObjectId(company.lastChangedBy.id);
			}
			// Get
			let newCompany;
			return MDBCompany.findOneAndUpdate(companyFilter, company, {
				new: true,
				upsert: true
			}).then((companyMDB) => {
				newCompany = new Company(companyMDB);
				// Save Logo
				return MDBCompanyLogo.findOneAndUpdate({
					"_id": new ObjectId(newCompany.getID())
				}, company, {
					new: true,
					upsert: true
				});
			}).then(() => {
				// Notify Change
				if (!company.id) {
					_centralRestServer.notifyCompanyCreated(
						{
							"id": newCompany.getID(),
							"type": Constants.NOTIF_ENTITY_COMPANY
						}
					);
				} else {
					_centralRestServer.notifyCompanyUpdated(
						{
							"id": newCompany.getID(),
							"type": Constants.NOTIF_ENTITY_COMPANY
						}
					);
				}
				return newCompany;
			});
		}
	}

	// Delegate
	static handleGetCompanies(searchValue, withSites, numberOfCompanies) {
		// Check Limit
		numberOfCompanies = Utils.checkRecordLimit(numberOfCompanies);
		// Set the filters
		let filters = {};
		// Source?
		if (searchValue) {
			// Build filter
			filters.$and = [];
			filters.$and.push({
				"$or": [
					{ "name" : { $regex : searchValue, $options: 'i' } },
					{ "address.city" : { $regex : searchValue, $options: 'i' } },
					{ "address.country" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Create Aggregation
		let aggregation = [];
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Add Sites
		aggregation.push({
			$lookup: {
				from: "sites",
				localField: "_id",
				foreignField: "companyID",
				as: "sites"
			}
		});
		aggregation.push({
			$addFields: {
				"numberOfSites": { $size: "$sites" }
			}
		});
		// Created By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "createdBy",
				foreignField: "_id",
				as: "createdBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$createdBy", "preserveNullAndEmptyArrays": true }
		});
		// Last Changed By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "lastChangedBy",
				foreignField: "_id",
				as: "lastChangedBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$lastChangedBy", "preserveNullAndEmptyArrays": true }
		});
		// Sort
		aggregation.push({
			$sort: { name : 1 }
		});
		// Limit
		if (numberOfCompanies > 0) {
			aggregation.push({
				$limit: numberOfCompanies
			});
		}
		// Execute
		return MDBCompany.aggregate(aggregation)
				.exec().then((companiesMDB) => {
			let companies = [];
			// Create
			companiesMDB.forEach((companyMDB) => {
				// Create
				let company = new Company(companyMDB);
				// Set site
				if (withSites && companyMDB.sites) {
					company.setSites(companyMDB.sites.map((site) => {
						return new Site(site);
					}));
				}
				// Add
				companies.push(company);
			});
			return companies;
		});
	}

	static handleDeleteCompany(id) {
		// Delete Sites
		return SiteStorage.handleGetSitesFromCompany(id).then((sites) => {
			// Delete
			let proms = [];
			sites.forEach((site) => {
				//	Delete Site
				proms.push(site.delete());
			});
			// Execute all promises
			return Promise.all(proms);
		}).then((results) => {
			// Remove the Company
			return MDBCompany.findByIdAndRemove(id);
		}).then((results) => {
			// Remove Logo
			return MDBCompanyLogo.findByIdAndRemove( id );
		}).then((result) => {
			// Notify Change
			_centralRestServer.notifyCompanyDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_COMPANY
				}
			);
			return;
		});
	}
}

module.exports = CompanyStorage;
