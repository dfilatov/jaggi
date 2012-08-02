var Q = require('q'),
    utils = require('./utils'),
    inherit = require('inherit'),
    Ctx = require('./ctx'),
    State = require('./state'),
    Block = require('./block');

module.exports = inherit({
    __constructor : function(blocks, ctx) {

        this._blocks = blocks;
        this._ctx = ctx;

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
                        res[blockId] = typeof blockError === 'string'?
                            { error : { message : blockError }} :
                            { error : blockError.toString() };
                    });
        });

        startDefer.resolve();

        return Q.allResolved(blockIds.map(getBlockPromise))
            .then(function() {
                return res;
            });
    },

    _runBlock : function(block) {

        if(!checkPredicate(block.before, [this._ctx])) {
            return;
        }

        var params = this._buildRunParams(block.params);

        if(typeof block.content === 'object') {
            return this._runSubRunner(block.content, params);
        }

        var res,
            runObj = typeof block.content === 'string'?
                new (require('./block/' + block.content)) :
                utils.isFunction(block.content)? block.content : null;

        var blockContentRes,
            defer;
        if(runObj) {
            runObj instanceof Block ||
                (runObj = {
                    run   : runObj,
                    abort : utils.noOp
                });

            blockContentRes = runObj.run(
                params,
                runObj.run.length > 1? defer = Q.defer() : undefined);
        }

        res = defer?
            defer.promise :
            this._runSubRunner(blockContentRes, params);

        var timeoutDefer = Q.defer(),
            timer = setTimeout(function() {
                runObj && runObj.abort();
                timeoutDefer.reject('timeout');
            }, block.timeout || 5000);

        res.then(
            function(blockRes) {
                clearTimeout(timer);
                timeoutDefer.resolve(blockRes);
            },
            timeoutDefer.reject);

        //return Q.timeout(res, block.timeout || 5000);
        return timeoutDefer.promise;
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