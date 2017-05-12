CREATE TABLE users (
    user_id    integer,
    first_name varchar(40),
    last_name  varchar(40),
    email      varchar(80),
    PRIMARY KEY(user_id)
);

INSERT INTO users VALUES
    (1, 'Michal', 'Smith', 'michal@smiths.com'),
    (2, 'Stephane', 'Mitnick', 'stephane@mitnicks.com'),
    (3, 'Romain', 'Liskov', 'romain@liskovs.com');

-- to load the schema
-- drun -u root postgres:9.6 bash -c 'cat tests/schema/postgres_schema.sql | psql -h localhost -U postgres'
