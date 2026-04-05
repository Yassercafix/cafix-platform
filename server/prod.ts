import app from './_core/index.js';
import { createServer } from 'http';

const port = process.env.PORT || 3000;
const server = createServer(app);

server.listen(port, () => {
  console.log(`Production server running on http://localhost:${port}/`);
});
