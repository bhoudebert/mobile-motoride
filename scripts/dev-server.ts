// A local agentRide server for the phone on the USB cable (README, "Try live sharing with a local server"):
// starts ../agentRide's server, makes a rider if there is none, forwards the port, and sets the server in the app.
// The server reads agentRide's .env too. A new server gets the test roadbooks (test/fixtures/roadbooks) pushed to it, to try the list on the phone.
// Ctrl-C stops it. The test of the phone (`npm run smoke:device`) replaces the app's server; run this again after it.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fixtureRoadbooks, listedCount, pushFixtures } from "./device/fixtureServer.ts";

const agentRide = resolve(import.meta.dirname, "../../agentRide");
const data = process.env.RIDE_DEV_DIR ?? join(homedir(), "ride-dev-data");
const port = process.env.RIDE_SERVER_PORT ?? "18973";

if (!existsSync(join(agentRide, "src/serve.ts"))) {
  console.error(`agentRide is not at ${agentRide}`);
  process.exit(1);
}
mkdirSync(data, { recursive: true });
// agentRide's own .env (Claude key, traffic, Mapillary...), as `npm run serve` there loads it: the server has every
// feature. The variables set below win over the file (node does not override the environment).
const ENV_FILE = "--env-file-if-exists=.env";
const env = { ...process.env, RIDE_DATA_DIR: data, RIDE_SERVER_PORT: port };

const tokenFile = join(data, "token.txt");
if (!existsSync(tokenFile)) {
  const added = execFileSync("node", [ENV_FILE, "src/admin.ts", "add", "dev@example.org"], {
    cwd: agentRide,
    env,
  }).toString();
  writeFileSync(tokenFile, /mrt_[A-Za-z0-9_-]+/.exec(added)![0]);
}
const token = readFileSync(tokenFile, "utf8").trim();

const server = spawn("node", [ENV_FILE, "src/serve.ts"], { cwd: agentRide, env, stdio: "inherit" });
const stop = () => {
  server.kill();
  try {
    execFileSync("adb", ["reverse", "--remove", `tcp:${port}`]);
  } catch {
    // Already gone.
  }
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await seedRoadbooks();

try {
  execFileSync("adb", ["reverse", `tcp:${port}`, `tcp:${port}`]);
  const link = `mobilemotoride://server?url=${encodeURIComponent(`http://localhost:${port}`)}&token=${token}`;
  execFileSync("adb", ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `'${link}'`]);
  console.log(`Server on http://localhost:${port}, token in ${tokenFile}. Answer "Use it" on the phone. Ctrl-C stops.`);
} catch {
  console.log("No phone through adb: the server runs, set it by hand in the app (Menu, Server) when one is connected.");
}

/** Push the test roadbooks once the server is up, unless it keeps some already (a re-run adds nothing). */
async function seedRoadbooks() {
  const base = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 30 && !up; i++) {
    up = await fetch(`${base}/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) return console.log("The server did not answer: no test roadbook pushed.");
  if (((await listedCount(base, token)) ?? 0) > 0) return;
  const pushed = await pushFixtures(base, token);
  console.log(
    pushed > 0
      ? `${pushed} of ${fixtureRoadbooks().length} test roadbooks pushed to the server.`
      : "This agentRide did not take the test roadbooks (PUT /roadbooks): the roadbook list stays empty.",
  );
}
