var Q = require('q'),
    utils = require('./utils'),
    Ctx = require('./ctx'),
    State = require('./state'),
    runner = module.exports = function(ctx, blocks) {

        var res = [],
            blockPromisesById = {};

        return Q.allResolved(blocks.map(function(block, i) {
            var blockPromise = buildBlockPromise(
                    block,
                    buildDependPromise(block.depend, blockPromisesById),
                    ctx);

            block.id && (blockPromisesById[block.id] = blockPromise);

            blockPromise.then(
                function(blockRes) {
                    checkPredicate(block.after, [ctx, blockRes]) && (res[i] = blockRes);
                },
                function(error) {
                    res[i] = { error : error };
                });

            return blockPromise;
        })).then(function() {
            return res;
        });

    };

function buildBlockPromise(block, dependPromise, ctx) {

    return Q.when(dependPromise, function() {
        return runBlock(block, ctx);
    });

}

function buildDependPromise(dependIds, blockPromisesById) {

    return dependIds &&
        Q.allResolved(dependIds.map(function(blockId) {
            return blockPromisesById[blockId];
        }));

}

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
    else if(Array.isArray(block.content)) {
        runner(
            new Ctx(utils.merge(ctx.params(), { state : new State(params) })),
            block.content
        )
        .then(function(res) {
            defer.resolve(res);
        });
    }
    else if(utils.isFunction(block.content)) {
        block.content(defer, params);
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