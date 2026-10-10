export function formatBugReport({ area, summary, steps, expected, actual, environment, contact = '' }) {
  return [
    `# ${summary.trim()}`,
    `## Area\n${area}`,
    `## Steps to reproduce\n${steps.trim()}`,
    `## Expected behavior\n${expected.trim()}`,
    `## Actual behavior\n${actual.trim()}`,
    `## Browser / device\n${environment.trim() || 'Not provided'}`,
    `## Contact information\n${contact.trim() || 'Not provided'}`,
  ].join('\n\n')
}
