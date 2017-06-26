"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openConnection = openConnection;
exports.closeConnection = closeConnection;
exports.wrapQuery = wrapQuery;
exports.cancelQuery = cancelQuery;
exports.runQuery = runQuery;
exports.streamQuery = streamQuery;
exports.upload = upload;

var _bluebird = require("bluebird");

var _bluebird2 = _interopRequireDefault(_bluebird);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _JSONStream = require("JSONStream");

var _JSONStream2 = _interopRequireDefault(_JSONStream);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * File system adapter.
 */

/**
 * Open a new connection.
 *
 * Params:
 *   @connection_string String*
 *
 * Return:
 *   @client Instance
 */

function openConnection() {}

/**
 * Close the connection.
 *
 * Params:
 *   @client Instance
 */

/**
 * Module dependencies.
 */

function closeConnection() {}

/**
 * Wrap the user query
 * inside a PostgreSQL request.
 *
 * Params:
 *   @query String*
 *   @last_updated_at String
 *
 * Return:
 *   @wrappedQuery String
 */

function wrapQuery(query) {
  return query;
}

function cancelQuery() {}

/**
 * Run a wrapped query.
 *
 * Params:
 *   @client Instance*
 *   @wrappedQuery String*
 *   @callback Function*
 *
 * Return:
 *   @callback Function
 *     - @error Object
 *     - @rows Array
 */

function runQuery(client) {
  var query = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  return new _bluebird2.default(function (resolve) {
    var file = _fs2.default.readFileSync(query, { encoding: "utf8" });
    resolve({ rows: file });
  });
}

/**
 * Stream a wrapped query.
 *
 * Params:
 *   @client Instance*
 *   @wrappedQuery String*
 *   @callback Function*
 *
 * Return:
 *   @callback Function
 *     - @error Object
 *     - @stream Stream
 */

function streamQuery(client, query) {
  return new _bluebird2.default(function (resolve) {
    var stream = _fs2.default.createReadStream(query).pipe(_JSONStream2.default.parse());
    resolve(stream);
    return stream;
  });
}

function upload(users, shipId, partNumber) {
  var data = users.map(function (user) {
    return JSON.stringify(user);
  }).join("\n");
  return new _bluebird2.default(function (resolve, reject) {
    var filename = "tests/extracts/" + new Date().getTime() + "-" + partNumber + ".json";
    _fs2.default.writeFile(filename, data, function (err) {
      if (err) {
        return reject(err);
      }
      return resolve({ url: "http://fake.url/" + filename, partNumber: partNumber, size: users.length });
    });
  });
}