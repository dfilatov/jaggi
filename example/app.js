var server = require('../index').createServer({
        port   : 3000,
        routes : require('./routes')
    });