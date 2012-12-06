var inherit = require('inherit');

module.exports = inherit(require('../block-runner'), {
    _run : function(defer) {
        this._desc.call(this._blockParams, defer);
    }
});