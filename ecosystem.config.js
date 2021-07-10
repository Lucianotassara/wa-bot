module.exports = {
    apps : [{
      name: 'wa-bot',
      script: './index.js',
      exec_interpreter: '/home/evida/.nvm/versions/node/v14.15.5/bin/node',

      // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
      args: '--update-env',
      node_args: '',
      instances: 1,
      autorestart: false,
      watch: false,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'desa'
      },
      env_production: {
        NODE_ENV: 'prod'
      }
    }]
  };
