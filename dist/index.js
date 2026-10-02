// src/index.ts
import { defineExtension } from "@muclient/sdk";

// src/copy.ts
var COPY = {
  page: "Community",
  kudosTitle: "Kudos",
  milestoneTitle: "Milestone",
  someone: "Someone",
  /** `giver → receiver`, then `: message` when there is one. */
  kudosBody: (giver, receiver, message) => `${giver} \u2192 ${receiver}${message ? `: ${message}` : ""}`,
  /** What a screen reader hears: the title and body, as the toast reads. */
  spoken: (title, body) => body ? `${title}: ${body}` : title,
  showKudos: "Show kudos",
  showKudosHint: "a toast when one player thanks another",
  showMilestones: "Show milestones",
  showMilestonesHint: "a toast when the community reaches one",
  showEvents: "Show other community events",
  showEventsHint: "any other community toast the game sends",
  seconds: "Toast time",
  secondsHint: "how long a community toast stays; hovering the toasts holds them",
  group: "Toasts",
  announce: "Read them aloud",
  announceHint: "through the screen reader live region"
};

// src/index.ts
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var str = (v) => typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
function toKudos(d) {
  if (!isObj(d)) return null;
  const receiver = str(d.receiver);
  if (!receiver) return null;
  const giver = d.anonymous === true ? COPY.someone : str(d.giver) || COPY.someone;
  return { moment: "kudos", kind: "kudos", title: COPY.kudosTitle, body: COPY.kudosBody(giver, receiver, str(d.message)) };
}
function toMilestone(d) {
  const label = isObj(d) ? str(d.label) : str(d);
  return label ? { moment: "milestone", kind: "milestone", title: COPY.milestoneTitle, body: label } : null;
}
function toEvent(d) {
  if (!isObj(d)) return null;
  const title = str(d.kind).replace(/^community_/i, "");
  if (!title) return null;
  return { moment: "event", kind: "info", title, body: str(d.text) || str(d.message) };
}
var KEYS = { kudos: "kudos", milestone: "milestones", event: "events", seconds: "toastSeconds", announce: "announce" };
var DEFAULT_SECONDS = 7;
var GROUP = { kudos: "community.kudos", milestone: void 0, event: "community.event" };
var index_default = defineExtension({
  activate(ctx) {
    const mu = ctx.mu;
    mu.settings.define({
      title: COPY.page,
      items: [
        { key: KEYS.kudos, label: COPY.showKudos, hint: COPY.showKudosHint, default: true, kind: "toggle", group: COPY.group },
        { key: KEYS.milestone, label: COPY.showMilestones, hint: COPY.showMilestonesHint, default: true, kind: "toggle", group: COPY.group },
        { key: KEYS.event, label: COPY.showEvents, hint: COPY.showEventsHint, default: true, kind: "toggle", group: COPY.group },
        { key: KEYS.seconds, label: COPY.seconds, hint: COPY.secondsHint, default: DEFAULT_SECONDS, kind: "range", min: 2, max: 60, step: 1, unit: "s", group: COPY.group },
        { key: KEYS.announce, label: COPY.announce, hint: COPY.announceHint, default: true, kind: "toggle", group: COPY.group }
      ]
    });
    const on = (key, sid) => mu.settings.get(key, sid ? { sid } : void 0) !== false;
    const seconds = (sid) => {
      const n = Number(mu.settings.get(KEYS.seconds, sid ? { sid } : void 0));
      return Number.isFinite(n) && n > 0 ? Math.min(60, Math.max(2, n)) : DEFAULT_SECONDS;
    };
    const raise = (t, sid, meta) => {
      if (!t) return false;
      if (meta?.replay) return false;
      if (!on(KEYS[t.moment], sid)) return false;
      const group = GROUP[t.moment];
      mu.ui.toast(t.title, t.body || void 0, { kind: t.kind, timeoutMs: seconds(sid) * 1e3, ...group ? { group } : {} });
      if (on(KEYS.announce, sid) && mu.effects.owner(sid)) mu.a11y.announce(COPY.spoken(t.title, t.body));
      return true;
    };
    mu.gmcp.on("Client.Community", (data, meta) => {
      const leaf = meta.pkg.toLowerCase();
      const t = leaf === "client.community.kudos" ? toKudos(data) : leaf === "client.community.milestone" ? toMilestone(data) : leaf === "client.community.event" ? toEvent(data) : null;
      if (t) raise(t, meta.sid, meta);
      else if (leaf.startsWith("client.community.")) mu.log.warn(`${meta.pkg}: nothing to show`, data);
    });
    const sidOr = (sid) => sid ?? mu.sessions.active()?.id;
    const api = {
      kudos: (k, sid) => raise(toKudos(k), sidOr(sid)),
      milestone: (m, sid) => raise(toMilestone(m), sidOr(sid)),
      event: (e, sid) => raise(toEvent(e), sidOr(sid)),
      toKudos,
      toMilestone,
      toEvent
    };
    ctx.exports(() => api);
    return api;
  }
});
export {
  KEYS,
  index_default as default,
  toEvent,
  toKudos,
  toMilestone
};
