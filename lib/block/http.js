var http = require('http'),
    url = require('url'),
    querystring = require('querystring'),
    utils = require('../utils'),
    inherit = require('inherit'),
    Block = require('../block');

module.exports = inherit(Block, {
    run : function(params, defer) {
        var parsedUrl = url.parse(params.url, true),
            needBuildBody = params.method === 'POST' || params.method === 'PUT',
            data = querystring.stringify(utils.merge(parsedUrl.query, params.data));

        this._doHttp(
            {
                method   : params.method,
                headers  : utils.merge(
                    params.headers,
                    needBuildBody?
                        {
                            'Content-Type'   : 'application/x-www-form-urlencoded',
                            'Content-length' : Buffer.byteLength(data)
                        } :
                        null),
                hostname : parsedUrl.hostname,
                port     : parsedUrl.port,
                path     : parsedUrl.pathname + (!needBuildBody && data? '?' + data : ''),
                auth     : params.auth
            },
            defer,
            params.dataType,
            needBuildBody? data : null,
            params.maxRedirects || 5);
    },

    abort : function() {
        this._curReq && this._curReq.abort();
    },

    _doHttp : function(params, defer, dataType, bodyData, redirCounter) {
        var t = this;
        t._curReq = http.request(
                params,
                function(res) {
                    if(res.statusCode === 301 || res.statusCode === 302) {
                        return --redirCounter?
                            t._doHttp(url.parse(res.headers['location'], true), defer, dataType, null, redirCounter) :
                            defer.reject(buildHttpError({ message : 'too many redirects' }));
                    }
                    else if(res.statusCode >= 400) {
                        return defer.reject(buildHttpError({ code : res.statusCode }));
                    }

                    var body = '';
                    res
                        .on('data', function(chunk) {
                            body += chunk;
                        })
                        .once('end', function() {
                            try {
                                defer.resolve(processResponse(body, dataType || 'json'));
                            }
                            catch(e) {
                                defer.reject(buildHttpError({ message : 'parse error: ' + e.message }));
                            }
                        })
                        .once('close', function() {
                            defer.reject(buildHttpError({ message : 'connection closed' }));
                        });
                });

        bodyData && t._curReq.write(bodyData);

        t._curReq
            .once('error', function(e) {
                defer.reject(buildHttpError({ message : e.message }));
            })
            .end();
    }
});

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
        429 : 'Too Many Requests',
        500 : 'Internal Server Error',
        501 : 'Not Implemented',
        502 : 'Bad Gateway',
        503 : 'Service Unavailable',
        504 : 'Gateway Timeout',
        505 : 'HTTP Version Not Supported'
    };

function buildHttpError(error) {
    error.code &&
        (error.message = ERROR_MESSAGES[error.code] || 'unspecified error');

    return error;
}

function processResponse(resp, dataType) {
    switch(dataType) {
        case 'json':
            return JSON.parse(resp);

        default:
            return resp;
    }
}