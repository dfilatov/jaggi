var express = require('express'),
    Q = require('q'),
    runner = require('./runner'),
    utils = require('./utils'),
    Ctx = require('./ctx'),
    DEFAULT_PARAMS = {
        port         : 80,
        routes      : [],
        configsPath : '../configs/'
    };

module.exports = {

    createServer : function(params) {

        params = utils.merge(DEFAULT_PARAMS, params);

        var server = express.createServer();

        server.configure(function() {
                //server.use(express.profiler());
                server.set('config', require(params.configsPath + server.settings.env));
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
                runner(
                    defer,
                    new Ctx(
                        {
                            request : req,
                            config  : server.settings.config
                        }),
                    require('../' + rule.response).blocks);
            });
        });

        return server.listen(params.port);

    }

};