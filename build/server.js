"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = server;

var _express = require("express");

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require("body-parser");

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _uiRouter = require("hull/lib/infra/queue/ui-router");

var _uiRouter2 = _interopRequireDefault(_uiRouter);

var _devMode = require("./lib/dev-mode");

var _devMode2 = _interopRequireDefault(_devMode);

var _syncAgent = require("./lib/sync-agent");

var _syncAgent2 = _interopRequireDefault(_syncAgent);

var _checkConfMiddleware = require("./lib/check-conf-middleware");

var _checkConfMiddleware2 = _interopRequireDefault(_checkConfMiddleware);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function server(app, options) {
  var hostSecret = options.hostSecret,
      queue = options.queue,
      devMode = options.devMode;


  if (devMode) {
    app.use((0, _devMode2.default)());
  }

  app.use(_bodyParser2.default.urlencoded({ extended: true }));

  app.use("/kue", (0, _uiRouter2.default)({ hostSecret: hostSecret, queueAgent: queue }));

  app.use(function (req, res, next) {
    if (req.hull && req.hull.ship) {
      req.agent = new _syncAgent2.default(req.hull);
      return next();
    }

    return res.status(403).json({ status: "missing credentials" });
  });

  app.get("/admin.html", function (_ref, res) {
    var agent = _ref.agent;

    if (agent.areConnectionParametersSet()) {
      var query = agent.getQuery();
      res.render("connected.html", _extends({
        query: query,
        last_sync_at: null
      }, agent.ship.private_settings));
    } else {
      res.render("home.html", {});
    }
  });

  app.post("/run", (0, _checkConfMiddleware2.default)(), function (_ref2, res) {
    var body = _ref2.body,
        agent = _ref2.agent;

    var query = body.query || agent.getQuery();

    if (!query) {
      return res.status(403).json({ status: "query string empty" });
    }

    return agent.runQuery(query, { timeout: 20000 }).then(function (data) {
      return res.json(data);
    }).catch(function (_ref3) {
      var status = _ref3.status,
          message = _ref3.message;
      return res.status(status || 500).send({ message: message });
    });
  });

  app.post("/import", (0, _checkConfMiddleware2.default)({ checkQueryString: true }), function (req, res) {
    req.hull.enqueue("startImport");
    res.json({ status: "scheduled" });
  });

  app.post("/sync", (0, _checkConfMiddleware2.default)({ checkQueryString: true }), function (req, res) {
    var response = { status: "ignored" };
    if (req.agent.isEnabled()) {
      response.status = "scheduled";
      req.hull.enqueue("startSync");
    }

    res.json(response);
  });

  return app;
}