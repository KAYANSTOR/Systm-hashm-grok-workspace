import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Sql } from "../db.ts";
import { resolveCanonicalAuthIdentity } from "./identity.server.ts";

function fakeSql(options: {
  user?: { id: string; email: string };
  account?: { id: string; accountId: string; userId: string };
  employee?: {
    employeeId: string;
    userId: string;
    organizationId: string;
    employeeActive: boolean;
    linkActive: boolean;
    organizationExists: boolean;
  };
}): Sql {
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    void strings;
    void values;
    return [] as T[];
  }) as unknown as Sql;
  sql.query = async <T>(text: string, params: unknown[] = []) => {
    if (text.includes('from "user"')) {
      return (options.user ? [options.user] : []) as T[];
    }
    if (text.includes('from "account"')) {
      return (options.account ? [options.account] : []) as T[];
    }
    if (text.includes("from employee_users")) {
      return (options.employee ? [options.employee] : []) as T[];
    }
    throw new Error(`unexpected query: ${text} ${JSON.stringify(params)}`);
  };
  sql.transaction = async () => {
    throw new Error("not used in resolver tests");
  };
  return sql;
}

const employee = {
  employeeId: "employee-1",
  userId: "user-1",
  organizationId: "org-warehouse-2",
  employeeActive: true,
  linkActive: true,
  organizationExists: true,
};
const account = {
  id: "account-1",
  accountId: "phone-773303455@accounts.hashem.local",
  userId: "user-1",
};

function resolvedSql() {
  return fakeSql({
    user: { id: "user-1", email: "phone-773303455@accounts.hashem.local" },
    account,
    employee,
  });
}

describe("resolveCanonicalAuthIdentity", () => {
  it("resolves all supported Yemen phone formats to one Better Auth identity", async () => {
    for (const phone of [
      "+967773303455",
      "00967773303455",
      "967773303455",
      "0773303455",
      "773303455",
    ]) {
      const result = await resolveCanonicalAuthIdentity(resolvedSql(), phone);
      assert.equal(result.status, "resolved");
      if (result.status === "resolved") {
        assert.equal(result.phone, "773303455");
        assert.equal(result.userId, "user-1");
        assert.equal(result.organizationId, "org-warehouse-2");
      }
    }
  });

  it("preserves the linked non-default organization", async () => {
    const result = await resolveCanonicalAuthIdentity(resolvedSql(), "773303455");
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") assert.notEqual(result.organizationId, "default_org");
  });

  it("returns repair_required when the Better Auth user has no employee linkage", async () => {
    const result = await resolveCanonicalAuthIdentity(
      fakeSql({
        user: { id: "user-1", email: "phone-773303455@accounts.hashem.local" },
        account,
      }),
      "773303455",
    );
    assert.equal(result.status, "repair_required");
    assert.equal(result.userId, "user-1");
  });

  it("denies inactive employee or inactive linkage", async () => {
    const result = await resolveCanonicalAuthIdentity(
      fakeSql({
        user: { id: "user-1", email: "phone-773303455@accounts.hashem.local" },
        account,
        employee: { ...employee, employeeActive: false },
      }),
      "773303455",
    );
    assert.equal(result.status, "inactive");
  });
});
