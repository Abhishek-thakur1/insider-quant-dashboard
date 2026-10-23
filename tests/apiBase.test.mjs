import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase } from '../src/apiBase.ts';

test('https page ignores an http:// API URL and uses the relative /api route', () => {
  assert.equal(resolveApiBase('http://example.internal:8080', 'https:'), '');
});

test('https page keeps an https:// API URL', () => {
  assert.equal(resolveApiBase('https://api.example.com/', 'https:'), 'https://api.example.com');
});

test('http page (local dev) keeps an http:// API URL', () => {
  assert.equal(resolveApiBase('http://localhost:8080', 'http:'), 'http://localhost:8080');
});

test('unset or blank URL means relative', () => {
  assert.equal(resolveApiBase(undefined, 'https:'), '');
  assert.equal(resolveApiBase('  ', 'http:'), '');
});
