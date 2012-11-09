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

    _doHttp : function (params, defer, dataType, bodyData, redirCounter) {
        this._curReq = http.request(
                params,
                function(res) {
                    if(res.statusCode === 301 || res.statusCode === 302) {
                        return --redirCounter?
                            this._doHttp(url.parse(res.headers['location'], true), defer, dataType, null, redirCounter) :
                            defer.reject(buildHttpErrorMessage('TOO_MANY_REDIRECTS'));
                    }
                    else if(res.statusCode >= 400) {
                        return defer.reject(buildHttpErrorMessage(res.statusCode));
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
                                defer.reject(buildHttpErrorMessage('PARSE_ERROR', e.message));
                            }
                        })
                        .once('close', function(e) {
                            defer.reject(buildHttpErrorMessage('CONNECTION_CLOSED', e.message));
                        });
                });

        bodyData && this._curReq.write(bodyData);

        this._curReq
            .once('error', function(e) {
                defer.reject(buildHttpErrorMessage('UNKNOWN_ERROR', e.message));
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
        500 : 'Internal Server Error',
        501 : 'Not Implemented',
        502 : 'Bad Gateway',
        503 : 'Service Unavailable',
        504 : 'Gateway Timeout',
        505 : 'HTTP Version Not Supported'
    };

function buildHttpErrorMessage(code, message) {
    return 'HTTP ' + code + ': ' + (message || ERROR_MESSAGES[code]);
}

function processResponse(resp, dataType) {
    switch(dataType) {
        case 'json':
            return JSON.parse(resp);

        default:
            return resp;
    }
}