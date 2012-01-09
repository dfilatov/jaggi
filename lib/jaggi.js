var express = require('express'),
    Q = require('q'),
    runner = require('./runner'),
    utils = require('./utils');

module.exports = {

    createServer : function(params) {

        params = utils.merge(DEFAULT_PARAMS, params);

        var server = express.createServer()
                .configure(function() {
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

        return server.listen(params.port);

    }

};

var DEFAULT_PARAMS = {
    port   : 80,
    routes : []
};