import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();
  const port = parseInt(process.env.PORT || '3001', 10);

  await app.listen({ port, host: '0.0.0.0' });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
