var express = require('express');

server = express.createServer();

server.get('/r/', function(req, res) {
    res.header('location', 'http://alexa.maps.dev.yandex.ru:3001/r/?a=' + (parseInt(req.param('a'), 10) + 1));
    res.send(302);
});

server.listen(3001);