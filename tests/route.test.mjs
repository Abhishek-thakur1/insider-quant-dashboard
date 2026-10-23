// Which dashboard each URL shows (src/route.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveView } from '../src/route.ts'

test('/ with no query or hash shows the new dashboard', () => {
  assert.equal(resolveView('', ''), 'new')
  assert.equal(resolveView('', '#'), 'new')
})

test('?view=classic and #classic show the classic dashboard', () => {
  assert.equal(resolveView('?view=classic', ''), 'classic')
  assert.equal(resolveView('', '#classic'), 'classic')
})

test('#new and ?view=new keep showing the new dashboard (old links)', () => {
  assert.equal(resolveView('', '#new'), 'new')
  assert.equal(resolveView('?view=new', ''), 'new')
})

test('?view=classic wins over a hash', () => {
  assert.equal(resolveView('?view=classic', '#new'), 'classic')
  assert.equal(resolveView('?view=new', '#classic'), 'new')
})

test('unknown values fall back to the new dashboard; other query params are ignored', () => {
  assert.equal(resolveView('?view=old', ''), 'new')
  assert.equal(resolveView('?x=1&view=classic', ''), 'classic')
  assert.equal(resolveView('', '#something'), 'new')
})
