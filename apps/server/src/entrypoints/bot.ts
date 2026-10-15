// Placeholder: keeps the bot process running until its real code is added.
console.log('bot started');

const keepAlive = setInterval(() => {}, 60_000);

process.on('SIGTERM', () => {
  clearInterval(keepAlive);
});
