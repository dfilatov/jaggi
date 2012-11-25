var jaggi = require('../../lib/jaggi');

module.exports = jaggi.declBlock({
    run : function(_, defer) {
        defer.resolve('simple-resolve-result');
    }
});