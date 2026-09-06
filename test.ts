global.window = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
const api = createStore(persist(() => ({}), { name: "test" }));
console.log("api keys:", Object.keys(api));
console.log("api.persist:", api.persist);
