/** Every string the extension shows. */
export const COPY = {
  page: 'Community',
  kudosTitle: 'Kudos',
  milestoneTitle: 'Milestone',
  someone: 'Someone',
  /** `giver → receiver`, then `: message` when there is one. */
  kudosBody: (giver: string, receiver: string, message: string) => `${giver} → ${receiver}${message ? `: ${message}` : ''}`,
  /** What a screen reader hears: the title and body, as the toast reads. */
  spoken: (title: string, body: string) => (body ? `${title}: ${body}` : title),
  showKudos: 'Show kudos',
  showKudosHint: 'a toast when one player thanks another',
  showMilestones: 'Show milestones',
  showMilestonesHint: 'a toast when the community reaches one',
  showEvents: 'Show other community events',
  showEventsHint: 'any other community toast the game sends',
  seconds: 'Toast time',
  secondsHint: 'how long a community toast stays; hovering the toasts holds them',
  group: 'Toasts',
  announce: 'Read them aloud',
  announceHint: 'through the screen reader live region',
} as const;
