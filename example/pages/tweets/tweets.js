module.exports = {
    blocks : {
        call : {
            'trends' : {
                include : 'includes/trends.js',
                toState : function(_, ctx) {
                    return {
                        trends : '.trends[:' + (ctx.request('limit') || 3)  + ']'
                    };
                },
                done : false
            },

            'tweets' : {
                deps : 'trends',
                guard : 'trends',
                timeout : 1000,
                params : function(ctx) {
                    return { trends : ctx.state('trends') };
                },
                call : function(params) {
                    var subBlocks = {};
                    params.trends.forEach(function(trend) {
                        subBlocks[trend.name] = {
                            include : 'includes/tweets.js',
                            params : function() {
                                var res = this.__base();
                                res.data = { q : trend.query };
                                return res;
                            },
                            pointer : '.results[:3].text'
                        }
                    });
                    return subBlocks;
                }
            }
        }
    }
};
