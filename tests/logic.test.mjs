// Data shaping for the redesign's cards and charts (src/redesign/logic.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { byDetector, cumulative, extent, funnel, heatTiles, impliedPrice, inRange, isFlagged, notAlertedReason, signalsByTrade, statsRows, stopToTarget, wasAlerted, SMALL_SAMPLE } from '../src/redesign/logic.ts'

const trade = (o) => ({ id: 1, symbol: 'NSE:X-EQ', side: 'LONG', entryPrice: 100, timestamp: 0, detectorName: 'D', size: 10, ...o })

test('stats leave flagged rows out by default; including them returns every row (owner, 31 Oct)', () => {
  const clean = trade({ id: 1, pnl: 10, r_multiple: 1, exitTimestamp: 1000, dataQuality: [] })
  const noField = trade({ id: 2, pnl: 5, r_multiple: 0.5, exitTimestamp: 2000 })
  const synthetic = trade({ id: 3, pnl: 0, r_multiple: 0, exitTimestamp: 1500, dataQuality: ['synthetic_close'] })
  const approx = trade({ id: 4, pnl: -20, r_multiple: -1, exitTimestamp: 1800, dataQuality: ['pre_sizing_approx', 'duration_unverified'] })
  const rows = [clean, noField, synthetic, approx]
  assert.deepEqual(rows.map(isFlagged), [false, false, true, true])
  assert.deepEqual(statsRows(rows, false).map((t) => t.id), [1, 2])
  assert.equal(statsRows(rows, true), rows, 'opt-in: the same rows, nothing dropped')
  assert.deepEqual(statsRows([], false), [])
  // the cumulative curve built from the default rows never includes the synthetic 0R close
  assert.deepEqual(cumulative(statsRows(rows, false), 'r').map((p) => p.v), [1, 1.5])
})

test('stop-to-target progress is clamped and null when a level is missing', () => {
  assert.equal(stopToTarget({ stopLoss: 90, target: 110 }, 100), 50)
  assert.equal(stopToTarget({ stopLoss: 90, target: 110 }, 80), 0)
  assert.equal(stopToTarget({ stopLoss: 110, target: 85 }, 97.5), 50) // a SHORT: stop above, target below
  assert.equal(stopToTarget({ target: 110 }, 100), null)
  assert.equal(stopToTarget({ stopLoss: 90, target: 110 }, null), null)
})

test('implied price from live P&L and quantity', () => {
  assert.equal(impliedPrice(trade({ size: 10 }), 50), 105)
  assert.equal(impliedPrice(trade({ side: 'SHORT', size: 10 }), 50), 95)
  assert.equal(impliedPrice(trade({ size: 0, actualSize: 0 }), 50), null)
  assert.equal(impliedPrice(trade({}), undefined), null)
})

test('cumulative series in exit order, skipping rows without the value', () => {
  const ts = [trade({ exitTimestamp: 3, r_multiple: -1, pnl: -10 }), trade({ exitTimestamp: 1, r_multiple: 2, pnl: 30 }), trade({ exitTimestamp: 2, pnl: 5 })]
  assert.deepEqual(cumulative(ts, 'r').map((p) => p.v), [2, 1])
  assert.deepEqual(cumulative(ts, 'pnl').map((p) => p.v), [30, 35, 25])
})

test('range keeps points from the latest one back and re-bases to the window start', () => {
  const D = 86_400_000
  const pts = [{ x: 0, v: 1, label: '' }, { x: 5 * D, v: 3, label: '' }, { x: 9 * D, v: 2, label: '' }]
  assert.deepEqual(inRange(pts, '1W').map((p) => p.v), [2, 1]) // base = value before the window (1)
  assert.equal(inRange(pts, 'ALL'), pts)
  assert.deepEqual(inRange([], '1D'), [])
})

test('per-detector rows carry n and a small-sample flag', () => {
  const rows = byDetector([trade({ detectorName: 'A', r_multiple: 1, pnl: 10 }), trade({ detectorName: 'A', r_multiple: -0.5, pnl: -5 }), trade({ detectorName: 'B', r_multiple: 2, pnl: 20 })])
  assert.equal(rows[0].detector, 'A'); assert.equal(rows[0].n, 2); assert.equal(rows[0].totalR, 0.5); assert.equal(rows[0].wins, 1)
  assert.equal(rows[0].small, true)
  assert.equal(SMALL_SAMPLE, 30)
})

test('funnel: fires → rejected by gate → passed → alerted', () => {
  const s = (o) => ({ id: 'x', firedAt: 0, symbol: 'S', detector: 'D', side: 'LONG', score: 70, threshold: 78, outcome: 'REJECTED', rejectedAt: null, regimeClass: null, marketRegime: null, alerted: false, suppressedReason: null, dataQuality: [], tradeId: null, ...o })
  const f = funnel([s({}), s({}), s({ rejectedAt: 'EV' }), s({ outcome: 'PASSED', alerted: true }), s({ outcome: 'PASSED', suppressedReason: 'CAPITAL_SKIP' }), s({ outcome: 'ERROR' })])
  assert.equal(f.fires, 6); assert.equal(f.rejectedTotal, 3); assert.deepEqual(f.rejected, [{ reason: 'SCORE', n: 2 }, { reason: 'EV', n: 1 }])
  assert.equal(f.passed, 2); assert.equal(f.alerted, 1); assert.equal(f.errors, 1); assert.deepEqual(f.suppressed, [{ reason: 'CAPITAL_SKIP', n: 1 }])
})

test('heat tiles: one per symbol, fired names counted, return from closed trades', () => {
  const sig = { id: 'x', firedAt: 0, detector: 'D', side: 'LONG', threshold: 78, outcome: 'REJECTED', rejectedAt: null, regimeClass: null, marketRegime: null, suppressedReason: null, dataQuality: [], tradeId: null }
  const tiles = heatTiles([{ ...sig, symbol: 'A', score: 60, alerted: false }, { ...sig, symbol: 'A', score: 72, alerted: false }, { ...sig, symbol: 'B', score: 80, alerted: true }],
    [trade({ symbol: 'A', pnl: 20, entryPrice: 100, size: 10 })])
  const a = tiles.find((t) => t.symbol === 'A'); const b = tiles.find((t) => t.symbol === 'B')
  assert.equal(a.fires, 2); assert.equal(a.bestScore, 72); assert.equal(a.retPct, 2)
  assert.equal(b.alerted, true); assert.equal(b.retPct, null)
})

test('extent always includes zero and pads', () => {
  const [lo, hi] = extent([2, 4])
  assert.ok(lo < 0 && hi > 4)
  assert.deepEqual(extent([]), [-1, 1])
})

test('alerted vs recorded-only: the signal log decides, the gated flag is the fallback', () => {
  const s = (o) => ({ id: 'x', firedAt: 0, symbol: 'S', detector: 'D', side: 'LONG', score: 70, threshold: 78, outcome: 'REJECTED', rejectedAt: null, regimeClass: null, marketRegime: null, alerted: false, suppressedReason: null, dataQuality: [], tradeId: null, ...o })
  const by = signalsByTrade([s({ tradeId: 1, alerted: true, outcome: 'PASSED' }), s({ tradeId: 2 }), s({ tradeId: null })])
  assert.equal(by.size, 2)
  assert.equal(wasAlerted({ id: 1, gated: false }, by), true)
  assert.equal(wasAlerted({ id: 2, gated: true }, by), false) // the log wins over the flag
  assert.equal(wasAlerted({ id: 9, gated: true }, by), true) // no log row: fall back to gated
  assert.equal(wasAlerted({ id: 9 }, by), false)
})

test('not-alerted reason from the signal row', () => {
  const s = (o) => ({ id: 'x', firedAt: 0, symbol: 'S', detector: 'D', side: 'LONG', score: 76, threshold: 78, outcome: 'REJECTED', rejectedAt: null, regimeClass: null, marketRegime: null, alerted: false, suppressedReason: null, dataQuality: [], tradeId: 1, ...o })
  assert.equal(notAlertedReason(undefined), 'Not alerted')
  assert.equal(notAlertedReason(s({})), 'score 76 < 78')
  assert.equal(notAlertedReason(s({ rejectedAt: 'EV', score: 85 })), 'EV gate')
  assert.equal(notAlertedReason(s({ rejectedAt: 'REGIME' })), 'Regime gate')
  assert.equal(notAlertedReason(s({ outcome: 'ERROR' })), 'Filter error')
  assert.equal(notAlertedReason(s({ outcome: 'PASSED', suppressedReason: 'CAPITAL_SKIP' })), 'Passed, not sent: capital skip')
  assert.equal(notAlertedReason(s({ score: null, threshold: null })), 'Not alerted')
})
