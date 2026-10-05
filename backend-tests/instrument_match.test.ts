import { test } from "node:test";
import assert from "node:assert/strict";

import { matchInstrumentForClassName } from "../src/lib/rpc/instrument-match.ts";

const INSTRUMENTS = ["Vocals", "Guitar", "Piano / Keyboard", "Violin", "Tabla", "Drums", "Flute", "Harmonium", "Ukulele"];

test("matchInstrumentForClassName: simple substring match", () => {
  assert.equal(matchInstrumentForClassName("Guitar Beginners", INSTRUMENTS), "Guitar");
  assert.equal(matchInstrumentForClassName("Advanced Tabla", INSTRUMENTS), "Tabla");
});

test("matchInstrumentForClassName: case-insensitive", () => {
  assert.equal(matchInstrumentForClassName("GUITAR basics", INSTRUMENTS), "Guitar");
  assert.equal(matchInstrumentForClassName("flute for kids", INSTRUMENTS), "Flute");
});

test("matchInstrumentForClassName: longest/most specific name wins", () => {
  assert.equal(matchInstrumentForClassName("Piano / Keyboard Group A", INSTRUMENTS), "Piano / Keyboard");
});

test("matchInstrumentForClassName: no match stays null", () => {
  assert.equal(matchInstrumentForClassName("Theory Workshop", INSTRUMENTS), null);
  assert.equal(matchInstrumentForClassName("", INSTRUMENTS), null);
});

test("matchInstrumentForClassName: empty instrument list never matches", () => {
  assert.equal(matchInstrumentForClassName("Guitar Beginners", []), null);
});
