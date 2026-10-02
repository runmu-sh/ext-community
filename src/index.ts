/**
 * Community (`@runmu.sh/ext-community`, id `community`): the game's community moments as toasts.
 *
 * GMCP `Client.Community.Kudos`, `.Milestone` and `.Event` (contracts in `schema/`, checked by the host before
 * the handler runs) → `mu.ui.toast` with a kind label, a burst `group` and the player's toast time, plus
 * `mu.a11y.announce`. These are events, not state: a replayed one (the GMCP snapshot on reconnect, a late
 * activation) raises nothing, and only the client that owns the session's effects toasts and speaks, so a
 * player with three tabs open sees one toast. Each kind can be muted per world. No panel, nothing sent.
 */
import { defineExtension, type EventMeta, type Mu } from '@muclient/sdk';
import { COPY } from './copy';
import type { CommunityApi, CommunityEvent, CommunityToast, Kudos, Milestone, Moment } from './types';

export type { CommunityApi, CommunityEvent, CommunityToast, Kudos, Milestone, Moment } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** `Client.Community.Kudos` → toast. Null without a receiver. */
export function toKudos(d: unknown): CommunityToast | null {
  if (!isObj(d)) return null;
  const receiver = str(d.receiver);
  if (!receiver) return null;
  const giver = d.anonymous === true ? COPY.someone : str(d.giver) || COPY.someone;
  return { moment: 'kudos', kind: 'kudos', title: COPY.kudosTitle, body: COPY.kudosBody(giver, receiver, str(d.message)) };
}
/** `Client.Community.Milestone` → toast. Null without a label. */
export function toMilestone(d: unknown): CommunityToast | null {
  const label = isObj(d) ? str(d.label) : str(d);
  return label ? { moment: 'milestone', kind: 'milestone', title: COPY.milestoneTitle, body: label } : null;
}
/** `Client.Community.Event` → toast: `kind` (without a `community_` prefix) is the title. Null without a kind. */
export function toEvent(d: unknown): CommunityToast | null {
  if (!isObj(d)) return null;
  const title = str(d.kind).replace(/^community_/i, '');
  if (!title) return null;
  return { moment: 'event', kind: 'info', title, body: str(d.text) || str(d.message) };
}

/** Setting keys, per world with an all-worlds fallback. */
export const KEYS = { kudos: 'kudos', milestone: 'milestones', event: 'events', seconds: 'toastSeconds', announce: 'announce' } as const;
const DEFAULT_SECONDS = 7;
/** The burst group each moment toasts under (3 within 2 s become one "N new …" toast). Milestones are rare and never grouped. */
const GROUP: Record<Moment, string | undefined> = { kudos: 'community.kudos', milestone: undefined, event: 'community.event' };

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;

    mu.settings.define({
      title: COPY.page,
      items: [
        { key: KEYS.kudos, label: COPY.showKudos, hint: COPY.showKudosHint, default: true, kind: 'toggle', group: COPY.group },
        { key: KEYS.milestone, label: COPY.showMilestones, hint: COPY.showMilestonesHint, default: true, kind: 'toggle', group: COPY.group },
        { key: KEYS.event, label: COPY.showEvents, hint: COPY.showEventsHint, default: true, kind: 'toggle', group: COPY.group },
        { key: KEYS.seconds, label: COPY.seconds, hint: COPY.secondsHint, default: DEFAULT_SECONDS, kind: 'range', min: 2, max: 60, step: 1, unit: 's', group: COPY.group },
        { key: KEYS.announce, label: COPY.announce, hint: COPY.announceHint, default: true, kind: 'toggle', group: COPY.group },
      ],
    });

    const on = (key: string, sid: string | undefined) => mu.settings.get<boolean>(key, sid ? { sid } : undefined) !== false;
    const seconds = (sid: string | undefined) => {
      const n = Number(mu.settings.get<number>(KEYS.seconds, sid ? { sid } : undefined));
      return Number.isFinite(n) && n > 0 ? Math.min(60, Math.max(2, n)) : DEFAULT_SECONDS;
    };

    /** Show one toast. `meta` is the game event's, when there is one. */
    const raise = (t: CommunityToast | null, sid: string | undefined, meta?: EventMeta): boolean => {
      if (!t) return false;
      // An event delivered again (the snapshot on reconnect, a late activation) was shown the first time.
      if (meta?.replay) return false;
      if (!on(KEYS[t.moment], sid)) return false;
      const group = GROUP[t.moment];
      mu.ui.toast(t.title, t.body || undefined, { kind: t.kind, timeoutMs: seconds(sid) * 1000, ...(group ? { group } : {}) });
      // The toast follows effect ownership by itself; the live region is ours to gate.
      if (on(KEYS.announce, sid) && mu.effects.owner(sid)) mu.a11y.announce(COPY.spoken(t.title, t.body));
      return true;
    };

    mu.gmcp.on('Client.Community', (data, meta) => {
      const leaf = meta.pkg.toLowerCase();
      const t = leaf === 'client.community.kudos' ? toKudos(data)
        : leaf === 'client.community.milestone' ? toMilestone(data)
        : leaf === 'client.community.event' ? toEvent(data)
        : null;
      if (t) raise(t, meta.sid, meta);
      else if (leaf.startsWith('client.community.')) mu.log.warn(`${meta.pkg}: nothing to show`, data);
    });

    const sidOr = (sid?: string) => sid ?? mu.sessions.active()?.id;
    const api: CommunityApi = {
      kudos: (k: Kudos, sid?: string) => raise(toKudos(k), sidOr(sid)),
      milestone: (m: Milestone, sid?: string) => raise(toMilestone(m), sidOr(sid)),
      event: (e: CommunityEvent, sid?: string) => raise(toEvent(e), sidOr(sid)),
      toKudos, toMilestone, toEvent,
    };
    ctx.exports(() => api);
    return api;
  },
});
