var path = require('path'),
    express = require('express'),
    server = express.createServer(),
    cfg = require(path.join(__dirname, 'configs', server.settings.env)),
    PageContext = require('./PageContext'),
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
            require(path.join(__dirname, rule.response)).blocks,
            {
                request  : req,
                response : resp
            },
            {
                contextFactory : function(params) {
                    return new PageContext(params);
                }
            })
                .then(function(res) {
                    resp.send('<pre>' + JSON.stringify(res, null, 4) + '</pre>');
                });
    });
});

server.listen(3000, function() {
    var addr = server.address();
    console.log('server started at ' + addr.address + ':' + addr.port);
});