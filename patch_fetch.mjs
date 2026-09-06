import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const replaceStr = `      fetchFromDb: async () => {
        const data = await fetchAllData();
        
        // Auto-migration
        if (data.isDbEmpty && get().invoices.length > 0) {
           console.log("Legacy data detected, syncing to database...");
           await get().syncLegacyDb();
           return;
        }

        set({`;

code = code.replace(`      fetchFromDb: async () => {\n        const data = await fetchAllData();\n        set({`, replaceStr);

fs.writeFileSync('src/lib/store.ts', code);
