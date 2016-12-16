"use strict";

/* eslint global-require: 0 */
if (process.env.NEW_RELIC_LICENSE_KEY) {
  console.warn("Starting newrelic agent with key: ", process.env.NEW_RELIC_LICENSE_KEY);
  require("newrelic");
}

var Hull = require("hull");
var Server = require("./server");

var PORT = process.env.PORT || 8082;

if (process.env.LOG_LEVEL) {
  Hull.logger.transports.console.level = process.env.LOG_LEVEL;
}

var options = {
  Hull: Hull,
  hostSecret: process.env.SECRET || "1234",
  devMode: process.env.NODE_ENV === "development"
};

var app = Server(options);

console.log("Listening on port " + PORT);
app.listen(PORT);