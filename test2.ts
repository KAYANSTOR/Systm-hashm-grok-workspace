import { create } from "zustand";
import { persist } from "zustand/middleware";
const useBoundStore = create()(persist(() => ({}), { name: "test" }));
console.log(Object.keys(useBoundStore));
console.log(useBoundStore.persist);
