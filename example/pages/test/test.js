module.exports = {

    blocks : {
        'second' : {
            deps : ['first'],
            params : function(ctx) {
                return { test : ctx.state().param('test') };
            },
            content : function(defer) {
                defer.resolve(this.params.test);
            }
        },
        'first' : {
            timeout : 1000,
            params  : function(ctx) {
                return { a : 'first', b : ctx.request().param('b') };
            },
            content : function(defer) {
                defer.resolve(this.params);
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
                    content : function(defer) {
                        defer.resolve(this.params);
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
                        content : function(defer) {
                            defer.resolve(['dyna' + i + '-content', this.params.dynaParam]);
                        }
                    };
                });
                return res;
            }
        },
        'static' : {
            content : function(defer) {
                defer.resolve({ staticData : true });
            }
        }
    }

};