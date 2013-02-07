var fs = require('fs'),
    inherit = require('inherit'),
    Block = require('../block');

module.exports = inherit(Block, {
    run : function(params, promise) {
        fs.readFile(params.path, params.encoding || 'utf8', function read(err, data) {
            err? promise.reject(new FsError(err)) : promise.fulfill(processData(data, params.dataType));
        });
    }
});

function processData(data, dataType) {
    switch(dataType) {
        case 'json':
            return JSON.parse(data);

        default:
            return data;
    }
}

var FsError = inherit(Error, {
    __constructor : function(err) {
        this.code = err.errno;
        this.message = err.code || 'unspecified error';
    },

    toString : function() {
        return 'FsError: ' + this.code + ', ' + this.message;
    }
});