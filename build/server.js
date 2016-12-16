"use strict";

var _express = require("express");

var _express2 = _interopRequireDefault(_express);

var _bodyParser = require("body-parser");

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _devMode = require("./dev-mode");

var _devMode2 = _interopRequireDefault(_devMode);

var _ejs = require("ejs");

var _ejs2 = _interopRequireDefault(_ejs);

var _syncAgent = require("./sync-agent");

var _syncAgent2 = _interopRequireDefault(_syncAgent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = function server() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var Hull = options.Hull,
      hostSecret = options.hostSecret;
  var Routes = Hull.Routes,
      hullClient = Hull.Middleware;
  var Readme = Routes.Readme,
      Manifest = Routes.Manifest;

  var app = (0, _express2.default)();

  if (options.devMode) {
    app.use((0, _devMode2.default)());
  }

  app.engine("html", _ejs2.default.renderFile);
  app.set("views", _path2.default.resolve(__dirname, "..", "views"));
  app.use(_express2.default.static(_path2.default.resolve(__dirname, "..", "dist")));
  app.use(_express2.default.static(_path2.default.resolve(__dirname, "..", "assets")));

  app.use(_bodyParser2.default.json());
  app.use(_bodyParser2.default.urlencoded({ extended: true }));

  app.get("/manifest.json", Manifest(__dirname));
  app.get("/", Readme);
  app.get("/readme", Readme);

  app.get("/admin.html", hullClient({ hostSecret: hostSecret, fetchShip: false }), function (req, res) {
    var config = req.hull.config;


    var hull = new Hull({
      id: req.query.ship,
      secret: req.query.secret,
      organization: req.query.organization
    });

    hull.get(req.query.ship).then(function (shipConfig) {

      if (shipConfig.private_settings.connection_string) {
        res.render("connected.html", {
          last_sync_at: shipConfig.private_settings.last_sync_at,
          db_type: shipConfig.private_settings.db_type,
          query: shipConfig.private_settings.query
        });
      } else {
        res.render("home.html", {});
      }
    });
  });

  app.post('/run', hullClient({ hostSecret: hostSecret, fetchShip: false }), function (req, res) {
    var settings = {
      id: req.query.ship,
      secret: req.query.secret,
      organization: req.query.organization
    };

    var hull = new Hull(settings);

    hull.get(settings.id).then(function (ship) {
      var query = req.body.query || ship.private_settings.query;
      var agent = new _syncAgent2.default(ship, hull);

      agent.runQuery(ship.private_settings.connection_string, query, function (err, data) {
        if (err) {
          Hull.logger.error(err);
          return res.json(err);
        } else {
          Hull.logger.info(data);
          return res.json(data);
        }
      });
    }).catch(function (err) {
      Hull.logger.error(err);
      return res.json(err);
    });
  });

  app.post('/import', hullClient({ hostSecret: hostSecret, fetchShip: false }), function (req, res) {
    var settings = {
      id: req.query.ship,
      secret: req.query.secret,
      organization: req.query.organization
    };

    var last_sync_at = void 0;
    if (req.query.incremental) {
      last_sync_at = ship.private_settings.last_sync_at;
    }

    var hull = new Hull(settings);

    hull.get(settings.id).then(function (ship) {
      var query = ship.private_settings.query;
      var agent = new _syncAgent2.default(ship, hull);

      agent.streamQuery(ship.private_settings.connection_string, query, last_sync_at, function (err, result) {
        if (err) {
          Hull.logger.error(err);
          return res.json(err);
        } else {
          Hull.logger.info(result);
          return res.json(result);
        }
      });
    }).catch(function (err) {
      Hull.logger.error(err);
      return res.json(err);
    });
  });

  // Error Handler
  app.use(function (err, req, res, next) {
    // eslint-disable-line no-unused-vars
    if (err) {
      var data = {
        status: err.status,
        segmentBody: req.segment,
        method: req.method,
        headers: req.headers,
        url: req.url,
        params: req.params
      };
      console.log("Error ----------------", err.message, err.status, data);
      console.log(err.stack);
    }

    return res.status(err.status || 500).send({ message: err.message });
  });

  return app;
};