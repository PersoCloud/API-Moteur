module.exports.info = function(message) {
    console.info(message);
}

module.exports.error = function(message) {
    console.error("[" + new Date().toISOString()+ "] " + message);
}

module.exports.clientError = function(message) {
    console.warn(message);
}

module.exports.sql = function(name, sql) {
    console.log("[" + new Date().toISOString()+ "] Requête SQL pour " + name + " :\n" + sql);
}

module.exports.cozyAddData = function(cozyid, field) {
    console.log("[" + new Date().toISOString()+ "] Cozy " + cozyid + " à ajouté une donnée " + field);
}
