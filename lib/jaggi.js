var inherit = require('inherit'),
    EventEmitter = require('events').EventEmitter,
    BlockRunner = require('./block-runner'),
    Ctx = require('./ctx'),
    State = require('./state'),
    Block = require('./block'),
    utils = require('./utils');

var DEFAULT_PARAMS = {
        meta            : false,
        pointer         : true,
        timeout         : 5000,
        root            : __dirname,
        maxIncludeDepth : 10,
        contextFactory  : function(ctx) {
            return new Ctx(ctx);
        }
    };

var Jaggi = inherit({
    __constructor : function(runner, emitter) {
        this._runner = runner;
        this._emitter = emitter;
    },

    run : function() {
        return this._runner.run();
    },

    on : function() {
        this._emitter.on.apply(this._emitter, arguments);
        return this;
    },

    once : function() {
        this._emitter.once.apply(this._emitter, arguments);
        return this;
    },

    un : function() {
        this._emitter.removeListener.apply(this._emitter, arguments);
        return this;
    }
});

module.exports = {
    declContext : function(props, staticProps) {
        return inherit(Ctx, props, staticProps);
    },

    declBlock : function(props, staticProps) {
        return inherit(Block, props, staticProps);
    },

    create : function(desc, ctx, params) {
        var emitter = new EventEmitter();
        return new Jaggi(
            BlockRunner.create(
                { call : desc },
                utils.merge(ctx, { state : new State() }),
                utils.merge(DEFAULT_PARAMS, params, { emitter : emitter, path : '.' })),
            emitter);
    }
};