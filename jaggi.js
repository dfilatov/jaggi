var server = require('./lib/jaggi').createServer({
        port   : 3000,
        routes : require('./routes')
    });