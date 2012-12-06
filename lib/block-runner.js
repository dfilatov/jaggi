var path = require('path'),
    inherit = require('inherit'),
    Q = require('q'),
    utils = require('./utils'),
    pointer = require('./pointer'),
    undef;

module.exports = inherit({
    __constructor : function(desc, ctx, params) {
        this._desc = desc;
        this._ctx = params.contextFactory(ctx);
        this._params = params;
        this._meta = { id : params.path };

        this._blockDefer = undef;
        this._blockParams = undef;
        this._blockRes = undef;
        this._blockError = undef;

        this._isRunning = false;
        this._isAborted = false;
    },

    run : function() {
        if(!this._isRunning) {
            this._isRunning = true;
            this._meta.startTime = Date.now();
            this._emitEvent('running');

            if(!this._checkGuard()) {
                this._emitEvent('guarded');
                return;
            }

            this._blockDefer = Q.defer();
            try {
                this._preprocess();
                this._run(this._blockDefer);
            }
            catch(e) {
                this._blockDefer.reject(e);
            }

            this._meta.params = this._blockParams;

            return Q.timeout(
                    this._blockDefer.promise,
                    this._meta.timeout = this._desc.timeout || this._params.timeout)
                .then(
                    this._onBlockDone.bind(this),
                    this._onBlockFailed.bind(this))
                .then(this._onBlockFinalized.bind(this));
        }
    },

    _run : function() {},

    _preprocess : function() {
        this._processInclude();
        this._buildBlockParams();
    },

    _processInclude : function() {
        var desc = this._desc;
        if(!desc.include) {
            return;
        }

        var fileName, includedBlock, depth = this._params.maxIncludeDepth;
        while(desc.include) {
            fileName = path.normalize(path.join(this._params.root, desc.include));

            includedBlock = require(fileName);
            desc = utils.merge(includedBlock, desc);
            desc.__base = includedBlock;

            if(!includedBlock.include) {
                delete desc.include;
            }

            if(!--depth) {
                throw({
                    message : 'includes depth (' + this._params.maxIncludeDepth + ') reached in file: ' + fileName
                });
            }
        }

        this._desc = desc;
    },

    _buildBlockParams : function() {
        var desc = this._desc;
        if(!desc.params) {
            this._blockParams = {};
        }
        else if(utils.isFunction(desc.params)) {
            var t = this;
            this._blockParams = desc.params.call(
                {
                    __base : desc.__base? // base call emulation
                        function() {
                            return t._buildBlockParams(desc.__base);
                        } :
                        function() {
                            return {};
                        }
                },
                t._ctx);
        }
        else {
            this._blockParams = desc.params;
        }
    },

    abort : function() {
        if(this._isRunning && !this._isAborted) {
            this._isAborted = true;
            this._abort();
            this._blockDefer.reject('aborted');
        }
    },

    _abort : function() {},

    _checkGuard : function() {
        var guard = this._desc.guard,
            type = typeof guard;

        if(type === 'undefined' || type === 'boolean') {
            return guard !== false;
        }

        if(utils.isFunction(guard)) {
            return guard(this._ctx) !== false;
        }

        var state = this._ctx.state(),
            i = (Array.isArray(guard)? guard : (guard = [guard])).length,
            param;
        while(i--) {
            param = state.param(guard[i]);
            if(Array.isArray(param)? !param.length : !param) {
                return false;
            }
        }

        return true;
    },

    _emitEvent : function(event, data) {
        this._params.emitter.emit(
            'block-event',
            {
                type : event,
                meta : this._meta
            },
            data);
    },

    _onBlockDone : function(blockRes) {
        this._blockRes = blockRes;

        this._updateState();

        var done = this._processBlockDoneHook();
        if(typeof done === 'boolean') {
            done?
                this._applyPointer() :
                this._blockRes = undef;
            return;
        }

        return done.then(
            (function(res) {
                return this._blockRes = res;
            }).bind(this),
            this._onBlockFailed.bind(this));
    },

    _processBlockDoneHook : function() {
        var hook = this._desc.done,
            type = typeof hook;

        if(type === 'undefined' || type === 'boolean') {
            return hook !== false;
        }

        if(utils.isFunction(hook)) {
            var defer,
                promise = (defer = hook.length > 2? Q.defer() : undef) && defer.promise;

            if(hook(this._blockRes, this._ctx, defer) === false) {
                return false;
            }

            return promise || true;
        }

        return true;
    },

    _onBlockFailed : function(blockError) {
        this._blockError = this._normalizeError(blockError);

        if(this._blockError.message.indexOf('Timed out') > -1) { // надо как-то получше отличать таймаут от реального режекта
            this.abort();
            this._blockError.message = this._blockError.message.toLowerCase();
        }

        if(!this._processBlockFailHook()) {
            this._blockRes = this._blockError = undef;
        }
    },

    _processBlockFailHook : function(error) {
        var hook = this._desc.fail,
            type = typeof hook;

        if(type === 'undefined' || type === 'boolean') {
            return hook !== false;
        }

        if(utils.isFunction(hook)) {
            return hook(error, this._ctx) !== false;
        }

        return true;
    },

    _onBlockFinalized : function() {
        this._processBlockFinHook();

        this._meta.endTime = Date.now();

        if(this._blockError) {
            this._emitEvent('failed', this._blockError);
            return { error : this._blockError };
        }

        this._emitEvent('done');
        return this._blockRes;
    },

    _processBlockFinHook : function() {
        var hook = this._desc.fin;
        hook && utils.isFunction(hook) && hook();
    },

    _updateState : function() {
        var toState = this._desc.toState;
        if(!toState) {
            return;
        }
        utils.isFunction(toState) &&
            (toState = toState(this._blockRes, this._ctx));

        var state = this._ctx.state();
        Object.keys(toState).forEach(function(name) {
            state.param(name, pointer(toState[name], this._blockRes));
        }, this);
    },

    _applyPointer : function() {
        var pointerObj = this._desc.pointer;
        if(pointerObj) {
            this._blockRes = pointer(
                utils.isFunction(pointerObj)?
                    pointerObj(this._blockRes, this._ctx) :
                    pointerObj,
                this._blockRes);
        }
    },

    _normalizeError : function(error) {
        var res = {};

        if(typeof error === 'string') {
            res.message = error;
        }
        else if(error) {
            error instanceof Error?
                res.message = error.message :
                res = error;
        }

        res.message || (res.message = 'unspecified error');

        return res;
    }
}, {
    create : function(desc, ctx, params) {
        var type;
        if(typeof desc.call === 'object') {
            type = 'object';
        }
        else if(typeof desc.call === 'string') {
            type = 'cls';
        }
        else if(utils.isFunction(desc.call)) {
            type = desc.call.length > 1? 'function' : 'object';
        }

        var cls = require('./block-runner/' + type);
        return new cls(desc, ctx, params);
    }
});