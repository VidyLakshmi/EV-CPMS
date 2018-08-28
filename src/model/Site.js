const Database = require('../utils/Database');
const SiteArea = require('./SiteArea');
const Company = require('./Company');
const User = require('./User');
const AppError = require('../exception/AppError');
const Constants = require('../utils/Constants');
const CompanyStorage = require('../storage/mongodb/CompanyStorage');
const UserStorage = require('../storage/mongodb/UserStorage');
const SiteAreaStorage = require('../storage/mongodb/SiteAreaStorage');
const SiteStorage = require('../storage/mongodb/SiteStorage');

class Site {
	constructor(site) {
		// Init model
		this._model = {};

		// Set it
		Database.updateSite(site, this._model);
	}

	getModel() {
		return this._model;
	}

	getID() {
		return this._model.id;
	}

	setName(name) {
		this._model.name = name;
	}

	getName() {
		return this._model.name;
	}

	setAddress(address) {
		this._model.address = address;
	}

	getAddress() {
		return this._model.address;
	}

	setAllowAllUsersToStopTransactionsEnabled(allowAllUsersToStopTransactions) {
		this._model.allowAllUsersToStopTransactions = allowAllUsersToStopTransactions;
	}

	isAllowAllUsersToStopTransactionsEnabled() {
		return this._model.allowAllUsersToStopTransactions;
	}

	setImage(image) {
		this._model.image = image;
	}

	getImage() {
		return this._model.image;
	}

	setGps(gps) {
		this._model.gps = gps;
	}

	getGps() {
		return this._model.gps;
	}

	getCreatedBy() {
		if (this._model.createdBy) {
			return new User(this._model.createdBy);
		}
		return null;
	}

	setCreatedBy(user) {
		this._model.createdBy = user.getModel();
	}

	getCreatedOn() {
		return this._model.createdOn;
	}

	setCreatedOn(createdOn) {
		this._model.createdOn = createdOn;
	}

	getLastChangedBy() {
		if (this._model.lastChangedBy) {
			return new User(this._model.lastChangedBy);
		}
		return null;
	}

	setLastChangedBy(user) {
		this._model.lastChangedBy = user.getModel();
	}

	getLastChangedOn() {
		return this._model.lastChangedOn;
	}

	setLastChangedOn(lastChangedOn) {
		this._model.lastChangedOn = lastChangedOn;
	}

	static checkIfSiteValid(filteredRequest, request) {
		// Update model?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site ID is mandatory`, 500, 
				'Site', 'checkIfSiteValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Site Name is mandatory`, 500, 
				'Site', 'checkIfSiteValid');
		}
		if(!filteredRequest.companyID) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Company ID is mandatory for the Site`, 500, 
				'Sites', 'checkIfSiteValid');
		}
	}

	async getCompany() {
		if (this._model.company) {
			return new Company(this._model.company);
		} else if (this._model.companyID){
			// Get from DB
			let company = await CompanyStorage.getCompany(this._model.companyID);
			// Keep it
			this.setCompany(company);
			return company;
		}
	}

	setCompany(company) {
		if (company) {
			this._model.company = company.getModel();
			this._model.companyID = company.getID();
		} else {
			this._model.company = null;
		}
	}

	async getSiteAreas() {
		if (this._model.sites) {
			return this._model.siteAreas.map((siteArea) => new SiteArea(siteArea));
		} else {
			// Get from DB
			let siteAreas = await SiteAreaStorage.getSiteAreas({'siteID': this.getID()});
			// Keep it
			this.setSiteAreas(siteAreas);
			return siteAreas;
		}
	}

	setSiteAreas(siteAreas) {
		this._model.siteAreas = siteAreas.map((siteArea) => siteArea.getModel());
	}

	async getUsers() {
		if (this._model.users) {
			return this._model.users.map((user) => new User(user));
		} else {
			// Get from DB
			let users = await UserStorage.getUsers(null, this.getID());
			// Keep it
			this.setUsers(users);
			return users;
		}
	}

	removeUser(user) {
		if (this._model.users) {
			// Search
			for (var i = 0; i < this._model.users.length; i++) {
				if (this._model.users[i].id == user.getID()) {
					// Remove
					this._model.users.splice(i, 1);
					break;
				}
			}
		}
	}

	setUsers(users) {
		this._model.users = users.map((user) => user.getModel());
	}

	save() {
		return SiteStorage.saveSite(this.getModel());
	}

	saveImage() {
		return SiteStorage.saveSiteImage(this.getModel());
	}

	delete() {
		return SiteStorage.deleteSite(this.getID());
	}
}

module.exports = Site;
