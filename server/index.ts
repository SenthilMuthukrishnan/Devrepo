import { apiApp } from './app';

const PORT = Number(process.env.PORT || 3001);

apiApp.listen(PORT, '0.0.0.0', () => {
  console.log(`BioPulse 15 API Server running on http://0.0.0.0:${PORT}`);
});
