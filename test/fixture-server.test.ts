import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { fileOf, fixtureRoadbooks, listedCount, pushFixtures } from "../scripts/device/fixtureServer.ts";

test("a fixture goes out as the file agentRide hands out, and the app reads it back", () => {
  const [rb] = fixtureRoadbooks();
  const parsed = parseRoadbookFile(fileOf(rb!, 3));
  assert.equal(parsed.name, rb!.name);
  assert.deepEqual(parsed.origin, { app: "agentRide", roadbook: 3, name: rb!.name });
});

test("every fixture is pushed with the token, and the listing is counted", async () => {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.method === "PUT") seen.push(`${req.headers.authorization}|${JSON.parse(body).origin.roadbook}`);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ roadbooks: seen.map(() => ({})) }));
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal(await listedCount(base, "t"), 0);
    const pushed = await pushFixtures(base, "t");
    assert.equal(pushed, fixtureRoadbooks().length);
    assert.deepEqual(
      seen,
      fixtureRoadbooks().map((_, i) => `Bearer t|${i + 1}`),
    );
    assert.equal(await listedCount(base, "t"), pushed);
  } finally {
    server.close();
  }
});
