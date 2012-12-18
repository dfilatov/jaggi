var utils = require('./utils'),
    MemoryCache = require('./cache/memory'),
    DEFAULT_DESC = {
        memory : function() {
            return new MemoryCache();
        }
    };

module.exports = require('inherit')({
    __constructor : function(desc) {
        this._desc = utils.merge(DEFAULT_DESC, desc);
        this._caches = {};
    },

    create : function(type) {
        type || (type = 'memory');
        return this._caches[type] || (this._caches[type] = this._desc[type]());
    }
});