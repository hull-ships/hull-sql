"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = devMode;

var _webpackDevMiddleware = require("webpack-dev-middleware");

var _webpackDevMiddleware2 = _interopRequireDefault(_webpackDevMiddleware);

var _webpack = require("webpack");

var _webpack2 = _interopRequireDefault(_webpack);

var _webpackConfig = require("../../webpack.config.js");

var _webpackConfig2 = _interopRequireDefault(_webpackConfig);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function devMode() {
  var compiler = (0, _webpack2.default)(_webpackConfig2.default);
  return (0, _webpackDevMiddleware2.default)(compiler, {
    publicPath: _webpackConfig2.default.output.publicPath,
    contentBase: "src",
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false
    }
  });
}