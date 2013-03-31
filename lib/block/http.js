var http = require('http'),
    https = require('https'),
    url = require('url'),
    querystring = require('querystring'),
    zlib = require('zlib'),
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
            body = hasBody? querystring.stringify(params.data) : '',
            headers = params.headers || {};

        if(params.allowGzip) {
            var encodingHeader = headers['Accept-Encoding'];
            if(!encodingHeader) {
                encodingHeader = 'gzip, *';
            }
            else if(encodingHeader.indexOf('gzip') === -1) {
                encodingHeader = 'gzip, ' + encodingHeader;
            }

            headers['Accept-Encoding'] = encodingHeader;
        }

        this._redirCounter = params.maxRedirects || 5;
        this._encoding = params.encoding || 'utf8';
        this._dataType = params.dataType;

        this._doHttp(
            {
                method   : params.method,
                headers  : utils.merge(
                    headers,
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
        var _this = this;
        _this._curReq = (params.protocol === 'https:'? https : http).request(
                params,
                function(res) {
                    if(res.statusCode === 301 || res.statusCode === 302) {
                        return --_this._redirCounter?
                            _this._doHttp(url.parse(res.headers['location'], true), promise, dataType) :
                            promise.reject(Error('too many redirects'));
                    }
                    else if(res.statusCode >= 400) {
                        return promise.reject(new HttpError(res.statusCode));
                    }

                    var resp = '',
                        headers = res.headers,
                        resStream;

                    headers['content-encoding'] === 'gzip'?
                        res.pipe(resStream = new zlib.Gunzip()) :
                        resStream = res;

                    resStream.setEncoding(_this._encoding);
                    resStream
                        .on('data', function(chunk) {
                            resp += chunk;
                        })
                        .once('end', function() {
                            try {
                                promise.fulfill(processResponse(
                                    resp,
                                    _this._dataType || extractDataTypeFromHeaders(headers)));
                            }
                            catch(e) {
                                promise.reject(e);
                            }
                        })
                        .once('close', function() {
                            promise.reject(Error('connection closed'));
                        });
                });

        body && _this._curReq.write(body);

        _this._curReq
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