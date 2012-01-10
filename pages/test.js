module.exports = {

    blocks : [
        {
            id      : 'first',
            timeout : 5000,
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
        {
            depend : ['first'],
            content : function(defer) {
                defer.resolve('second');
            }
        },
        {
            content : 'http',
            params : function(ctx) {
                return {
                    method   : 'POST',
                    url      : ctx.config().hosts.nmaps + '/actions/get-geoobject.xml',
                    dataType : 'json',
                    data     : { id : 614884 }
                };
            }
        },
        {
            depend : ['first'],
            params : function(ctx) {
                return { test : ctx.state().param('test') };
            },
            content : [
                {
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
            ]
        }
    ]

};