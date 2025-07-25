const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Redis client
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('✅ Connected to Redis');
});

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '24h';

// Admin credentials (in production, use proper user management)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
});

// Admin login
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Simple credential check (in production, use proper user management)
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            const token = jwt.sign(
                { sub: username, role: 'admin' },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.json({
                access_token: token,
                token_type: 'bearer',
                expires_in: JWT_EXPIRES_IN
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get rate limiting configuration
app.get('/api/config', authenticateToken, async (req, res) => {
    try {
        const config = await redisClient.get('rate_limit_config');
        
        if (config) {
            res.json(JSON.parse(config));
        } else {
            // Return default configuration
            const defaultConfig = {
                default_requests_per_minute: 60,
                default_burst_size: 10,
                endpoints: {
                    "/api/users": {
                        "GET": { "requests_per_minute": 100, "burst_size": 20 },
                        "POST": { "requests_per_minute": 30, "burst_size": 5 }
                    },
                    "/api/data": {
                        "GET": { "requests_per_minute": 200, "burst_size": 50 },
                        "POST": { "requests_per_minute": 50, "burst_size": 10 }
                    }
                },
                user_overrides: {}
            };
            res.json(defaultConfig);
        }
    } catch (error) {
        console.error('Get config error:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
});

// Update rate limiting configuration
app.post('/api/config', authenticateToken, async (req, res) => {
    try {
        const configData = req.body;

        // Validate configuration structure
        const requiredFields = ['default_requests_per_minute', 'endpoints'];
        for (const field of requiredFields) {
            if (!(field in configData)) {
                return res.status(400).json({ error: `Missing field: ${field}` });
            }
        }

        // Validate numeric values
        if (typeof configData.default_requests_per_minute !== 'number' || 
            configData.default_requests_per_minute <= 0) {
            return res.status(400).json({ 
                error: 'default_requests_per_minute must be a positive number' 
            });
        }

        // Store configuration in Redis
        await redisClient.set('rate_limit_config', JSON.stringify(configData));

        // Notify FastAPI gateway about config update (optional)
        await redisClient.publish('config_update', JSON.stringify({
            type: 'rate_limit_config',
            data: configData,
            timestamp: Date.now()
        }));

        res.json({ 
            message: 'Configuration updated successfully',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Update config error:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Get endpoint configurations
app.get('/api/endpoints', authenticateToken, async (req, res) => {
    try {
        const config = await redisClient.get('rate_limit_config');
        
        if (config) {
            const parsedConfig = JSON.parse(config);
            res.json({
                endpoints: parsedConfig.endpoints || {},
                default_requests_per_minute: parsedConfig.default_requests_per_minute,
                default_burst_size: parsedConfig.default_burst_size || 10
            });
        } else {
            res.json({ endpoints: {} });
        }
    } catch (error) {
        console.error('Get endpoints error:', error);
        res.status(500).json({ error: 'Failed to get endpoints' });
    }
});

// Add/Update endpoint configuration
app.post('/api/endpoints', authenticateToken, async (req, res) => {
    try {
        const { endpoint, method, requests_per_minute, burst_size } = req.body;

        if (!endpoint || !method || !requests_per_minute) {
            return res.status(400).json({ 
                error: 'endpoint, method, and requests_per_minute are required' 
            });
        }

        // Get current configuration
        let config = await redisClient.get('rate_limit_config');
        config = config ? JSON.parse(config) : { 
            default_requests_per_minute: 60,
            default_burst_size: 10,
            endpoints: {},
            user_overrides: {}
        };

        // Update endpoint configuration
        if (!config.endpoints[endpoint]) {
            config.endpoints[endpoint] = {};
        }

        config.endpoints[endpoint][method] = {
            requests_per_minute: parseInt(requests_per_minute),
            burst_size: parseInt(burst_size) || config.default_burst_size || 10
        };

        // Save updated configuration
        await redisClient.set('rate_limit_config', JSON.stringify(config));

        // Notify about update
        await redisClient.publish('config_update', JSON.stringify({
            type: 'endpoint_config',
            endpoint,
            method,
            data: config.endpoints[endpoint][method],
            timestamp: Date.now()
        }));

        res.json({ 
            message: 'Endpoint configuration updated successfully',
            endpoint,
            method,
            config: config.endpoints[endpoint][method]
        });
    } catch (error) {
        console.error('Update endpoint error:', error);
        res.status(500).json({ error: 'Failed to update endpoint configuration' });
    }
});

// Delete endpoint configuration
app.delete('/api/endpoints/:endpoint/:method', authenticateToken, async (req, res) => {
    try {
        const { endpoint, method } = req.params;

        // Get current configuration
        let config = await redisClient.get('rate_limit_config');
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        config = JSON.parse(config);

        if (config.endpoints && config.endpoints[endpoint] && config.endpoints[endpoint][method]) {
            delete config.endpoints[endpoint][method];

            // If no methods left for endpoint, remove endpoint
            if (Object.keys(config.endpoints[endpoint]).length === 0) {
                delete config.endpoints[endpoint];
            }

            // Save updated configuration
            await redisClient.set('rate_limit_config', JSON.stringify(config));

            // Notify about deletion
            await redisClient.publish('config_update', JSON.stringify({
                type: 'endpoint_deleted',
                endpoint,
                method,
                timestamp: Date.now()
            }));

            res.json({ 
                message: 'Endpoint configuration deleted successfully',
                endpoint,
                method
            });
        } else {
            res.status(404).json({ error: 'Endpoint configuration not found' });
        }
    } catch (error) {
        console.error('Delete endpoint error:', error);
        res.status(500).json({ error: 'Failed to delete endpoint configuration' });
    }
});

// Get user overrides
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const config = await redisClient.get('rate_limit_config');
        
        if (config) {
            const parsedConfig = JSON.parse(config);
            res.json({
                user_overrides: parsedConfig.user_overrides || {}
            });
        } else {
            res.json({ user_overrides: {} });
        }
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get user overrides' });
    }
});

// Add/Update user override
app.post('/api/users', authenticateToken, async (req, res) => {
    try {
        const { user_id, requests_per_minute, burst_size } = req.body;

        if (!user_id || !requests_per_minute) {
            return res.status(400).json({ 
                error: 'user_id and requests_per_minute are required' 
            });
        }

        // Get current configuration
        let config = await redisClient.get('rate_limit_config');
        config = config ? JSON.parse(config) : { 
            default_requests_per_minute: 60,
            default_burst_size: 10,
            endpoints: {},
            user_overrides: {}
        };

        // Update user override
        config.user_overrides[user_id] = {
            requests_per_minute: parseInt(requests_per_minute),
            burst_size: parseInt(burst_size) || config.default_burst_size || 10
        };

        // Save updated configuration
        await redisClient.set('rate_limit_config', JSON.stringify(config));

        // Notify about update
        await redisClient.publish('config_update', JSON.stringify({
            type: 'user_override',
            user_id,
            data: config.user_overrides[user_id],
            timestamp: Date.now()
        }));

        res.json({ 
            message: 'User override updated successfully',
            user_id,
            config: config.user_overrides[user_id]
        });
    } catch (error) {
        console.error('Update user override error:', error);
        res.status(500).json({ error: 'Failed to update user override' });
    }
});

// Delete user override
app.delete('/api/users/:user_id', authenticateToken, async (req, res) => {
    try {
        const { user_id } = req.params;

        // Get current configuration
        let config = await redisClient.get('rate_limit_config');
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }

        config = JSON.parse(config);

        if (config.user_overrides && config.user_overrides[user_id]) {
            delete config.user_overrides[user_id];

            // Save updated configuration
            await redisClient.set('rate_limit_config', JSON.stringify(config));

            // Notify about deletion
            await redisClient.publish('config_update', JSON.stringify({
                type: 'user_override_deleted',
                user_id,
                timestamp: Date.now()
            }));

            res.json({ 
                message: 'User override deleted successfully',
                user_id
            });
        } else {
            res.status(404).json({ error: 'User override not found' });
        }
    } catch (error) {
        console.error('Delete user override error:', error);
        res.status(500).json({ error: 'Failed to delete user override' });
    }
});

// Get statistics
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const currentTime = Math.floor(Date.now() / 1000);
        const currentMinute = Math.floor(currentTime / 60);
        
        const stats = {
            current_minute: currentMinute,
            global_stats: [],
            recent_activity: []
        };

        // Get global stats for last 5 minutes
        for (let i = 0; i < 5; i++) {
            const minuteKey = currentMinute - i;
            const globalStatsKey = `stats:global:${minuteKey}`;
            
            const total = await redisClient.get(`${globalStatsKey}:total`) || 0;
            const allowed = await redisClient.get(`${globalStatsKey}:allowed`) || 0;
            const blocked = await redisClient.get(`${globalStatsKey}:blocked`) || 0;
            
            stats.global_stats.push({
                minute: minuteKey,
                total: parseInt(total),
                allowed: parseInt(allowed),
                blocked: parseInt(blocked)
            });
        }

        res.json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
    try {
        await redisClient.connect();
        
        app.listen(PORT, () => {
            console.log(`✅ Admin API server running on port ${PORT}`);
            console.log(`📚 API Documentation: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await redisClient.disconnect();
    process.exit(0);
});