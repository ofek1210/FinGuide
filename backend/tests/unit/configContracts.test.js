const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

const read = relativePath =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

describe('config and docs contracts', () => {
  it('keeps backend and frontend examples aligned to port 5001', () => {
    const backendEnv = read('.env.example');
    const frontendEnv = read('../frontend/.env.example');
    const viteConfig = read('../frontend/vite.config.ts');

    expect(backendEnv).toContain('PORT=5001');
    expect(frontendEnv).toContain('VITE_API_URL=http://localhost:5001');
    expect(viteConfig).toContain('http://127.0.0.1:5001');
  });

  it('documents the canonical API base URL and cookie auth migration', () => {
    const apiDoc = read('docs/API.md');

    expect(apiDoc).toContain('http://localhost:5001/api');
    expect(apiDoc).toContain('HttpOnly cookie');
    expect(apiDoc).not.toContain('http://localhost:5000/api');
  });
});
