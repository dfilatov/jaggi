var jaggi = require('../lib/jaggi');

var called;
module.exports = {
    'done hook calling' : {
        setUp : function(callback) {
            called = false;
            callback();
        },

        'hook should be called if block resolved' : function(test) {
            jaggi.create({
                call : {
                    A : {
                        call : function(_, promise) {
                            promise.resolve();
                        },
                        done : function() {
                            called = true;
                        }
                    }
                }
            }).run().then(function() {
                test.ok(called);
                test.done();
            });
        },

        'hook should not be called if block rejected' : function(test) {
            jaggi.create({
                call : {
                    A : {
                        call : function(_, promise) {
                            promise.reject();
                        },
                        done : function() {
                            called = true;
                        }
                    }
                }
            }).run().then(function() {
                test.ok(!called);
                test.done();
            });
        },

        'hook should not be called if block not running' : function(test) {
            jaggi.create({
                call : {
                    A : {
                        guard : false,
                        call : function(_, promise) {
                            promise.resolve();
                        },
                        done : function() {
                            called = true;
                        }
                    }
                }
            }).run().then(function() {
                test.ok(!called);
                test.done();
            });
        }
    },

    'done hook should prevent adding block result to tree if done=false' : function(test) {
        jaggi.create({
            call : {
                A : {
                    call : function(_, promise) {
                        promise.resolve({ ok : true });
                    },
                    done : false
                }
            }
        }).run().then(function(res) {
            test.deepEqual(res, {});
            test.done();
        });
    },

    'done hook should prevent adding block result to tree if return false' : function(test) {
        jaggi.create({
            call : {
                A : {
                    call : function(_, promise) {
                        promise.resolve({ ok : true });
                    },
                    done : function(_, _, promise) {
                        return false;
                    }
                }
            }
        }).run().then(function(res) {
            test.deepEqual(res, {});
            test.done();
        });
    },

    'done hook can modify block result' : function(test) {
        jaggi.create({
            call : {
                A : {
                    call : function(_, promise) {
                        promise.resolve({ ok : true });
                    },
                    done : function(res, _, promise) {
                        promise.resolve({ ok : false });
                    }
                }
            }
        }).run().then(function(res) {
            test.deepEqual(res, { A : { ok : false }});
            test.done();
        });
    },

    'done hook can reject block' : function(test) {
        jaggi.create({
            call : {
                A : {
                    call : function(_, promise) {
                        promise.resolve('ok');
                    },
                    done : function(_, _, promise) {
                        promise.reject('error');
                    }
                }
            }
        }).run().then(function(res) {
            test.deepEqual(res, { A : { error : { message : 'error' }}});
            test.done();
        });
    }
};