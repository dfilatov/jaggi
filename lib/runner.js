var path = require('path'),
    Q = require('q'),
    utils = require('./utils'),
    inherit = require('inherit'),
    State = require('./state'),
    Block = require('./block'),
    pointer = require('./pointer'),
    undefined;

module.exports = inherit({
    __constructor : function(blocks, ctx, params) {
        this._blocks = blocks;
        this._ctx = params.contextFactory(ctx);
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
                    if(block.error) { // error in preprocessing
                        throw { message : block.error };
                    }

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
                        t._emitBlockEvent(blockError);
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
                    typeof res[blockId] !== 'undefined' &&
                        (correctedRes[blockId] = res[blockId]);
                });
                return correctedRes;
            });
    },

    _preprocess : function() {
        var t = this,
            res = Array.isArray(t._blocks)? [] : {};

        Object.keys(t._blocks).forEach(function(blockId) {
            res[blockId] = t._processInclude(t._blocks[blockId]);
        });

        this._blocks = res;
    },

    _processInclude : function(block) {
        if(!block.include) {
            return block;
        }

        var fileName, includedBlock, depth = this._params.maxIncludeDepth;
        while(block.include) {
            if(!path.existsSync(fileName = path.normalize(path.join(this._params.root, block.include)))) {
                return { error : 'included file no exists: ' + fileName };
            }

            includedBlock = require(fileName);
            block = utils.merge(includedBlock, block);
            if(!includedBlock.include) {
                delete block.include;
            }

            if(!--depth) {
                return { error : 'includes depth (' + this._params.maxIncludeDepth + ') reached in file: ' + fileName };
            }
        }

        return block;
    },

    _runBlock : function(block) {
        var t = this;

        if(!t._checkBlockGuard(block.guard)) {
            return;
        }

        var blockParams = t._buildBlockParams(block.params),
            meta = {
                time   : Date.now(),
                params : blockParams
            },
            runObj, defer, promise;

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

        return Q.timeout(
            promise,
            meta.timeout = block.timeout || t._params.timeout)
                .then(
                    t._onBlockDone.bind(t, block),
                    t._onBlockFailed.bind(t, block, runObj))
                .then(t._onBlockFinalized.bind(t, block, meta));
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
            utils.merge(this._ctx.params(), { state : new State(params) }),
            this._params)
                .run();
    },

    _updateState : function(data, blockState) {
        if(!blockState) {
            return;
        }

        if(utils.isFunction(blockState)) {
            blockState = blockState(data, this._ctx);
        }

        var state = this._ctx.state();
        Object.keys(blockState).forEach(function(name) {
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

        if(utils.isFunction(hook)) {
            return hook(error, this._ctx) !== false;
        }

        return true;
    },

    _onBlockFinalized : function(block, meta, res) {
        this._processBlockFinHook(block.fin);

        meta.time = Date.now() - meta.time;
        this._emitBlockEvent(res, meta);

        return res;
    },

    _processBlockFinHook : function(hook) {
        utils.isFunction(hook) && hook();
    },

    _emitBlockEvent : function(blockRes, blockMeta) {
        var emitter = this._params.emitter;
        blockRes && blockRes.error?
            emitter.emit('block-failed', blockMeta || {}, blockRes) :
            emitter.emit('block-done', blockMeta);
    }
});

function isBlockPath(path) {
    return path.lastIndexOf('.js') === path.length - 3;
}
