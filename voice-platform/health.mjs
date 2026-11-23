// Summarize only the most recent event sample returned to this browser.
// These counts are observational, not a service-uptime or reliability guarantee.
export function summarizeVoiceActivity(events) {
  const rows = Array.isArray(events) ? events : [];
  const count = type => rows.filter(row => row?.event_type === type).length;
  const completed = count('turn_completed');
  const errors = count('runtime_error');
  const connections = count('connected');
  return {
    sampled: rows.length,
    completed,
    errors,
    connections,
    description: rows.length
      ? `Last ${rows.length} recorded events: ${completed} completed turns, ${errors} runtime errors, ${connections} connections.`
      : 'No recorded events for this deployment.',
  };
}
