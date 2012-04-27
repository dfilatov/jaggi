var Q = require('q'),
    utils = require('./utils'),
    Ctx = require('./ctx'),
    State = require('./state'),
    runner = module.exports = function(ctx, blocks) {

        var res = {},
            startDefer = Q.defer(),
            blocksPromisesById = {};

        Object.keys(blocks).forEach(function(id) {
            var block = blocks[id];
            blocksPromisesById[id] = startDefer.promise
                .then(function() {
                    return Q.allResolved(
                            [startDefer].concat(
                                block.deps?
                                    block.deps.map(function(depId) {
                                        return blocksPromisesById[depId];
                                    }) :
                                    []
                                ))
                        .then(function() {
                            return runBlock(block, ctx);
                        });
                })
                .then(
                    function(blockRes) {
                        checkPredicate(block.after, [ctx, blockRes]) && (res[id] = blockRes);
                    },
                    function(blockError) {
                        res[id] = { error : blockError };
                    });
                });

        startDefer.resolve();

        return Q.allResolved(
            Object.keys(blocksPromisesById).map(function(id) {
                return blocksPromisesById[id];
            }))
            .then(function() {
                return res;
            });

    };

function runBlock(block, ctx) {

    var defer = Q.defer();

    if(!checkPredicate(block.before, [ctx])) {
        defer.resolve();
        return defer.promise;
    }

    var params = buildParams(block.params, ctx);

    if(typeof block.content === 'string') {
        require('./block/' + block.content)(defer, params);
    }
    else if(utils.isFunction(block.content)) {
        block.content(defer, params);
    }
    else if(typeof block.content === 'object') {
        runner(
            new Ctx(utils.merge(ctx.params(), { state : new State(params) })),
            block.content
        )
        .then(function(res) {
            defer.resolve(res);
        });
    }

    return defer.promise.timeout(block.timeout || 5000);

}

function buildParams(params, ctx) {

    if(!params) {
        return {};
    }

    if(utils.isFunction(params)) {
        return params(ctx);
    }

    return params;

}

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