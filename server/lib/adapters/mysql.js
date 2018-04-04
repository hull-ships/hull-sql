/**
 * Module dependencies.
 */
const mysql = require("mysql");
const Promise = require("bluebird");
const SequelizeUtils = require("sequelize/lib/utils");
const _ = require("lodash");

const parseConnectionConfig = require("../utils/parse-connection-config");
const validateResultColumns = require("./validate-result-columns");

/**
 * mySQL adapter.
 */

/**
 * Open a new connection.
 *
 * @param {Object} settings The ship settings.
 *
 * @return {mysql.IConnection} A mysql connection instance
 */
function openConnection(settings) {
  const connection_string = parseConnectionConfig(settings);
  return mysql.createConnection(connection_string);
}

/**
 * Close the connection.
 *
 * @param {mysql.IConnection} client The mysql client
 */
function closeConnection(client) {
  client.end();
}

function cancelQuery(client) {
  closeConnection(client);
}

/**
 * Validate Result specific for mysql database
 * @returns Array of errors
 */

function validateResult(result, import_type = "users") {
  return validateResultColumns(result.columns.map(column => column.name), import_type);
}

/**
 *
 * @param error from database connector
 * @returns {{errors: Array}}
 */

function checkForError(error) {
  if (error && error.code === "ER_PARSE_ERROR") {
    return { message: `Invalid Syntax: ${_.get(error, "sqlMessage", "")}` };
  }

  if (error && (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND")) {
    return { message: `Server Error: ${_.get(error, "message", "")}` };
  }
  return false;
}

/**
 * Wrap the user query inside a My SQL request.
 *
 * @param {*} sql The raw SQL query
 * @param {*} replacements The replacement parameters
 */
function wrapQuery(sql, replacements) {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mysql");
}

/**
 * Runs the query using the specified client and options.
 * @param {mysql.IConnection} client The My SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object of the following format: { rows }
 */
function runQuery(client, query, options = {}) {
  let connectionTimeout;
  let queryTimeout;

  return new Promise((resolve, reject) => {
    if (options.connectionTimeout) {
      connectionTimeout = setTimeout(() => {
        reject(new Error("Connection Timeout"));
        cancelQuery(client);
      }, options.connectionTimeout);
    }
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }
      if (options.queryTimeout) {
        queryTimeout = setTimeout(() => {
          reject(new Error("Query Timeout"));
          cancelQuery(client);
        }, options.queryTimeout);
      }

      const params = { sql: `${query} LIMIT ${options.limit || 100}` };

      if (options.timeout && options.timeout > 0) {
        params.timeout = options.timeout;
      }

      // Run the query.
      return client.query(params, (queryError, rows, fieldPackets) => {
        if (queryTimeout) {
          clearTimeout(queryTimeout);
        }
        if (queryError) {
          queryError.status = 400;
          return reject(queryError);
        }
        return resolve({ rows, columns: fieldPackets });
      });
    });
  });
}

/**
 * Creates a readable stream that contains the query result.
 * @param {mysql.IConnection} client The My SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object that wraps a stream.
 */
function streamQuery(client, query, options = {}) {
  let connectionTimeout;
  let queryTimeout;

  return new Promise((resolve, reject) => {
    if (options.connectionTimeout) {
      connectionTimeout = setTimeout(() => {
        reject(new Error("Connection Timeout"));
        cancelQuery(client);
      }, options.connectionTimeout);
    }
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      const params = { sql: query };

      if (options.timeout && options.timeout > 0) {
        params.timeout = options.timeout;
      }
      const stream = client.query(params).stream({ highWaterMark: 10 });
      if (options.queryTimeout) {
        queryTimeout = setTimeout(() => {
          stream.emit("error", new Error("Query Timeout"));
          cancelQuery(client);
        }, options.queryTimeout);
      }

      stream.on("end", () => {
        if (queryTimeout) {
          clearTimeout(queryTimeout);
        }
        client.end();
      });
      // Run the query.
      return resolve(stream);
    });
  });
}


module.exports = {
  parseConnectionConfig,
  openConnection,
  closeConnection,
  wrapQuery,
  validateResult,
  checkForError,
  runQuery,
  streamQuery
};
