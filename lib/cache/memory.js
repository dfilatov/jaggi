var inherit = require('inherit'),
    DEFAULT_MAX_AGE = 60000,
    storage = {};

module.exports = inherit(require('../cache'), {
    get : function(params) {
        if(storage.hasOwnProperty(params.key)) {
            var cached = storage[params.key];
            if(cached.ts + (params.maxAge || DEFAULT_MAX_AGE) >= Date.now()) {
                return cached.val;
            }
            else {
                delete storage[params.key];
            }
        }
    },

    set : function(val, params) {
        storage[params.key] = { ts : Date.now(), val : val };
    }
});