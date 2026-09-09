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

test("a duplicate operation is still finalized after the business callback", async () => {
  let finalized = false;
  const result = await drainOutbox(
    [{ ...item, status: "failed", attempts: 1 }],
    async () => ({ status: "duplicate", operationId: item.operationId }),
    {
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
      finalize: async () => ({ status: "error", reason: "ack_network_failure" }),
    },
  );

  assert.equal(result[0].status, "failed");
  assert.match(result[0].lastError || "", /ack_network_failure/);
});
