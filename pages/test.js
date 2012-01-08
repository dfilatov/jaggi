module.exports = {

    blocks : [
        {
            id      : 'first',
            timeout : 5000,
            params  : function(ctx) {
                return { a : 'first', b : ctx.req().param('b') };
            },
            content : function(defer, params) {
                defer.resolve(params);
            },
            after : function(ctx) {
                ctx.param('test', 'val');
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
            params : {
                method   : 'POST',
                url      : 'http://n.maps.yandex.ru/actions/get-geoobject.xml',
                dataType : 'json',
                data     : { id : 614884 }
            }
        },
        {
            depend : ['first'],
            params : function(ctx) {
                return { test : ctx.param('test') };
            },
            content : [
                {
                    params : function(ctx) {
                        return { test : ctx.param('test'), test2 : ctx.req().param('b') };
                    },
                    content : function(defer, params) {
                        defer.resolve(params);
                    }
                }/*,
                {
                    content : 'http'
                }*/
            ]
        }
    ]

};