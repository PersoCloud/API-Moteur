var logger = require("../helpers/logger");
var Influx = require('influxdb-nodejs');

var hlp_date = require('../helpers/date');
var hlp_string = require('../helpers/string');
var hlp_influxdb = require('../helpers/influxdb');
var hlp_group = require('../helpers/group');

exports.analyze = function (req, res, next) {
	// Contrôles sur les données reçues
	if(req.query.cozyid == undefined) {
		logger.clientError('No cozy id specified');
		res.status(400).send('No cozy id specified');
        return;
	}

	if(req.query.field == undefined) {
		logger.clientError('No field specified');
		res.status(400).send('No field specified');
        return;
	}

	var metakey = "value";
	if(req.query.metakey != undefined) {
		metakey = req.query.metakey;
	}

    // Extraction de la période
    var period = hlp_date.extractPeriod(req.query.period);
    if (period == false) {
		logger.clientError('Invalid period');
        res.status(400).send('Invalid period');
        return;
    }

	var group = hlp_group.extractGroup(req.query.group, metakey);
    var field = hlp_string.capitalizeFirstLetter(req.query.field);
	var cozyid = req.query.cozyid;
    var clt_influx = new Influx('http://127.0.0.1:8086/'+ field +'_DB');

	createQuery(clt_influx, field, "*", group, period, function(queryUsers) { // On génère la requête SQL pour faire l'analyse sur l'ensemble des utilisateurs
		if (typeof queryUsers == "number") { // Erreur
			res.status(queryUsers).send({});
		} 
		else {
			logger.sql("engine.data", queryUsers);
			execute(clt_influx, field, queryUsers, "*", period, group, function(resultsUsers) { // On éxécute la requête
				if (typeof resultsUsers == "number") { // Erreur
					if(resultsUsers == 400) {
						res.status(resultsUsers).send('No data');
					} else {
						res.status(resultsUsers).send({});
					}
				}
				else {
					createQuery(clt_influx, field, cozyid, group, period, function(queryUser) { // On génère la requête SQL pour faire l'analyse sur le cozyid
						if (typeof queryUser == "number") { 
							if(queryUser == 404) { // Le cozyid n'existe pas dans la base de données
								res.status(200).send({cozy: {}, engine: resultsUsers});
							} else { // Erreur
								res.status(queryUser).send({});
							}
						} 
						else {
							logger.sql("cozy.data", queryUser);
							execute(clt_influx, field, queryUser, cozyid, period, group, function(resultsUser) { // On éxécute la requête
								if (typeof resultsUser == "number") { // Erreur
									res.status(resultsUser).send({});
								}
								else {
									res.status(200).send({cozy: resultsUser, engine: resultsUsers});
								}
							});
						}
					});
				}
			});
		}
	});
}

/**
 * Exécute une requête
 * @param {String} whereCozyId Tout les utilisateur (*) ou un identifiant cozy 
 * @param {callback} cb Callback
 */
function execute(clt_influx, field, query, whereCozyId, period, group, cb) {
	clt_influx.queryRaw(query) // Exécution de la requête
		.then(engineData => {	
			if(engineData.results[0].error != undefined) {
				logger.error(engineData.results[0].error);
				cb(400);
			}
			else {
				// Recherche pour obtenir les métadonnées
				var influxdb_client_query_meta = clt_influx.query(field);
				if (period != undefined) {
					influxdb_client_query_meta.condition('time', period.start, '>=')
						.condition('time', period.end, '<');
				}
				if(whereCozyId != "*") {
					influxdb_client_query_meta.condition("cozyid", whereCozyId, '=');
				}				

				var query_meta = setAggregates(group.key, influxdb_client_query_meta);
				if(whereCozyId != "*") { 
					logger.sql("cozy.meta", query_meta);
				} else {
					logger.sql("engine.meta", query_meta);
				}
				query_meta.then(engineMeta => {
					// Formatage des données
					hlp_influxdb.toJsonFormat(engineData, engineMeta, group, function(engineResults) { 
						cb(engineResults); 
					}) 
				})
				.catch(err => {
					logger.error("Erreur lors de l'exécution de la requête SQL sur les métadonnées pour le cozy " + whereCozyId + " : " + err);
					cb(500);
				});
			}								
		})
		.catch(err => {
			logger.error("Erreur lors de l'exécution de la requête SQL : " + err);
			cb(404);
		});
}

/**
 * Ajoute les functions Influxdb à la requête pour récupérer les aggrégats.
 * @param {*} groupKey Champs sur lequel on regroupe les résultats
 * @param {*} query Si query est vide, retourne une chaine de caractère utilisable dans une requête. 
 * 					Si query est un objet Influx, retourne l'objet avec les fonctions d'aggrégats.
 */
function setAggregates(groupKey, query) {
	if(query == undefined) {
		return "count("+groupKey+"), min("+groupKey+"), max("+groupKey+"), mean("+groupKey+"), median("+groupKey+"), sum("+groupKey+"), stddev("+groupKey+"), first("+groupKey+"), last("+groupKey+")"
	}
	return query.addFunction('count', groupKey)
		.addFunction('min', groupKey)
		.addFunction('max', groupKey)
		.addFunction('mean', groupKey)
		.addFunction('median', groupKey)
		.addFunction('sum', groupKey)
		.addFunction('stddev', groupKey)
		.addFunction('first', groupKey)
		.addFunction('last', groupKey);
}

/**
 * Créer une requête SQL
 * @param {*} cozyid Pour tout utilisateur (*) ou un identifiant cozy
 * @param {*} cb 
 */
function createQuery(clt_influx, field, cozyid, group, period, cb) {
	if (group.by != undefined) { 
		var groupby = "";
		group.by.forEach(function(groupByItem) {
			if(groupby !== "") {
				groupby += ", ";
			}
			groupby += groupByItem;
		})

		if (period != undefined) {
			if(cozyid == "*") {
				cb("SELECT " + setAggregates(group.key) + " FROM " + field + " WHERE time >= '"+  period.start + "' and time < '" + period.end + "' GROUP BY " + groupby);
			} else {
				cb("SELECT " + setAggregates(group.key) + " FROM " + field + " WHERE cozyid = '" + cozyid + "' and time >= '"+  period.start + "' and time < '" + period.end + "' GROUP BY " + groupby);
			}
		}
		else { // Si aucune période n'a été définie, on regroupe sur l'ensemble des données
			createQuery_GroupByAllTime(clt_influx, field, cozyid, group, groupby, function(query) {
				cb(query);
			});
		}
	}
	else {
		var query = "SELECT * FROM " + field;
		if (period != undefined) {
			if(cozyid == "*") {
				query += " WHERE time >= '"+  period.start + "' and time < '" + period.end + "'";
			}
			else {
				query += " WHERE cozyid = '" + cozyid + "' and time >= '"+  period.start + "' and time < '" + period.end + "'";
			}
		}
		else {
			if(cozyid != "*") {
				query += " WHERE cozyid = '" + cozyid + "'";
			}
		}
		cb(query);
	}	
}

/**
 * Traitement si on regroupe sans avoir préciser de période
 */
function createQuery_GroupByAllTime(clt_influx, field, cozyid, group, groupby, cb) {
	var queryOldestMesurement = "SELECT * FROM " + field;
	var queryNewestMesurement = "SELECT * FROM " + field;
	if(cozyid != "*") {
		queryOldestMesurement += " WHERE cozyid = '" + cozyid + "'";
		queryNewestMesurement += " WHERE cozyid = '" + cozyid + "'";
	}
	queryOldestMesurement += " ORDER BY time LIMIT 1";
	queryNewestMesurement += " ORDER BY time DESC LIMIT 1"

	// On va rechercher le plus ancien et le plus recent enregistrement afin d'obtenir une période de temps nécéssaire pour la requête Influxdb
	clt_influx.queryRaw(queryOldestMesurement)
		.then(oldestMeasurement => {
			if(oldestMeasurement.results[0].series == undefined) { // cozyid ne correspond à aucune entrée dans la base
				cb(404);
			}
			else {
				clt_influx.queryRaw(queryNewestMesurement)
					.then(newestMeasurement => {
						var minTime = oldestMeasurement.results[0].series[0].values[0][0];	
						var maxTime = newestMeasurement.results[0].series[0].values[0][0];	
						if(cozyid != "*") {
							cb("SELECT " + setAggregates(group.key) + " FROM " + field + " WHERE cozyid = '" + cozyid + "' and time >= '" + minTime + "' and time <= '"+maxTime+"' GROUP BY " + groupby);
						} else {							
							cb("SELECT " + setAggregates(group.key) + " FROM " + field + " WHERE time >= '" + minTime + "' and time <= '"+maxTime+"' GROUP BY " + groupby);
						}
					}).catch(err => {
						logger.error(err);
						cb(500);
					});
				}
		})
		.catch(err => {
			logger.error(err);
			cb(500);
		});
};