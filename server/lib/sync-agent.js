/**
 * Module dependencies.
 */
import _ from "lodash";
import moment from "moment";
import ps from "promise-streams";

// Map each record of the stream.
import map from "through2-map";
import through2 from "through2";

import * as Adapters from "./adapters";

const DEFAULT_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10000", 10);
const FULL_IMPORT_DAYS = process.env.FULL_IMPORT_DAYS || "10000";

/**
 * Export the sync agent for the SQL ship.
 */

class ConfigurationError extends Error {
  constructor(msg) {
    super(msg);
    this.status = 403;
  }
}

export default class SyncAgent {

  /**
   * Creates a new SyncAgent instance.
   * @param {*} param0 The configuration for the client.
   */
  constructor({ ship, client, job, metric, batchSize = DEFAULT_BATCH_SIZE }) {
    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = client;
    this.job = job;
    this.metric = metric;
    this.batchSize = batchSize;

    this.importDelay = _.random(0, process.env.IMPORT_DELAY || 120);

    const private_settings = this.ship.private_settings;
    // Get the DB type.
    const { db_type, output_type = "s3" } = private_settings;
    this.db_type = db_type;
    this.adapter = { in: Adapters[db_type], out: Adapters[output_type] };

    // Make sure the DB type is known.
    // If not, throw an error.
    // Otherwise, use the correct adapter.
    if (!this.adapter.in) {
      throw new ConfigurationError(`Invalid database type ${db_type}.`);
    }
    if (!this.adapter.out) {
      throw new ConfigurationError(`Invalid output type ${output_type}.`);
    }

    this.client = this.adapter.in.openConnection(private_settings);
    return this;
  }

  /**
   * Returns whether sync is enabled or not.
   * @return {boolean} True if sync is enabled; otherwise false.
   */
  isEnabled() {
    return this.ship.private_settings.enabled === true;
  }

  /**
   * Returns whether all required connection parameters have been supplied.
   * @return {boolean} True if all parameters are specified; otherwise false.
   */
  areConnectionParametersConfigured() {
    const settings = this.ship.private_settings;
    const conn = ["type", "host", "port", "name", "user", "password"].reduce((c, key) => {
      let val = settings[`db_${key}`];
      if (key === "type" && val === "redshift") val = "postgres";
      if (c && val && val.length > 0) {
        return { ...c,
          [key]: val
        };
      }
      return false;
    }, {});

    return !!conn;
  }

  /**
   * Returns whether the query string has been configured.
   * @return {boolean} True if the query string is set; otherwise false.
   */
  isQueryStringConfigured() {
    return !!this.getQuery();
  }

  /**
   * Returns the SQL query from the ship settings.
   * @return {string} The SQL query string as supplied by the user.
   */
  getQuery() {
    return this.ship.private_settings.query;
  }

  /**
   * Run a wrapped query.
   *
   * Params:
   *   @query String*
   *   @callback Function*
   *
   * Return:
   *   @callback Function
   *     - @error Object
   *     - @success Object
   */

  runQuery(query, options = {}) {
    // Wrap the query.
    const oneDayAgo = moment().subtract(1, "day").utc();
    const replacements = {
      last_updated_at: options.last_updated_at || oneDayAgo.toISOString(),
      import_start_date: moment().subtract(this.ship.private_settings.import_days, "days").format()
    };

    const wrappedQuery = this.adapter.in.wrapQuery(query, replacements);
      // Run the method for the specific adapter.
    return this.adapter.in.runQuery(this.client, wrappedQuery, options)
      .then(result => {
        this.adapter.in.closeConnection(this.client);

        const { errors } = this.adapter.in.validateResult(result);
        if (errors && errors.length > 0) {
          return { entries: result.rows, errors };
        }

        return { entries: result.rows };
      });
  }

  startImport(options = {}) {
    this.hull.logger.info("incoming.job.start", { jobName: "sync", type: "user", options });
    const query = this.getQuery();
    const started_sync_at = new Date();
    if (!options.import_days) {
      options.import_days = FULL_IMPORT_DAYS;
    }
    return this.streamQuery(query, options)
      .then(stream => this.sync(stream, started_sync_at))
      .catch(err => {
        this.hull.logger.info("incoming.job.error", { jobName: "sync", errors: _.get(err, "message", err) });
        return Promise.reject(err);
      });
  }

  startSync(options = {}) {
    const private_settings = this.ship.private_settings;
    const oneHourAgo = moment().subtract(1, "hour").utc();
    options.import_days = private_settings.import_days;
    const last_updated_at = private_settings.last_updated_at || private_settings.last_sync_at || oneHourAgo.toISOString();
    return this.startImport({ ...options, last_updated_at });
  }

  streamQuery(query, options = {}) {
    const { last_updated_at } = options;
    const replacements = {
      last_updated_at,
      import_start_date: moment().subtract(options.import_days, "days").format()
    };
    // Wrap the query.
    const wrappedQuery = this.adapter.in.wrapQuery(query, replacements);

    this.hull.logger.info("incoming.job.query", { jobName: "sync", query: wrappedQuery });

    // Run the method for the specific adapter.
    return this.adapter.in.streamQuery(this.client, wrappedQuery).then(stream => {
      return stream;
    }, err => {
      this.hull.logger.info("incoming.job.error", { jobName: "sync", errors: _.invoke(err, "toString") || err });
      err.status = 403;
      throw err;
    });
  }

  /**
   * Stream a wrapped query.
   *
   * Params:
   *   @connection_string String*
   *   @query String*
   *   @callback Function*
   *
   * Return:
   *   @callback Function
   *     - @error Object
   *     - @success Object
   */

  sync(stream, started_sync_at) {
    let processed = 0;
    let last_updated_at;

    const transform = map({ objectMode: true }, (record) => {
      const user = {};
      processed += 1;

      const jobId = this.job ? this.job.id : undefined;

      if (processed % 1000 === 0) {
        const elapsed = new Date() - started_sync_at;
        this.hull.logger.info("incoming.job.progress", { jobId, jobName: "sync", stepName: "query", progress: processed, elapsed });
        if (this.job && this.job.queue && this.job.queue.client) {
          try {
            this.job.queue.client.extendLock(this.job.queue, this.job.id);
            this.job.progress(processed);
          } catch (err) {
            // unsupported adatpter operation
          }
        }
      }

      // Add the user id if exists.
      if (record.external_id) {
        user.userId = record.external_id.toString();
      }

      if (record.updated_at) {
        last_updated_at = last_updated_at || record.updated_at;
        if (record.updated_at > last_updated_at) {
          last_updated_at = record.updated_at;
        }
      }

      // Register everything else inside the "traits" object.
      user.traits = _.omit(record, "external_id", "updated_at");
      return user;
    });

    let numBatches = 1;
    let numUsers = 0;
    let currentStream = null;
    let currentPromise = null;
    const { batchSize, adapter, ship } = this;

    let last_job_id = null;
    return new Promise((resolve, reject) => {
      ps.wait(stream
      .on("error", (err) => {
        this.hull.logger.info("incoming.job.error", { jobName: "sync", errors: _.invoke(err, "toString") || err });
        if (stream.close) stream.close();
        this.adapter.in.closeConnection(this.client);
        reject(err);
      })
      .pipe(transform)
      .pipe(through2({ objectMode: true, highWaterMark: 10 }, function rotate(user, enc, callback) {
        try {
          if (currentStream === null || numUsers % batchSize === 0) {
            numBatches += 1;
            if (currentStream) {
              currentStream.end();
              this.push(currentPromise);
            }
            const newUpload = adapter.out.upload(ship.id, (numBatches - 1));
            currentStream = newUpload.stream;
            currentPromise = newUpload.promise;
          }
          currentStream.write(`${JSON.stringify(user)}\n`);
          numUsers += 1;
          callback();
        } catch (e) {
          throw e;
        }
      }, function finish(callback) {
        if (currentStream && currentStream.end) {
          // Readable does not implement end function,
          // so we need to be careful here.
          currentStream.end();
        }
        this.push(currentPromise);
        callback();
      }))
      .pipe(ps.map({ highWaterMark: 1 }, ({ url, partNumber, size }) => {
        return (() => {
          this.hull.logger.info("incoming.job.progress", { jobName: "sync", stepName: "upload", progress: partNumber, size });
          if (size > 0) {
            return this.startImportJob(url, partNumber, size);
          }
          return false;
        })()
        .then(({ job }) => {
          last_job_id = job.id;
          this.hull.logger.info("incoming.job.progress", { jobName: "sync", stepName: "import", progress: partNumber, job });
          return { job };
        })
        .catch(err => {
          this.hull.logger.info("incoming.job.error", { jobName: "sync", errors: _.get(err, "message", err) });
        });
      }))
      )
      .then(() => {
        const duration = new Date() - started_sync_at;

        this.metric.increment("ship.incoming.users", processed);
        this.hull.logger.info("incoming.job.success", { jobName: "sync", duration, progress: processed });

        const settings = {
          last_sync_at: started_sync_at,
          last_updated_at: last_updated_at || started_sync_at
        };

        if (last_job_id) {
          settings.last_job_id = last_job_id;
        }
        return this.hull.utils.settings.update(settings)
          .then(resolve);
      })
      .catch(reject);
    });
  }

  startImportJob(url, partNumber, size) {
    const { overwrite } = this.ship.private_settings;
    const params = {
      url,
      format: "json",
      notify: true,
      emit_event: false,
      overwrite: !!overwrite,
      name: `Import from hull-sql ${this.ship.name} - part ${partNumber}`,
      schedule_at: moment().add(this.importDelay + (2 * partNumber), "minutes").toISOString(),
      stats: { size }
    };

    this.hull.logger.info("incoming.job.progress", { jobName: "sync", stepName: "import", progress: partNumber, options: _.omit(params, "url") });

    return this.hull.post("/import/users", params)
      .then(job => {
        return { job, partNumber };
      });
  }
}
