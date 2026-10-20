const http = require('http');
const os = require('os');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const epoch = randomUUID();

let counter = 0;
const processed = new Map();

function send(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Connection': 'close',
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
    req.resume();
    const path = new URL(req.url, 'http://localhost').pathname;

    if (req.method === 'GET' && path === '/health') {
        return send(res, 200, { status: 'OK', epoch });
    }

    if (req.method === 'GET' && path === '/counter') {
        return send(res, 200, {
            counter,
            operations: processed.size,
            coordinatorPod: os.hostname(),
            epoch,
        });
    }

    // Reinicio manual para preparar experimentos sin trafico activo.
    if (req.method === 'POST' && path === '/reset') {
        counter = 0;
        processed.clear();
        return send(res, 200, { counter, epoch });
    }

    if (req.method === 'POST' && path === '/increment') {
        const id = req.headers['idempotency-key'];

        if (typeof id !== 'string' || !id.trim() || id.length > 128) {
            return send(res, 400, {
                error: 'Se requiere Idempotency-Key de 1 a 128 caracteres',
            });
        }

        // Consulta e incremento sin esperas asincronas entre ambos.
        if (processed.has(id)) {
            return send(res, 200, {
                ...processed.get(id),
                repeated: true,
            });
        }

        counter += 1;

        const result = {
            counter,
            operationId: id,
            coordinatorPod: os.hostname(),
            epoch,
            repeated: false,
        };

        processed.set(id, result);
        return send(res, 200, result);
    }

    return send(res, 404, { error: 'Ruta no encontrada' });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Coordinador activo en puerto ${PORT}`);
    console.log(`Pod: ${os.hostname()} | Epoch: ${epoch}`);
});

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
});
