global.window = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
import { useStore } from "./src/lib/store";
console.log("hasHydrated before:", useStore.persist.hasHydrated());
useStore.persist.onFinishHydration(() => {
  console.log("onFinishHydration called!");
});
useStore.persist.rehydrate();
console.log("hasHydrated after:", useStore.persist.hasHydrated());
