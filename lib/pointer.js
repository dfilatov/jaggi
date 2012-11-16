var jspath = require('jspath');

module.exports = function pointer(pointerObj, data) {
    if(typeof pointerObj === 'string') {
        return pointerObj? jspath.apply(pointerObj, data) : data;
    }

    if(Array.isArray(pointerObj)) {
        return pointerObj.map(function(item) {
            return pointer(item, data);
        });
    }

    if(typeof pointerObj === 'object') {
        var res = {};
        Object.keys(pointerObj).forEach(function(key) {
            res[key] = pointer(pointerObj[key], data);
        });
        return res;
    }

    return data;
};