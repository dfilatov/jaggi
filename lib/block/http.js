var http = require('http'),
    url = require('url'),
    querystring = require('querystring'),
    utils = require('../utils');

module.exports = function(defer) {

    var params = this.params,
        parsedUrl = url.parse(params.url, true),
        data = querystring.stringify(utils.merge(parsedUrl.query, params.data)),
        req = http.request(
            {
                method   : params.method,
                headers  : params.method === 'POST' &&
                    {
                        'Content-Type'   : 'application/x-www-form-urlencoded',
                        'Content-length' : data.length
                    },
                hostname : parsedUrl.hostname,
                port     : parsedUrl.port,
                path     : parsedUrl.path +
                    (params.method !== 'POST' && data? '?' + data : ''),
                auth     : params.auth
            },
            function(res) {
                if(res.statusCode == 404) {
                    defer.reject({ message : 'not found', url : params.url });
                    return;
                }

                var body = '';
                res
                    .on('data', function(chunk) {
                        body += chunk;
                    })
                    .on('end', function() {
                        try {
                            defer.resolve(processResponse(body, params.dataType));
                        }
                        catch(e) {
                            defer.reject({ message : e.message, url : params.url });
                        }
                    })
                    .on('close', function(e) {
                        defer.reject({ message : e.message, url : params.url });
                    });
            });

    params.method === 'POST' && req.write(data);

    req
        .on('error', function(e) {
            defer.reject({ message : e.message, url : params.url });
        })
        .end();

};

function processResponse(resp, dataType) {

    switch(dataType) {
        case 'json':
            return JSON.parse(resp);

        default:
            return resp;
    }

}