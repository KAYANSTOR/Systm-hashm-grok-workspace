/** Stable device id for offline multi-device identity. */
const KEY = "hashem-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `dev_ephemeral_${Date.now().toString(36)}`;
  }
}
