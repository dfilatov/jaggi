var inherit = require('inherit');

module.exports = inherit(require('../block-runner'), {
    _run : function() {
        this._desc.call(this._blockParams, this._blockPromise);
    }
});