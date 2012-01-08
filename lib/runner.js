var Q = require('qq'),
    Ctx = require('./ctx'),
    runner = module.exports = function(defer, params, req, blocks) {

        var res = [],
            counter = blocks.length,
            blockDefersById = {},
            ctx = new Ctx(params, req);

        blocks.forEach(function(block, i) {
            var blockDefer = buildBlockDefer(block, blockDefersById, ctx);

            block.id && (blockDefersById[block.id] = blockDefer);

            Q.when(
                blockDefer.promise,
                function(blockRes) {
                    checkPredicate(block.after, [ctx, blockRes]) && (res[i] = blockRes);
                    --counter || defer.resolve(res);
                },
                function(error) {
                    res[i] = { error : error };
                    --counter || defer.resolve(res);
                });
        });

    };

function buildBlockDefer(block, blockDefersById, ctx) {

    var res = Q.defer();

    Q.when(buildDependDefer(block, blockDefersById).promise, function() {
        runBlock(block, res, ctx);
    });

    return res;

}

function buildDependDefer(block, blockDefersById) {

    var res = Q.defer(),
        depends = block.depend;

    if(depends) {
        var counter = depends.length;
        depends.forEach(function(blockId) {
            var defer = blockDefersById[blockId];
            Q.when(
                defer && defer.promise,
                function() {
                    --counter || res.resolve();
                },
                function() {
                    --counter || res.resolve();
                });
        });
    }
    else {
        res.resolve();
    }

    return res;

}

function runBlock(block, defer, ctx) {

    if(!checkPredicate(block.before, [ctx])) {
        defer.resolve();
        return;
    }

    var params = buildParams(block.params, ctx);

    if(typeof block.content === 'string') {
        require('./block/' + block.content)(defer, params);
    }
    else if(Array.isArray(block.content)) {
        runner(defer, params, ctx.req(), block.content);
    }
    else if(isFunction(block.content)) {
        block.content(defer, params);
    }

    var timer = setTimeout(
            function() {
                defer.reject('timeout');
            },
            block.timeout || 5000);
    Q.when(
        defer.promise,
        function() {
           clearTimeout(timer);
        },
        function() {
           clearTimeout(timer);
        });

}

function buildParams(params, ctx) {

    if(!params) {
        return {};
    }

    if(isFunction(params)) {
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

var toStr = Object.prototype.toString;
function isFunction(obj) {
    return toStr.call(obj) === '[object Function]';
}