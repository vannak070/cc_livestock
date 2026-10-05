module.exports = {
  apps: [
    {
      name: 'cc-livestock-api',
      script: 'node_modules/.bin/tsx',
      args: 'src/server/index.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    },
    {
      name: 'cc-livestock-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
