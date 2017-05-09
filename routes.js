var express = require('express');
var router = express.Router();
var fs = require("fs");

var ctrl_analyze = require("./controllers/analyze");
var ctrl_cozydata = require("./controllers/cozydata");
var ctrl_signature = require("./controllers/signature");

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

// TODO: Finir l'inscription d'un Cozy dans le moteur (Acquisition d'un CozyID et d'une signature)
router.get('/cozydata/register', function(req, res, next) {
    ctrl_signature.registerCozy(req, res, next);
});

// Utilisé pour insérer des données dans le moteur sans authentification des Cozy (Sans inscription et sans contrôle des signatures)
router.post('/cozydata/force', function(req, res, next) { 
	ctrl_cozydata.set(req, res, next, true);
});

module.exports = router;