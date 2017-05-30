## v0.1.2 - sbellity - 2017-05-30
- return early with a 403 error if no credentials in URL
- add tests for instrumentation of incoming users count

## v0.1.1
- add instrumentation for incoming users count

## v0.1.0
- upgrade to hull-node@0.11.0
- restructurized main application files
- adds `import_days` setting and `start_import_date` replacemenet variable to write incremental queries - deprecates previous `last_updated_at` solution
