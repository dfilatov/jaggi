module.exports = {

    blocks : {
        'first' : {
            timeout : 1000,
            params  : function(ctx) {
                return { a : 'first', b : ctx.request().param('b') };
            },
            content : function(defer, params) {
                defer.resolve(params);
            },
            after : function(ctx) {
                ctx.state().param('test', 'val');
                //return false;
            }
        },
        'second' : {
            deps : ['first'],
            params : function(ctx) {
                return { test : ctx.state().param('test') };
            },
            content : function(defer, params) {
                defer.resolve(params.test);
            }
        },
        'http' : {
            content : 'http',
            params : function(ctx) {
                return {
                    method   : 'GET',
                    url      : ctx.config().hosts.nmaps + '/actions/get-geoobject.xml',
                    dataType : 'json',
                    data     : { id : 614884 }
                };
            }
        },
        'nested' : {
            deps : ['first', 'http'],
            params : function(ctx) {
                return { test : ctx.state().param('test') };
            },
            content : {
                'inner' : {
                    params : function(ctx) {
                        return {
                            test : ctx.state().param('test'),
                            test2 : ctx.request().param('b')
                        };
                    },
                    content : function(defer, params) {
                        defer.resolve(params);
                    }
                }
            }
        }
    }

};