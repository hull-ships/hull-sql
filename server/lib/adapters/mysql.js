/**
 * Module dependencies.
 */
import mysql from "mariadb";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";
import _ from "lodash";
import parseConnectionConfig from "../utils/parse-connection-config";
import validateResultColumns from "./validate-result-columns";

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
  return client.then((connection) => connection.end());
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
  return client.then(conn => {
    const params = { sql: `${query} LIMIT ${options.limit || 100}` };
    return conn.query(params).then((rows) => {
      const columnNames = Object.keys(rows[0]);
      const columnTypes = _.map(rows.meta, 'type');
      const columns = _.zip(columnNames, columnTypes).map(([ name, type ]) => ({ name, type }));
      return { rows, columns };
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
  return client.then((conn) => conn.queryStream(query));
}


module.exports = {
  openConnection,
  closeConnection,
  runQuery,
  validateResult,
  checkForError,
  wrapQuery,
  streamQuery
}
