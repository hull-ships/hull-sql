
/**
 * Module dependencies.
 */
import tedious from "tedious";
import Promise from "bluebird";
import _ from "lodash";
import Readable from "readable-stream";
import SequelizeUtils from "sequelize/lib/utils";
import parseConnectionConfig from "../utils/connstr-mssql";

/**
 * MS SQL adapter.
 */


/**
 * Open a new connection.
 *
 * @param {Object} settings The ship settings.
 *
 * @return {tedious.Connection} The tedious.Connection instance
 */
export function openConnection(settings) {
  const config = parseConnectionConfig(settings);
  return new tedious.Connection(config);
}

/**
 * Close the connection.
 *
 * @param {tedious.Connection} client The MSSQL client
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
export function wrapQuery(sql, replacements) {
  return SequelizeUtils.formatNamedParameters(sql, replacements, "mssql");
}

/**
 * Runs the query using the specified client and options.
 * @param {tedious.Connection} client The MS SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object of the following format: { rows }
 */
export function runQuery(client, query, options) {
  return new Promise((resolve, reject) => {
    const confoptions = _.merge(client.config.options, options);
    const conf = _.cloneDeep(client.config);
    conf.options = confoptions;

    const conn = new tedious.Connection(conf);

    conn.on("connect", (err) => { // eslint-disable-line consistent-return
      if (err) {
        return reject(err);
      }

      const qparam = `WITH __qry__ AS (${query}) SELECT TOP(100) * FROM __qry__`;

      const request = new tedious.Request(qparam, (reqError) => { // eslint-disable-line consistent-return
        if (reqError) {
          return reject(reqError);
        }
      });

      const rows = [];
      let resultReturned = false;

      request.on("row", (columns) => {
        const row = {};
        _.forEach(columns, (column) => {
          row[column.metadata.colName] = column.value;
        });
        rows.push(row);
      });

      request.on("done", (rowCount) => { // eslint-disable-line consistent-return
        if (_.isNumber(rowCount) && !resultReturned) {
          resultReturned = true;
          return resolve({
            rows
          });
        }
      });

      request.on("doneInProc", (rowCount) => { // eslint-disable-line consistent-return
        if (_.isNumber(rowCount) && !resultReturned) {
          resultReturned = true;
          return resolve({
            rows
          });
        }
      });

      request.on("doneProc", (rowCount) => { // eslint-disable-line consistent-return
        if (_.isNumber(rowCount) && !resultReturned) {
          resultReturned = true;
          return resolve({
            rows
          });
        }
      });

      conn.execSql(request);
    });
  });
}

/**
 * Creates a readable stream that contains the query result.
 * @param {tedious.Connection} client The MS SQL client.
 * @param {string} query The query to execute.
 * @param {Object} options The options.
 *
 * @returns {Promise} A promise object that wraps a stream.
 */
export function streamQuery(client, query, options = {}) {
  return new Promise((resolve, reject) => {
    const confoptions = _.merge(client.config.options, options);
    const conf = _.cloneDeep(client.config);
    conf.options = confoptions;
    const conn = new tedious.Connection(conf);

    const streamOpts = {};
    streamOpts.ObjectMode = true;
    streamOpts.highWaterMark = 10;
    const stream = new Readable(streamOpts);

    let resultReturned = false;

    stream._read = function () { // eslint-disable-line func-names
      conn.on("connect", (err) => { // eslint-disable-line consistent-return
        if (err) {
          stream.emit("error", err);
          return reject(err);
        }

        const request = new tedious.Request(query, (reqError) => { // eslint-disable-line consistent-return
          if (reqError) {
            stream.emit("error", reqError);
            return reject(reqError);
          }
        });

        request.on("row", (columns) => {
          const row = {};
          _.forEach(columns, (column) => {
            row[column.metadata.colName] = column.value;
          });
          stream.push(JSON.stringify(row));
        });

        request.on("done", (rowCount) => { // eslint-disable-line consistent-return
          if (_.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        request.on("doneInProc", (rowCount) => { // eslint-disable-line consistent-return
          if (_.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        request.on("doneProc", (rowCount) => { // eslint-disable-line consistent-return
          if (_.isNumber(rowCount) && !resultReturned) {
            resultReturned = true;
            stream.push(null);
          }
        });

        conn.execSql(request);
      });
    };

    stream.once("end", () => {
      process.nextTick(() => {
        stream.emit("close");
      });
    });
    return resolve(stream);
  });
}
