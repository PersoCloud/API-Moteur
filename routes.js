var express = require('express');
var router = express.Router();
var fs = require("fs");

var ctrl_analyze = require("./controllers/analyze");
var ctrl_cozydata = require("./controllers/cozydata");

/* Lire un fichier sur le serveur et le retourner au client */
router.get('/test', function (req, res) {
    fs.readFile( __dirname + "/" + "JeuDeTest-Factures.json", 'utf8', function (err, data) {
        res.end( data );
    });
});

// Analyse
router.get('/analyze', function(req, res, next) {
    ctrl_analyze.analyze(req, res, next);
});


router.post('/cozydata', function(req, res, next) {
    ctrl_cozydata.set(req, res, next, false);
});

// Utilisé pour insérer des données dans le moteur sans authentification des Cozy (Inscription et contrôle des signatures)
router.post('/cozydata/force', function(req, res, next) { 
	ctrl_cozydata.set(req, res, next, true);
});

module.exports = router;