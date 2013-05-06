var inherit = require('inherit'),
    Block = require('../block'),
    MongoClient = require('mongodb').MongoClient,
    connection;

module.exports = inherit(Block, {
    run : function(params, promise) {

        var credentials = params.credentials,
            login = credentials.username ? (credentials.username + ':' + credentials.password + '@') : '',
            connectionHandler = function(err, db) {
                if (err) return promise.reject(new MongodbError(err));

                connection = db;

                var collection = db.collection(params.collection),
                    query = params.query || {},
                    args = Array.isArray(query)? query.concat([queryHandler]) : [query, queryHandler];

                collection[params.operation || 'find'].apply(collection, args);
            },
            queryHandler = function(err, data) {
                if (err) return promise.reject(new MongodbError(err));

                if (!data) return promise.fulfill(data);

                data.toArray ?
                    data.toArray(function(err, data) {
                        err?
                            promise.reject(new MongodbError(err)) :
                            promise.fulfill(data);
                    }) :
                    promise.fulfill(data);
            };

        connection?
            connectionHandler(null, connection) :
            MongoClient.connect('mongodb://' + login + (credentials.host || 'localhost') + ':' + (credentials.port || 27017) + '/' + credentials.database, connectionHandler);
    }
});

var MongodbError = inherit(Error, {
    __constructor : function(err) {
        this.code = err.code;
        this.message = err.errmsg || 'unspecified error';
    },

    toString : function() {
        return 'MongodbError: ' + this.code + ', ' + this.message;
    }
});