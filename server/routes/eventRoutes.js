module.exports = {
    registerEventRoutes(app, { sseClients, sendSseEvent }) {
        app.get('/api/events', (req, res) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders && res.flushHeaders();

            res.write('\n');
            sseClients.add(res);

            req.on('close', () => {
                sseClients.delete(res);
            });
        });

        return app;
    }
};
