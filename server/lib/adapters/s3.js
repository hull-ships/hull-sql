/**
 * Configure the streaming to AWS.
 */
import Stream from "stream";
import Aws from "aws-sdk";
import through2 from "through2";

export function upload(shipId, partNumber) {
  const stream = new Stream.PassThrough();

  const Body = new Stream.PassThrough();
  const Bucket = process.env.BUCKET_PATH;
  const Key = `extracts/${shipId}/${new Date().getTime()}-${partNumber}.json`;
  const params = {
    Bucket, Key, Body,
    ACL: "private",
    ContentType: "application/json",
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
      .pipe(through2((chunk, enc, callback) => {
        size += 1;
        callback(null, chunk);
      }))
      .pipe(Body);
  });

  return { promise, stream };
}
