# Changelog

## 0.3.19
- Adding the ability to pull from a snowflake warehouse
- Also adding the ability to migrate specific connectors to a place where each different type of sql can serve their own assets

## 0.3.18
- prevent malicious dep flatmap-stream@0.1.1 from installing

## 0.3.17
- added data type handler to the postgres connection to make sure numeric and int8 values are cast to Numbers

## 0.3.16
- update error wording

## 0.3.15
- upgrade hull-node and newrelic to the latest versions

## 0.3.14
- fix internal dependency

## 0.3.13
- revert back newrelic dependency

## 0.3.12
- revert back hull-node to latest working version

## 0.3.11
- make preview timeout configurable and set default to 60 seconds

## 0.3.10
- upgrade newrelic dependency

## 0.3.9
- upgrade hull-node to the latest version

## 0.3.8
- allow to specify timeout on process env vars level - in `ms` npm package format - env var name: `CONNECTOR_TIMEOUT`
- trim semicolons `;` from user query

## 0.3.7
- add job_id and part_number to import job API

## 0.3.6
- [hotfix] Fix reporting of import size
- remove options to sync every minute

## 0.3.5
- [hotfix] adjust the import delay to the interval

## 0.3.4
- [hotfix] ensure that JSON object is passed to stream instead of string

## 0.3.3
- [hotfix] ensure that objectMode is set with proper casing for Node v8.x and above when streaming MS SQL records

## 0.3.2
- add status update on `/sync` endpoint error
- remove actual query execution from `/status` endpoint
- fix connection closing

## 0.3.1
- add support for events
- support sync interval in settings

## 0.3.0
- add support for accounts

## 0.2.11
- adds status endpoint and `hull_summary` param to error logs

## 0.2.10
- empty results validation

## 0.2.9
- hotfix make sure the postgres client is closed in all scenarios

## 0.2.8
- add gzip compression before sending to s3

## 0.2.7
- adds postgres queries validation to check json columns
- adds rows calidation to check if required columns are present and if non of them contain invalid charactes

## 0.2.6
- Add support for MS SQL
- Fix issue with saved queries

## 0.2.5
- change the highwaterMark on rotating stream

## 0.2.4
- extend lock times on bull queue internals

## 0.2.3
- rebuild the stream processing part to avoid batching big arrays in memory
- adjusted logs to match the convention

## 0.2.2
- update job progress

## 0.2.1
- upgrade hull-node and switch to bull queue library

## 0.2.0
- Add support for mysql

## 0.1.6
- Add option to enter custom option in connection string

## 0.1.5
- Fix display preview if first record has a null value

## v0.1.4
- upgrade hull-node

## v0.1.3
- handle stream errors and make them fail the job not to stale the whole worker

## v0.1.2 - sbellity - 2017-05-30
- return early with a 403 error if no credentials in URL
- add tests for instrumentation of incoming users count

## v0.1.1
- add instrumentation for incoming users count

## v0.1.0
- upgrade to hull-node@0.11.0
- restructurized main application files
- adds `import_days` setting and `start_import_date` replacemenet variable to write incremental queries - deprecates previous `last_updated_at` solution
