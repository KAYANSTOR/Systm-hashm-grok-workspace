import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
const store = createStore()(persist(() => ({}), { name: "test" }));
console.log(Object.keys(store));
console.log(store.persist);
