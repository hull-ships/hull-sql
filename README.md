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

### Error and timeout handling

|Endpoint|Purpose|Connection timeout|Query timeout|Error handling|
|---|---|---|---|---|
|/run|Runs query from preview - does not import any data, only show results|1s|10s|Returns error message back to UI|
|/import|Runs one time full import|1s|10m|Sends `import.job.error` log line and update connector status to error|
|/sync|Runs on configurable interval|1s|less than configured interval|Sends `import.job.error` log line and update connector status to error|
|/status|Runs on fixed interval and preforms simple SQL query to check connection|1s|1m|Sets connector status|

To see customer facing logs refer to [this section of documentation](./assets/readme.md#troubleshooting).

### Logs

Logs that are specific for SQL Connector:

* `incoming.job.*`
  - jobName: `sync`
  - stepName: `query` - showing progress for fetching users from database
  - stepName: `upload` - showing progress for uploading chunks of data to S3
  - stepName: `import` - showing progress for triggering imports on the platform

* `incoming.job.query` - includes the full query which is run on the external database to import data from
* `connection.error` - encountered problems when connecting with database
* `incoming.job.warning` - query returned no results

### Status

  Messages that may come from status endpoint: 
  
  * `Connection string is not configured.` - when some of database settings are not configured in connector's private settings
  * `Error when trying to connect with database. {err}` - when trying to establish connection and perform simple query 
  * `Query string is not configured` - when `query` is not configured in connector's private settings
  * `Database does not return any rows for saved query` - when database returned no results for saved query.
  * `Results have invalid format {messages}` - when results from database have invalid format. messages - list that contains specified 
  * `Interval syncing is enabled but interval time is less or equal zero` - when cron syncing is enabled but time provided by user is less than zero.

### Notifications

  Messages that may be sent to platform from this connector:
    
   - error: 
      * `Server Error: {err}` - server side error, mostly connection errors
      * `Invalid Syntax: {message}` - errors about invalid query syntax
      * `Invalid structure {messages}` - errors about invalid results structure, e.g. missing email/external_id, json column in postgres database ...
   - warning:
      * `Warning: Query returned no results` - when query that was already saved returned no results
