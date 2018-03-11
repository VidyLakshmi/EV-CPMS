module.exports.email = {
	"subject": "Request to reset your password",
	"body": {
		"header": {
			"title": "Reset Password",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Hi <%= (user.firstName?user.firstName:user.name) %>,",
			"",
			"You have just requested to reset your password.",
			"",
			"Click on the link below to generate and receive a new one."
		],
		"action": {
			"title": "Reset Password",
			"url": "<%= evseDashboardResetPassURL %>"
		},
		"afterActionLines": [
			"If you haven't requested anything, you can ignore this email.",
			"",
			"Best Regards,",
			"EV Admin."
		],
		"footer": {
		}
	}
};

module.exports.fr_FR = {};
module.exports.fr_FR.email = {
	"subject": "Votre véhicule est correctement connecté sur <%= chargingBoxID %>",
	"body": {
		"header": {
			"title": "Connecté avec Succès!",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Bonjour <%= (user.firstName?user.firstName:user.name) %>,",
			"",
			"Vous venez de demander un nouveau mot de passe.",
			"",
			"Cliquez sur le lien ci-dessous pour en générer et en recevoir un nouveau."
		],
		"action": {
			"title": "Init Mot De Passe",
			"url": "<%= evseDashboardResetPassURL %>"
		},
		"afterActionLines": [
			"Si vous n'êtes par l'auteur de cette rêquete, vous pouvez ignorer cet email.",
			"",
			"Cordialement,",
			"EV Admin."
		],
		"footer": {
		}
	}
};
