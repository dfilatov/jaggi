var inherit = require('inherit'),
    Block = require('../block'),
    MongoClient = require('mongodb').MongoClient,
    Vow = require('vow'),
    utils = require('../utils'),
    connections = {},
    DEFAULT_CREDENTIALS = {
        host : 'localhost',
        port : 27017
    };

module.exports = inherit(Block, {
    run : function(params, promise) {
        connect(utils.merge(DEFAULT_CREDENTIALS, params.credentials)).then(
            function(connection) {
                var collection = connection.collection(params.collection),
                    query = params.query || {},
                    queryHandler = function(err, data) {
                        if(err) {
                            promise.reject(new MongodbError(err));
                            return;
                        }

                        if(!data) {
                            promise.fulfill(data);
                            return;
                        }

                        data.toArray?
                            data.toArray(function(err, data) {
                                if(err) {
                                    promise.reject(new MongodbError(err));
                                    return;
                                }

                                promise.fulfill(data);
                            }) :
                            promise.fulfill(data);
                    };

                collection[params.operation || 'find'].apply(
                    collection,
                    Array.isArray(query)? query.concat([queryHandler]) : [query, queryHandler]);
                },
            function(err) {
                promise.reject(err);
            });
    }
});

function connect(credentials) {
    var credentialsStr = JSON.stringify(credentials);
    if(connections[credentialsStr]) {
        return connections[credentialsStr];
    }

    var promise = connections[credentialsStr] = Vow.promise();

    MongoClient.connect(
        'mongodb://' + (credentials.username? credentials.username + ':' + credentials.password + '@' : '') +
            credentials.host + ':' +
            credentials.port + '/' +
            credentials.database,
        function(err, connection) {
            if(err) {
                delete connections[credentialsStr];
                promise.reject(new MongodbError(err));
                return;
            }

            promise.fulfill(connection);
        });

    return promise;
}

var MongodbError = inherit(Error, {
    __constructor : function(err) {
        this.code = err.code;
        this.message = err.errmsg || 'unspecified error';
    },

    toString : function() {
        return 'MongodbError: ' + this.code + ', ' + this.message;
    }
});