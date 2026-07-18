import { fileURLToPath } from 'node:url';
export const startWorker = () => {
    console.log('Worker started');
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startWorker();
}
//# sourceMappingURL=index.js.map