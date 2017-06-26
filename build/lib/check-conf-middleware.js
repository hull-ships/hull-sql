"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = checkConfigurationFactory;
function checkConfigurationFactory() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$checkQueryString = _ref.checkQueryString,
      checkQueryString = _ref$checkQueryString === undefined ? false : _ref$checkQueryString;

  return function checkConfigurationMiddleware(_ref2, res, next) {
    var hull = _ref2.hull,
        agent = _ref2.agent;

    if (!agent.areConnectionParametersSet()) {
      hull.client.logger.error("connection string not configured");
      return res.status(403).json({ status: "connection string not configured" });
    }

    if (checkQueryString && !agent.isQueryStringConfigured()) {
      hull.client.logger.error("query string not configured");
      return res.status(403).json({ status: "query string not configured" });
    }

    return next();
  };
}