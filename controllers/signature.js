const crypto = require('crypto');
const Influx = require('influx');
var sleep = require('system-sleep');

function rnd_string(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for(var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}; 

exports.registerCozy = function(req, res, next) {
 	// client qui se connecte à la base de données
 	const clt_influx = new Influx.InfluxDB({
		host: 'localhost',
		database: 'cozyIDs_DB',
		schema: [{
			measurement: 'cozyIDs',
			fields: {    
				signature: Influx.FieldType.STRING
			},
     		tags: ['cozyid']
		}]
	});

	clt_influx.getDatabaseNames() // On vérifie que la base de donnée pour le field souhaité existe
		.then(names => {
			if (names.indexOf('cozyIDs_DB') < 0) { // Si elle existe pas
				console.log('Création de la base de données cozyIDs_DB');						
				clt_influx.createDatabase('cozyIDs_DB'); // On créer la base de données
				sleep(500); // On attend que la base de données soit bien créée. // FIXME : Il n'y a pas de callback dans la méthode clt_influx.createDatabase pour le moment
			}

			var cozyid = rnd_string(8);
			var signature = getHash(cozyid);
	
			clt_influx.writePoints([{
				measurement: 'cozyIDs',
				tags: { cozyid: cozyid },
				fields: { signature: signature}
			}]
			).catch(function(err) {
				logger.error("Erreur lors de l'enregistrement l'enregistrement du cozyid et de la signature :\n" + err);
			});
			res.status(200).json({signature:signature, cozyid:cozyid});
		}).catch(function(err) {
			console.error(err);
		});		
}

function getHash(cozyid){
 	return crypto.createHmac('sha256', cozyid)
	 			 .update('e0975cd62a2aaf1d8cca2dd892da89129604088dd82ceb665db45a7871212f99')
                 .digest('hex');
 }

exports.checkCozySignature = function (cozyid, signature_raw) {
	var hash = getHash(cozyid);
	const clt_influx = new Influx.InfluxDB({
		host: 'localhost',
		database: 'cozyIDs_DB',
		schema: [{
			measurement: 'cozyIDs',
			fields: { 
				signature: Influx.FieldType.STRING
      		},
     		tags: ['cozyid']
		}]
	});

	clt_influx.queryRaw('select signature from cozyIDs where cozyid = ' + cozyid) // Exécution de la requête
		.then(signature => { 
			if (signature == undefined) { 
				return false;
			}
			return signature_raw == signature;
		})
		.catch(function(err) {
			console.error(err);
		});
}