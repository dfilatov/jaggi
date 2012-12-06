module.exports = {
    blocks : {
        'trends' : {
            params : {
                url : 'https://api.twitter.com/1/trends/1.json'
            },
            call : 'http',
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
            timeout : 10000,
            params : function(ctx) {
                return { trends : ctx.state('trends') };
            },
            call : function(params) {
                var subBlocks = {};
                params.trends.forEach(function(trend) {
                    subBlocks[trend.name] = {
                        params : {
                            url  : 'http://search.twitter.com/search.json',
                            data : { q : trend.query }
                        },
                        call : 'http',
                        pointer : '.results[:3].text'
                    }
                });
                return subBlocks;
            }
        }
    }
};
