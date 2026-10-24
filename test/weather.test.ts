import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conditionOf,
  forecastAt,
  isAlert,
  outlookOf,
  parseForecast,
  samplePoints,
  weatherAnnouncement,
  weigh,
  type HourForecast,
  type SamplePoint,
} from "../src/core/weather.ts";
import { cumulativeDistances } from "../src/core/track.ts";
import { drawLine } from "./helpers/path.ts";

const T0 = Date.UTC(2026, 9, 22, 9, 0, 0);
const H = 3_600_000;

const hour = (i: number, over: Partial<HourForecast> = {}): HourForecast => ({
  time: T0 + i * H,
  tempC: 12,
  precipMm: 0,
  symbol: "partlycloudy_day",
  windMps: 4,
  ...over,
});

test("a MET Norway answer is read hour by hour, with the six hours standing in when the hour is missing", () => {
  const body = {
    properties: {
      timeseries: [
        {
          time: "2026-10-22T10:00:00Z",
          data: {
            instant: { details: { air_temperature: 11.2, wind_speed: 7.6 } },
            next_1_hours: { summary: { symbol_code: "lightrain_day" }, details: { precipitation_amount: 0.4 } },
          },
        },
        {
          time: "2026-10-22T09:00:00Z",
          data: {
            instant: { details: { air_temperature: 10.1, wind_speed: 7.3 } },
            next_1_hours: { summary: { symbol_code: "rain" }, details: { precipitation_amount: 1.5 } },
          },
        },
        {
          time: "2026-10-25T09:00:00Z",
          data: {
            instant: { details: { air_temperature: 8 } },
            next_6_hours: { summary: { symbol_code: "rain" }, details: { precipitation_amount: 6 } },
          },
        },
        { time: "bad", data: {} },
        { time: "2026-10-22T11:00:00Z" },
      ],
    },
  };
  const hours = parseForecast(body);
  assert.equal(hours.length, 3);
  assert.deepEqual(hours[0], {
    time: Date.UTC(2026, 9, 22, 9),
    tempC: 10.1,
    precipMm: 1.5,
    symbol: "rain",
    windMps: 7.3,
  });
  assert.equal(hours[1]!.symbol, "lightrain_day");
  assert.equal(hours[2]!.precipMm, 1);
  assert.equal(hours[2]!.windMps, null);
  for (const bad of [null, {}, { properties: {} }, { properties: { timeseries: "x" } }, "text"])
    assert.deepEqual(parseForecast(bad), []);
});

test("the forecast for a moment is the hour it falls in, or the nearest within 90 minutes", () => {
  const hours = [hour(0), hour(1, { tempC: 9 }), hour(2)];
  assert.equal(forecastAt(hours, T0 + 30 * 60_000)!.time, T0);
  assert.equal(forecastAt(hours, T0 + H + 1)!.tempC, 9);
  assert.equal(forecastAt(hours, T0 + 3 * H + 30 * 60_000)!.time, T0 + 2 * H);
  assert.equal(forecastAt(hours, T0 + 6 * H), null);
  assert.equal(forecastAt(hours, T0 - 4 * H), null);
  assert.equal(forecastAt([], T0), null);
});

test("conditions: dry, light, rain, heavy, thunder, snow and rain on a cold road", () => {
  const at = (over: Partial<HourForecast>) => conditionOf(hour(0, over));
  assert.equal(at({}), "dry");
  assert.equal(at({ precipMm: 0.1 }), "dry");
  assert.equal(at({ precipMm: 0.3 }), "light");
  assert.equal(at({ precipMm: 1 }), "rain");
  assert.equal(at({ precipMm: 3.9 }), "rain");
  assert.equal(at({ precipMm: 4 }), "heavy");
  assert.equal(at({ precipMm: 0.5, symbol: "rainandthunder" }), "storm");
  assert.equal(at({ precipMm: 0, symbol: "lightssleetshowersandthunder_day" }), "storm");
  assert.equal(at({ precipMm: 2, symbol: "heavysnow", tempC: -1 }), "snow");
  assert.equal(at({ precipMm: 1, symbol: "sleet" }), "snow");
  assert.equal(at({ precipMm: 1, tempC: 2 }), "ice");
  assert.equal(at({ precipMm: 0.3, tempC: 0.5 }), "ice");
  assert.equal(at({ precipMm: 1, tempC: 3 }), "rain");
  assert.equal(at({ precipMm: 0, tempC: -3 }), "dry");
  assert.equal(at({ precipMm: null, symbol: null, tempC: null }), "dry");
  assert.deepEqual((["dry", "light", "rain", "heavy", "storm", "snow", "ice"] as const).map(isAlert), [
    false,
    false,
    true,
    true,
    true,
    true,
    true,
  ]);
});

const line = drawLine([{ straight: 100_000 }]);
const cum = cumulativeDistances(line);

test("the points to ask about are here and every 15 km up to 60 km, with the time the rider gets there", () => {
  const pts = samplePoints(line, cum, 10_000, 100_000, 20, T0);
  assert.deepEqual(
    pts.map((p) => p.distM),
    [0, 15_000, 30_000, 45_000, 60_000],
  );
  assert.deepEqual(
    pts.map((p) => p.atM),
    [10_000, 25_000, 40_000, 55_000, 70_000],
  );
  assert.equal(pts[0]!.etaMs, T0);
  assert.equal(pts[1]!.etaMs, T0 + 750_000);
  // Standing still or slow: the speed of a ride on the road is taken.
  assert.equal(samplePoints(line, cum, 0, 100_000, 0, T0)[1]!.etaMs, T0 + (15_000 / 16) * 1000);
  assert.equal(samplePoints(line, cum, 0, 100_000, null, T0)[1]!.etaMs, T0 + (15_000 / 16) * 1000);
});

test("near the finish the last point is the finish, and at the finish there is one", () => {
  const near = samplePoints(line, cum, 90_000, 100_000, 20, T0);
  assert.deepEqual(
    near.map((p) => p.distM),
    [0, 10_000],
  );
  assert.equal(near[1]!.atM, 100_000);
  assert.equal(samplePoints(line, cum, 100_000, 100_000, 20, T0).length, 1);
  assert.equal(samplePoints(line, cum, 130_000, 100_000, 20, T0).length, 1);
  assert.deepEqual(
    samplePoints(line, cum, 0, 100_000, 20, T0)
      .map((p) => p.distM)
      .at(-1),
    60_000,
  );
});

const pt = (distM: number): SamplePoint => ({ distM, atM: distM, lat: 50, lon: 3, etaMs: T0 + distM * 60 });
const outlookFor = (conds: Array<Partial<HourForecast> | null>) =>
  outlookOf(conds.map((c, i) => weigh(pt(i * 15_000), c ? [hour(0, c), hour(1, c)] : null)));

test("the outlook finds the first rain ahead when it is dry here", () => {
  const o = outlookFor([{}, {}, { precipMm: 2 }, { precipMm: 5 }]);
  assert.equal(o.now, "dry");
  assert.equal(o.coming!.condition, "rain");
  assert.equal(o.coming!.point.distM, 30_000);
  assert.equal(o.clearing, null);
});

test("when it is raining here the outlook says where it stops, not where it starts", () => {
  const o = outlookFor([{ precipMm: 2 }, { precipMm: 2 }, {}, { precipMm: 3 }]);
  assert.equal(o.now, "rain");
  assert.equal(o.coming, null);
  assert.equal(o.clearing!.point.distM, 30_000);
});

test("a drizzle is not a warning, a missing forecast is skipped and the coldest point is kept", () => {
  const o = outlookFor([{ tempC: 8 }, { precipMm: 0.3, tempC: 6 }, null, { tempC: 5 }]);
  assert.equal(o.coming, null);
  assert.equal(o.minTempC, 5);
  assert.equal(outlookFor([null, null]).now, null);
  assert.equal(outlookFor([null, null]).minTempC, null);
  assert.equal(outlookOf([]).now, null);
});

test("bad weather coming is said once for its kind, within 30 km, and not when it is already raining", () => {
  const said = new Set<"rain" | "storm">();
  const far = outlookFor([{}, {}, {}, {}, { precipMm: 2 }]);
  assert.equal(weatherAnnouncement(far, said), null);
  const near = outlookFor([{}, {}, { precipMm: 2 }]);
  assert.deepEqual(weatherAnnouncement(near, said), { condition: "rain", distM: 30_000 });
  said.add("rain");
  assert.equal(weatherAnnouncement(near, said), null);
  // Another kind is news.
  const storm = outlookFor([{}, { symbol: "heavyrainandthunder", precipMm: 5 }]);
  assert.deepEqual(weatherAnnouncement(storm, said), { condition: "storm", distM: 15_000 });
  // In the rain already: nothing to announce.
  assert.equal(weatherAnnouncement(outlookFor([{ precipMm: 2 }, { precipMm: 3 }]), new Set()), null);
  assert.equal(weatherAnnouncement(outlookFor([{}, {}]), new Set()), null);
});
