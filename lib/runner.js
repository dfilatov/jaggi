var path = require('path'),
    Q = require('q'),
    utils = require('./utils'),
    inherit = require('inherit'),
    Ctx = require('./ctx'),
    State = require('./state'),
    Block = require('./block'),
    pointer = require('./pointer');

module.exports = inherit({
    __constructor : function(blocks, ctx, params) {
        this._blocks = blocks;
        this._ctx = ctx;
        this._params = params;
    },

    run : function() {
        this._preprocess();

        var t = this,
            blockIds = Object.keys(t._blocks),
            blocksPromises = {},
            startDefer = Q.defer(),
            isDescArray = Array.isArray(t._blocks),
            res = isDescArray? [] : {},
            getBlockPromise = function(blockId) {
                return blocksPromises[blockId];
            };

        blockIds.forEach(function(blockId) {
            var block = t._blocks[blockId];
            blocksPromises[blockId] = startDefer.promise
                .then(function() {
                    return block.deps?
                        Q.allResolved((Array.isArray(block.deps)? block.deps : [block.deps]).map(getBlockPromise))
                            .then(function() {
                                return t._runBlock(block);
                            }) :
                        t._runBlock(block);
                })
                .then(
                    function(blockRes) {
                        res[blockId] = blockRes;
                    },
                    function(blockError) {
                        res[blockId] = t._onBlockFailed(block, null, blockError);
                    });
        });

        startDefer.resolve();

        return Q.allResolved(blockIds.map(getBlockPromise))
            .then(function() {
                if(isDescArray) {
                    return res;
                }

                var correctedRes = {};
                blockIds.forEach(function(blockId) {
                    correctedRes[blockId] = res[blockId];
                });
                return correctedRes;
            });
    },

    _preprocess : function() {
        var t = this,
            res = Array.isArray(t._blocks)? [] : {};

        Object.keys(t._blocks).forEach(function(blockId) {
            var block = t._blocks[blockId];
            res[blockId] = block.include?
                utils.merge(require(path.join(t._params.root, block.include)), block) :
                block;
        });

        t._blocks = res;
    },

    _runBlock : function(block) {
        var t = this;

        if(!t._checkBlockGuard(block.guard)) {
            return;
        }

        var res = {},
            blockParams = t._buildBlockParams(block.params),
            runObj, defer, promise;

        t._params.meta && (res.meta =
            {
                time   : Date.now(),
                params : blockParams
            });

        if(typeof block.call === 'object') {
            promise = t._runSubRunner(block.call, blockParams);
        }
        else if(typeof block.call === 'string') {
            runObj = new (require(isBlockPath(block.call)?
                path.join(t._params.root, block.call) :
                './block/' + block.call));
        }
        else if(utils.isFunction(block.call)) {
            runObj = {
                run   : block.call,
                abort : utils.noOp
            };
        }

        if(runObj) {
            promise = (defer = runObj.run.length > 1? Q.defer() : undefined) && defer.promise;
            var blockContentRes = runObj.run(blockParams, defer);
            promise || (promise = t._runSubRunner(blockContentRes, blockParams));
        }

        var timeout = block.timeout || t._params.timeout;
        return Q.timeout(
            promise,
            timeout)
                .fin(function() {
                    var meta = res.meta;
                    if(meta) {
                        meta.time = Date.now() - meta.time;
                        meta.timeout = timeout;
                    }
                })
                .then(
                    t._onBlockDone.bind(t, block),
                    t._onBlockFailed.bind(t, block, runObj));
    },

    _buildBlockParams : function(blockParams) {
        if(!blockParams) {
            return {};
        }

        if(utils.isFunction(blockParams)) {
            return blockParams(this._ctx);
        }

        return blockParams;
    },

    _runSubRunner : function(blocks, params) {
        return new this.__self(
            blocks,
            new Ctx(utils.merge(this._ctx.params(), { state : new State(params) })),
            this._params)
                .run();
    },

    _updateState : function(data, blockState) {
        var state = this._ctx.state();
        blockState && Object.keys(blockState).forEach(function(name) {
            state.param(name, pointer(blockState[name], data));
        });
    },

    _applyPointer : function(pointerObj, data) {
        return this._params.pointer?
            pointer(pointerObj, data) :
            data;
    },

    _checkBlockGuard : function(guard) {
        var type = typeof guard;

        if(type === 'undefined' || type === 'boolean') {
            return guard !== false;
        }

        if(utils.isFunction(guard)) {
            return guard(this._ctx) !== false;
        }

        var state = this._ctx.state(),
            i = (Array.isArray(guard)? guard : (guard = [guard])).length,
            param;
        while(i--) {
            param = state.param(guard[i]);
            if(Array.isArray(param)? !param.length : !param) {
                return false;
            }
        }

        return true;
    },

    _onBlockDone : function(block, blockRes) {
        block.state && this._updateState(blockRes, block.state);

        var done = this._processBlockDoneHook(block.done, blockRes);
        if(typeof done === 'boolean') {
            return done?
                this._applyPointer(block.pointer, blockRes) :
                undefined;
        }

        return done.then(
            function(blockRes) {
                return blockRes;
            },
            this._onBlockFailed.bind(this, block, null));
    },

    _processBlockDoneHook : function(hook, res) {
        var type = typeof hook;
        if(type === 'undefined' || type === 'boolean') {
            return hook !== false;
        }

        if(utils.isFunction(hook)) {
            var defer,
                promise = (defer = hook.length > 2? Q.defer() : undefined) && defer.promise;

            if(hook(res, this._ctx, defer) === false) {
                return false;
            }

            return promise || true;
        }

        return true;
    },

    _onBlockFailed : function(block, runObj, blockError) {
        var error = {};

        if(typeof blockError === 'string') {
            error.message = blockError;
        }
        else if(blockError) {
            if(blockError.message && blockError.message.indexOf('Timed out') > -1) { // надо как-то получше отличать таймаут от реального режекта
                runObj && runObj.abort();
                error.message = blockError.message.toLowerCase();
            }
            else if(blockError instanceof Error) {
                error.message = blockError.message;
            }
            else {
                error = blockError;
            }
        }

        error.message || (error.message = 'unspecified error');
        return this._processBlockFailHook(block.fail, error)?
            { error : error } :
            undefined;
    },

    _processBlockFailHook : function(hook, error) {
        var type = typeof hook;
        if(type === 'undefined' || type === 'boolean') {
            return hook !== false;
        }

        if(type === 'boolean') {
            return hook;
        }

        if(utils.isFunction(hook)) {
            return hook(error, this._ctx) !== false;
        }

        return true;
    }
});

function isBlockPath(path) {
    return path.lastIndexOf('.js') === path.length - 3;
}