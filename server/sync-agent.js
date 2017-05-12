/**
 * Module dependencies.
 */

import _ from "lodash";
import moment from "moment";
import URI from "urijs";
import BatchStream from "batch-stream";
import ps from "promise-streams";

// Map each record of the stream.
import map from "through2-map";

import * as Adapters from "./adapters";

const DEFAULT_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10000", 10);
const NB_CONCURRENT_BATCH = 3;


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
   * Constructor.
   *
   * Params:
   *   @ship Object*
   *   @hull Object*
   */

  constructor({ ship, client, job, batchSize = DEFAULT_BATCH_SIZE }) {
    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = client;
    this.job = job;
    this.batchSize = batchSize;

    this.importDelay = _.random(0, process.env.IMPORT_DELAY || 120);

    // Get the DB type.
    const { db_type, output_type = "s3" } = this.ship.private_settings;
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

    const connectionString = this.connectionString();

    this.client = this.adapter.in.openConnection(connectionString);
    return this;
  }

  isEnabled() {
    return this.ship.private_settings.enabled === true;
  }

  isConnectionStringConfigured() {
    return !!this.connectionString();
  }

  isQueryStringConfigured() {
    return !!this.getQuery();
  }

  connectionString() {
    const conn = ["type", "host", "port", "name", "user", "password"].reduce((c, key) => {
      const val = this.ship.private_settings[`db_${key}`];
      if (c && val && val.length > 0) {
        return { ...c, [key]: val };
      }
      return false;
    }, {});
    if (conn) {
      return URI()
        .protocol(conn.type)
        .username(conn.user)
        .password(conn.password)
        .host(conn.host)
        .port(conn.port)
        .path(conn.name)
        .toString();
    }
    return false;
  }

  updateShipSettings(settings) {
    return this.hull.get(this.ship.id).then(({ private_settings }) => {
      return this.hull.put(this.ship.id, {
        private_settings: {
          ...private_settings,
          ...settings
        }
      });
    });
  }

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
    const last_updated_at = options.last_updated_at || oneDayAgo.toISOString();
    const wrappedQuery = this.adapter.in.wrapQuery(query, last_updated_at);
    // Run the method for the specific adapter.
    return this.adapter.in.runQuery(this.client, wrappedQuery, options)
      .then(result => {
        return { entries: result.rows };
      });
  }

  startImport(options) {
    this.hull.logger.info("sync.start", options);
    const query = this.getQuery();
    const started_sync_at = new Date();
    return this.streamQuery(query, options)
      .then(stream => this.sync(stream, started_sync_at))
      .catch(err => {
        this.hull.logger.error("sync.error", { message: err.message });
      });
  }

  startSync(options) {
    const private_settings = this.ship.private_settings;
    const oneHourAgo = moment().subtract(1, "hour").utc();
    const last_updated_at = private_settings.last_updated_at || private_settings.last_sync_at || oneHourAgo.toISOString();
    return this.startImport({ ...options, last_updated_at });
  }

  streamQuery(query, options = {}) {
    const { last_updated_at } = options;

    // Wrap the query.
    const wrappedQuery = this.adapter.in.wrapQuery(query, last_updated_at);

    this.hull.logger.debug("sync.query", { query: wrappedQuery });

    // Run the method for the specific adapter.
    return this.adapter.in.streamQuery(this.client, wrappedQuery).then(stream => {
      stream.on("error", err => this.hull.logger.error("sync.error", { message: err.toString(), query: wrappedQuery }));
      return stream;
    }, err => {
      this.hull.logger.error("sync.error", { message: err.toString() });
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

      if (processed % 1000 === 0) {
        const elapsed = new Date() - started_sync_at;
        this.hull.logger.info("sync.progress", { processed, elapsed });
        if (this.job) {
          this.job.progress(processed);
          this.job.log("%d proceesed in  %d ms", processed, elapsed);
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

    const batch = new BatchStream({ size: this.batchSize });

    let num = 0;

    let last_job_id = null;

    return stream
      .pipe(transform)
      .pipe(batch)
      .pipe(ps.map({ concurrent: NB_CONCURRENT_BATCH }, users => {
        num += 1;
        return this.adapter.out.upload(users, this.ship.id, num).then(({ url, partNumber, size }) => {
          if (users.length > 0) {
            return this.startImportJob(url, partNumber, size);
          }
          return false;
        })
          .then(({ job, partNumber }) => {
            last_job_id = job.id;
            this.hull.logger.info(`sync.job.part.${partNumber}`, { job });
            return { job };
          })
          .catch(err => {
            this.hull.logger.error("sync.error", err.message);
          });
      }))
      .wait()
      .then(() => {
        const duration = new Date() - started_sync_at;

        this.hull.logger.info("sync.done", { duration, processed });

        const settings = {
          last_sync_at: started_sync_at,
          last_updated_at: last_updated_at || started_sync_at
        };

        if (last_job_id) {
          settings.last_job_id = last_job_id;
        }
        return this.updateShipSettings(settings);
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

    this.hull.logger.info("sync.import", _.omit(params, "url"));

    return this.hull.post("/import/users", params)
      .then(job => {
        return { job, partNumber };
      });
  }
}
