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
            blocksPromises = {},
            startDefer = Q.defer(),
            res = {},
            getBlockPromise = function(id) {
                return blocksPromises[id];
            };

        Object.keys(t._blocks).forEach(function(id) {
            var block = t._blocks[id];
            blocksPromises[id] = startDefer.promise
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
                        checkPredicate(block.after, [t._ctx, blockRes]) && (res[id] = blockRes);
                    },
                    function(blockError) {
                        res[id] = typeof blockError === 'string'?
                            { error : { message : blockError }} :
                            { error : blockError.toString() };
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
            var runObj;
            if(typeof block.content === 'string') {
                runObj = new (require('./block/' + block.content));
            }
            else if(utils.isFunction(block.content)) {
                runObj = block.content;
            }

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
        }

        var timeoutDefer = Q.defer(),
            timer = setTimeout(function() {
                runObj.abort();
                timeoutDefer.reject('timeout');
            }, block.timeout || 5000);

        res.then(
            function(blockRes) {
                clearTimeout(timer);
                timeoutDefer.resolve(blockRes);
            },
            timeoutDefer.reject);

        return timeoutDefer.promise;

        //return Q.timeout(res, block.timeout || 5000);

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