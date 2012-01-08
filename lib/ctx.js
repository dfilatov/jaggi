module.exports = require('inherit')({

    __constructor : function(params, req) {

        this._params = params;
        this._req = req;

    },

    param : function(name, val) {

        if(arguments.length === 1) {
            return this._params[name];
        }

        this._params[name] = val;

        return this;

    },

    req : function() {

        return this._req;

    }

});