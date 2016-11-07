var http = require('https'),
	fs = require('fs'),
	url = require('url'),
	count = 0,
	path = "/dev/iot/leo/leaspeaking"
	userAdmin = "",
	pwdAdmin = "",
	publicRessources = ["GET /", "GET /index.html", "GET /auth"];

var options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

// Récupération user et mot de passe
process.argv.forEach(function (val, index) {
	if (index === 2) {
		userAdmin = val;
	} else if  (index === 3) {
		pwdAdmin = val;
	}
});

// Vérification chemin des json
try {
	fs.statSync(path).isDirectory();
} catch (error) {
	console.log("Répertoire \"" + path + "\" non trouvé")
	path = "./";
}

/*
* Permet de créer le Json de la réponse
* @param httpCode {Integer} code HTTP
* @param contentType {String} header content-type
* @param content {String/Json} body  de la réposne
* @return {Json} de la forme { httpCode : httpCode, contentType : contentType, content : content }
*/
function _createResponse(httpCode, contentType, content) {
	return {
		httpCode : httpCode,
		contentType : contentType,
		content : content
	};
}

/*
* Permet de terminer la requête HTTP
* @param res {Object} Objet Node réprésetant la réponse HTTP
* @param response {Json} Voir _createResponse()
*/
function _endResponse(res, response) {
	res.writeHead(response.httpCode, {'Content-Type': response.contentType});
	res.end(response.content);
}

/*
* Permet de lire un fichier
* @param fileName {String} Nom du fichier
* @param withPath {Boolean} indique s'il faut aller le chercher le fichier avec le path 
* @return {Object} le résultat de readFileSync de Node
*/
function _internalReadFileSync(fileName, withPath) {
	var filePath = fileName;
	if (withPath) {
		filePath = path + fileName;
	}
	return fs.readFileSync(filePath);
}

/*
* Permet d'écrire dans un fichier
*/
function _internalWriteFileSync(fileName, content) {
	fs.writeFileSync(path + fileName, content);
}

http.createServer(options, function(req, res) {
	var httpRequest = req.method + " " + url.parse(req.url).pathname;
	var sendResponse = true;
	var checkAuthent = (req.headers["user"] === userAdmin && req.headers["pwd"] === pwdAdmin);
	
	// Vérification user/pwd si la ressource demandée ne fait pas partie des ressources publiques
	if (publicRessources.indexOf(httpRequest) !== -1 || checkAuthent) {
		switch (httpRequest) {
			case "GET /":
				response = _createResponse(200, "text/html", _internalReadFileSync('index.html', false));
				break;
			case "GET /index.html":
				response = _createResponse(200, "text/html", _internalReadFileSync('index.html', false));
				break;
			case "GET /auth":
				if (checkAuthent) {
					response = _createResponse(200, "text/html", "Access granted");
				} else {
					response = _createResponse(403, "text/html", "Forbidden");
				}
				break;
			case "GET /gamification":
				try {
					var gamification = _internalReadFileSync('gamification.json', true);
					var gamificationJson = JSON.parse(gamification);
					response = _createResponse(200, "application/json", JSON.stringify(gamificationJson));
				} catch (error) {
					response = _createResponse(404, "text/html", "Resource not found");
				}
				break;
			case "POST /gamification":
				sendResponse = false;
				try {
					var requestContent = req.content;
					// Vérification des headers
					if (req.headers["content-type"] !== "application/json") {
						_createResponse(400, "text/html", "Le contenu de la requête devrait être du Json");
						_endResponse(res, response);
					} else {
						var body = [];
						req.on('data', function(chunk) {
							body.push(chunk);
						}).on('end', function() {
							try {
								body = Buffer.concat(body).toString();
								// Vérification du contenu
								JSON.parse(body);
								_internalWriteFileSync('gamification.json', body);
								response = _createResponse(201, "text/html", "OK");
								_endResponse(res, response);
							} catch (error) {
								console.log(error);
								response = _createResponse(500, "text/html", "Erreur lors de l'écriture : " + error);
								_endResponse(res, response);
							}
						}).on('error', function(error) {
							console.log(error);
							response = _createResponse(500, "text/html", "Erreur lors de l'écriture : " + error);
							_endResponse(res, response);
						});
					}
				} catch (error) {
					console.log(error);
					response = _createResponse(500, "text/html", "Erreur lors de l'écriture : " + error);
					_endResponse(res, response);
				}
				break;
			case "GET /tweets/count":
				try {
					var tweets = _internalReadFileSync('tweets.json', true);
					count = JSON.parse(tweets).length;
				} catch (error) {
					response = _createResponse(200, "application/json", "{\"count\":"+count+"}");
				} finally {
					response = _createResponse(200, "application/json", "{\"count\":"+count+"}");
				}
				break;
			default:
				response = _createResponse(404, "text/html", "Resource not found")
				break;
		}
	} else {
		response = _createResponse(403, "text/html", "Forbidden");
	}
	
	if (sendResponse) {
		_endResponse(res, response);
	}
	
}).listen(9090);