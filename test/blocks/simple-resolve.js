var jaggi = require('../../lib/jaggi');

module.exports = jaggi.block({
    run : function(_, defer) {
        defer.resolve('simple-resolve-result');
    }
});