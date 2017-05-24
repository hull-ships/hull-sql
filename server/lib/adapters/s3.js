/**
 * Configure the streaming to AWS.
 */

import Stream from "stream";
import Aws from "aws-sdk";

export function upload(users, shipId, partNumber) {
  // Convert users array to stream
  const stream = new Stream.Readable();
  users.forEach(user => stream.push(`${JSON.stringify(user)}\n`));
  stream.push(null);

  const Body = new Stream.PassThrough();
  const Bucket = process.env.BUCKET_PATH;
  const Key = `extracts/${shipId}/${new Date().getTime()}-${partNumber}.json`;
  const params = {
    Bucket, Key, Body,
    ACL: "private",
    ContentType: "application/json",
  };

  return new Promise((resolve, reject) => {
    const s3 = new Aws.S3();

    s3.upload(params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          url: s3.getSignedUrl("getObject", { Bucket, Key, Expires: 86400 }),
          partNumber,
          size: users.length,
        });
      }
    });
    stream.pipe(Body);
  });
}
