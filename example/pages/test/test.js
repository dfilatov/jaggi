module.exports = {

    blocks : {
        'second' : {
            deps : ['first'],
            params : function(ctx) {
                return { test : ctx.state().param('test') };
            },
            content : function(params, defer) {
                defer.resolve(params.test);
            }
        },
        'first' : {
            timeout : 1000,
            params  : function(ctx) {
                return { a : 'first', b : ctx.request().param('b') };
            },
            content : function(params, defer) {
                defer.resolve(params);
            },
            after : function(ctx) {
                ctx.state().param('test', 'val');
                //return false;
            }
        },
        'http' : {
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
        'nested' : {
            deps : ['first'],
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
                    content : function(params, defer) {
                        defer.resolve(params);
                    }
                }
            }
        },
        'dynamic' : {
            timeout : 4000,
            deps    : ['nested'],
            params  : { dyna : [1, 2, 3], dynaParam : 'dyna-param-test' },
            content : function() {
                var res = {};
                this.params.dyna.forEach(function(i) {
                    res['dyna' + i] = {
                        params : function(ctx) {
                            return ctx.state().params();
                        },
                        content : function(params, defer) {
                            defer.resolve(['dyna' + i + '-content', params.dynaParam]);
                        }
                    };
                });
                return res;
            }
        },
        'static' : {
            content : function(_, defer) {
                defer.resolve({ staticData : true });
            }
        },
         'auth' : {
            content : 'http',
            params : function(ctx) {
                return {
                    url  : 'http://blackbox-mimino.yandex.net/blackbox/',
                    data : {
                        method    : 'session',
                        host      : 'yandex.ru',
                        sessionid : ctx.request().cookies['session_id'],
                        userip    : ctx.request().headers['x-forwarded-for'],
                        regname   : 'yes',
                        format    : 'json'
                    }
                };
            }
        }
    }

};