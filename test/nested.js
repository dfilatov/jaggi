var jaggi = require('../lib/jaggi'),
    path = require('path');

module.exports = {
    'block should produce nested block' : function(test) {
        jaggi.create({
                A : {
                    call : {
                        'A-1' : {
                            call : {
                                'A-1-1' : {
                                    call : function(_, promise) {
                                        promise.resolve('A-1-1-result');
                                    }
                                }
                            }
                        },
                        'A-2' : {
                            call : function(_, promise) {
                                promise.reject('A-2-error');
                            }
                        }
                    }
                }
            }).run().then(function(res) {
                test.deepEqual(
                    res,
                    {
                        A : {
                            'A-1' : {
                                'A-1-1' : 'A-1-1-result'
                            },
                            'A-2' : {
                                error : { message : 'A-2-error' }
                            }
                        }
                    });
                test.done();
            });
    },

    'block should produce nested block in call' : function(test) {
        jaggi.create({
                A : {
                    call : function() {
                        return {
                            'A-1' : {
                                call : function() {
                                    return {
                                        'A-1-1' : {
                                            call : function(_, promise) {
                                                promise.resolve('A-1-1-result');
                                            }
                                        }
                                    };
                                }
                            },
                            'A-2' : {
                                call : function(_, promise) {
                                    promise.reject('A-2-error');
                                }
                            }
                        };
                    }
                }
            }).run().then(function(res) {
                test.deepEqual(
                    res,
                    {
                        A : {
                            'A-1' : {
                                'A-1-1' : 'A-1-1-result'
                            },
                            'A-2' : {
                                error : { message : 'A-2-error' }
                            }
                        }
                    });
                test.done();
            });
    }
};
