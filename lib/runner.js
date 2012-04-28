var Q = require('q'),
    utils = require('./utils'),
    inherit = require('inherit'),
    Ctx = require('./ctx'),
    State = require('./state'),
    Runner = module.exports = inherit({

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
                            res[id] = { error : blockError };
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

            var defer = Q.defer();

            var params = this._buildRunParams(block.params);
            if(typeof block.content === 'string') {
                require('./block/' + block.content)(defer, params);
            }
            else if(utils.isFunction(block.content)) {
                block.content(defer, params);
            }
            else if(typeof block.content === 'object') {
                new Runner(block.content, new Ctx(utils.merge(this._ctx.params(), { state : new State(params) })))
                    .run()
                    .then(function(res) {
                        defer.resolve(res);
                    });
            }

            return defer.promise;

        },

        _buildRunParams : function(blockParams) {

            if(!blockParams) {
                return {};
            }

            if(utils.isFunction(blockParams)) {
                return blockParams(this._ctx);
            }

            return blockParams;

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