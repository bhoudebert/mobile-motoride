import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COUNTDOWN_S,
  EMERGENCY_NUMBER,
  TEST_COUNTDOWN_S,
  isPhoneNumber,
  mapLink,
  normalizeNumber,
  parseContact,
  secondsLeft,
  smsUrl,
  telUrl,
} from "../src/core/crashAlert.ts";

test("the countdown is 30 seconds, 10 for the test, and the number to call is 112", () => {
  assert.equal(COUNTDOWN_S, 30);
  assert.equal(TEST_COUNTDOWN_S, 10);
  assert.equal(EMERGENCY_NUMBER, "112");
});

test("a phone number is digits with the usual spaces and dots, an optional +, at least six digits", () => {
  for (const ok of ["0612345678", "+33 6 12 34 56 78", "06.12.34.56.78", "(02) 1234-5678", " +32 475 12 34 56 "])
    assert.equal(isPhoneNumber(ok), true, ok);
  for (const bad of [
    "",
    "abc",
    "12345",
    "+",
    "06 12 34 56 78 90 12 34 56 78 90",
    "0612345678; rm",
    "tel:0612345678",
    "06-12-34-56-ab",
  ])
    assert.equal(isPhoneNumber(bad), false, bad);
});

test("a number loses what a dialler does not need, and keeps a leading +", () => {
  assert.equal(normalizeNumber("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizeNumber("06.12.34.56.78"), "0612345678");
  assert.equal(normalizeNumber(" (02) 1234-5678 "), "0212345678");
});

test("a stored contact is read back, and anything else is nothing", () => {
  assert.deepEqual(parseContact(JSON.stringify({ name: "Anna", number: "+33 6 12 34 56 78" })), {
    name: "Anna",
    number: "+33612345678",
  });
  assert.deepEqual(parseContact(JSON.stringify({ number: "0612345678" })), { name: "", number: "0612345678" });
  assert.equal(parseContact(JSON.stringify({ name: "x".repeat(100), number: "0612345678" }))!.name.length, 60);
  for (const bad of [null, "", "{nope", "{}", JSON.stringify({ number: "abc" }), JSON.stringify({ number: 12345678 })])
    assert.equal(parseContact(bad), null, String(bad));
});

test("the link to the messages app has the number and the text, encoded, and no more than that", () => {
  assert.equal(
    smsUrl("+33 6 12 34 56 78", "à bientôt & merci"),
    "sms:+33612345678?body=%C3%A0%20bient%C3%B4t%20%26%20merci",
  );
  assert.equal(smsUrl("", "x"), "sms:?body=x");
  assert.equal(telUrl("112"), "tel:112");
  assert.equal(telUrl("+33 1 23 45 67 89"), "tel:+33123456789");
});

test("the map link is OpenStreetMap at the position", () => {
  assert.equal(
    mapLink(50.456789, 3.2),
    "https://www.openstreetmap.org/?mlat=50.45679&mlon=3.20000#map=17/50.45679/3.20000",
  );
});

test("seconds left count down to 0 and never below", () => {
  assert.equal(secondsLeft(1000, 1000, 30), 30);
  assert.equal(secondsLeft(1000, 1001, 30), 30);
  assert.equal(secondsLeft(1000, 2000, 30), 29);
  assert.equal(secondsLeft(1000, 30_999, 30), 1);
  assert.equal(secondsLeft(1000, 31_000, 30), 0);
  assert.equal(secondsLeft(1000, 99_000, 30), 0);
});
