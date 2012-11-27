var jaggi = require('../lib/jaggi');

var called;
module.exports = {
    'done hook calling' : {
        setUp : function(callback) {
            called = false;
            callback();
        },

        /*'hook should be called if block resolved' : function(test) {
            jaggi.create({
                A : {
                    call : function(_, defer) {
                        defer.resolve();
                    },
                    done : function() {
                        called = true;
                    }
                }
            }).run().fin(function() {
                test.strictEqual(called, true);
                test.done();
            });
        },*/

        'hook should not be called if block rejected' : function(test) {
            jaggi.create({
                A : {
                    call : function(_, defer) {
                        defer.reject();
                    },
                    done : function() {
                        called = true;
                    }
                }
            }).run().fin(function() {
                test.strictEqual(called, false);
                test.done();
            });
        },

        /*'hook should not be called if block not running' : function(test) {
            jaggi.run({
                A : {
                    guard : false,
                    call : function(_, defer) {
                        defer.resolve();
                    },
                    done : function() {
                        called = true;
                    }
                }
            }).fin(function() {
                test.strictEqual(called, false);
                test.done();
            });
        } */
    },
     /*
    'done hook should prevent adding block result to tree if done=false' : function(test) {
        jaggi.run({
            A : {
                call : function(_, defer) {
                    defer.resolve({ ok : true });
                },
                done : false
            }
        }).then(function(res) {
            test.deepEqual(res, {});
            test.done();
        });
    },

    'done hook should prevent adding block result to tree if return false' : function(test) {
        jaggi.run({
            A : {
                call : function(_, defer) {
                    defer.resolve({ ok : true });
                },
                done : function(_, _, defer) {
                    return false;
                }
            }
        }).then(function(res) {
            test.deepEqual(res, {});
            test.done();
        });
    },

    'done hook can modify block result' : function(test) {
        jaggi.run({
            A : {
                call : function(_, defer) {
                    defer.resolve({ ok : true });
                },
                done : function(res, _, defer) {
                    defer.resolve({ ok : false });
                }
            }
        }).then(function(res) {
            test.deepEqual(res, { A : { ok : false }});
            test.done();
        });
    },

    'done hook can reject block' : function(test) {
        jaggi.run({
            A : {
                call : function(_, defer) {
                    defer.resolve('ok');
                },
                done : function(_, _, defer) {
                    defer.reject('error');
                }
            }
        }).then(function(res) {
            test.deepEqual(res, { A : { error : { message : 'error' }}});
            test.done();
        });
    }  */
};