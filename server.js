var http = require('http');
var express = require('express');
var app = express();

app.use('/', express.static(__dirname + '/web'));
app.listen(8080, function() { console.log('listening')});

