/**
 * Module dependencies.
 */
import mysql from "mysql";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";
import parseConnectionConfig from "../utils/parse-connection-config";

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
export function openConnection(settings) {
  const connection_string = parseConnectionConfig(settings);
  return mysql.createConnection(connection_string);
}

/**
 * Close the connection.
 *
 * @param {mysql.IConnection} client The mysql client
 */
export function closeConnection(client) {
  client.end();
}

/**
 * Validate Result specific for mysql database
 * @returns Array of errors
 */

export function validateResult() {
  return [];
}

/**
 * Wrap the user query inside a My SQL request.
 *
 * @param {*} sql The raw SQL query
 * @param {*} replacements The replacement parameters
 */
export function wrapQuery(sql, replacements) {
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
export function runQuery(client, query, options = {}) {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      const params = { sql: `${query} LIMIT 100` };

      if (options.timeout && options.timeout > 0) {
        params.timeout = options.timeout;
      }

      // Run the query.
      return client.query(params, (queryError, rows) => {
        client.end();
        if (queryError) {
          queryError.status = 400;
          return reject(queryError);
        }
        return resolve({ rows });
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
export function streamQuery(client, query, options = {}) {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      const params = { sql: query };

      if (options.timeout && options.timeout > 0) {
        params.timeout = options.timeout;
      }

      // Run the query.
      return resolve(client.query(params).stream({ highWaterMark: 10 }));
    });
  });
}

