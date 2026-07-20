const sqlite = require("node:sqlite");

const [major, minor] = process.versions.node.split(".").map(Number);
const supported = major === 24 && minor >= 17;
const capabilities = {
  node: process.versions.node,
  npmExecPath: process.env.npm_execpath || null,
  executable: process.execPath,
  databaseSync: typeof sqlite.DatabaseSync === "function",
  onlineBackup: typeof sqlite.backup === "function",
};

console.log(JSON.stringify(capabilities));
if (!supported || !capabilities.databaseSync || !capabilities.onlineBackup) {
  console.error("Agent Company OS requires Node >=24.17.0 <25 with node:sqlite online backup support.");
  process.exit(1);
}
