"use strict";

var _hull = require("hull");

var _hull2 = _interopRequireDefault(_hull);

var _express = require("express");

var _express2 = _interopRequireDefault(_express);

var _awsSdk = require("aws-sdk");

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _infra = require("hull/lib/infra");

var _server = require("./server");

var _server2 = _interopRequireDefault(_server);

var _worker = require("./worker");

var _worker2 = _interopRequireDefault(_worker);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var hostSecret = process.env.SECRET;
var port = process.env.PORT || 8082;
var devMode = process.env.NODE_ENV === "development";

var app = (0, _express2.default)();

_awsSdk2.default.config.update({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

if (process.env.LOG_LEVEL) {
  _hull2.default.logger.transports.console.level = process.env.LOG_LEVEL;
}

var cache = new _infra.Cache({
  store: "memory",
  ttl: 1
});

var queue = new _infra.Queue("bull", {
  prefix: process.env.KUE_PREFIX || "hull-sql",
  redis: process.env.REDIS_URL
});

var connector = new _hull2.default.Connector({
  hostSecret: hostSecret,
  port: port,
  cache: cache,
  queue: queue
});

connector.setupApp(app);

if (process.env.COMBINED || process.env.WORKER) {
  (0, _worker2.default)(connector);
  connector.startWorker();
}

if (process.env.COMBINED || process.env.SERVER) {
  (0, _server2.default)(app, { hostSecret: hostSecret, queue: queue, devMode: devMode });
  connector.startApp(app);
}