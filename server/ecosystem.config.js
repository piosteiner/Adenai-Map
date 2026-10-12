// PM2 config: `pm2 start ecosystem.config.js` (from this directory)
// Secrets and settings come from .env, loaded by server.js via dotenv.
module.exports = {
  apps: [{
    name: 'adenai-cms',
    script: 'server.js',
    cwd: __dirname
  }]
};
