// Writing Stats — `background`: the single place that adds up words from
// every window. Storage is shared, but updating it here (and atomically)
// keeps concurrent windows from losing counts.
import { today } from "./words.js";

async function add(words) {
  await typora.storage.update("days", (days = {}) => {
    const key = today();
    days[key] = (days[key] ?? 0) + words;
    return days;
  });
}

async function prune() {
  const cutoff = Date.now() - 90 * 86_400_000;
  await typora.storage.update("days", (days = {}) => {
    for (const key of Object.keys(days)) if (new Date(key).getTime() < cutoff) delete days[key];
    return days;
  });
}

export async function activate(ctx) {
  ctx.subscriptions.push(
    typora.runtime.onConnect((port) => {
      port.onMessage(async (message) => {
        if (message?.type === "added" && Number.isFinite(message.words)) await add(Math.min(message.words, 5000));
        if (message?.type === "reset")
          await typora.storage.update("days", (days = {}) => ({ ...days, [today()]: 0 }));
      });
    }),
    typora.alarms.onAlarm((name) => {
      if (name === "prune") void prune();
    }),
  );
  await typora.alarms.create("prune", { delayInMinutes: 1, periodInMinutes: 360 });
}
