// @Flow

/**
 * Module dependencies.
 */
import tedious from "tedious";
import Promise from "bluebird";
import _ from "lodash";
import SequelizeUtils from "sequelize/lib/utils";

/**
 * MS SQL adapter.
 */

/**
 * Open a new connection.
 *
 * @param {tedious.ConnectionConfig} config The connection configuration.
 *
 * @return {tedious.Connection} The tedious.Connection instance
 */
export function openConnection(config: tedious.ConnectionConfig): tedious.Connection {
  return new tedious.Connection(config);
}

/**
 * Close the connection.
 *
 * @param {tedious.Connection} client
 */
export function closeConnection(client) {
  client.close();
}

/**
 * Wrap the user query inside a MS SQL request.
 *
 * @param {*} sql The raw SQL query
 * @param {*} replacements The replacement parameters
 */
export function wrapQuery(sql, replacements): any {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mssql");
}

/**
 * Runs the query using the specified client and options.
 * @param {tedious.Connection} client The MS SQL client.
 * @param {string} query The query to execute.
 * @param {*} options The options.
 */
export function runQuery(client: tedious.Connection, query: string, options) {
  return new Promise((resolve, reject) => {
    const confoptions = _.merge(client.config.options, options);
    const conf = _.cloneDeep(client.config);
    conf.options = confoptions;
    const conn = new tedious.Connection(conf);

    conn.on("connect", (err) => { // eslint-disable-line consistent-return
      if (err) {
        return reject(err);
      }

      const qparam = `${query} LIMIT 100`;

      const request = new tedious.Request(qparam, (reqError) => { // eslint-disable-line consistent-return
        if (reqError) {
          return reject(reqError);
        }
      });

      const rows = [];

      request.on("row", (columns) => {
        const row = {};
        _.forEach(columns, (column) => {
          row[column.metadata.name] = column.value;
        });
        rows.push(row);
      });

      request.on("done", (rowCount, more) => { // eslint-disable-line consistent-return
        if (!more) {
          return resolve(rows);
        }
      });

      request.on("doneInProc", (rowCount, more) => { // eslint-disable-line consistent-return
        if (!more) {
          return resolve(rows);
        }
      });

      request.on("doneProc", (rowCount, more) => { // eslint-disable-line consistent-return
        if (!more) {
          return resolve(rows);
        }
      });

      conn.execSql(request);
    });
  });
}
