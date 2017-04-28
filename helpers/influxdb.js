/***
 * Réorganise les résultats renvoyés par InfluxDB
 */
exports.toJsonFormat = function(data, meta, group, callback) {
	// Vérification si les données ou métadonnées sont vides
	if(data.results[0].series == undefined) {
		callback({});
		return;
	}
	var rawData = data.results[0].series;

	var rawMeta = undefined;
	if(meta.results[0].series != undefined && meta.results[0].series[0] != undefined) {
		rawMeta = meta.results[0].series[0];
	}

	var engineDataFiltered = [];	
	// On réassemble les clés (columns) et les valeurs retournées par influxdb pour les données
	rawData.forEach(function(serie) {		
		assembleKeyValue(serie.columns, serie.values, function(rtnData) {		
			if(serie.tags == undefined) { // Si on a pas spécifié de groupby
				engineDataFiltered.push(rtnData);
			} else if (group.by.length == 1) { // Si on a spécifié un groupby				
				var tagName = group.by[0];	
				rtnData[0][tagName] = serie.tags[tagName];
				engineDataFiltered.push(rtnData[0]);
			} else { // Si on a spécifié deux groupby	
				rtnData.forEach(function(element) {
					var tagName = group.by[0];	
					var tagValue = serie.tags[tagName];
					var i = 0;
					while(engineDataFiltered[i] != undefined && Object.keys(engineDataFiltered[i])[0] != tagValue && i < engineDataFiltered.length) {
						i++;
					}
					if(i == engineDataFiltered.length) { // L'élément n'existe pas encore
						engineDataFiltered.push({ [tagValue]: [element] });
					} else {
						engineDataFiltered[i][tagValue].push(element);
					}
				});
			}
		});				
	});
	
	// On enleve les structures de données en trop
	if(group.by == undefined || group.by[0].substr(0,5) == "time(") {
		engineDataFiltered = engineDataFiltered[0];
	} 
	else if (group.by.length == 2) {
		var engineDataFilteredGrouped = {};
		engineDataFiltered.forEach(function(element) {
			var key = Object.keys(element)[0];
			engineDataFilteredGrouped[key] = element[key];
		});
		engineDataFiltered = engineDataFilteredGrouped;
	}
	

	// On réassamble les clés et les valeurs retournées par influxdb pour les métadonées s'il y en a 
	if(rawMeta != undefined) {
		assembleKeyValue(rawMeta.columns, rawMeta.values, [ "time" ], function(rtnMeta) {				
			callback({ "data": engineDataFiltered, "meta": rtnMeta[0]});
		});	
	} else {
		callback({ "data": engineDataFiltered, "meta": {}});
	}   
};

/**
 * Réassemble les clés valeurs dans un seul et même objet
 * Supprime la clé "cozyid"
 * @param {*} keys 
 * @param {*} values 
 * @param {StringArray} excludes Exclure les key
 * @param {Callback} cb 
 */
function assembleKeyValue(keys, values, excludes, cb) {
	var rtn = [];
	values.forEach(function(element) {
		var result = {};
		for(var i=0; i < keys.length; i++) {
			if(keys[i] != "cozyid") {
				if(cb === undefined) { // Si on a pas spécifié "excludes"
					result[keys[i]] = element[i];
				} 
				else {
					if(excludes.indexOf(keys[i]) == -1) { // Si excludes ne contient pas keys[i]
						result[keys[i]] = element[i];
					}
				};
			}			
		}
		rtn.push(result);
	});
	if(cb === undefined) { excludes(rtn); }
	else { cb(rtn); }
}