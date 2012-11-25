module.exports = require('../index').declContext({
    request : function(name) {
        if(arguments.length === 1) {
            return this.param('request').param(name);
        }

        return this.param('request');
    },

    response : function() {
        return this.param('response');
    }
});
