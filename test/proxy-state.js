var jaggi = require('../lib/jaggi');

var stateParams;
module.exports = {
    setUp : function(done) {
        stateParams = {};
        done();
    },

    'nested block should have new state' : function(test) {
        jaggi.create({
            A : {
                call : function(_, defer) {
                    defer.resolve('A done');
                },
                toState : {
                    'A-1-res' : '.'
                }
            },

            B : {
                call : {
                    'B-1' : {
                        params : function(ctx) {
                            stateParams = ctx.state().params();
                        },
                        call : function(_, defer) {
                            defer.resolve('B-1 done');
                        }
                    }
                }
            }
        }).run().fin(function() {
            test.deepEqual(stateParams, {});
            test.done();
        });
    },

    'nested block should have parent state if proxyState=true' : function(test) {
        jaggi.create({
            A : {
                call : function(_, defer) {
                    defer.resolve('A done');
                },
                toState : {
                    'A-1-res' : '.'
                }
            },

            B : {
                proxyState : true,
                call : {
                    'B-1' : {
                        params : function(ctx) {
                            stateParams = ctx.state().params();
                        },
                        call : function(_, defer) {
                            defer.resolve('B-1 done');
                        }
                    }
                }
            }
        }).run().fin(function() {
            test.deepEqual(stateParams, { 'A-1-res' : ['A done'] });
            test.done();
        });
    }
};
