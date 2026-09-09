import { useStore } from "./store";

/**
 * Client-side cloud synchronization bootstrap.
 *
 * The application uses the server/Postgres dataset as the shared source of
 * truth. Local state is only the offline projection. On startup and whenever
 * connectivity/focus returns, drain local mutations first, then refresh the
 * shared snapshot so a newly opened device sees data created on other devices.
 */
let started = false;
let timer: ReturnType<typeof setInterval> | undefined;
let running: Promise<void> | null = null;

async function syncNow() {
  if (running) return running;
  running = (async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;

    const store = useStore.getState();
    // Never fall back to legacy full-store migration merely because an
    // outbox item exists. Current mutations are already represented by the
    // idempotent outbox and must be ACKed before pulling the shared snapshot.
    if (store.outbox.length) {
      await store.drainPendingOutbox();
    }

    await useStore.getState().fetchFromDb();
  })().catch((error) => {
    console.error("cloud-sync-bootstrap", error);
  }).finally(() => {
    running = null;
  });
  return running;
}

export function startCloudSync() {
  if (started || typeof window === "undefined") return;
  started = true;

  const start = () => {
    void syncNow();
    if (!timer) {
      timer = setInterval(() => void syncNow(), 30_000);
    }
  };

  if (document.readyState === "loading") {
    window.addEventListener("load", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("online", () => void syncNow());
  window.addEventListener("focus", () => void syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
}
