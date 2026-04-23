module.exports = {
    apps: [{
        name: 'wa-bot',
        script: './index.mjs',
        instances: 1,
        autorestart: false,
        watch: false,
        exec_mode: 'fork',
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            ENV: 'DEV'
        },
        env_production: {
            NODE_ENV: 'production',
            ENV: 'PRD'
        }
    }]
};
