"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = workerJobs;

var _hull = require("hull");

var _syncAgent = require("./lib/sync-agent");

var _syncAgent2 = _interopRequireDefault(_syncAgent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function workerJobs(connector) {
  var _this = this;

  connector.worker({
    startSync: function startSync(ctx) {
      ctx.job = _this;
      var agent = new _syncAgent2.default(ctx);
      return agent.startSync();
    },
    startImport: function startImport(ctx) {
      ctx.job = _this;
      var agent = new _syncAgent2.default(ctx);
      return agent.startImport();
    }
  });
  return connector;
}