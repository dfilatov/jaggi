module.exports = {

    merge : function() {

        var res = {};

        for(var i = 0, len = arguments.length; i < len; i++) {
            var obj = arguments[i];
            if(obj) {
                for(var name in obj) {
                    obj.hasOwnProperty(name) && (res[name] = obj[name]);
                }
            }
        }

        return res;

    }

};