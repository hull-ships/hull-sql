/**
 * Module dependencies.
 */

const _ = require("lodash");

// Map each record of the stream.
const transform = require("./utils/transform");

/**
 * Configure the streaming to AWS.
 */

// Configure the AWS SDK.
const Aws = require("aws-sdk");
Aws.config.update({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

// Configure the AWS S3 account with
// a new AWS instance.
const awsAccount = new Aws.S3();
const awsS3 = require("s3-upload-stream")(awsAccount);

import * as Adapters from "./adapters";

// Configure the AWS S3 bucket.
const s3Params = {
  Bucket: process.env.BUCKET_PATH,
  ACL: "private",
  StorageClass: "STANDARD",
  ContentType: "application/json",
  Expires: 86400
};


/**
 * Export the sync agent for the SQL ship.
 */

module.exports = class SyncAgent {

  /**
   * Constructor.
   *
   * Params:
   *   @ship Object*
   *   @hull Object*
   */

  constructor(ship, hull) {
    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = hull;

    // Get the DB type.
    const { db_type } = this.ship.private_settings;
    this.adapter = Adapters[db_type];

    // Make sure the DB type is known.
    // If not, throw an error.
    // Otherwise, use the correct adapter.
    if (!this.adapter) {
      return {
        error: 405,
        message: `Invalid database type '${db_type}'.`
      };
    }

    this.client = this.adapter.openConnection(this.ship.private_settings.connection_string);
    return this;
  }

  /**
   * Run a wrapped query.
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

  runQuery(connection_string, query, callback) {
    const self = this;
    const client = self.client;

    // Wrap the query.
    const countQuery = self.adapter.countQuery(query);
    const wrappedQuery = self.adapter.wrapQuery(query);

    // Run the method for the specific adapter.
    self.adapter.runQuery(client, wrappedQuery, countQuery, (err, data) => {
      if (err) {
        let message;
        if (err.message.substr(0, 11) === "getaddrinfo") {
          message = "impossible to connect to the database.";
        } else {
          message = err.message;
        }

        return callback({
          error: 400,
          message: `An error occured with the request you provided: ${message}`
        });
      }

      // Close the connection.
      self.adapter.closeConnection(client);

      // Return the result.
      return callback(null, {
        count: data.count,
        entries: data.entries
      });
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

  streamQuery(connection_string, query, last_sync_at, callback) {
    const self = this;
    const client = self.client;

    // Wrap the query.
    const wrappedQuery = this.adapter.wrapQuery(query, last_sync_at);

    // We need to know when we start the job.
    const started_sync_at = new Date();

    // Run the method for the specific adapter.
    self.adapter.streamQuery(client, wrappedQuery, (err, streamedQuery) => {
      if (err) {
        return callback({
          error: 400,
          message: `An error occured while streaming the data: ${err.message}`
        });
      }

      // Create the stream and return it.
      const stream = streamedQuery.pipe(transform());

      // Use a unique location for every ship.
      const now = new Date().getTime();
      s3Params.Key = `extracts/${self.ship.id}/${now}.json`;

      // Stream and upload the data to S3.
      const upload = awsS3.upload(s3Params);
      const uploader = stream.pipe(upload);

      // On a stream error.
      stream.on("error", (error) => {
        return callback({
          error: 400,
          message: `An error occured while streaming the data: ${error.message}`
        });
      });

      // On a stream error.
      uploader.on("error", (error) => {
        return callback({
          error: 400,
          message: `An error occured while streaming the data: ${error.message}`
        });
      });

      // Make sure the stream has finish
      // before doing everything else.
      stream.on("end", () => {
        self.adapter.closeConnection(client);

        // Get the bucket URL.
        const url = awsAccount.getSignedUrl("getObject", _.pick(s3Params, [
          "Bucket",
          "Key",
          "Expires"
        ]));

        // When the file is uploaded, import the data to Hull.
        uploader.on("uploaded", () => {
          self.hull.post("/import/users", {
            url,
            format: "json",
            notify: true,
            emit_event: false
          })
            .then(job => {
              self.hull.get(self.ship.id).then(({ private_settings }) => {
                self.hull.put(self.ship.id, {
                  private_settings: {
                    ...private_settings,
                    last_sync_at: started_sync_at,
                    last_job_id: job.id
                  }
                });
              });
              return callback(null, job);
            })
            .catch(error => {
              return callback({
                error: 400,
                message: `An error occured while streaming the data: ${error.message}`
              });
            });
        });
      });

      return stream;
    });
  }
};
