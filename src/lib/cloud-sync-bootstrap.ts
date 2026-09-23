import { useStore } from "./store";

/**
 * Client-side cloud synchronization bootstrap.
 *
 * Local state is the fast offline projection. On every online entry we:
 *  1) drain local outbox mutations to the cloud
 *  2) pull the latest snapshot from the cloud so another device's data appears
 *
 * A manual sync from Settings remains available for an explicit full refresh.
 */
let started = false;
let timer: ReturnType<typeof setInterval> | undefined;
let running: Promise<void> | null = null;

async function syncNow(forcePull = false) {
  if (running) return running;
  running = (async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;

    const store = useStore.getState();
    if (store.outbox.length) {
      await store.drainPendingOutbox();
    } else if (store.pendingSyncCount > 0) {
      useStore.setState({ pendingSyncCount: 0 });
    }

    if (forcePull || !useStore.getState().initialDataLoaded) {
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
    void syncNow(true);
    if (!timer) {
      timer = setInterval(() => void syncNow(false), 30_000);
    }
  };

  if (document.readyState === "loading") {
    window.addEventListener("load", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("online", () => void syncNow(true));
  window.addEventListener("focus", () => void syncNow(false));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow(false);
  });
}
