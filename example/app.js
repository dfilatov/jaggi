var path = require('path'),
    app = require('express')(),
    PageContext = require('./page-context'),
    jaggi = require('../index'),
    util = require('util');

require('./routes').forEach(function(rule) {
    app[rule.method? rule.method.toLowerCase() : 'get'](rule.request, function(req, resp) {
        var runner = jaggi.create(
                require(path.join(__dirname, rule.response)).blocks,
                {
                    request  : req,
                    response : resp
                },
                {
                    contextFactory : function(params) {
                        return new PageContext(params);
                    }
                });

        runner
            .on('block-event', function(event, data) {
                console.log(
                    util.format('block %s %s', event.meta.id, event.type),
                    (data && data.message) || '');
            })
            .run().then(function(res) {
                resp.send('<pre>' + JSON.stringify(res, null, 4) + '</pre>');
            });
    });
});

app.listen(3000, function() {
    console.log('app started');
});