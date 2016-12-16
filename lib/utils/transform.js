/**
 * Module dependencies.
 */

const _ = require('lodash');
const map = require('through2-map');

/**
 * Transform each entry of a stream.
 */

module.exports = () => {
  return map({objectMode: true}, (record) => {
    const user = {};

    // Add the user id if exists.
    if (record.external_id) {
      user.userId = record.external_id.toString();
    }

    // Register eveything else inside the "traits" object.
    user.traits = _.omit(record, 'external_id', 'updated_at');

    // Return the user, stringified, so we can stream it.
    return `${JSON.stringify(user)}\n`;
  });
};
