var inherit = require('inherit'),
    DEFAULT_MAX_AGE = 60000,
    storage = {};

module.exports = inherit(require('../cache'), {
    get : function(params, promise) {
        if(storage.hasOwnProperty(params.key)) {
            var cached = storage[params.key];
            if(cached.ts + (params.maxAge || DEFAULT_MAX_AGE) >= Date.now()) {
                promise.fulfill(cached.val);
                return;
            }
            else {
                delete storage[params.key];
            }
        }
        promise.reject();
    },

    set : function(val, params, promise) {
        storage[params.key] = { ts : Date.now(), val : val };
        promise.fulfill();
    }
});