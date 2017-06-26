"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openConnection = openConnection;
exports.closeConnection = closeConnection;
exports.wrapQuery = wrapQuery;
exports.runQuery = runQuery;
exports.streamQuery = streamQuery;

var _mysql = require("mysql");

var _mysql2 = _interopRequireDefault(_mysql);

var _bluebird = require("bluebird");

var _bluebird2 = _interopRequireDefault(_bluebird);

var _utils = require("sequelize/lib/utils");

var _utils2 = _interopRequireDefault(_utils);

var _connstrUtil = require("../utils/connstr-util");

var _connstrUtil2 = _interopRequireDefault(_connstrUtil);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * mySQL adapter.
 */

/**
 * Opens a new connection.
 * @param {Object} settings The private_settings of the ship.
 *
 * @return {mqsql.IConnection} A client instance.
 */

/**
 * Module dependencies.
 */
function openConnection(settings) {
  var connection_string = (0, _connstrUtil2.default)(settings);
  return _mysql2.default.createConnection(connection_string);
}

/**
 * Closes the connection.
 * @param {mysql.IConnection} client The MySQL client instance to close.
 */
function closeConnection(client) {
  client.end();
}

/**
 * Wraps the user query into a MySql request.
 * @param {any} sql The raw SQL query
 * @param {any} replacements The replacement parameters
 *
 * @return {any} The wrapped request.
 */
function wrapQuery(sql, replacements) {
  return _utils2.default.formatNamedParameters(sql, replacements, "mysql");
}

/**
 * Runs the wrapped query
 * @param {mysql.Iconnection} client The MySQL client.
 * @param {any} query The wrapped query.
 * @param {Object} options Additional options to run the query. Optional.
 *
 * @return {Promise} A bluebird promise that returns the thenable result: { rows: Object[] }.
 */
function runQuery(client, query) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  return new _bluebird2.default(function (resolve, reject) {
    // Connect the connection.
    client.connect(function (connectionError) {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      var params = {
        sql: query + " LIMIT 100"
      };

      if (options.timeout && options.timeout > 0) {
        params.timeout = options.timeout;
      }

      // Run the query.
      return client.query(params, function (queryError, rows) {
        client.end();
        if (queryError) {
          queryError.status = 400;
          return reject(queryError);
        }
        return resolve({
          rows: rows
        });
      });
    });
  });
}

/**
 * Streams a wrapped query.
 * @param {mysql.Iconnection} client The MySQL client.
 * @param {any} query The wrapped query.
 * @param {Object} options Additional options to run the query. Optional.
 *
 * @return {Promise{Stream}} A promise that returns a Stream as thenable result.
 */
function streamQuery(client, query) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  return new _bluebird2.default(function (resolve, reject) {
    // Connect the connection.
    client.connect(function (connectionError) {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      var params = {
        sql: query
      };

      if (options.timeout && options.timeout > 0) {
        params.timeout = options.timeout;
      }
      // Run the query.
      return resolve(client.query(params).stream({
        highWaterMark: 10
      }));
    });
  });
}