var inherit = require('inherit'),
    Vow = require('vow'),
    utils = require('../utils'),
    State = require('../state');

module.exports = inherit(require('../block-runner'), {
    __constructor : function() {
        this.__base.apply(this, arguments);

        this._subBlocksDesc = this._desc.call;
        this._subBlockPromises = {};
        this._subBlockRunners = [];
    },

    _preprocess : function() {
        this._processSubBlockDescs();
    },

    _processSubBlockDescs : function() {
        utils.isFunction(this._subBlocksDesc) &&
            (this._subBlocksDesc = this._subBlocksDesc(this._blockParams));
    },

    _run : function() {
        var _this = this;

        _this._blockRes = Array.isArray(_this._subBlocksDesc)? [] : {};

        Vow.allResolved(
                Object.keys(_this._subBlocksDesc).map(function(blockId) {
                    return _this._getSubBlockPromise(blockId).then(function(blockRes) {
                        _this._blockRes[blockId] = blockRes;
                })}))
            .then(function() {
                _this._normalizeBlockRes();
                _this._blockPromise.fulfill(_this._blockRes);
            });
    },

    _abort : function() {
        this._subBlockRunners.forEach(function(subBlockRunner) {
            subBlockRunner.abort();
        });
    },

    _getSubBlockPromise : function(blockId) {
        if(this._subBlockPromises[blockId]) {
            return this._subBlockPromises[blockId];
        }

        var subBlockDesc = this._subBlocksDesc[blockId];
        if(!subBlockDesc) {
            return;
        }

        var subBlockRunner = this._createSubBlockRunner(blockId),
            subBlockDeps = subBlockDesc.deps,
            res;

        this._subBlockRunners.push(subBlockRunner);

        if(!subBlockDeps) {
            res = subBlockRunner.run();
        }
        else {
            var subBlockRunnerFn = function() {
                    if(!this._isAborted) {
                        return subBlockRunner.run();
                    }
                }.bind(this);

            res = Array.isArray(subBlockDeps)?
                Promise.allResolved(subBlockDeps.map(this._getSubBlockPromise, this))
                    .then(subBlockRunnerFn) :
                this._getSubBlockPromise(subBlockDeps)
                    .then(subBlockRunnerFn);
        }

        return this._subBlockPromises[blockId] = res;
    },

    _createSubBlockRunner : function(blockId) {
        var path = this._params.path + (this._params.path === '.'? '' : '.') + blockId;

        return this.__self.create(
            this._subBlocksDesc[blockId],
            utils.merge(
                this._ctx.params(),
                { state : this._desc.proxyState? this._ctx.state() : new State(this._blockParams) }),
            utils.merge(
                this._params,
                { path : path }));
    },

    _normalizeBlockRes : function() {
        var subBlocksDesc = this._subBlocksDesc;
        if(Array.isArray(subBlocksDesc)) {
            return;
        }

        var subBlockIds = Object.keys(subBlocksDesc),
            normalizedRes = {};

        subBlockIds.forEach(function(blockId) {
            typeof this._blockRes[blockId] !== 'undefined' &&
                (normalizedRes[blockId] = this._blockRes[blockId]);
        }, this);

        this._blockRes = normalizedRes;
    }
});