var jaggi = require('../lib/jaggi'),
    path = require('path');

module.exports = {
    'block should produce result' : function(test) {
        jaggi.create({
                A : {
                    call : function(_, promise) {
                        promise.resolve('result');
                    }
                }
            }).run().then(function(res) {
                test.deepEqual(res, { A : 'result' });
                test.done();
            });
    },

    'block should produce complex result' : function(test) {
        jaggi.create({
                A : {
                    call : function(_, promise) {
                        promise.resolve({ a : { b : { c : true }}});
                    }
                }
            }).run().then(function(res) {
                test.deepEqual(res, { A : { a : { b : { c : true }}}});
                test.done();
            });
    },

    'block should call user-defined block' : function(test) {
        jaggi.create(
            {
                A : {
                    call : 'simple-resolve.js'
                }
            },
            null,
            {
                root : path.join(__dirname, 'stubs', 'blocks')
            }).run().then(function(res) {
                test.deepEqual(res, { A : 'simple-resolve-result' });
                test.done();
            });
    },

    'block should produce error if user-defined block no exists' : function(test) {
        jaggi.create(
            {
                A : {
                    call : 'no-exists.js'
                }
            },
            null,
            {
                root : path.join(__dirname, 'stubs', 'blocks')
            }).run().then(function(res) {
                test.ok(res.A.error.message.indexOf('Cannot find module') > -1);
                test.done();
            });
    }
};