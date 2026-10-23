// Formatting used by the redesign (src/redesign/format.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { ago, clock, compactRupees, istParts, istTime, rupees, secondsToSquareOff, shortSymbol, signedPct, signedR, signedRupees, tone } from '../src/redesign/format.ts'

const IST = 330 * 60_000
const at = (day, hhmmss) => Date.parse(`${day}T${hhmmss}Z`) - IST

test('rupees use Indian grouping and 2 decimals', () => {
  assert.equal(rupees(123456.789), '₹1,23,456.79')
  assert.equal(rupees(0), '₹0.00')
})

test('signed values carry an arrow and a sign, never colour alone; minus is U+2212', () => {
  assert.equal(signedRupees(377.26), '▲ +₹377.26')
  assert.equal(signedRupees(-119.54), '▼ −₹119.54')
  assert.equal(signedRupees(0), '₹0.00')
  assert.equal(signedR(1.5), '+1.50R')
  assert.equal(signedR(-0.27), '−0.27R')
  assert.equal(signedR(0), '0.00R')
  assert.equal(signedPct(-0.84), '−0.8%')
  assert.deepEqual([tone(2), tone(-2), tone(0), tone(null)], ['gain', 'loss', 'muted', 'muted'])
})

test('compact rupees use K / L / Cr', () => {
  assert.equal(compactRupees(950), '₹950')
  assert.equal(compactRupees(12400), '₹12.4K')
  assert.equal(compactRupees(-320000), '−₹3.2L')
  assert.equal(compactRupees(11000000), '₹1.1Cr')
})

test('symbols are shortened for display', () => {
  assert.equal(shortSymbol('NSE:AARTIPHARM-EQ'), 'AARTIPHARM')
  assert.equal(shortSymbol('NIFTY 22450 PE'), 'NIFTY 22450 PE')
})

test('market state from the IST clock; health status "holiday" wins', () => {
  assert.equal(istParts(at('2026-10-23', '09:05:00')).market, 'Pre-open')
  assert.equal(istParts(at('2026-10-23', '09:15:00')).market, 'Open')
  assert.equal(istParts(at('2026-10-23', '15:30:00')).market, 'Closed')
  assert.equal(istParts(at('2026-10-24', '11:00:00')).market, 'Closed') // Saturday
  assert.equal(istParts(at('2026-11-09', '11:00:00'), 'holiday').market, 'Holiday')
  assert.equal(istTime(at('2026-10-23', '14:34:05')), '14:34')
})

test('square-off countdown ends at 15:15 IST', () => {
  assert.equal(secondsToSquareOff(at('2026-10-23', '15:10:00')), 300)
  assert.equal(secondsToSquareOff(at('2026-10-23', '15:15:00')), null)
  assert.equal(clock(3725), '1:02:05')
  assert.equal(clock(125), '2:05')
})

test('relative "updated" time', () => {
  const now = 1_000_000
  assert.equal(ago(null, now), 'not loaded yet')
  assert.equal(ago(now - 1000, now), 'just now')
  assert.equal(ago(now - 12_000, now), '12s ago')
  assert.equal(ago(now - 240_000, now), '4m ago')
})
