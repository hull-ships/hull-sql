"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.upload = upload;

var _stream = require("stream");

var _stream2 = _interopRequireDefault(_stream);

var _awsSdk = require("aws-sdk");

var _awsSdk2 = _interopRequireDefault(_awsSdk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Configure the streaming to AWS.
 */

function upload(users, shipId, partNumber) {
  // Convert users array to stream
  var stream = new _stream2.default.Readable();
  users.forEach(function (user) {
    return stream.push(JSON.stringify(user) + "\n");
  });
  stream.push(null);

  var Body = new _stream2.default.PassThrough();
  var Bucket = process.env.BUCKET_PATH;
  var Key = "extracts/" + shipId + "/" + new Date().getTime() + "-" + partNumber + ".json";
  var params = {
    Bucket: Bucket, Key: Key, Body: Body,
    ACL: "private",
    ContentType: "application/json"
  };

  return new Promise(function (resolve, reject) {
    var s3 = new _awsSdk2.default.S3();

    s3.upload(params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          url: s3.getSignedUrl("getObject", { Bucket: Bucket, Key: Key, Expires: 86400 }),
          partNumber: partNumber,
          size: users.length
        });
      }
    });
    stream.pipe(Body);
  });
}