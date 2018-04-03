/**
 * Configure the streaming to AWS.
 */
const Stream = require("stream");
const zlib = require("zlib");
const Aws = require("aws-sdk");
const through2 = require("through2");

function upload(shipId, partNumber) {
  const stream = new Stream.PassThrough();
  const gzip = zlib.createGzip();

  const Body = new Stream.PassThrough();
  const Bucket = process.env.BUCKET_PATH;
  const Key = `extracts/${shipId}/${new Date().getTime()}-${partNumber}.json`;
  const params = {
    Bucket, Key, Body,
    ACL: "private",
    ContentType: "application/json",
    ContentEncoding: "gzip"
  };

  const promise = new Promise((resolve, reject) => {
    const s3 = new Aws.S3();
    let size = 0;

    s3.upload(params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          url: s3.getSignedUrl("getObject", { Bucket, Key, Expires: 86400 }),
          partNumber,
          size
        });
      }
    });
    stream
      .pipe(gzip)
      .pipe(through2((chunk, enc, callback) => {
        size += 1;
        callback(null, chunk);
      }))
      .pipe(Body);
  });

  return { promise, stream };
}

module.exports = {
  upload
};
