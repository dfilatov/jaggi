var inherit = require('inherit'),
    path = require('path');

module.exports = inherit(require('../block-runner'), {
    __constructor : function() {
        this.__base.apply(this, arguments);
        this._block = null;
    },

    _run : function(defer) {
        var clsPath = this._desc.call;

        this._block = new (require(isOuterBlock(clsPath)?
                path.join(this._params.root, clsPath) :
                '../block/' + clsPath));

        this._block.run(this._blockParams, defer);
    },

    _abort : function() {
        this._block.abort();
    }
});

function isOuterBlock(clsPath) {
    return clsPath.lastIndexOf('.js') === clsPath.length - 3;
}