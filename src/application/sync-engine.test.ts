import test from "node:test";
import assert from "node:assert/strict";
import { createOutboxItem } from "../domain/outbox.ts";
import { drainOutbox } from "./sync-engine.ts";

const item = createOutboxItem({
  operationId: "invoice.save:inv-test-1",
  operationType: "invoice.save",
  documentId: "inv-test-1",
  orgId: "default_org",
  deviceId: "device-a",
  payload: { id: "inv-test-1" },
});

test("finalizes only after the business apply callback succeeds", async () => {
  const events: string[] = [];
  const result = await drainOutbox(
    [item],
    async () => {
      events.push("apply");
      return { status: "applied", operationId: item.operationId };
    },
    {
      preflight: async () => ({ status: "ok" }),
      finalize: async () => {
        events.push("finalize");
        return { status: "completed", operationId: item.operationId };
      },
    },
  );

  assert.deepEqual(events, ["apply", "finalize"]);
  assert.equal(result[0].status, "done");
  assert.equal(result[0].attempts, 1);
});

test("does not register or finalize an operation when its business mutation fails", async () => {
  const events: string[] = [];
  const result = await drainOutbox(
    [item],
    async () => {
      events.push("business");
      throw new Error("business mutation failed");
    },
    {
      preflight: async () => ({ status: "ok" }),
      finalize: async () => {
        events.push("finalize");
        return { status: "completed", operationId: item.operationId };
      },
    },
  );

  assert.deepEqual(events, ["business"]);
  assert.equal(result[0].status, "failed");
});

test("a duplicate operation is still finalized after the business callback", async () => {
  let finalized = false;
  const result = await drainOutbox(
    [{ ...item, status: "failed", attempts: 1 }],
    async () => ({ status: "duplicate", operationId: item.operationId }),
    {
      preflight: async () => ({ status: "ok" }),
      finalize: async () => {
        finalized = true;
        return { status: "already_applied", operationId: item.operationId };
      },
    },
  );

  assert.equal(finalized, true);
  assert.equal(result[0].status, "done");
});

test("finalization failure keeps the operation retryable", async () => {
  const result = await drainOutbox(
    [item],
    async () => ({ status: "applied", operationId: item.operationId }),
    {
      preflight: async () => ({ status: "ok" }),
      finalize: async () => ({ status: "error", reason: "ack_network_failure" }),
    },
  );

  assert.equal(result[0].status, "failed");
  assert.match(result[0].lastError || "", /ack_network_failure/);
});

test("stale offline write is blocked before business mutation", async () => {
  let applied = false;
  const result = await drainOutbox(
    [{
      ...item,
      payload: { id: item.documentId, syncVersion: 1 },
    }],
    async () => {
      applied = true;
      return { status: "applied", operationId: item.operationId };
    },
    {
      preflight: async () => ({
        status: "conflict",
        reason: "stale_version",
        conflictId: "conflict:test",
        baseVersion: 1,
        serverVersion: 2,
      }),
    },
  );

  assert.equal(applied, false);
  assert.equal(result[0].status, "failed");
  assert.match(result[0].lastError || "", /^SYNC_CONFLICT:conflict:test:base=1:server=2$/);
});
