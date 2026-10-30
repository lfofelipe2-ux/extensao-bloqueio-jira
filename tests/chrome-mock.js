export function installChromeMock() {
  const data = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return key in data ? { [key]: structuredClone(data[key]) } : {};
        },
        async set(items) {
          for (const [k, v] of Object.entries(items)) data[k] = structuredClone(v);
        },
      },
    },
  };
  return data;
}
