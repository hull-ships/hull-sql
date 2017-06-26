"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openConnection = openConnection;
exports.closeConnection = closeConnection;
exports.wrapQuery = wrapQuery;
exports.runQuery = runQuery;
exports.streamQuery = streamQuery;

var _pg = require("pg");

var _pg2 = _interopRequireDefault(_pg);

var _pgQueryStream = require("pg-query-stream");

var _pgQueryStream2 = _interopRequireDefault(_pgQueryStream);

var _bluebird = require("bluebird");

var _bluebird2 = _interopRequireDefault(_bluebird);

var _utils = require("sequelize/lib/utils");

var _utils2 = _interopRequireDefault(_utils);

var _connstrUtil = require("../utils/connstr-util");

var _connstrUtil2 = _interopRequireDefault(_connstrUtil);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * PostgreSQL adapter.
 */

/**
 * Opens a new connection.
 * @param {Object} settings The private_settings of the ship.
 *
 * @return {Pg.Client} A client instance.
 */
function openConnection(settings) {
  var connection_string = (0, _connstrUtil2.default)(settings);
  var client = new _pg2.default.Client(connection_string);
  return client;
}

/**
 * Closes the connection.
 * @param {Pg.Client} client The postgres client.
 */
/**
 * Module dependencies.
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
  var query = _utils2.default.formatNamedParameters(sql, replacements, "postgres");
  return "WITH __qry__ AS (" + query + ") SELECT * FROM __qry__";
}

/**
 * Cancels the query executed by the given client.
 * @param {Pg.Client} client The postgres client.
 *
 * @return {any} The postgres client that cancelled the execution, if any.
 */
function cancelQuery(client) {
  var processID = client.processID;

  var c2 = new _pg2.default.Client(client.connectionParameters);
  c2.connect(function (cErr) {
    if (cErr) return false;
    c2.query("SELECT pg_cancel_backend(" + processID + ")", function () {
      c2.end();
    });
    return c2;
  });
}

/**
 * Runs the wrapped query
 * @param {Pg.Client} client The postgres client.
 * @param {any} query The wrapped query.
 * @param {Object} options Additional options to run the query. Optional.
 *
 * @return {Promise} A bluebird promise that returns the thenable result: { rows: Object[] }.
 */
function runQuery(client, query) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  return new _bluebird2.default(function (resolve, reject) {
    // Limit the result.
    query = query + " LIMIT 100";

    var timer = void 0;
    var currentQuery = void 0;

    if (options.timeout) {
      timer = setTimeout(function () {
        reject(new Error("Timeout error"));
        cancelQuery(client);
      }, options.timeout);
    }

    // Connect the connection.
    client.connect(function (connectionError) {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      // Run the query.
      currentQuery = client.query(query, function (queryError, result) {
        if (timer) clearTimeout(timer);
        client.end();
        if (queryError) {
          queryError.status = 400;
          return reject(queryError);
        }
        return resolve(result);
      });

      return currentQuery;
    });
  });
}

/**
 * Streams a wrapped query.
 * @param {Pg.Client} client The postgres client.
 * @param {any} query The wrapped query.
 *
 * @return {Promise{Stream}} A promise that returns a Stream as thenable result.
 */
function streamQuery(client, query) {
  return new _bluebird2.default(function (resolve, reject) {
    // After connecting the connection, stream the query.
    client.connect(function (connectionError) {
      if (connectionError) {
        return reject(connectionError);
      }
      var stream = client.query(new _pgQueryStream2.default(query));
      resolve(stream);
      return stream;
    });
  });
}