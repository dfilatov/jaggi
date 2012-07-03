var State = require('./state');

module.exports = require('inherit')({

    __constructor : function(params) {

        (this._params = params).state || (this._params.state = new State());

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

    state : function() {
        return this.param('state');
    },

    request : function() {
        return this.param('request');
    },

    config : function() {
        return this.param('config');
    }

});