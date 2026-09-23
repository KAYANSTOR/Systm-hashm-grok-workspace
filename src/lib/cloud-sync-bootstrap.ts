import { useStore } from "./store";

/**
 * Client-side cloud synchronization bootstrap.
 *
 * Local state is the fast offline projection. The complete snapshot is fetched
 * once on the first online entry; later visits only drain local mutations.
 * A manual sync from Settings remains the explicit way to pull remote changes.
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

    if (!useStore.getState().initialDataLoaded) {
      await useStore.getState().fetchFromDb();
    }
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
