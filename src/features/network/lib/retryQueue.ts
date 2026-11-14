// Local retry queue for connect (PRD 8, R8: weak venue signal). Entries survive a reload when storage works;
// everything degrades to in-memory when storage is blocked.
export interface PendingConnect {
  token: string;
  source: "tap" | "scan";
  sessionId: string | null;
  at: number;
}

const KEY = "net:pendingConnects";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
let memory: PendingConnect[] = [];

function read(): PendingConnect[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingConnect[]) : memory;
  } catch {
    return memory;
  }
}

function write(items: PendingConnect[]) {
  memory = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* in-memory only */
  }
}

export function enqueueConnect(p: Omit<PendingConnect, "at">, now = Date.now()) {
  const items = read().filter((x) => x.token !== p.token);
  write([...items, { ...p, at: now }]);
}

export function pendingConnects(now = Date.now()): PendingConnect[] {
  return read().filter((x) => now - x.at < MAX_AGE_MS);
}

/** Tries every pending entry; keeps the ones that still fail because of the network. */
export async function flushConnects(
  send: (p: PendingConnect) => Promise<void>,
  isOfflineError: (e: unknown) => boolean,
  now = Date.now(),
): Promise<{ sent: number; kept: number }> {
  const items = pendingConnects(now);
  const kept: PendingConnect[] = [];
  let sent = 0;
  for (const p of items) {
    try {
      await send(p);
      sent++;
    } catch (e) {
      if (isOfflineError(e)) kept.push(p);
    }
  }
  write(kept);
  return { sent, kept: kept.length };
}
