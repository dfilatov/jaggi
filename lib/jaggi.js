var express = require('express'),
    Runner = require('./runner'),
    utils = require('./utils'),
    Ctx = require('./ctx'),
    DEFAULT_PARAMS = {
        port        : 80,
        routes      : [],
        configsPath : '../configs/'
    };

module.exports = {

    createServer : function(params) {

        params = utils.merge(DEFAULT_PARAMS, params);

        var rootDir = process.cwd() + '/',
            server = express.createServer();

        server.configure(function() {
            server.use(express.profiler());
            server.set('config', require(rootDir + 'configs/' + server.settings.env));
            server.use(express.bodyParser());
            server.use(express.methodOverride());
        });

        params.routes.forEach(function(rule) {
            server[rule.method? rule.method.toLowerCase() : 'get'](rule.request, function(req, resp) {
                new Runner(
                        require(rootDir + rule.response).blocks,
                        new Ctx(
                            {
                                request : req,
                                config  : server.settings.config
                            }))
                    .run()
                    .then(function(res) {
                        resp.send(JSON.stringify(res));
                    });
            });
        });

        server.listen(params.port, function() {
            var addr = server.address();
            console.log('jaggi started at ' + addr.address + ':' + addr.port);
        });

        return server;

    }

};