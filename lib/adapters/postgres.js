/**
 * Module dependencies.
 */

const Pg = require('pg');
const QueryStream = require('pg-query-stream');

/**
 * PostgreSQL adapter.
 */

module.exports = {

  /**
   * Open a new connection.
   *
   * Params:
   *   @connection_string String*
   *
   * Return:
   *   @client Instance
   */

  openConnection(connection_string) {
    const client = new Pg.Client(connection_string);
    return client;
  },

  /**
   * Close the connection.
   *
   * Params:
   *   @client Instance
   */

  closeConnection(client) {
    client.end();
  },

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

  wrapQuery: (query, last_sync_at) => {

    // Wrap the query.
    const wrappedQuery = `WITH hull_users AS (${query})
      SELECT * FROM hull_users
      WHERE (external_id IS NOT NULL OR email IS NOT NULL)`;

    // Add a condition if needed.
    if (last_sync_at) {
      return `${wrappedQuery} AND updated_at >= '${last_sync_at}'`;
    }

    return wrappedQuery;
  },

  /**
   * Get the count from the user query
   * inside a PostgreSQL request.
   *
   * Params:
   *   @query String*
   *
   * Return:
   *   @wrappedQuery String
   */

  countQuery: (query) => {
    const wrappedQuery = `WITH hull_users AS (${query})
      SELECT COUNT (*) FROM hull_users
      WHERE (external_id IS NOT NULL OR email IS NOT NULL)`;

    return wrappedQuery;
  },

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

  runQuery: (client, wrappedQuery, countQuery, callback) => {

    // Limit the result.
    wrappedQuery = `${wrappedQuery} LIMIT 100`;

    // Connect the connection.
    client.connect((err) => {
      if (err) {
        return callback({
          error: 503,
          message: err.message
        });
      }

      // Run the query.
      client.query(wrappedQuery, (err, result) => {
        if (err) {
          return callback({
            error: 400,
            message: err.message
          });
        }

        client.query(countQuery, (err, count) => {
          if (err) {
            return callback({
              error: 400,
              message: err.message
            });
          }

          // Return the rows of the result.
          return callback(null, {
            count: count.rows[0].count,
            entries: result.rows
          });
        });
      });
    });
  },

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

  streamQuery: (client, wrappedQuery, callback) => {

    // After connecting the connection, stream the query.
    client.connect((err) => {
      if (err) {
        return callback({
          error: 503,
          message: err.message
        })
      }

      // Stream the wrapped query.
      const streaming = new QueryStream(wrappedQuery);
      const streamedQuery = client.query(streaming, (err, result) => {
        if (err) {
          return callback({
            error: 400,
            message: err.message
          });
        }
      });

      // Return the streamed query in case of success.
      return callback(null, streamedQuery);
    });
  }
};
