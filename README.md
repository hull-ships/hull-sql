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

### Schema requirements :

The `users` table requires the following columns:
- email (text/varchar)
- updated_at (timestamp)

### Usage:

Inside the query editor you can use **extra variables**: 
- `${last_updated_at}` - timestamp of last update


#####Example:

```sql
SELECT id as external_id, email as email, updated_at as updated_at
FROM users
WHERE updated_at > ${last_updated_at}
```
