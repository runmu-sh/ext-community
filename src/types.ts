/**
 * The GMCP contract and exported API of `@runmu.sh/ext-community` (id `community`). The JSON schemas the host
 * validates inbound payloads with are `schema/*.json`; this file, they and the README change together.
 */

/** `Client.Community.Kudos`: one player thanked another. */
export interface Kudos {
  /** Who gave it. Shown as "Someone" when missing or when `anonymous`. */
  giver?: string;
  /** Who received it. */
  receiver: string;
  /** What they said, if anything. */
  message?: string;
  /** Hide the giver. */
  anonymous?: boolean;
}

/** `Client.Community.Milestone`: something the community reached. */
export interface Milestone {
  label: string;
}

/**
 * `Client.Community.Event`: any other community moment. `kind` is the toast's title (a `community_` prefix is
 * dropped, so a game can pass its event name as it is), `text` the body (`message` is read when `text` is missing).
 */
export interface CommunityEvent {
  kind: string;
  text?: string;
  message?: string;
}

/** Which of the three a toast is: also the name of its mute setting. */
export type Moment = 'kudos' | 'milestone' | 'event';

/** What a payload becomes: the toast's small label (`kind`), its title and body. */
export interface CommunityToast {
  moment: Moment;
  kind: string;
  title: string;
  body: string;
}

/** `ctx.api('community')`. */
export interface CommunityApi {
  /** Raise a kudos toast for session `sid` (default: the active one), as if the game had sent it. False when muted or empty. */
  kudos(k: Kudos, sid?: string): boolean;
  /** Raise a milestone toast. */
  milestone(m: Milestone, sid?: string): boolean;
  /** Raise any other community toast. */
  event(e: CommunityEvent, sid?: string): boolean;
  /** The pure payload → toast mappers (no effects), for tests and for other clients of the contract. */
  toKudos(k: unknown): CommunityToast | null;
  toMilestone(m: unknown): CommunityToast | null;
  toEvent(e: unknown): CommunityToast | null;
}
