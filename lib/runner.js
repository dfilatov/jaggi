var path = require('path'),
    Q = require('q'),
    utils = require('./utils'),
    inherit = require('inherit'),
    Ctx = require('./ctx'),
    State = require('./state'),
    Block = require('./block');

module.exports = inherit({
    __constructor : function(blocks, ctx, params) {
        this._blocks = blocks;
        this._ctx = ctx;
        this._params = params;
    },

    run : function() {
        var t = this,
            isDescArray = Array.isArray(t._blocks),
            blockIds = isDescArray?
                t._blocks.map(function(_, i) {
                    return i;
                }) :
                Object.keys(t._blocks),
            blocksPromises = {},
            startDefer = Q.defer(),
            res = isDescArray? [] : {},
            getBlockPromise = function(blockId) {
                return blocksPromises[blockId];
            };

        blockIds.forEach(function(blockId) {
            var block = t._blocks[blockId];
            blocksPromises[blockId] = startDefer.promise
                .then(function() {
                    return block.deps?
                        Q.allResolved(block.deps.map(getBlockPromise))
                            .then(function() {
                                return t._runBlock(block);
                            }) :
                        t._runBlock(block);
                })
                .then(
                    function(blockRes) {
                        checkPredicate(block.after, [t._ctx, blockRes]) && (res[blockId] = blockRes);
                    },
                    function(blockError) {
                        res[blockId] = blockError;
                    });
        });

        startDefer.resolve();

        return Q.allResolved(blockIds.map(getBlockPromise))
            .then(function() {
                return res;
            });
    },

    _runBlock : function(block) {
        var _this = this;

        if(typeof block === 'string') {
            block = require(path.join(_this._params.root, block));
        }

        var meta = { time : Date.now() };

        if(!checkPredicate(block.before, [_this._ctx])) {
            return;
        }

        var blockParams = _this._buildBlockParams(block.params),
            runObj, defer, promise;

        if(typeof block === 'string') {
            block = require(path.join(_this._params.root, block.content));
            console.log(block);
        }

        if(typeof block.content === 'object') {
            promise = _this._runSubRunner(block.content, blockParams);
        }
        else if(typeof block.content === 'string') {
            runObj = new (require(isBlockPath(block.content)?
                path.join(_this._params.root, block.content) :
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
            promise || (promise = _this._runSubRunner(blockContentRes, blockParams));
        }

        meta.params = blockParams;

        return Q.timeout(
            promise,
            meta.timeout = block.timeout || _this._params.timeout)
                .fin(function() {
                    meta.time = Date.now() - meta.time;
                })
                .then(
                    function(blockRes) {
                        var res = { result : blockRes };
                        _this._params.meta && (res.meta = meta);

                        return res;
                    },
                    function(blockError) {
                        var res = { error : {}};

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

                        res.error.message || (res.error.message = 'undefined error');

                        _this._params.meta && (res.meta = meta);

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
    }
});

function isBlockPath(path) {
    return path.lastIndexOf('.js') === path.length - 3;
}

function checkPredicate(predicate, params) {
    switch(typeof predicate) {
        case 'undefined':
            return true;

        case 'boolean':
            return predicate;

        default:
            return predicate.apply(null, params) !== false;
    }
}