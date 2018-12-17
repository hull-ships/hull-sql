/**
 * Module dependencies.
 */
import snowflake from "snowflake-sdk";
import Promise from "bluebird";
import _ from "lodash";
import parseConnectionConfig from "../utils/parse-connection-config";
import validateResultColumns from "./validate-result-columns";

/**
 * SnowFlake adapter.
 */

/**
 * Open a new connection.
 *
 * @param {Object} settings The ship settings.
 *
 */
export function openConnection(settings) {
  var connection = snowflake.createConnection({
    account: settings.db_host,
    username: settings.db_user,
    password: settings.db_password,
    region: settings.db_port,
    database: settings.db_name
  });
}

/**
 * Close the connection.
 */
export function closeConnection(client) {
  return new Promise((resolve, reject) => client.destroy((err, conn) => {
    return err ? reject(err) : resolve(conn);
  }));
}

/**
 * Validate Result specific for database
 * @returns Array of errors
 */

export function validateResult(result, import_type = "users") {
  // return validateResultColumns(result.columns.map(column => column.name), import_type);
  // TODO
}

/**
 *
 * @param error from database connector
 * @returns {{errors: Array}}
 */

export function checkForError(error) {
  console.warn("TODO: Implement checkForError");
  return false;
}

/**
 * Wrap the user query inside a SQL query.
 *
 * @param {*} sql The raw SQL query
 * @param {*} replacements The replacement parameters
 */
export function wrapQuery(sql, replacements) {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mysql");
}

/**
 * Runs the query using the specified client and options.
 * @param client The SnowFlake client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object of the following format: { rows }
 */
export function runQuery(client, query, options = {}) {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }
      client.execute({
        sqlText: `${query} LIMIT ${options.limit || 100}`,
        complete: (queryError, stmt, rows) => {
        if (queryError) {
          queryError.status = 400;
          return reject(queryError);
        }
        resolve({ rows });
      }));
    });
  });
}

/**
 * Creates a readable stream that contains the query result.
 * @param client The SnowFlake client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object that wraps a stream.
 */
export function streamQuery(client, query, options = {}) {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      client.execute({
        sqlText: query,
        streamResult: true,
        complete: (queryError, stmt, rows) => {
        if (queryError) {
          queryError.status = 400;
          return reject(queryError);
        }
        const stream = stmt.streamRows();
        resolve(stream);
      }));
    });
  });
}
