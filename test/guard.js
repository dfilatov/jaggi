var jaggi = require('../lib/jaggi');

var called;
module.exports = {
    setUp : function(callback) {
        called = false;
        callback();
    },

    'block should not be running if guard=false' : function(test) {
        jaggi.create({
            A : {
                guard : false,
                call : function() {
                    called = true;
                }
            }
        }).run().then(function() {
            test.strictEqual(called, false);
            test.done();
        });
    },

    'block should not be running if guard function return false' : function(test) {
        jaggi.create({
            A : {
                guard : function() {
                    return false;
                },
                call : function() {
                    called = true;
                }
            }
        }).run().then(function() {
            test.strictEqual(called, false);
            test.done();
        });
    },

    'block should be running if guard function return true' : function(test) {
        jaggi.create({
            A : {
                guard : function() {
                    return true;
                },
                call : function() {
                    called = true;
                }
            }
        }).run().then(function() {
            test.strictEqual(called, true);
            test.done();
        });
    },

    'block should be running if guard function return undefined' : function(test) {
        jaggi.create({
            A : {
                guard : function() {},
                call : function() {
                    called = true;
                }
            }
        }).run().then(function() {
            test.strictEqual(called, true);
            test.done();
        });
    }
};