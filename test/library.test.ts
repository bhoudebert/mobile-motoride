import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ImportError,
  importUrlOf,
  isFileLink,
  isImportLink,
  libraryId,
  nameFromFile,
  parseImport,
} from "../src/core/library.ts";
import { drawLine } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";

const line = drawLine([{ straight: 2000 }]);
const gpx = (name: string, extra = "") =>
  `<?xml version="1.0"?><gpx version="1.1"><metadata><name>${name}</name></metadata>${extra}<trk><trkseg>${line
    .map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"/>`)
    .join("")}</trkseg></trk></gpx>`;

test("a roadbook file and a GPX are told apart by their content, whatever the name", () => {
  const file = parseImport(roadbookFile(line, { name: "From agentRide" }), "photo.jpg");
  assert.equal(file.name, "From agentRide");
  assert.equal(file.line.length, line.length);
  const g = parseImport(gpx("A GPX ride"), "ride.json");
  assert.equal(g.name, "A GPX ride");
  assert.equal(g.line.length, line.length);
  assert.equal(g.limits, undefined);
});

test("a byte order mark and leading blanks do not hide the format", () => {
  assert.equal(parseImport("﻿  \n" + gpx("Bom")).name, "Bom");
  assert.equal(parseImport("﻿" + roadbookFile(line, { name: "BomJson" })).name, "BomJson");
});

test("what is neither is refused with a reason", () => {
  for (const text of ["", "hello", "<html></html>", "[1,2]", "{}", "{not json"])
    assert.throws(() => parseImport(text), ImportError, text);
  assert.throws(() => parseImport("hello"), /not a roadbook file or a GPX file/);
  assert.throws(() => parseImport(`{"format":"motoride-roadbook","version":2,"line":"x"}`), /version 2 is newer/);
  assert.throws(() => parseImport(`<gpx version="1.1"><wpt lat="1" lon="1"/></gpx>`), /at least 2 are needed/);
});

test("a file that does not name itself takes the name of the file", () => {
  const unnamed = `<gpx>${"<trk><trkseg>"}${line.map(([a, o]) => `<trkpt lat="${a}" lon="${o}"/>`).join("")}</trkseg></trk></gpx>`;
  assert.equal(parseImport(unnamed, "Sunday_loop.gpx").name, "Sunday loop");
  assert.equal(parseImport(unnamed).name, "Roadbook");
});

test("the same route has the same id, so it is replaced; another route, another id", () => {
  const a = parseImport(gpx("Ride"));
  const b = parseImport(gpx("Ride"));
  assert.equal(a.id, b.id);
  assert.match(a.id, /^ride-[0-9a-z]+$/);
  assert.notEqual(parseImport(gpx("Other")).id, a.id);
  assert.notEqual(libraryId("Ride", line.slice(0, 100)), libraryId("Ride", line));
  assert.notEqual(
    libraryId("Ride", line),
    libraryId(
      "Ride",
      line.map(([la, lo]) => [la + 0.01, lo] as [number, number]),
    ),
  );
});

test("file names are tidied", () => {
  assert.equal(nameFromFile("/sdcard/Download/my_ride.motoride.json"), "my ride");
  assert.equal(nameFromFile("Loop%20one.gpx"), "Loop one");
  assert.equal(nameFromFile(".gpx"), "Roadbook");
});

test("an import link must carry an http or https address", () => {
  assert.equal(
    importUrlOf("mobilemotoride://import?url=https%3A%2F%2Fexample.org%2Fa.json"),
    "https://example.org/a.json",
  );
  assert.equal(
    importUrlOf("mobilemotoride://import?url=http%3A%2F%2F192.168.1.5%3A8000%2Fr%2Ftoken"),
    "http://192.168.1.5:8000/r/token",
  );
  assert.equal(importUrlOf("mobilemotoride://import?url=file%3A%2F%2F%2Fetc%2Fpasswd"), null);
  assert.equal(importUrlOf("mobilemotoride://import?url=javascript%3Aalert(1)"), null);
  assert.equal(importUrlOf("mobilemotoride://import"), null);
  assert.equal(importUrlOf("mobilemotoride://replay/ride"), null);
  assert.equal(isImportLink("mobilemotoride://import?url=x"), true);
  assert.equal(isImportLink("mobilemotoride://replay/ride"), false);
  assert.equal(isFileLink("content://media/external/file/12"), true);
  assert.equal(isFileLink("file:///sdcard/a.gpx"), true);
  assert.equal(isFileLink("https://example.org"), false);
});

import { parseStored, serializeStored } from "../src/core/library.ts";

test("a kept roadbook is read back as it was, and a damaged file is skipped", () => {
  const rb = parseImport(gpx("Kept"));
  const back = parseStored(serializeStored({ roadbook: rb, importedAt: 1234 }));
  assert.deepEqual(back, { roadbook: rb, importedAt: 1234 });
  for (const bad of [
    "",
    "{",
    "[]",
    `{"v":2}`,
    `{"v":1,"importedAt":1,"roadbook":{"id":"a","name":"b","stops":[],"line":[[1,2]]}}`,
  ])
    assert.equal(parseStored(bad), null, bad);
  assert.equal(
    parseStored(`{"v":1,"importedAt":1,"roadbook":{"id":"a","name":"b","stops":[],"line":[[1,2],["x",3]]}}`),
    null,
  );
});
