"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mssql = exports.s3 = exports.filesystem = exports.postgres = exports.redshift = exports.mysql = undefined;

var _postgres = require("./postgres");

var postgres = _interopRequireWildcard(_postgres);

var _mysql = require("./mysql");

var mysql = _interopRequireWildcard(_mysql);

var _filesystem = require("./filesystem");

var filesystem = _interopRequireWildcard(_filesystem);

var _s = require("./s3");

var s3 = _interopRequireWildcard(_s);

var _mssql = require("./mssql");

var mssql = _interopRequireWildcard(_mssql);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var redshift = postgres;

exports.mysql = mysql;
exports.redshift = redshift;
exports.postgres = postgres;
exports.filesystem = filesystem;
exports.s3 = s3;
exports.mssql = mssql;