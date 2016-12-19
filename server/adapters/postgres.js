/**
 * Module dependencies.
 */

import Pg from "pg";
import QueryStream from "pg-query-stream";
import Promise from "bluebird";
/**
 * PostgreSQL adapter.
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
  const client = new Pg.Client(connection_string);
  return client;
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
 * inside a PostgreSQL request.
 *
 * Params:
 *   @query String*
 *   @last_sync_at String
 *
 * Return:
 *   @wrappedQuery String
 */

export function wrapQuery(query, last_sync_at) {
  // Wrap the query.
  const wrappedQuery = `WITH __qry__ AS (${query}) SELECT * FROM __qry__`;

  // Add a condition if needed.
  if (last_sync_at) {
    return `${wrappedQuery} AND updated_at >= '${last_sync_at}'`;
  }

  return wrappedQuery;
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
    // Limit the result.
    query = `${query} LIMIT 100`;

    let timer;
    let currentQuery;

    if (options.timeout) {
      timer = setTimeout(() => {
        reject(new Error("Timeout error"));
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

export function streamQuery(client, query) {
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

