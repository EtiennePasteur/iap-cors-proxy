const express = require('express');
const url = require('url');
const {createProxyMiddleware} = require('http-proxy-middleware');
const {GoogleAuth} = require('google-auth-library');

module.exports = {
    cookie: null,
    server: null,
    frontendUrl: null,
    port: null,
    intervalRef: null,

    getToken: async (addr, keyFile, client_id, renew) => {
        try {
            const auth = new GoogleAuth({keyFile: keyFile});
            const client = await auth.getIdTokenClient(client_id);
            const res = await client.request({url: addr});
            module.exports.cookie = res.config.headers.Authorization.split(' ')[1];
            if (renew) {
                console.log('🔑 Renewing token successfully');
            } else {
                console.log('🔑 Authentication success');
            }
        } catch (error) {
            console.log('💡 Authentication error : ' + error);
        }
    },

    iapAuth: async (addr, keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS, renew = false) => {
        const adapters = {
            'http:': require('http'),
            'https:': require('https')
        };
        adapters[url.parse(addr).protocol].request(addr, {method: 'HEAD'}, res => {
            if (res.headers.location) {
                const queryObject = url.parse(res.headers.location, true).query;
                const client_id = queryObject.client_id;
                module.exports.getToken(addr, keyFile, client_id, renew);
            }
        }).end();
    },

    onProxyRes: (proxyRes, req, res) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = module.exports.frontendUrl;
    },

    onProxyReq: (proxyReq, req, res) => {
        console.log('🛰️ ' + req.url);

        res.header("Access-Control-Allow-Origin", module.exports.frontendUrl);
        res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        proxyReq.setHeader('Cookie', 'GCP_IAAP_AUTH_TOKEN=' + module.exports.cookie);
    },

    launchExpress: (back, front, keyfile, port, pathRewrite) => {
        if (module.exports.server === null) {
            const app = express();
            app.use(createProxyMiddleware({
                target: back,
                changeOrigin: true,
                onProxyReq: module.exports.onProxyReq,
                onProxyRes: module.exports.onProxyRes,
                pathRewrite: {[pathRewrite]: ''}
            }));
            module.exports.server = require('http').createServer(app);
            module.exports.server = require('http-shutdown')(module.exports.server);

            module.exports.frontendUrl = front;
            module.exports.port = port;

            module.exports.server.listen(port, function () {
                console.log('👂 Listening on port : ' + port)
            });
        } else {
            console.log('💡 Server already running');
        }
    },

    start: (back, front, keyfile, port, pathRewrite) => {
        if (!module.exports.intervalRef) {
            module.exports.intervalRef = setInterval(() => {
                module.exports.iapAuth(back, keyfile, true)
            }, 60000 * 15);
        }

        if (module.exports.cookie !== null) {
            module.exports.launchExpress(back, front, keyfile, port, pathRewrite);
        } else {
            module.exports.iapAuth(back, keyfile).then(() => {
                module.exports.launchExpress(back, front, keyfile, port, pathRewrite);
            });
        }
    },

    stop: () => {
        if (module.exports.intervalRef) {
            clearInterval(module.exports.intervalRef);
        }
        if (module.exports.server !== null) {
            module.exports.server.shutdown(function (err) {
                if (err) {
                    console.log('💡 Shutdown failed');
                } else {
                    module.exports.cookie = null;
                    module.exports.server = null;
                    console.log('❌ Server stopped !');
                }
            });
        }
    }
}
