const http = require('http');
const os = require('os');

const PORT = Number(process.env.PORT || 3000);
const COORDINATOR_URL =
    process.env.COORDINATOR_URL || 'http://counter-coordinator:3000';

const VERSION = 'v4';

function send(res, status, data) {
    if (res.writableEnded || res.destroyed) return;

    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Connection': 'close',
    });

    res.end(JSON.stringify({
        ...data,
        pod: os.hostname(),
        version: VERSION,
    }));
}

function forward(req, res, path) {
    const headers = { Connection: 'close' };

    if (req.headers['idempotency-key']) {
        headers['Idempotency-Key'] = req.headers['idempotency-key'];
    }

    const upstream = http.request(
        new URL(path, COORDINATOR_URL),
        {
            method: req.method,
            headers,
            agent: false,
        },
        (response) => {
            let body = '';

            response.on('data', (chunk) => {
                body += chunk;
            });

            response.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    send(res, response.statusCode, data);
                } catch (_) {
                    send(res, 502, {
                        error: 'Respuesta invalida del coordinador',
                    });
                }
            });

            response.on('error', () => {
                send(res, 502, {
                    error: 'Respuesta incompleta del coordinador',
                });
            });
        }
    );

    upstream.setTimeout(3000, () => {
        upstream.destroy(new Error('Timeout del coordinador'));
    });

    upstream.on('error', () => {
        send(res, 503, {
            error: 'No se pudo confirmar la operacion con el coordinador',
            instruction: 'Para reintentar un incremento, conserve Idempotency-Key',
        });
    });

    upstream.end();
}

const server = http.createServer((req, res) => {
    req.resume();
    const path = new URL(req.url, 'http://localhost').pathname;

    if (req.method === 'GET' && path === '/health') {
        return send(res, 200, { status: 'OK' });
    }

    if (
        req.method === 'GET' &&
        ['/', '/api/info', '/counter'].includes(path)
    ) {
        return forward(req, res, '/counter');
    }

    if (req.method === 'POST' && path === '/increment') {
        return forward(req, res, '/increment');
    }

    // Usar solamente para preparar pruebas sin trafico activo.
    if (req.method === 'POST' && path === '/reset') {
        return forward(req, res, '/reset');
    }

    return send(res, 404, { error: 'Ruta no encontrada' });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Aplicacion ${VERSION} en puerto ${PORT}`);
    console.log(`Pod: ${os.hostname()}`);
    console.log(`Coordinador: ${COORDINATOR_URL}`);
});

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
});