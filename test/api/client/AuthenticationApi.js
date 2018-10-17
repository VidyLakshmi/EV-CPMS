class AuthenticationApi {

    constructor(baseApi){
        this.baseApi = baseApi;
    }

    login(email, password, acceptEula = true){
        return this.baseApi.send({
            method: 'POST',
            url: '/client/auth/Login',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                email: email,
                password: password,
                tenant: 'cfr',
                acceptEula: acceptEula
            }
        });
    }

}

module.exports = AuthenticationApi;