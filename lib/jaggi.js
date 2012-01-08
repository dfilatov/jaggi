var express = require('express'),
    Q = require('qq'),
    runner = require('./runner');

module.exports = {

    createServer : function(params) {

        params = processParams(params);

        var server = express.createServer();

        server.configure(function() {
            //server.use(express.profiler());
            server.use(server.router);
            server.use(express.bodyParser());
            server.use(express.methodOverride());
        });

        params.routes.forEach(function(rule) {
            server[rule.method? rule.method.toLowerCase() : 'get'](rule.request, function(req, resp) {
                var defer = Q.defer();
                Q.when(defer.promise, function(res) {
                    resp.send(JSON.stringify(res));
                });
                runner(defer, {}, req, require('../' + rule.response).blocks);
            });
        });

        server.listen(params.port);

        return server;

    }

};

var DEFAULT_PARAMS = {
    port   : 80,
    routes : []
};

function processParams(params) {

    if(!params) {
        return DEFAULT_PARAMS;
    }

    for(var i in DEFAULT_PARAMS) {
        if(DEFAULT_PARAMS.hasOwnProperty(i) && !(i in params)) {
            params[i] = DEFAULT_PARAMS[i];
        }
    }

    return params;

}