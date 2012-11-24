module.exports = require('inherit')({
    __constructor : function(params) {
        this._params = params;
    },

    params : function(val) {
        if(!arguments.length) {
            return this._params;
        }

        this._params = val;

        return this;
    },

    param : function(name, val) {
        if(arguments.length === 1) {
            return this._params[name];
        }

        this._params[name] = val;

        return this;
    },

    state : function(name, val) {
        var argLen = arguments.length,
            state = this.param('state');

        if(argLen) {
            if(argLen === 1) {
                if(typeof name === 'string') { // getter
                    return state.param(name);
                }

                Object.keys(name).forEach(function(name, val) { // complex setter
                    state.param(name, val);
                });
            }
            else {
                state.param(name, val); // setter
            }

            return this;
        }

        return this.param('state');
    },

    request : function() {
        return this.param('request');
    },

    response : function() {
        return this.param('response');
    }
});