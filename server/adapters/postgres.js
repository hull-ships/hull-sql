/**
 * Module dependencies.
 */

import Pg from "pg";
import QueryStream from "pg-query-stream";
import Promise from "bluebird";
import Query from "../util/query";


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
  return new Pg.Client(connection_string);
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


export function makeQuery(template, context = null) {
  return new Query(template, context);
}


/**
 * Wrap the user query
 * inside a PostgreSQL request.
 *
 * Params:
 *   @query String*
 *   @context Object
 *
 * Return:
 *   @wrappedQuery String
 */

export function wrapQuery(query, context) {
  if (query.isEmpty()) {
    return query.freeze();
  }

  return makeQuery(
    `WITH __qry__ AS (${query.toSql()}) 
      SELECT * FROM __qry__ ` +
      "WHERE updated_at > ${last_updated_at}",
    context
  );
}

function cancelQuery(client) {
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
 * Run a wrapped query.
 *
 * Params:
 *   @client Instance*
 *   @query Object*
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

    query.append("LIMIT 100");

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
      console.log("SQL", query.toSql());
      currentQuery = client.query(query.toSql(), (queryError, result) => {
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
      const stream = client.query(new QueryStream(query.toSql()));
      resolve(stream);
      return stream;
    });
  });
}
