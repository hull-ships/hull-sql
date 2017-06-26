"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; // @Flow

/**
 * Module dependencies.
 */


exports.openConnection = openConnection;
exports.closeConnection = closeConnection;
exports.wrapQuery = wrapQuery;
exports.runQuery = runQuery;
exports.streamQuery = streamQuery;

var _tedious = require("tedious");

var _tedious2 = _interopRequireDefault(_tedious);

var _bluebird = require("bluebird");

var _bluebird2 = _interopRequireDefault(_bluebird);

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _readableStream = require("readable-stream");

var _readableStream2 = _interopRequireDefault(_readableStream);

var _utils = require("sequelize/lib/utils");

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * MS SQL adapter.
 */

function parseConnectionConfig(settings) {
  var conn = ["type", "host", "port", "name", "user", "password"].reduce(function (c, key) {
    var val = settings["db_" + key];
    if (c && val && val.length > 0) {
      return _extends({}, c, _defineProperty({}, key, val));
    }
    return false;
  }, {});
  // Must-have options
  var opts = {
    port: conn.port || 1433,
    database: conn.name
  };
  // All additional options are optional
  if (settings.db_options) {
    try {
      var customOptions = JSON.parse(settings.db_options);
      if (customOptions) {
        opts = _lodash2.default.merge(opts, customOptions);
      }
    } catch (parseError) {
      this.hull.logger.error("config.error", parseError);
    }
  }

  var config = {
    userName: conn.user,
    password: conn.password,
    server: conn.host,
    options: opts
  };

  return config;
}

/**
 * Open a new connection.
 *
 * @param {Object} settings The ship settings.
 *
 * @return {tedious.Connection} The tedious.Connection instance
 */
function openConnection(settings) {
  var config = parseConnectionConfig(settings);
  return new _tedious2.default.Connection(config);
}

/**
 * Close the connection.
 *
 * @param {tedious.Connection} client
 */
function closeConnection(client) {
  client.close();
}

/**
 * Wrap the user query inside a MS SQL request.
 *
 * @param {*} sql The raw SQL query
 * @param {*} replacements The replacement parameters
 */
function wrapQuery(sql, replacements) {
  return _utils2.default.formatNamedParameters(sql, replacements, "mssql");
}

/**
 * Runs the query using the specified client and options.
 * @param {tedious.Connection} client The MS SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object.
 */
function runQuery(client, query, options) {
  return new _bluebird2.default(function (resolve, reject) {
    var confoptions = _lodash2.default.merge(client.config.options, options);
    var conf = _lodash2.default.cloneDeep(client.config);
    conf.options = confoptions;

    var conn = new _tedious2.default.Connection(conf);

    conn.on("connect", function (err) {
      // eslint-disable-line consistent-return
      if (err) {
        return reject(err);
      }

      var qparam = "WITH __qry__ AS (" + query + ") SELECT TOP(100) * FROM __qry__";

      var request = new _tedious2.default.Request(qparam, function (reqError) {
        // eslint-disable-line consistent-return
        if (reqError) {
          return reject(reqError);
        }
      });

      var rows = [];
      var resultReturned = false;

      request.on("row", function (columns) {
        var row = {};
        _lodash2.default.forEach(columns, function (column) {
          row[column.metadata.colName] = column.value;
        });
        rows.push(row);
      });

      request.on("done", function (rowCount) {
        // eslint-disable-line consistent-return
        if (_lodash2.default.isNumber(rowCount) && !resultReturned) {
          resultReturned = true;
          return resolve({
            rows: rows
          });
        }
      });

      request.on("doneInProc", function (rowCount) {
        // eslint-disable-line consistent-return
        if (_lodash2.default.isNumber(rowCount) && !resultReturned) {
          resultReturned = true;
          return resolve({
            rows: rows
          });
        }
      });

      request.on("doneProc", function (rowCount) {
        // eslint-disable-line consistent-return
        if (_lodash2.default.isNumber(rowCount) && !resultReturned) {
          resultReturned = true;
          return resolve({
            rows: rows
          });
        }
      });

      conn.execSql(request);
    });
  });
}

/**
 * Creates a readable stream that contains the query result.
 * @param {tedious.Connection} client The MS SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object.
 */
function streamQuery(client, query, options) {
  return new _bluebird2.default(function (resolve, reject) {
    var confoptions = _lodash2.default.merge(client.config.options, options);
    var conf = _lodash2.default.cloneDeep(client.config);
    conf.options = confoptions;
    var conn = new _tedious2.default.Connection(conf);

    var streamOpts = {};
    streamOpts.ObjectMode = true;
    streamOpts.highWaterMark = 10;
    var stream = new _readableStream2.default(streamOpts);

    var resultReturned = false;

    stream._read = function () {
      // eslint-disable-line func-names
      conn.on("connect", function (err) {
        // eslint-disable-line consistent-return
        if (err) {
          stream.emit("error", err);
          return reject(err);
        }

        var request = new _tedious2.default.Request(query, function (reqError) {
          // eslint-disable-line consistent-return
          if (reqError) {
            stream.emit("error", reqError);
            return reject(reqError);
          }
        });

        request.on("row", function (columns) {
          var row = {};
          _lodash2.default.forEach(columns, function (column) {
            row[column.metadata.colName] = column.value;
          });
          stream.push(JSON.stringify(row));
        });

        request.on("done", function (rowCount) {
          // eslint-disable-line consistent-return
          if (_lodash2.default.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        request.on("doneInProc", function (rowCount) {
          // eslint-disable-line consistent-return
          if (_lodash2.default.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        request.on("doneProc", function (rowCount) {
          // eslint-disable-line consistent-return
          if (_lodash2.default.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        conn.execSql(request);
      });
    };

    stream.once("end", function () {
      process.nextTick(function () {
        stream.emit("close");
      });
    });
    return resolve(stream);
  });
}