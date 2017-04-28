var logger = require("../helpers/logger");
var Influx = require('influx');
var sleep = require('system-sleep');

var hlp_date = require('../helpers/date');
var hlp_string = require('../helpers/string');
var hlp_influxdb = require('../helpers/influxdb');

exports.set = function (req, res, next, force) {
	// Vérification des champs
	if(req.body == undefined) {
		logger.clientError('No data sent');
		res.status(400).send('No data sent');
        return;
	}
	
	if(req.body.cozyid == undefined) {
		logger.clientError('No cozy id specified');
		res.status(400).send('No cozy id specified');
        return;
	}

	/*if(!force) { // Sera utilisé lors de la prochaine version avec l'authentification des cozys

	}*/

	if(req.body.field == undefined) {
		logger.clientError('No field specified');
		res.status(400).send('No field specified');
        return;
	}
	
	if(req.body.data == undefined) {
		logger.clientError('No data specified');
		res.status(400).send('No data specified');
        return;
	}

	// Traitements et vérifications sur les champs
    var field = hlp_string.capitalizeFirstLetter(req.body.field);
	var cozyid = req.body.cozyid;	
	var datas = req.body.data;
	var datas_keys = [];

	if(datas.length == undefined) {  // Si c'est un objet et non un objet
		datas = [datas]; // On le transforme en tableau
	}
	
	// On lit toute les clés des objets afin d'obtenir la structure de donnée
	datas.forEach(function(element) {
		element.cozyid = cozyid;
		datas_keys = datas_keys.concat(Object.keys(element));
	});
	datas_keys = cleanArray(datas_keys);

	// On regarde quel est le type le plus général possible de chaque donnée 
	var datas_types = [];
	for(var i = 0; i < datas_keys.length; i++) {
		datas_types[i] = undefined;
	}
	datas.forEach(function(element) {
		for(var i = 0; i < datas_keys.length; i++) {
			if(element[datas_keys[i]] != undefined) {
				if(isBoolean(element[datas_keys[i]])) {
					if(datas_types[i] == undefined) {
						datas_types[i] = Influx.FieldType.BOOLEAN;
					} 
				}
				else if (isInt(element[datas_keys[i]])) {
					if(datas_types[i] == undefined || datas_types[i] == Influx.FieldType.BOOLEAN) {
						datas_types[i] = Influx.FieldType.INTEGER;
					} 
				} else if (isFloat(element[datas_keys[i]])) {
					if(datas_types[i] == undefined || datas_types[i] != Influx.FieldType.STRING) {
						datas_types[i] = Influx.FieldType.FLOAT;
					} 
				} else {
					datas_types[i] = Influx.FieldType.STRING;
				}
			}
		}
	});

	// On indique le schéma des données à Influx
	var tags_schema = getTagsSchema(datas_keys, datas_types);
	var fields_schema = getFieldsSchema(datas_keys, datas_types);
	var noFieldType = false;
	if(isEmpty(fields_schema)) { // Si on a trouvé aucun champ possible pour field, on en créer un car il en faut au moins un pour InfluxDB
		fields_schema = { value: Influx.FieldType.INTEGER };
		noFieldType = true;
	}

	// On créer le client InfluxDB
	const clt_influx = new Influx.InfluxDB({
		host: 'localhost',
		database: field +'_DB',
		schema: [{
			measurement: field,
			fields: fields_schema,
			tags: tags_schema
		}]
	});

	clt_influx.getDatabaseNames() // On vérifie que la base de donnée pour le field souhaité existe
		.then(names => {
			if (names.indexOf(field +'_DB') < 0) { // Si elle existe pas
				console.log('Création de la base de données ' + field +'_DB' + '...');						
				clt_influx.createDatabase(field +'_DB'); // On créer la base de données
				sleep(500); // On attend que la base de données soit bien créée. // FIXME : Il n'y a pas de callback dans la méthode clt_influx.createDatabase pour le moment
			}
			
			// On ajoute chaque donnée à Influx
			var error = false;
			for(var i = 0; i < datas.length; i++) {
				var item = datas[i];
				var tags_values = getTags(tags_schema, item);
				var fields_values = getFields(fields_schema, item);

				if(noFieldType) {
					if(field == "Mood") {
						fields_values = { value: getMoodValue(item.status) };
					} else {
						fields_values = { value: 1 };
					}
				}

				// On ajoute la données à InfluxDB
				clt_influx.writePoints([{
					measurement: field,
					tags: tags_values,
					fields: fields_values,
					timestamp: getItemTime(field, item)
				}], {
					precision: 'ms'
				}).catch(function(err) {
					error = true;
					logger.error("Erreur lors de l'insertion de la donnée " + field + " du cozy " + item.cozyid + " :\nItem : " + JSON.stringify(item) + "\nTags : " + JSON.stringify(tags_values) + "\nFields_schema : " + JSON.stringify(fields_schema) + " | Fiels_values : " + JSON.stringify(fields_values) +" \n" + err);
				})
			}

			// On indique comment c'est passé le traitement au client
			if(error) { res.status(500).send(); }
			else { res.status(200).send(); }
		})
		.catch(err => logger.error('Erreur lors de la création de la base de donnée ' + field +'_DB : ' + err));
};

/**
 * Retourne le schéma de données pour les tags InfluxDB
 * @param {*} datas_keys Clés des valeurs à ajoutées
 * @param {*} datas_types Types des valeurs à ajoutées
 */
function getTagsSchema(datas_keys, datas_types) {
	var tags = [];
	for (var i = 0; i < datas_keys.length; i++) {
		if(datas_keys[i] != "time" && datas_types[i] == Influx.FieldType.STRING) {
			tags.push(datas_keys[i]);
		}
	}
	return tags;
}

/**
 * Retourne les tags InfluxDB
 * @param {*} tags_schema Schéma de donnée des tags 
 * @param {*} item Données à ajouter à InfluxDB
 */
function getTags(tags_schema, item) {
	var values = {};
	for (var i = 0; i < tags_schema.length; i++) {
		if(item[tags_schema[i]] == undefined || item[tags_schema[i]] == "") {
			values[tags_schema[i]] = "null";
		} else {
			values[tags_schema[i]] = item[tags_schema[i]];
		}
	}
	return values;
}

/**
 * Retourne le schéma de données pour les fields InfluxDB
 * @param {*} datas_keys Clés des valeurs à ajoutées
 * @param {*} datas_types Types des valeurs à ajoutées
 */
function getFieldsSchema(datas_keys, datas_types) {
	var fields = {};
	for (var i = 0; i < datas_keys.length; i++) {
		if(datas_types[i] != Influx.FieldType.STRING) {
			fields[datas_keys[i]] = datas_types[i];
		}
	}
	return fields;
}

/**
 * Retourne les fields InfluxDB
 * @param {*} fields_schema Schéma de donnée des fields 
 * @param {*} item Données à ajouter à InfluxDB
 */
function getFields(fields_schema, item) {
	var values = {};
	for (var i = 0; i < Object.keys(fields_schema).length; i++) {
		var key = Object.keys(fields_schema)[i];
		values[key] = item[key];
	}
	return values;
}

/**
 * Retourne le timestamp des données
 * @param {*} field Type de la donnée ajoutée
 * @param {*} item Données
 */
function getItemTime(field, item) {
	if(item.time != undefined) {
		return new Date(item.time).getTime();
	} else if(item.date != undefined) {
		return new Date(item.date).getTime();
	/*} else if (field == 'Mood') {
		return new Date(item.date).getTime();*/
	} else if (field == 'Consuptionstatement') {
		return new Date(item.start).getTime();		
	} else {
		return Date.now();
	}
}

/**
 * Retourne un tableau sans doublons de array
 * @param {*} array 
 */
function cleanArray(array) {
  var i, j, len = array.length, out = [], obj = {};
  for (i = 0; i < len; i++) {
    obj[array[i]] = 0;
  }
  for (j in obj) {
    out.push(j);
  }
  return out;
}

function isInt(n){
    return Number(n) === n && n % 1 === 0;
}

function isFloat(n){
    return Number(n) === n && n % 1 !== 0;
}

function isBoolean(bool) {
    return typeof bool === 'boolean' ||  (typeof bool === 'object' && typeof bool.valueOf() === 'boolean');
}

function isEmpty(map) {
   for(var key in map) {
      return !map.hasOwnProperty(key);
   }
   return true;
}

function getMoodValue(status) {
	switch(status) {
		case 'bad' : return 1;
		case 'neutral': return 2;
		default: return 3;
	}
}