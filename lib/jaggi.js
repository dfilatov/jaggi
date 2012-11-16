var inherit = require('inherit'),
    Runner = require('./runner'),
    Ctx = require('./ctx'),
    State = require('./state'),
    Block = require('./block'),
    utils = require('./utils');

var DEFAULT_PARAMS = {
        meta    : false,
        pointer : true,
        timeout : 5000,
        root    : __dirname
    };

module.exports = {
    block : function(props, staticProps) {
        return inherit(Block, props, staticProps);
    },

    run : function(blocks, ctx, params) {
        return new Runner(
            blocks,
            new Ctx(utils.merge(ctx, { state : new State() })),
            utils.merge(DEFAULT_PARAMS, params))
                .run();
    }
};