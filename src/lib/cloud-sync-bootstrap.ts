import { useStore } from "./store";

/**
 * Client-side cloud synchronization bootstrap.
 *
 * Local state is the fast offline projection. Every online entry refreshes the
 * shared snapshot in the background without blocking the first paint; pending
 * local mutations are drained before the refresh.
 */
let started = false;
let timer: ReturnType<typeof setInterval> | undefined;
let running: Promise<void> | null = null;

async function syncNow() {
  if (running) return running;
  running = (async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;

    const store = useStore.getState();
    // A persisted counter can outlive the actual local outbox. In that case
    // fetchFromDb must not route into the legacy migration path.
    if (store.outbox.length) {
      await store.drainPendingOutbox();
    } else if (store.pendingSyncCount > 0) {
      useStore.setState({ pendingSyncCount: 0 });
    }

    await useStore.getState().fetchFromDb();
  })()
    .catch((error) => {
      console.error("cloud-sync-bootstrap", error);
    })
    .finally(() => {
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
