import type { QueuedMutation } from "./index";
export type Mutation = QueuedMutation;
/** Keep changes queued while an older batch was being sent. */
export function reconcile(
  batch: Mutation[],
  remaining: Mutation[],
  latest: Mutation[],
) {
  const ids = new Set(batch.map((m) => m.id));
  return [...remaining, ...latest.filter((m) => !ids.has(m.id))];
}
export async function drain(
  queue: Mutation[],
  send: (m: Mutation) => Promise<unknown>,
) {
  const remaining: Mutation[] = [];
  let sent = 0;
  for (let i = 0; i < queue.length; i++) {
    const m = queue[i];
    try {
      await send(m);
      sent++;
    } catch (e: any) {
      remaining.push(
        { ...m, error: e.status === 409 ? e.message : undefined },
        ...queue.slice(i + 1),
      );
      return {
        remaining,
        sent,
        conflict: e.status === 409,
        offline: !e.status,
      };
    }
  }
  return { remaining, sent, conflict: false, offline: false };
}
