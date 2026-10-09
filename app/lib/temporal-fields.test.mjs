import assert from "node:assert/strict";

const {
  formatHm,
  formatHmDisplay,
  formatYmdDisplay,
  HOUR_OPTIONS,
  localDateToYmd,
  MINUTE_OPTIONS,
  parseHm,
  todayYmd,
  tomorrowYmd,
  ymdToLocalDate,
} = await import("./temporal-fields.ts");

{
  assert.equal(ymdToLocalDate("not-a-date"), undefined);
  assert.equal(ymdToLocalDate(""), undefined);
  const date = ymdToLocalDate("2026-08-17");
  assert.ok(date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 7);
  assert.equal(date.getDate(), 17);
  assert.equal(localDateToYmd(date), "2026-08-17");
  assert.equal(formatYmdDisplay("2026-08-17"), "17 Aug 2026");
}

{
  const noon = new Date(2026, 7, 17, 12, 0, 0);
  assert.equal(todayYmd(noon), "2026-08-17");
  assert.equal(tomorrowYmd(noon), "2026-08-18");

  // Month / year rollover
  assert.equal(tomorrowYmd(new Date(2026, 0, 31, 9, 0, 0)), "2026-02-01");
  assert.equal(tomorrowYmd(new Date(2026, 11, 31, 9, 0, 0)), "2027-01-01");
}

{
  assert.equal(parseHm(""), null);
  assert.equal(parseHm("25:00"), null);
  assert.deepEqual(parseHm("08:30"), { hour: "08", minute: "30" });
  assert.equal(formatHm("8", "5"), "08:05");
  assert.equal(formatHmDisplay("08:30"), "08:30");
  assert.equal(HOUR_OPTIONS.length, 24);
  assert.equal(MINUTE_OPTIONS.length, 60);
  assert.equal(HOUR_OPTIONS[0], "00");
  assert.equal(HOUR_OPTIONS[23], "23");
  assert.equal(MINUTE_OPTIONS[59], "59");
}

console.log("temporal-fields unit tests passed");
