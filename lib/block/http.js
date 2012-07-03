var http = require('http'),
    url = require('url'),
    querystring = require('querystring'),
    utils = require('../utils');

module.exports = function(params, defer) {

    var parsedUrl = url.parse(params.url, true),
        needBuildBody = params.method === 'POST' || params.method === 'PUT',
        data = querystring.stringify(utils.merge(parsedUrl.query, params.data));

    doHttp(
        {
            method   : params.method,
            headers  : utils.merge(
                params.headers,
                needBuildBody?
                    {
                        'Content-Type'   : 'application/x-www-form-urlencoded',
                        'Content-length' : data.length
                    } :
                    null),
            hostname : parsedUrl.hostname,
            port     : parsedUrl.port,
            path     : parsedUrl.pathname +
                (!needBuildBody && data? '?' + data : ''),
            auth     : params.auth
        },
        defer,
        params.dataType,
        needBuildBody? data : null,
        params.maxRedirects || 5);

};

function doHttp(params, defer, dataType, bodyData, redirCounter) {

    var req = http.request(
            params,
            function(res) {
                if(res.statusCode === 301 || res.statusCode === 302) {
                    return --redirCounter?
                        doHttp(url.parse(res.headers['location'], true), defer, dataType, null, redirCounter) :
                        defer.reject(buildHttpErrorMessage('TOO_MANY_REDIRECTS'));
                }
                else if(res.statusCode >= 400) {
                    return defer.reject(res.statusCode);
                }

                var body = '';
                res
                    .on('data', function(chunk) {
                        body += chunk;
                    })
                    .on('end', function() {
                        try {
                            defer.resolve(processResponse(body, dataType || 'json'));
                        }
                        catch(e) {
                            defer.reject(buildHttpErrorMessage('PARSE_ERROR', e.message));
                        }
                    })
                    .on('close', function(e) {
                        defer.reject(buildHttpErrorMessage('CONNECTION_CLOSED', e.message));
                    });
            });

    bodyData && req.write(bodyData);

    req
        .on('error', function(e) {
            defer.reject(buildHttpErrorMessage('UNKNOWN_ERROR', e.message));
        })
        .end();

}

var ERROR_MESSAGES = {
    400 : 'Bad Request',
    401 : 'Unauthorized',
    402 : 'Payment Required',
    403 : 'Forbidden',
    404 : 'Not Found',
    405 : 'Method not allowed',
    406 : 'Not Acceptable',
    407 : 'Proxy Authentication Required',
    408 : 'Request Timeout',
    409 : 'Conflict',
    410 : 'Gone',
    500 : 'Internal Server Error',
    501 : 'Not Implemented',
    502 : 'Bad Gateway',
    503 : 'Service Unavailable',
    504 : 'Gateway Timeout',
    505 : 'HTTP Version Not Supported'
};

function buildHttpErrorMessage(code, message) {
    return {
        code    : 'HTTP_' + code,
        message : message || ERROR_MESSAGES[code]
    };
}

function processResponse(resp, dataType) {

    switch(dataType) {
        case 'json':
            return JSON.parse(resp);

        default:
            return resp;
    }

}