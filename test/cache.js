var jaggi = require('../lib/jaggi');

module.exports = {
    'block should cache result by maxAge time' : function(test) {
        var callCnt = 0,
            blocksDesc = {
                call : {
                    A : {
                        cache : {
                            key : 'key',
                            maxAge : 50
                        },
                        call : function(_, promise) {
                            callCnt++;
                            promise.fulfill('result');
                        }
                    }
                }
            };

        jaggi.create(blocksDesc).run().then(function(res) {
            test.deepEqual(res, { A : 'result' });
        });

        setTimeout(
            function() {
                jaggi.create(blocksDesc).run().then(function(res) {
                    test.deepEqual(res, { A : 'result' });
                });
            },
            30);

        setTimeout(
            function() {
                jaggi.create(blocksDesc).run().then(function(res) {
                    test.deepEqual(res, { A : 'result' });
                    test.equal(callCnt, 2);
                    test.done();
                });
            },
            70);
    }
};