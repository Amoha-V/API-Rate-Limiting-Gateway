module.exports = {
    port: process.env.ADMIN_API_PORT || 3000,
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 27017,
        name: process.env.DB_NAME || 'admin_db'
    },
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
    apiVersion: 'v1',
    logLevel: process.env.LOG_LEVEL || 'info'
};