DROP VIEW IF EXISTS users_view;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    user_id    integer,
    first_name varchar(40),
    last_name  varchar(40),
    email      varchar(80),
    foo_integer integer,
    foo_date TIMESTAMPTZ,
    PRIMARY KEY(user_id)
);

INSERT INTO users VALUES
    (1, 'Michal', 'Smith', 'michal@smiths.com', 123, '2016-04-04 10:10:10'),
    (2, 'Stephane', 'Mitnick', 'stephane@mitnicks.com', 123, '2016-04-04 10:10:10'),
    (3, 'Romain', 'Liskov', 'romain@liskovs.com', 123, '2016-04-04 10:10:10');


CREATE VIEW users_view AS SELECT user_id as id, first_name as name, email, foo_integer as foo_numeric FROM users LIMIT 2;

-- to load the schema
-- docker run -it --rm -v `pwd`:/app -w /app --network=host postgres:9.6 bash -c 'cat tests/schema/postgres_schema.sql | PGPASSWORD=postgres psql -h localhost -U postgres'

-- example query:
-- SELECT id as external_id, name as first_name, foo_numeric as testing_trait FROM users_view
