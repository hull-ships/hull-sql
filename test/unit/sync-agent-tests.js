/* global describe, it */
import { expect } from "chai";
import sinon from "sinon";
import assert from "assert";
import moment from "moment";
import stream from "stream";

import SyncAgent from "../../server/lib/sync-agent.js";

describe("SyncAgent", () => {
  it("should pass import_start_date to adapter", () => {
    const syncAgent = new SyncAgent({
      ship: {
        private_settings: {
          db_type: "filesystem",
          import_days: 10
        }
      }
    });
    sinon.stub(syncAgent.adapter.in, "runQuery").callsFake(() => {
      return Promise.resolve();
    });

    const wrapQueryStub = sinon.spy(syncAgent.adapter.in, "wrapQuery");
    syncAgent.runQuery("SELECT email, external_id as id FROM users;");

    expect(wrapQueryStub.args[0][1].import_start_date).to.be.equal(moment().subtract(10, "days").format());
  });

  it("should reject sync operation when stream error occurs", (done) => {
    const syncAgent = new SyncAgent({
      client: {
        logger: {
          error: () => {},
          info: () => {}
        },
        post: () => Promise.resolve({})
      },
      ship: {
        private_settings: {
          db_type: "filesystem",
          import_days: 10
        }
      }
    });
    const mockStream = new stream.Readable();
    mockStream.close = () => {};

    const closeStreamStub = sinon.stub(mockStream, "close");
    const closeConnectionStub = sinon.stub(syncAgent.adapter.in, "closeConnection");

    syncAgent.sync(mockStream, new Date())
      .catch(err => {
        expect(err.message).to.be.equal("Expected");
        done();
      });

    mockStream.emit("error", new Error("Expected"));
    expect(closeStreamStub.callCount).to.be.equal(1);
    expect(closeConnectionStub.callCount).to.be.equal(1);
  });

  it("not fail when undefined stream error occurs", (done) => {
    const syncAgent = new SyncAgent({
      client: {
        logger: {
          error: () => {},
          info: () => {}
        },
        post: () => Promise.resolve({})
      },
      ship: {
        private_settings: {
          db_type: "filesystem",
          import_days: 10
        }
      }
    });
    const mockStream = new stream.Readable();
    mockStream.close = () => {};

    const closeStreamStub = sinon.stub(mockStream, "close");

    syncAgent.sync(mockStream, new Date())
      .catch((err) => {
        expect(err).to.be.equal(undefined);
        done();
      });

    mockStream.emit("error", undefined);
    expect(closeStreamStub.callCount).to.be.equal(1);
  });

  it("should send notification about database type error", (done) => {
    const config = {
      client: {
        logger: {
          error: () => {},
          info: () => {}
        },
        post: sinon.spy(() => Promise.resolve({}))
      },
      ship: {
        id: "1234",
        private_settings: {
          db_type: "no_db",
          import_days: 10
        }
      }
    };

    try {
      new SyncAgent(config);
    } catch (err) {}

    setTimeout(() => {
      assert.equal(config.client.post.firstCall.args[0], "1234/notifications");
      assert.equal(config.client.post.firstCall.args[1].status, "error");
      assert.equal(config.client.post.firstCall.args[1].message, "Invalid database type no_db.");
      done();
    }, 1500);
  });

  it("should send notification about errors", (done) => {
    const config = {
      client: {
        logger: {
          error: () => {},
          info: () => {}
        },
        post: sinon.spy(() => Promise.resolve({}))
      },
      ship: {
        id: "1234",
        private_settings: {
          db_type: "no_db",
          import_days: 10
        }
      }
    };

    try {
      new SyncAgent(config);
    } catch (err) {}

    setTimeout(() => {
      assert.equal(config.client.post.firstCall.args[0], "1234/notifications");
      assert.equal(config.client.post.firstCall.args[1].status, "error");
      assert.equal(config.client.post.firstCall.args[1].message, "Invalid database type no_db.");
      done();
    }, 1500);
  });
});
