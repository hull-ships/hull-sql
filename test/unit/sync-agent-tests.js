/* global describe, it */
const { expect } = require("chai");
const sinon = require("sinon");
const moment = require("moment");
const stream = require("stream");

const SyncAgent = require("../../server/lib/sync-agent.js");

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

  describe("idKey", () => {
    it("should return 'userId'", () => {
      const syncAgent = new SyncAgent({ ship: { private_settings:
        { db_type: "filesystem", import_type: "users" } } });
      expect(syncAgent.idKey()).to.equal("userId");
    });

    it("should return 'accountId'", () => {
      const syncAgent = new SyncAgent({ ship: { private_settings:
        { db_type: "filesystem", import_type: "accounts" } } });
      expect(syncAgent.idKey()).to.equal("accountId");
    });

    it("should return 'userId'", () => {
      const syncAgent = new SyncAgent({ ship: { private_settings:
        { db_type: "filesystem", import_type: "events" } } });
      expect(syncAgent.idKey()).to.equal("userId");
    });
  });

  describe("dataKey", () => {
    it("should return 'traits'", () => {
      const syncAgent = new SyncAgent({ ship: { private_settings:
        { db_type: "filesystem", import_type: "users" } } });
      expect(syncAgent.dataKey()).to.equal("traits");
    });

    it("should return 'traits'", () => {
      const syncAgent = new SyncAgent({ ship: { private_settings:
        { db_type: "filesystem", import_type: "accounts" } } });
      expect(syncAgent.dataKey()).to.equal("traits");
    });

    it("should return 'properties'", () => {
      const syncAgent = new SyncAgent({ ship: { private_settings:
        { db_type: "filesystem", import_type: "events" } } });
      expect(syncAgent.dataKey()).to.equal("properties");
    });
  });
});
