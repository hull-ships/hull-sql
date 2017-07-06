#!/bin/bash
mkdir -p tests/schema/faker
curl https://raw.githubusercontent.com/jbranchaud/pg_faker/master/sql/first_names.sql -o tests/schema/faker/first_names.sql
curl https://raw.githubusercontent.com/jbranchaud/pg_faker/master/sql/last_names.sql -o tests/schema/faker/last_names.sql
curl https://raw.githubusercontent.com/jbranchaud/pg_faker/master/sql/functions.sql -o tests/schema/faker/functions.sql

