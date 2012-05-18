var Q = require('q'),
    utils = require('./utils'),
    inherit = require('inherit'),
    Ctx = require('./ctx'),
    State = require('./state');

module.exports = inherit({

    __constructor : function(blocks, ctx) {

        this._blocks = blocks;
        this._ctx = ctx;

    },

    run : function() {

        var t = this,
            blocksPromises = {},
            startDefer = Q.defer(),
            res = {};

        Object.keys(t._blocks).forEach(function(id) {
            var block = t._blocks[id];
            blocksPromises[id] = startDefer.promise
                .then(function() {
                    return block.deps?
                        Q.allResolved(
                            block.deps.map(function(depId) {
                                return blocksPromises[depId];
                            }))
                            .then(function() {
                                return t._runBlock(block);
                            }) :
                        t._runBlock(block);
                })
                .then(
                    function(blockRes) {
                        checkPredicate(block.after, [t._ctx, blockRes]) && (res[id] = blockRes);
                    },
                    function(blockError) {
                        res[id] = { error : blockError.message || blockError };
                    });
                });

        startDefer.resolve();

        return Q.allResolved(
                Object.keys(blocksPromises).map(function(id) {
                    return blocksPromises[id];
                }))
            .then(function() {
                return res;
            });

    },

    _runBlock : function(block) {

        if(!checkPredicate(block.before, [this._ctx])) {
            return;
        }

        var res,
            params = this._buildRunParams(block.params);

        if(typeof block.content === 'object') {
            res = this._runSubRunner(block.content, params);
        }
        else {
            var defer = Q.defer(),
                blockContentRes;

            if(typeof block.content === 'string') {
                blockContentRes = require('./block/' + block.content)(defer, params);
            }
            else if(utils.isFunction(block.content)) {
                blockContentRes = block.content(defer, params);
            }

            res = typeof blockContentRes === 'object'?
                this._runSubRunner(blockContentRes, params) :
                defer.promise;
        }

        return Q.timeout(res, block.timeout || 5000);

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
            new Ctx(utils.merge(this._ctx.params(), { state : new State(params) })))
                .run();

    }

});

function checkPredicate(predicate, params) {

    var type = typeof predicate;

    if(type === 'undefined') {
        return true;
    }

    if(type === 'boolean') {
        return predicate;
    }

    return predicate.apply(null, params) !== false;

}