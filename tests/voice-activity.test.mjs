import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeVoiceActivity } from '../voice-platform/health.mjs';

test('empty activity is neutral rather than claiming uptime', () => {
  const summary = summarizeVoiceActivity([]);
  assert.equal(summary.sampled, 0);
  assert.match(summary.description, /No recorded events/);
});

test('sample counts are accurate and do not interpret unknown event types as errors', () => {
  const summary = summarizeVoiceActivity([
    { event_type: 'connected' },
    { event_type: 'turn_completed' },
    { event_type: 'runtime_error' },
    { event_type: 'custom_event' },
    { event_type: 'turn_completed' },
  ]);
  assert.deepEqual([summary.sampled, summary.completed, summary.errors, summary.connections], [5, 2, 1, 1]);
  assert.match(summary.description, /Last 5 recorded events/);
});

test('invalid event response produces a safe empty summary', () => {
  const summary = summarizeVoiceActivity(null);
  assert.equal(summary.sampled, 0);
});
