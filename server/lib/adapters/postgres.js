/**
 * Module dependencies.
 */
import Pg from "pg";
import QueryStream from "pg-query-stream";
import Promise from "bluebird";
import SequelizeUtils from "sequelize/lib/utils";
import parseConnectionConfig from "../utils/connstr-util";

/**
 * PostgreSQL adapter.
 */

/**
 * Opens a new connection.
 * @param {Object} settings The private_settings of the ship.
 *
 * @return {Pg.Client} A client instance.
 */
export function openConnection(settings: Object): Pg.Client {
  const connection_string = parseConnectionConfig(settings);
  const client = new Pg.Client(connection_string);
  return client;
}

/**
 * Closes the connection.
 * @param {Pg.Client} client The postgres client.
 */
export function closeConnection(client: Pg.Client): void {
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
  const query = SequelizeUtils.formatNamedParameters(sql, replacements, "postgres");
  return `WITH __qry__ AS (${query}) SELECT * FROM __qry__`;
}

/**
 * Cancels the query executed by the given client.
 * @param {Pg.Client} client The postgres client.
 *
 * @return {any} The postgres client that cancelled the execution, if any.
 */
function cancelQuery(client: Pg.Client): any {
  const { processID } = client;
  const c2 = new Pg.Client(client.connectionParameters);
  c2.connect((cErr) => {
    if (cErr) return false;
    c2.query(`SELECT pg_cancel_backend(${processID})`, () => {
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
export function runQuery(client: Pg.Client, query: any, options: Object = {}): Promise {
  return new Promise((resolve, reject) => {
    // Limit the result.
    query = `${query} LIMIT 100`;

    let timer;
    let currentQuery;

    if (options.timeout) {
      timer = setTimeout(() => {
        reject(new Error("Timeout error"));
        cancelQuery(client);
      }, options.timeout);
    }

    // Connect the connection.
    client.connect((connectionError) => {
      if (connectionError) {
        connectionError.status = 401;
        return reject(connectionError);
      }

      // Run the query.
      currentQuery = client.query(query, (queryError, result) => {
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
export function streamQuery(client: Pg.Client, query: any): Promise {
  return new Promise((resolve, reject) => {
    // After connecting the connection, stream the query.
    client.connect((connectionError) => {
      if (connectionError) {
        return reject(connectionError);
      }
      const stream = client.query(new QueryStream(query));
      resolve(stream);
      return stream;
    });
  });
}
