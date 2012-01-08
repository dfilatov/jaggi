var http = require('http'),
    url = require('url'),
    querystring = require('querystring');

module.exports = function(defer, params) {

    var parsedUrl = url.parse(params.url, true),
        data = parsedUrl.query;

    if(params.data) {
        for(var name in params.data) {
            params.data.hasOwnProperty(name) && (data[name] = params.data[name]);
        }
    }

    var strData = querystring.stringify(data),
        req = http.request(
            {
                method   : params.method,
                headers  : params.method === 'POST' &&
                    {
                        'Content-length' : strData.length
                    },
                hostname : parsedUrl.hostname,
                port     : parsedUrl.port,
                path     : parsedUrl.path +
                    (params.method !== 'POST' && strData? '?' + strData : ''),
                auth     : params.auth
            },
            function(res) {
                if(res.statusCode == 404) {
                    defer.reject('404');
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
                            defer.reject(e.message);
                        }
                    })
                    .on('close', function(e) {
                        defer.reject(e.message);
                    });
            });

    params.method === 'POST' && req.write(strData);

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