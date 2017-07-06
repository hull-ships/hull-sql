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
