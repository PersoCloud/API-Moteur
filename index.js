/////////////////////////////////////////////////
///          PersoCloud - API moteur          ///
/////////////////////////////////////////////////

const PORT = 8081;

/* Chargement des librairies */
var express = require('express');
var app = express();
var morgan = require('morgan'); // Logger
var bodyParser = require('body-parser'); // pull information from HTML POST (express4)

app.use(morgan('[:date[iso]] :method :status :url - :res[content-length] o - :response-time ms'));
app.use(bodyParser.json()); // parse application/json

// Chargement des routes
var routes = require('./routes'); // Chargement des routes de l'API
app.use('/', routes);

/* Lancement du serveur */
var server = app.listen(PORT, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log("Moteur PersoCloud démarré sur http://%s:%s", host, port);
});
