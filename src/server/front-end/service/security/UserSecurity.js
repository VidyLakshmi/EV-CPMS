const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../utils/Authorizations');
const Utils = require('../../../../utils/Utils');
const UtilsSecurity = require('./UtilsSecurity');

class UserSecurity {
	static filterUserDeleteRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterUserRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.ID = sanitize(request.ID);
		return filteredRequest;
	}

	static filterUsersRequest(request, loggedUser) {
		let filteredRequest = {};
		// Handle picture
		filteredRequest.Search = request.Search;
		filteredRequest.SiteID = request.SiteID;
		return filteredRequest;
	}

	static filterUserUpdateRequest(request, loggedUser) {
		// Set
		let filteredRequest = UserSecurity._filterUserRequest(request, loggedUser);
		filteredRequest.id = sanitize(request.id);
		return filteredRequest;
	}

	static filterUserCreateRequest(request, loggedUser) {
		return UserSecurity._filterUserRequest(request, loggedUser);
	}

	static _filterUserRequest(request, loggedUser) {
		let filteredRequest = {};
		filteredRequest.costCenter = sanitize(request.costCenter);
		filteredRequest.email = sanitize(request.email);
		filteredRequest.firstName = sanitize(request.firstName);
		filteredRequest.iNumber = sanitize(request.iNumber);
		filteredRequest.image = sanitize(request.image);
		filteredRequest.mobile = sanitize(request.mobile);
		filteredRequest.name = sanitize(request.name);
		filteredRequest.locale = sanitize(request.locale);
		filteredRequest.address = UtilsSecurity.filterAddressRequest(request.address, loggedUser);
		if (request.passwords) {
			filteredRequest.password = sanitize(request.passwords.password);
		}
		filteredRequest.phone = sanitize(request.phone);
		// Admin?
		if (Authorizations.isAdmin(loggedUser)) {
			// Ok to set the role
			filteredRequest.role = sanitize(request.role);
			filteredRequest.status = sanitize(request.status);
		}
		filteredRequest.tagIDs = sanitize(request.tagIDs);
		return filteredRequest;
	}

	// User
	static filterUserResponse(user, loggedUser) {
		let filteredUser={};

		if (!user) {
			return null;
		}
		// Check auth
		if (Authorizations.canReadUser(loggedUser, user)) {
			// Admin?
			if (Authorizations.isAdmin(loggedUser)) {
				filteredUser.id = user.id;
				filteredUser.name = user.name;
				filteredUser.firstName = user.firstName;
				filteredUser.locale = user.locale;
				filteredUser.email = user.email;
				filteredUser.phone = user.phone;
				filteredUser.mobile = user.mobile;
				filteredUser.iNumber = user.iNumber;
				filteredUser.costCenter = user.costCenter;
				filteredUser.status = user.status;
				filteredUser.eulaAcceptedOn = user.eulaAcceptedOn;
				filteredUser.eulaAcceptedVersion = user.eulaAcceptedVersion;
				filteredUser.tagIDs = user.tagIDs;
				filteredUser.role = user.role;
				filteredUser.numberOfTransactions = user.numberOfTransactions;
				filteredUser.numberOfSites = user.numberOfSites;
				if (user.address) {
					filteredUser.address = UtilsSecurity.filterAddressRequest(user.address, loggedUser);
				}
			} else {
				// Set only necessary info
				filteredUser.id = user.id;
				filteredUser.name = user.name;
				filteredUser.firstName = user.firstName;
				filteredUser.email = user.email;
				filteredUser.locale = user.locale;
			}
			// Created By / Last Changed By
			UtilsSecurity.filterCreatedAndLastChanged(
				filteredUser, user, loggedUser);
		}
		return filteredUser;
	}

	// User
	static filterMinimalUserResponse(user, loggedUser) {
		let filteredUser={};

		if (!user) {
			return null;
		}
		// Check auth
		if (Authorizations.canReadUser(loggedUser, user)) {
			// Admin?
			if (Authorizations.isAdmin(loggedUser)) {
				filteredUser.id = user.id;
				filteredUser.name = user.name;
				filteredUser.firstName = user.firstName;
			} else {
				// Set only necessary info
				filteredUser.id = user.id;
				filteredUser.name = user.name;
				filteredUser.firstName = user.firstName;
			}
		}
		return filteredUser;
	}

	static filterUsersResponse(users, loggedUser) {
		let filteredUsers = [];

		if (!users) {
			return null;
		}
		users.forEach(user => {
			// Filter
			let filteredUser = UserSecurity.filterUserResponse(user, loggedUser);
			// Ok?
			if (filteredUser) {
				// Add
				filteredUsers.push(filteredUser);
			}
		});
		return filteredUsers;
	}

	static filterEndUserLicenseAgreementRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.Language = sanitize(request.Language);
		return filteredRequest;
	}

	static filterEndUserLicenseAgreementResponse(endUserLicenseAgreement, loggedUser) {
		let filteredEndUserLicenseAgreement = {};

		if (!endUserLicenseAgreement) {
			return null;
		}
		// Set
		filteredEndUserLicenseAgreement.text = endUserLicenseAgreement.text;
		return filteredEndUserLicenseAgreement;
	}
}

module.exports = UserSecurity;
