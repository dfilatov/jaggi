var jaggi = require('../lib/jaggi'),
    path = require('path');

module.exports = {
    'block should produce result' : function(test) {
        jaggi.run({
                A : {
                    call : function(_, defer) {
                        defer.resolve('result');
                    }
                }
            }).then(function(res) {
                test.deepEqual(res, { A : 'result' });
                test.done();
            });
    },

    'block should produce complex result' : function(test) {
        jaggi.run({
                A : {
                    call : function(_, defer) {
                        defer.resolve({ a : { b : { c : true }}});
                    }
                }
            }).then(function(res) {
                test.deepEqual(res, { A : { a : { b : { c : true }}}});
                test.done();
            });
    },

    'block should call user-defined block' : function(test) {
        jaggi.run(
            {
                A : {
                    call : 'simple-resolve.js'
                }
            },
            null,
            {
                root : path.join(__dirname, 'blocks')
            }).then(function(res) {
                test.deepEqual(res, { A : 'simple-resolve-result' });
                test.done();
            });
    },

    'block should produce error if user-defined block no exists' : function(test) {
        jaggi.run(
            {
                A : {
                    call : 'no-exists.js'
                }
            },
            null,
            {
                root : path.join(__dirname, 'blocks')
            }).then(function(res) {
                test.deepEqual(res, { A : { error : { message : 'Cannot find module \'/home/dfilatov/www/jaggi/test/blocks/no-exists.js\'' }}});
                test.done();
            });
    }
};