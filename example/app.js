var server = require('../index').createServer({
        rootDir : __dirname,
        port    : 3000,
        routes  : require('./routes')
    });