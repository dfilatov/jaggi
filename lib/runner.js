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
                        res[blockId] = blockError.error?
                            blockError :
                            { error : { message : blockError.message }};
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
            res[blockId] = typeof block === 'string'?
                require(path.join(t._params.root, block)) :
                block;
        });

        t._blocks = res;
    },

    _runBlock : function(block) {
        var t = this;

        if(!t._checkGuard(block.guard) || !t._beforeBlock(block.before)) {
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

        if(typeof block.content === 'object') {
            promise = t._runSubRunner(block.content, blockParams);
        }
        else if(typeof block.content === 'string') {
            runObj = new (require(isBlockPath(block.content)?
                path.join(t._params.root, block.content) :
                './block/' + block.content));
        }
        else if(utils.isFunction(block.content)) {
            runObj = {
                run   : block.content,
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
                    function(blockRes) {
                        block.state && t._updateState(blockRes, block.state);

                        var afterRes = t._afterBlock(block.after, blockRes);
                        if(typeof afterRes === 'boolean') {
                            if(afterRes) {
                                res.result = t._applyPointer(block.pointer, blockRes);
                                return res;
                            }

                            return;
                        }

                        if(Q.isPromise(afterRes)) {
                            return afterRes.then(
                                function(blockRes) {
                                    res.result = blockRes;
                                    return res;
                                },
                                function(blockError) {
                                    res.error = typeof blockError === 'string'?
                                        { message : blockError } :
                                        (blockError || { message : 'unspecified error' });
                                    return res;
                                });
                        }

                        res.result = blockRes;
                        return res;
                    },
                    function(blockError) {
                        res.error = {};

                        if(typeof blockError === 'string') {
                            res.error.message = blockError;
                        }
                        else if(blockError) {
                            if(blockError.message && blockError.message.indexOf('Timed out') > -1) { // надо как-то получше отличать таймаут от реального режекта
                                runObj && runObj.abort();
                                res.error.message = blockError.message.toLowerCase();
                            }
                            else {
                                res.error = blockError;
                            }
                        }

                        res.error.message || (res.error.message = 'unspecified error');
                        return res;
                    });
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

    _checkGuard : function(guard) {
        if(!guard) {
            return true;
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

    _beforeBlock : function(before) {
        if(typeof before === 'boolean') {
            return before;
        }

        return !(utils.isFunction(before) && before(this._ctx) === false);
    },

    _afterBlock : function(after, res) {
        if(typeof after === 'boolean') {
            return after;
        }

        if(utils.isFunction(after)) {
            var defer,
                promise = (defer = after.length > 2? Q.defer() : undefined) && defer.promise;

            if(after(this._ctx, res, defer) === false) {
                return false;
            }

            return promise;
        }

        return true;
    }
});

function isBlockPath(path) {
    return path.lastIndexOf('.js') === path.length - 3;
}