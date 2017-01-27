# Hull / SQL

### Install the SQL Database Importer to Pass Custom Data to Hull

The SQL Database Importer hooks into your PostgreSQL or Redshift database, lets you define a query that will be run on a regular schedule and import the results into Hull.

You can choose to fetch only updated users or the full data set when you build your query. We provide a way to put in a placeholder that will be replaced with the timestamp of the previous query.

Once Users are imported in Hull, only those who have changed will actually be re-sent to other connectors

The SQL imported does not write in your database - we recommend you provide read-only credentials to increase security.

To connect the SQL Database connector, go to Ships. You’ll need to select your Database type (Postgres or MySQL), enter its location, username and password, enter a Connection String and write a SQL query to extract the right data into Hull.

By default, this will run every 3 hours.
