/// <reference types="node" />
export const worker = true;

console.log("Worker starting...");
setInterval(() => {
  console.log("Worker heartbeat");
}, 60000);
