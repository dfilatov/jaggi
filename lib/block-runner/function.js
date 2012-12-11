var inherit = require('inherit');

module.exports = inherit(require('../block-runner'), {
    _run : function(promise) {
        this._desc.call(this._blockParams, promise);
    }
});