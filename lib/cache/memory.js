var inherit = require('inherit'),
    DEFAULT_MAX_AGE = 60000,
    storage = {};

module.exports = inherit(require('../cache'), {
    get : function(params, promise) {
        storage.hasOwnProperty(params.key)?
            promise.fulfill(storage[params.key]) :
            promise.reject();
    },

    set : function(val, params, promise) {
        storage[params.key] = val;
        setTimeout(
            function() {
                delete storage[params.key];
            },
            params.maxAge || DEFAULT_MAX_AGE);

        promise.fulfill();
    }
});