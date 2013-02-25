var inherit = require('inherit'),
    path = require('path');

module.exports = inherit(require('../block-runner'), {
    __constructor : function() {
        this.__base.apply(this, arguments);
        this._block = null;
    },

    _run : function() {
        var clsPath = this._desc.call;

        this._block = new (require(isOuterBlock(clsPath)?
                path.join(this._params.root, clsPath) :
                path.join('..', 'block', clsPath)));

        this._block.run(this._blockParams, this._blockPromise);
    },

    _abort : function() {
        this._block.abort();
    }
});

function isOuterBlock(clsPath) {
    return path.extname(clsPath) === '.js';
}