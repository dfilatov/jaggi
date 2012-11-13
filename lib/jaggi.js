var Runner = require('./runner'),
    Ctx = require('./ctx'),
    State = require('./state'),
    utils = require('./utils');

var DEFAULT_PARAMS = {
        meta : false,
        root : __dirname
    };

module.exports = {
    run : function(blocks, ctx, params) {
        return new Runner(
            blocks,
            new Ctx(utils.merge(ctx, { state : new State() })),
            utils.merge(DEFAULT_PARAMS, params))
                .run();
    }
};