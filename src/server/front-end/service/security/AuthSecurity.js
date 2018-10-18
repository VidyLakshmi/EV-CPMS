const sanitize = require('mongo-sanitize');
const Constants = require('../../../../utils/Constants');
const UtilsSecurity = require('./UtilsSecurity');

class AuthSecurity {

	static filterIsAuthorizedRequest(request, loggedUser) {
		const filteredRequest = {};
		// Set
		filteredRequest.Action = sanitize(request.Action);
		filteredRequest.Arg1 = sanitize(request.Arg1);
		filteredRequest.Arg2 = sanitize(request.Arg2);
		filteredRequest.Arg3 = sanitize(request.Arg3);
		return filteredRequest;
	}

	static filterResetPasswordRequest(request, loggedUser) {
		const filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.captcha = sanitize(request.captcha);
		filteredRequest.hash = sanitize(request.hash);
		return filteredRequest;
	}

	static filterRegisterUserRequest(request, loggedUser) {
		const filteredRequest = {};
		// Set
		filteredRequest.name = sanitize(request.name);
		filteredRequest.firstName = sanitize(request.firstName);
		filteredRequest.email = sanitize(request.email);
		filteredRequest.password = sanitize(request.passwords.password);
		filteredRequest.captcha = sanitize(request.captcha);
		filteredRequest.acceptEula = UtilsSecurity.filterBoolean(request.acceptEula);
		filteredRequest.status = Constants.USER_STATUS_PENDING;
		return filteredRequest;
	}

	static filterLoginRequest(request) {
		const filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.password = sanitize(request.password);
		filteredRequest.tenant = sanitize(request.tenant);
		filteredRequest.acceptEula = UtilsSecurity.filterBoolean(request.acceptEula);
		return filteredRequest;
	}

	static filterVerifyEmailRequest(request) {
		const filteredRequest = {};
		// Set
		filteredRequest.Email = sanitize(request.Email);
		filteredRequest.VerificationToken = sanitize(request.VerificationToken);
		return filteredRequest;
	}

	static filterResendVerificationEmail(request) {
		const filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.captcha = sanitize(request.captcha);
		return filteredRequest;
	}
}

module.exports = AuthSecurity;
