var http = require('http'),
    https = require('https'),
    url = require('url'),
    querystring = require('querystring'),
    utils = require('../utils'),
    inherit = require('inherit'),
    Block = require('../block');

module.exports = inherit(Block, {
    run : function(params, promise) {
        var parsedUrl = url.parse(params.url, true),
            hasBody = params.method === 'POST' || params.method === 'PUT',
            queryParams = querystring.stringify(
                hasBody?
                    parsedUrl.query :
                    utils.merge(parsedUrl.query, params.data)),
            body = hasBody? querystring.stringify(params.data) : '';

        this._redirCounter = params.maxRedirects || 5;

        this._doHttp(
            {
                method   : params.method,
                headers  : utils.merge(
                    params.headers,
                    hasBody?
                        {
                            'Content-Type'   : 'application/x-www-form-urlencoded',
                            'Content-length' : Buffer.byteLength(body)
                        } :
                        null),
                protocol : parsedUrl.protocol,
                hostname : parsedUrl.hostname,
                port     : parsedUrl.port,
                path     : parsedUrl.pathname + (queryParams? '?' + queryParams : ''),
                auth     : params.auth
            },
            promise,
            params.dataType,
            body);
    },

    abort : function() {
        this._curReq && this._curReq.abort();
    },

    _doHttp : function(params, promise, dataType, body) {
        this._curReq = (params.protocol === 'https:'? https : http).request(
                params,
                function(res) {
                    if(res.statusCode === 301 || res.statusCode === 302) {
                        return --this._redirCounter?
                            this._doHttp(url.parse(res.headers['location'], true), promise, dataType) :
                            promise.reject(Error('too many redirects'));
                    }
                    else if(res.statusCode >= 400) {
                        return promise.reject(new HttpError(res.statusCode));
                    }

                    var buffers = [];
                    res
                        .on('data', function(chunk) {
                            buffers.push(chunk);
                        })
                        .once('end', function() {
                            try {
                                promise.fulfill(processResponse(
                                    Buffer.concat(buffers).toString(),
                                    dataType || extractDataTypeFromHeaders(res.headers)));
                            }
                            catch(e) {
                                promise.reject(e);
                            }
                        })
                        .once('close', function() {
                            promise.reject(Error('connection closed'));
                        });
                }.bind(this));

        body && this._curReq.write(body);

        this._curReq
            .once('error', function(e) {
                promise.reject(e);
            })
            .end();
    }
});

function extractDataTypeFromHeaders(headers) {
    var contentType = headers['content-type'];
    if(contentType.indexOf('json') > -1) {
        return 'json';
    }

    return 'text';
}

function processResponse(resp, dataType) {
    switch(dataType) {
        case 'json':
            return JSON.parse(resp);

        default:
            return resp;
    }
}

var HttpError = inherit(Error, {
    __constructor : function(code) {
        this.code = code;
        this.message = http.STATUS_CODES[code] || 'unspecified error';
    },

    toString : function() {
        return 'HttpError: ' + this.code + ', ' + this.message;
    }
});