var express = require('express'),
    server = express.createServer(),
    rootPath = __dirname + '/',
    cfg = require(rootPath + 'configs/' + server.settings.env),
    jaggi = require('../index');

server.configure(function() {
    server.use(express.profiler());
    server.use(express.bodyParser());
    server.use(express.cookieParser());
    server.use(express.methodOverride());
});

require('./routes').forEach(function(rule) {
    server[rule.method? rule.method.toLowerCase() : 'get'](rule.request, function(req, resp) {
        jaggi.run(
            require(rootPath + rule.response).blocks,
            {
                config   : cfg,
                request  : req,
                response : resp
            })
                .then(function(res) {
                    resp.send(JSON.stringify(res));
                });
    });
});

server.listen(3000, function() {
    var addr = server.address();
    console.log('server started at ' + addr.address + ':' + addr.port);
});