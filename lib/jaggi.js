var Runner = require('./runner'),
    Ctx = require('./ctx'),
    State = require('./state'),
    utils = require('./utils');

module.exports = {
    run : function(blocks, ctx) {
        return new Runner(blocks, new Ctx(utils.merge(ctx, { state : new State() }))).run();
    }
};