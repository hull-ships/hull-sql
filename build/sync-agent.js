'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Module dependencies.
 */

var _ = require('lodash');
var map = require('through2-map');

// Map each record of the stream.
var transform = require('./utils/transform');

/**
 * Configure the streaming to AWS.
 */

// Configure the AWS SDK.
var Aws = require('aws-sdk');
Aws.config.update({
  accessKeyId: process.env.AWS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY
});

// Configure the AWS S3 account with
// a new AWS instance.
var awsAccount = new Aws.S3();
var awsS3 = require('s3-upload-stream')(awsAccount);

// Configure the AWS S3 bucket.
var s3Params = {
  Bucket: process.env.BUCKET_PATH,
  ACL: 'private',
  StorageClass: 'STANDARD',
  ContentType: 'application/json',
  Expires: 86400
};

/**
 * Known adapters.
 */

var adapters = ['postgres'];

/**
 * Export the sync agent for the SQL ship.
 */

module.exports = function () {

  /**
   * Constructor.
   *
   * Params:
   *   @ship Object*
   *   @hull Object*
   */

  function SyncAgent(ship, hull) {
    _classCallCheck(this, SyncAgent);

    // Expose the ship settings
    // and the Hull instance.
    this.ship = ship;
    this.hull = hull;

    // Get the DB type.
    var adapter = this.ship.private_settings.db_type;

    // Make sure the DB type is known.
    // If not, throw an error.
    // Otherwise, use the correct adapter.
    if (!_.includes(adapters, adapter)) {
      return {
        error: 405,
        message: 'No adapter specified.'
      };
    } else {
      this.adapter = require('./adapters/' + adapter);
      this.client = this.adapter.openConnection(this.ship.private_settings.connection_string);
    }
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

  _createClass(SyncAgent, [{
    key: 'runQuery',
    value: function runQuery(connection_string, query, callback) {
      var self = this;
      var client = self.client;

      // Wrap the query.
      var countQuery = self.adapter.countQuery(query);
      var wrappedQuery = self.adapter.wrapQuery(query);

      // Run the method for the specific adapter.
      self.adapter.runQuery(client, wrappedQuery, countQuery, function (err, data) {
        if (err) {
          var message = void 0;
          if (err.message.substr(0, 11) === 'getaddrinfo') {
            message = 'impossible to connect to the database.';
          } else {
            message = err.message;
          }

          return callback({
            error: 400,
            message: 'An error occured with the request you provided: ' + message
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

  }, {
    key: 'streamQuery',
    value: function streamQuery(connection_string, query, last_sync_at, callback) {
      var self = this;
      var client = self.client;

      // Wrap the query.
      var wrappedQuery = this.adapter.wrapQuery(query, last_sync_at);

      // We need to know when we start the job.
      var started_sync_at = new Date();

      // Run the method for the specific adapter.
      self.adapter.streamQuery(client, wrappedQuery, function (err, streamedQuery) {
        if (err) {
          return callback({
            error: 400,
            message: 'An error occured while streaming the data: ' + err.message
          });
        }

        // Create the stream and return it.
        var stream = streamedQuery.pipe(transform());

        // Use a unique location for every ship.
        var now = new Date().getTime();
        s3Params.Key = 'extracts/' + self.ship.id + '/' + now + '.json';

        // Stream and upload the data to S3.
        var upload = awsS3.upload(s3Params);
        var uploader = stream.pipe(upload);

        // On a stream error.
        stream.on('error', function (err) {
          return callback({
            error: 400,
            message: 'An error occured while streaming the data: ' + err.message
          });
        });

        // On a stream error.
        uploader.on('error', function (err) {
          return callback({
            error: 400,
            message: 'An error occured while streaming the data: ' + err.message
          });
        });

        // Make sure the stream has finish
        // before doing everything else.
        stream.on('end', function () {
          self.adapter.closeConnection(client);

          // Get the bucket URL.
          var url = awsAccount.getSignedUrl('getObject', _.pick(s3Params, ['Bucket', 'Key', 'Expires']));

          // When the file is uploaded, import the data to Hull.
          uploader.on('uploaded', function (details) {
            self.hull.post('/import/users', {
              url: url,
              format: 'json',
              notify: true,
              emit_event: false
            }).then(function (job) {
              self.hull.get(self.ship.id).then(function (_ref) {
                var private_settings = _ref.private_settings;

                self.hull.put(self.ship.id, {
                  private_settings: _extends({}, private_settings, {
                    last_sync_at: started_sync_at,
                    last_job_id: job.id
                  })
                });
              });
              return callback(null, job);
            }).catch(function (err) {
              return callback({
                error: 400,
                message: 'An error occured while streaming the data: ' + err.message
              });
            });
          });
        });
      });
    }
  }]);

  return SyncAgent;
}();