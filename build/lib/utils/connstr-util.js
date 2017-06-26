"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.parseConnectionConfig = parseConnectionConfig;

var _urijs = require("urijs");

var _urijs2 = _interopRequireDefault(_urijs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function parseConnectionConfig(settings) {
  var conn = ["type", "host", "port", "name", "user", "password"].reduce(function (c, key) {
    var val = settings["db_" + key];
    if (key === "type" && val === "redshift") val = "postgres";
    if (c && val && val.length > 0) {
      return _extends({}, c, _defineProperty({}, key, val));
    }
    return false;
  }, {});
  if (conn) {
    var uri = (0, _urijs2.default)().protocol(conn.type).username(conn.user).password(conn.password).host(conn.host).port(conn.port).path(conn.name);

    if (settings.db_options) {
      return uri.query(settings.db_options).toString();
    }
    return uri.toString();
  }

  return false;
}

exports.default = parseConnectionConfig;