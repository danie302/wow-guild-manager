// Placeholder: keeps the api process running until its real code is added.
console.log('api started');

const keepAlive = setInterval(() => {}, 60_000);

process.on('SIGTERM', () => {
  clearInterval(keepAlive);
});
