var request = require('request');
var sleep = require('system-sleep');
var hlp_random = require('./hlp_random');

const NB_COZY = 25;

for(var i = 0; i < NB_COZY; i++) {		
	var cozyid = hlp_random.string(8);
	console.log('Insertion de données dans le moteur pour le cozy ' + (i+1) + '/' + NB_COZY + ' : ' + cozyid);
	
	httpPost(generate("bill", cozyid), function (err, response, body){
		if (err) { 
			console.log("L'API moteur n'est pas démarrée");
			process.exit();
		}		
		httpPost(generate("mood", cozyid), function (err, response, body){
			if (err) { 
				console.log(err);			
			}
		});
		httpPost(generate("consuptionstatement", cozyid), function (err, response, body){
			if (err) { 
				console.log(err);			
			}
		});
	});
	sleep(750); // Pause pour éviter une surchage sur serveur
}


/**
 * Envoi des données au moteur
 */
function httpPost(data, callback) {
  request({
        method: 'POST',
        uri: 'http://localhost:8081/cozydata/force',
        json: data
    }, function(err, res, body) {
        callback(err, res, body);
    }
  );
}


/**
 * Retourne une données de type spécifié
 * @param {*} type 
 */
function generate(type, cozyid) { 
    var generatedData;
    switch (type) {
        case 'bill': generatedData = generateBills(); break; 
        case 'mood': generatedData = generateMoods(); break; 
        case 'consuptionstatement': generatedData = generateConsuptionstatement(); break;   
        default: return generatedData = undefined; break;
    }
	
    var data = {
        cozyid: cozyid,
        field: type,
        data: generatedData
    };
    return data;
}

/// Générateurs de données 
/**
 * Basé sur le modèle facture de My Accounts
 */
function generateBills() { 
    var bills = [];  		
    var nbDonnee = hlp_random.int(0, 100);

    var types = { 
        "Orange" : "phone", 
        "Materiel.net" : "NA",
        "Sfr mobile" : "Mobile",
        "Sosh" : "phone",
        "Free" : "",
        "Free Mobile" : "phone",
        "Bouygues Box" : "",
        "Darty" : "shop",
        "Ameli" : "health",
        "APRR" : "Peage",
        "Github": "",
        "Numericable" : "",
        "vente-privee.com" : "shop",
        "Virgin mobile" : "",
        "VOYAGES SNCF" : "transport"
    };

    for (var k=0; k<nbDonnee; k++) {			
        var vendor = Object.keys(types)[hlp_random.int(0, Object.keys(types).length)];
        var bill = {};
        bill.vendor = vendor;
        bill.type = types[vendor],					
        bill.amount = hlp_random.float(1, 301, 2);
        bill.time = hlp_random.timestamp(1451602800000);
        bills.push(bill);
    } 
    return bills;
}

/**
 * Basé sur Mood (Kyou)
 */
function generateMoods() { 
    var moods = [];  
    var nbDonnee = hlp_random.int(0, 100);
    var types = ["bad", "neutral", "good"];

    for (var k=0; k<nbDonnee; k++) {			
        var mood = {};
        mood.status = types[hlp_random.int(0, types.length)];
        mood.date = hlp_random.timestamp(1451602800000).toISOString().substring(0, 10) + "T00:00:00.000Z",					
        moods.push(mood);
    } 
    return moods;
}

/**
 * Basé sur Consumptionstatement (Rélévé de compteur du konnector EDF)
 */
function generateConsuptionstatement() { 
    var consumptions = [];  
    var nbDonnee = hlp_random.int(0, 50);

    function randomStatement() {
        var statement = {};
        switch (hlp_random.int(0, 5)) {
            case 0: 
                statement.type = "ESTIME"; 
                statement.category = "ESTIMATION_AUTO";
                statement.reason = "RELEVE_PERIODIQUE";
            break;
            default: 
                statement.type = "REEL";
                switch (hlp_random.int(0, 9)) {
                    case 0: case 1: case 2: 
                        statement.category = "RELEVE_CONFIANCE_ELEC";
                        statement.reason = "RELEVE_PERIODIQUE";
                    break;
                    case 3: 
                        statement.category = "RELEVE_REEL_Z1_POUR_FACTURATION_COMMUNE";
                        statement.reason = "RELEVE_INTERMEDIAIRE_CALC_FACT";
                    break;
                    default:
                        statement.category = "RELEVE_REEL_PAR_ERD_GRD";
                        switch (hlp_random.int(0, 2)) {
                            case 0: statement.reason = "RELEVE_INTERMEDIAIRE"; break;
                            default: statement.reason = "RELEVE_PERIODIQUE"; break;
                        }
                    break;
                }
            break;
        }
        return statement;
    }

    for (var k=0; k<nbDonnee; k++) {
        var period = hlp_random.timestamp(1451602800000);		
        var statement = randomStatement();	
        var consumption = {};
        consumption.start = period.toISOString().substring(0, 10);
        period.setMonth(period.getMonth()+1);
        consumption.end = period.toISOString().substring(0, 10);	
        consumption.value = hlp_random.int(30, 500);
        consumption.statementType = statement.type;
        consumption.statementCategory = statement.category;
        consumption.statementReason = statement.reason;
        consumptions.push(consumption);
    } 
    return consumptions;
}