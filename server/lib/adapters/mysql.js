// @flow
/**
 * Module dependencies.
 */
import mysql from "mysql";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";
import parseConnectionConfig from "../utils/connstr-util";

/**
 * mySQL adapter.
 */

/**
 * Opens a new connection.
 * @param {Object} settings The private_settings of the ship.
 *
 * @return {mqsql.IConnection} A client instance.
 */
export function openConnection(settings: Object): mysql.IConnection {
  const connection_string = parseConnectionConfig(settings);
  return mysql.createConnection(connection_string);
}

/**
 * Closes the connection.
 * @param {mysql.IConnection} client The MySQL client instance to close.
 */
export function closeConnection(client: mysql.IConnection): void {
  client.end();
}

/**
 * Wraps the user query into a MySql request.
 * @param {any} sql The raw SQL query
 * @param {any} replacements The replacement parameters
 *
 * @return {any} The wrapped request.
 */
export function wrapQuery(sql: any, replacements: any): any {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mysql");
}

/**
 * Runs the wrapped query
 * @param {mysql.Iconnection} client The MySQL client.
 * @param {any} query The wrapped query.
 * @param {Object} options Additional options to run the query. Optional.
 *
 * @return {Promise} A bluebird promise that returns the thenable result: { rows: Object[] }.
 */
export function runQuery(client: mysql.IConnection, query: any, options: Object = {}): Promise {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      const params: Object = {
        sql: `${query} LIMIT 100`
      };

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
        return resolve({
          rows
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
export function streamQuery(client: mysql.Iconnection, query: any, options: Object = {}): Promise {
  return new Promise((resolve, reject) => {
    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      const params: Object = {
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
