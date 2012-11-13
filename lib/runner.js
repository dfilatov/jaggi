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
            blockIds = Object.keys(t._blocks),
            blocksPromises = {},
            startDefer = Q.defer(),
            res = {},
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
                        res[blockId] = {
                            error : typeof blockError === 'string'?
                                { message : blockError } :
                                blockError.toString()
                        };
                    });
        });

        startDefer.resolve();

        return Q.allResolved(blockIds.map(getBlockPromise))
            .then(function() {
                return res;
            });
    },

    _runBlock : function(block) {
        var startTime = Date.now(),
            _this = this;

        if(!checkPredicate(block.before, [_this._ctx])) {
            return;
        }

        if(typeof block.content === 'string' && isBlockPath(block.content)) {
            block = require(path.join(_this._params.root, block.content));
        }

        var params = _this._buildRunParams(block.params),
            promise;

        if(typeof block.content === 'object') {
            promise = _this._runSubRunner(block.content, params);
        }
        else {
            var runObj = typeof block.content === 'string'?
                    new (require('./block/' + block.content)) :
                    utils.isFunction(block.content)? block.content : null,
                blockContentRes;

            if(runObj) {
                runObj instanceof Block ||
                    (runObj = {
                        run   : runObj,
                        abort : utils.noOp
                    });

                var defer = runObj.run.length > 1? Q.defer() : undefined;
                promise = defer.promise;

                blockContentRes = runObj.run(
                    params,
                    defer);
            }
        }

        return Q.timeout(promise || _this._runSubRunner(blockContentRes, params), block.timeout || 5000).then(
            function(blockRes) {
                var res = { result : blockRes };

                _this._params.meta &&
                    (res.meta = {
                        time   : Date.now() - startTime,
                        params : params
                    });

                return res;
            },
            function() {
                runObj && runObj.abort();
                throw 'timeout';
            });
    },

    _buildRunParams : function(blockParams) {
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