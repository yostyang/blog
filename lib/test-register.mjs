import { register } from "node:module";

await register(new URL("./test-hooks.mjs", import.meta.url));
