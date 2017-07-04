# Hull SQL Ship.

### Using :

- Go to your `Hull Dashboard > Ships > Add new`
- Paste the URL for your Heroku deployment, or use ours : `https://hull-sql.herokuapp.com/`
- Visit the Setup Page (see below)
- Add your ship to a Platform.

### Developing :

- Fork
- Install

```sh
npm i -g gulp
npm i
npm run start:dev #starts in dev mode with nodemon
npm run test #runs unit tests, lints and checks dependencies
npm run watch #builds client package
npm run build # build
# Checkout package.json for more tasks
```


### Installing 

#### Dependencies for this connector 

- Redis
- S3 Bucket
- IAM profile with read/write access to a S3 bucket

#### Environment variables

| SECRET | Connector Secret - Generate a random secret string |
| AWS_KEY_ID | Access Key for IAM profile |
| AWS_SECRET_KEY | Secret Key for IAM profile |
| BUCKET_PATH | S3 Bucket name and path for extracted files |
| REDIS_URL | Redis URL for the jobs queue |


#### How to setup the S3 bucket and IAM profile

This article explains how to create an IAM profile and grant access to a S3 bucket : https://aws.amazon.com/blogs/security/writing-iam-policies-how-to-grant-access-to-an-amazon-s3-bucket/

You might also want to configure your S3 bucket's lifecycle to expire files automatically after a few days.

In the S3 section of your AWS console, go to your bucket's Management tab and add a Lifecycle rule to automatically expire Objects after 7 days.

### Logs
  
  Logs that are specific for SQL Connector :
  
  * `sync.start` - logged when started importing users from SQL database
  * `sync.progress` - logged when continuing importing users from SQL database
  * `sync.job.part.<number_part>` - logged on each pushed fragment to S3
  * `sync.done` - logged on finished upload job
  * `sync.import` - logged when started importing users to Hull
  
