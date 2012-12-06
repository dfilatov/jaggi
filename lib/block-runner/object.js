var inherit = require('inherit'),
    Q = require('q'),
    utils = require('../utils'),
    State = require('../state');

module.exports = inherit(require('../block-runner'), {
    __constructor : function() {
        this.__base.apply(this, arguments);
        this._subBlockDescs = this._desc.call;
        this._subBlockRunners = [];
    },

    _preprocess : function() {
        this.__base.apply(this, arguments);
        this._processSubBlockDescs();
    },

    _processSubBlockDescs : function() {
        utils.isFunction(this._subBlockDescs) &&
            (this._subBlockDescs = this._subBlockDescs(this._blockParams));
    },

    _run : function(defer) {
        var t = this,
            subBlocksDesc = t._subBlockDescs,
            isSubBlocksArray = Array.isArray(subBlocksDesc),
            subBlockIds = Object.keys(subBlocksDesc),
            subBlockPromises = {},
            getSubBlockPromise = function(id) {
                return subBlockPromises[id];
            },
            startDefer = Q.defer();

        t._blockRes = isSubBlocksArray? [] : {};

        subBlockIds.forEach(function(blockId) {
            var subBlockDesc = subBlocksDesc[blockId],
                subBlockRunner = t._createSubBlockRunner(subBlockDesc, blockId);

            t._subBlockRunners.push(subBlockRunner);

            subBlockPromises[blockId] = startDefer.promise
                .then(function() {
                    return subBlockDesc.deps?
                        Q.allResolved(
                                (Array.isArray(subBlockDesc.deps)? subBlockDesc.deps : [subBlockDesc.deps])
                                    .map(getSubBlockPromise))
                            .then(function() {
                                return subBlockRunner.run();
                            }) :
                        subBlockRunner.run();
                })
                .then(function(runnerRes) {
                    t._blockRes[blockId] = runnerRes;
                });
        });

        startDefer.resolve();

        Q.allResolved(subBlockIds.map(getSubBlockPromise))
            .then(function() {
                if(isSubBlocksArray) {
                    return t._blockRes;
                }

                var correctedRes = {};
                subBlockIds.forEach(function(blockId) {
                    typeof t._blockRes[blockId] !== 'undefined' &&
                        (correctedRes[blockId] = t._blockRes[blockId]);
                });
                defer.resolve(t._blockRes = correctedRes);
            });
    },

    _abort : function() {
        this._subBlockRunners.forEach(function(subBlockRunner) {
            subBlockRunner.abort();
        });
    },

    _createSubBlockRunner : function(desc, blockId) {
        return this.__self.create(
            desc,
            utils.merge(
                this._ctx.params(),
                { state : this._desc.proxyState? this._ctx.state() : new State(this._blockParams) }),
            utils.merge(
                this._params,
                { path : this._params.path + '.' + blockId }));
    }
});