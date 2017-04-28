/**
 * Créer un objet group à partir d'une chaîne de caractère { by: ..., key: ... }
 * By est utilisé pour GROUP BY ...
 * Key est utilisé pour SELECT count(...), mean(...), ...
 */
exports.extractGroup = function(groupString, metakey) {
    if(groupString != undefined && groupString.length > 0) {
        var values = groupString.split(";");
        if(values != undefined && values.length == 2) {
            var groupbyValues = values[0].split(",");
            if(groupbyValues != undefined && groupbyValues.length > 1) {
                return {
                    by: groupbyValues,
                    key: values[1]
                };
            }
            else {
                return {
                    by: [values[0]],
                    key: values[1]
                };
            }
        }
        else {
            var groupbyValues = groupString.split(",");
            if(groupbyValues != undefined && groupbyValues.length > 1) {
                return {
                    by: groupbyValues,
                    key: metakey
                };
            }
            else {
                return {
                    by: [groupString],
                    key: metakey
                };
            }            
        }
    }
    return {
        by: undefined,
        key: metakey
    };
};