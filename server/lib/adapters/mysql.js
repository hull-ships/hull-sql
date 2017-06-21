/**
 * Module dependencies.
 */
import mysql from "mysql";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";

/**
 * mySQL adapter.
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

export function openConnection(connection_string) {
  return mysql.createConnection(connection_string);
}

/**
 * Close the connection.
 *
 * Params:
 *   @client Instance
 */

export function closeConnection(client) {
  client.end();
}

/**
 * Wrap the user query
 * inside a mySQL request.
 *
 * Params:
 *   @query String*
 *   @last_updated_at String
 *
 * Return:
 *   @wrappedQuery String
 */

export function wrapQuery(sql, replacements) {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mysql");
}

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

export function streamQuery(client, query, options = {}) {
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
      return resolve(client.query(params).stream({ highWaterMark: 10 }));
    });
  });
}

