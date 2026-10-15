// Placeholder: keeps the worker process running until its real code is added.
console.log('worker started');

const keepAlive = setInterval(() => {}, 60_000);

process.on('SIGTERM', () => {
  clearInterval(keepAlive);
});
