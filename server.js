"use strict";

var http = require("http");
var httpProxy = require("http-proxy");
var qs = require("querystring");
var url = require("url");
var FifoArray = require("fifo-array");
var express = require("express");
var minimist = require("minimist");

/* Defaults
 * endpoint: http://localhost:8890
 **/

var argv = minimist(process.argv.slice(2));
var endpoint = argv.endpoint || "http://localhost:8890";
console.log("Commandline arguments: ", argv);


var logArray = new FifoArray(20);


var proxy = httpProxy.createProxyServer({});


var serverSparql = http.createServer(function (req, res) {
    var url_parts = url.parse(req.url, true);
    var query_params = url_parts.query;

    req.time = new Date();
    if (query_params.query) {
        req.query = query_params.query;
    } else {
        var body = [];
        req.on("data", function (chunk) {
            body.push(chunk);
        }).on("end", function () {
            body = Buffer.concat(body).toString();
            req.query = qs.parse(body).query;
        });
    }

    if (req.query) {
        var sparqlLogEntry = {
            "url": req.url,
            "destinationUrl": endpoint,
            "method": req.method,
            "host": req.headers.host,
            "userAgent": req.headers["user-agent"],
            "headers": req.headers,
            "time": Date.now(),
            "query": req.query,
            "client": req.headers["x-forwarded-for"] ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    req.connection.socket.remoteAddress
        };
        
        logArray.push(sparqlLogEntry);
        emitRequest(sparqlLogEntry);
        console.log("New SPARQL request", sparqlLogEntry);

    }

    proxy.web(req, res, {
        target: endpoint        
    });

}).listen(5050);
console.log("SPARQL proxy listening on", serverSparql.address());


var app = express();
var serverLog = app.listen(5060);
app.use(function (req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.get("/", function (req, res) {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.write(JSON.stringify(logArray, null, 2));
    res.end();
});

var io = require("socket.io").listen(serverLog);
io.sockets.on("connection", function (socket) {
    console.log("Client connected", socket.client.id);
});
var emitRequest = function (data) {
    io.emit("request", data);
};

console.log("SPARQL statistics listening on", serverLog.address());


