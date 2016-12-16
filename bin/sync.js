const Hull = require('hull');
const SyncAgent = require('../lib/sync-agent');

const settings = {
  id: '58525333f9edca6bfe000086',
  secret: 'xxxxxxx',
  organization: '098f3ab5.hullbeta.io'
};

const hull = new Hull(settings);

hull.get(settings.id)
  .then((ship) => {
    const agent = new SyncAgent(ship, hull);

    const test = agent.runQuery(ship.private_settings.connection_string, ship.private_settings.query);
    console.log(test);
  })
  .catch(err => {
    console.log(err);
  });
