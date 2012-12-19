var path = require('path'),
    inherit = require('inherit'),
    Promise = require('jspromise'),
    utils = require('./utils'),
    pointer = require('./pointer'),
    undef;

module.exports = inherit({
    __constructor : function(desc, ctx, params) {
        this._desc = desc;
        this._ctx = params.contextFactory(ctx);
        this._params = params;
        this._meta = { id : params.path };

        this._blockPromise = undef;
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

            this._blockPromise = Promise();

            try {
                if(!this._checkGuard()) {
                    this._emitEvent('guarded');
                    return;
                }

                this._buildBlockParams();
                this._processFromCache().then(
                    this._onCacheHit.bind(this),
                    this._onCacheMissed.bind(this));
            }
            catch(e) {
                this._blockPromise.reject(e);
            }

            this._meta.params = this._blockParams;
            this._meta.timeout = this._desc.timeout || this._params.timeout;

            return Promise.timeout(
                    this._blockPromise,
                    this._meta.timeout = this._desc.timeout || this._params.timeout)
                .then(
                    this._onBlockDone.bind(this),
                    this._onBlockFailed.bind(this))
                .then(this._onBlockFinalized.bind(this));
        }
    },

    _run : function() {},

    _buildBlockParams : function() {
        this._blockParams = this._buildBlockParamsByDesc(this._desc);
    },

    _processFromCache : function() {
        var promise = Promise(),
            cacheDesc = this._desc.cache;

        cacheDesc?
            (this._blockRes = this._params.cacheFactory.create(cacheDesc.type)
                .get(this._buildCacheParams(cacheDesc), promise)) :
            promise.reject();

        return promise;
    },

    _onCacheHit : function(val) {
        this._meta.cacheHit = true;
        this._blockRes = val;
        this._blockPromise.fulfill(val);
    },

    _onCacheMissed : function() {
        this._meta.cacheHit = false;
        this._preprocess();
        this._run();
    },

    _buildCacheParams : function(cacheDesc) {
        var key = utils.isFunction(cacheDesc.key)? cacheDesc.key(this._blockParams) : cacheDesc.key;

        if(Array.isArray(key)) {
            key = key.join('\x0B');
        }
        else if(typeof key === 'object') {
            key = Object.keys(key).map(function(name) {
                return name + '_-_' + key[name];
            }).join('\x0B');
        }

        return utils.merge(cacheDesc, { key : key });
    },

    _preprocess : function() {},

    _buildBlockParamsByDesc : function(desc) {
        if(!desc.params) {
            return {};
        }

        if(utils.isFunction(desc.params)) {
            var _this = this;
            return desc.params.call(
                {
                    __base : desc.__base? // base call emulation
                        function() {
                            return _this._buildBlockParamsByDesc(desc.__base);
                        } :
                        function() {
                            return {};
                        }
                },
                _this._ctx);
        }

        return desc.params;
    },

    abort : function() {
        if(this._isRunning && !this._isAborted) {
            this._isAborted = true;
            this._blockPromise.reject('aborted');
            this._abort();
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
        var promise;
        if(typeof this._blockRes === 'undefined') {
            this._blockRes = blockRes;
            promise = this._processToCache();
        }
        else {
            promise = Promise();
            promise.fulfill();
        }

        var fn = function() {
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
            }.bind(this);

        return promise.then(fn, fn);
    },

    _processToCache : function() {
        var promise = Promise(),
            cacheDesc = this._desc.cache;

        cacheDesc?
            this._params.cacheFactory.create(cacheDesc.type)
                .set(this._blockRes, this._buildCacheParams(cacheDesc), promise) :
            promise.reject();

        return promise;
    },

    _processBlockDoneHook : function() {
        var hook = this._desc.done,
            type = typeof hook;

        if(type === 'undefined' || type === 'boolean') {
            return hook !== false;
        }

        if(utils.isFunction(hook)) {
            var promise = hook.length > 2? Promise() : undef;

            if(hook(this._blockRes, this._ctx, promise) === false) {
                return false;
            }

            return promise || true;
        }

        return true;
    },

    _onBlockFailed : function(blockError) {
        this._blockError = this._normalizeError(blockError);

        this._blockError.message === 'timed out' && this.abort(); // надо как-то получше отличать таймаут от реального режекта

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
            return { error : { message : this._blockError.toString() }};
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
        error || (error = 'unspecified error');

        return typeof error === 'string'?
            Error(error) :
            error;
    }
}, {
    create : function(desc, ctx, params) {
        try {
            desc = this._processInclude(desc, params);
        }
        catch(e) {
            desc = this._buildErrorDesc(e);
        }

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
        else {
            desc = this._buildErrorDesc(Error('undefined type of block: ' + typeof desc.call));
            type = 'function';
        }

        var cls = require('./block-runner/' + type);
        return new cls(desc, ctx, params);
    },

    _processInclude : function(desc, params) {
        if(!desc.include) {
            return desc;
        }

        var fileName, includedBlock, depth = params.maxIncludeDepth;
        while(desc.include) {
            fileName = path.normalize(path.join(params.root, desc.include));

            includedBlock = require(fileName);
            desc = utils.merge(includedBlock, desc);
            desc.__base = includedBlock;

            if(!includedBlock.include) {
                delete desc.include;
            }

            if(!--depth) {
                throw Error('includes depth (' + params.maxIncludeDepth + ') reached in file: ' + fileName);
            }
        }

        return desc;
    },

    _buildErrorDesc : function(e) {
        return {
            call : function() {
                throw e;
            }
        };
    }
});