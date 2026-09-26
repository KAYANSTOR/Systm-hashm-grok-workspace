import { useStore } from "./store";

/**
 * Client-side cloud synchronization bootstrap.
 *
 * Local state is the fast offline projection. The shared snapshot is refreshed
 * on an idle bootstrap and on a slow interval; navigation must never trigger a
 * network request just because the window received focus or became visible.
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
    // Keep the first interaction free of network/database work. The local
    // Zustand projection renders immediately; cloud refresh can safely wait
    // for an idle slice after the app becomes usable.
    const runWhenIdle = () => void syncNow();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runWhenIdle, { timeout: 2500 });
    } else {
      globalThis.setTimeout(runWhenIdle, 500);
    }
    if (!timer) {
      timer = setInterval(() => void syncNow(), 30_000);
    }
  };

  if (document.readyState === "loading") {
    window.addEventListener("load", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("online", () => void syncNow(), { passive: true });
}
