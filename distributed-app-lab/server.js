const http = require('http');
const os = require('os');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || 'v3';
const APP_MESSAGE = process.env.APP_MESSAGE || 'Versión Canary — en pruebas controladas';

let localCounter = 0;

// ─── Simulación de almacenamiento compartido de pagos (idempotencia) ───
// En producción esto sería Redis o una base de datos compartida.
// Aquí usamos un Map en memoria para demostrar el concepto.
const processedPayments = new Map();

function commonHeaders(contentType = 'text/html; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Connection': 'close'
  };
}

function info() {
  return {
    version: APP_VERSION,
    message: APP_MESSAGE,
    pod: os.hostname(),
    counter: localCounter,
    time: new Date().toISOString()
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // ─── Health Check ───
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, commonHeaders('text/plain; charset=utf-8'));
    return res.end('OK');
  }

  // ─── Info API ───
  if (req.method === 'GET' && url.pathname === '/api/info') {
    res.writeHead(200, commonHeaders('application/json; charset=utf-8'));
    return res.end(JSON.stringify(info()));
  }

  // ─── Incrementar contador local ───
  if (req.method === 'POST' && url.pathname === '/increment') {
    localCounter++;
    res.writeHead(200, commonHeaders('application/json; charset=utf-8'));
    return res.end(JSON.stringify({ action: 'increment', ...info() }));
  }

  // ─── ENDPOINT DE PAGO IDEMPOTENTE ───
  // Demuestra cómo evitar pagos duplicados usando una clave de idempotencia.
  // Cada solicitud de pago lleva un "idempotencyKey" único.
  // Si el mismo key llega a cualquier pod, solo se procesa la primera vez.
  if (req.method === 'POST' && url.pathname === '/api/payment') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payment = JSON.parse(body);
        const idempotencyKey = payment.idempotencyKey;

        if (!idempotencyKey) {
          res.writeHead(400, commonHeaders('application/json; charset=utf-8'));
          return res.end(JSON.stringify({
            error: 'Falta idempotencyKey',
            explanation: 'Cada pago debe incluir una clave única para evitar duplicados'
          }));
        }

        // Verificar si ya fue procesado
        if (processedPayments.has(idempotencyKey)) {
          const original = processedPayments.get(idempotencyKey);
          res.writeHead(200, commonHeaders('application/json; charset=utf-8'));
          return res.end(JSON.stringify({
            status: 'DUPLICADO — ya fue procesado',
            originalResult: original,
            processedBy: original.processedBy,
            currentPod: os.hostname(),
            explanation: 'Este pago ya fue confirmado. No se volvió a cobrar.'
          }));
        }

        // Procesar el pago (simulación)
        const result = {
          status: 'APROBADO',
          idempotencyKey,
          amount: payment.amount,
          currency: payment.currency || 'USD',
          processedBy: os.hostname(),
          processedAt: new Date().toISOString(),
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
        };

        // Guardar en el registro de pagos procesados
        processedPayments.set(idempotencyKey, result);

        res.writeHead(200, commonHeaders('application/json; charset=utf-8'));
        return res.end(JSON.stringify(result));

      } catch (e) {
        res.writeHead(400, commonHeaders('application/json; charset=utf-8'));
        return res.end(JSON.stringify({ error: 'JSON inválido', details: e.message }));
      }
    });
    return;
  }

  // ─── Listar pagos procesados (para demostración) ───
  if (req.method === 'GET' && url.pathname === '/api/payments') {
    const payments = Array.from(processedPayments.entries()).map(([key, val]) => ({ idempotencyKey: key, ...val }));
    res.writeHead(200, commonHeaders('application/json; charset=utf-8'));
    return res.end(JSON.stringify({ pod: os.hostname(), totalPayments: payments.length, payments }));
  }

  // ─── Página principal con UI de pruebas ───
  if (req.method === 'GET' && url.pathname === '/') {
    const data = info();
    const versionColor = data.version === 'v3' ? '#e74c3c' : data.version === 'v2' ? '#3498db' : '#27ae60';
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Distributed App Lab ${data.version}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; background: #f0f2f5; color: #333; }
    .card { background: white; border-radius: 16px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,.06); margin-bottom: 20px; }
    .version-badge { display: inline-block; background: ${versionColor}; color: white; padding: 4px 14px; border-radius: 20px; font-weight: bold; font-size: 14px; }
    h1 { margin-bottom: 8px; }
    h2 { margin: 18px 0 10px; color: #555; font-size: 18px; }
    code { background: #eef1f4; padding: 3px 7px; border-radius: 6px; font-size: 13px; }
    button { padding: 10px 18px; margin: 4px 4px 4px 0; cursor: pointer; border: none; border-radius: 8px; font-size: 14px; color: white; transition: transform .1s; }
    button:hover { transform: scale(1.03); }
    button:active { transform: scale(0.97); }
    .btn-blue { background: #3498db; }
    .btn-green { background: #27ae60; }
    .btn-orange { background: #e67e22; }
    .btn-red { background: #e74c3c; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
    .info-row:last-child { border-bottom: none; }
    .label { color: #888; }
    .value { font-weight: bold; }
    pre { background: #1e1e2e; color: #a6e3a1; padding: 16px; border-radius: 10px; overflow-x: auto; font-size: 13px; white-space: pre-wrap; margin-top: 10px; min-height: 60px; }
    .section-title { font-size: 15px; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Distributed App Lab <span class="version-badge">${data.version}</span></h1>
    <p style="margin: 8px 0 16px; color: #666;">${data.message}</p>
    <div class="info-row"><span class="label">Servidor / Pod</span><code>${data.pod}</code></div>
    <div class="info-row"><span class="label">Contador local</span><span class="value">${data.counter}</span></div>
    <div class="info-row"><span class="label">Hora UTC</span><span>${data.time}</span></div>
  </div>

  <div class="card">
    <p class="section-title">Acciones</p>
    <button class="btn-blue" onclick="incrementar()">Incrementar Contador</button>
    <button class="btn-green" onclick="location.reload()">Refrescar</button>
  </div>

  <div class="card">
    <p class="section-title">Prueba de Pago Idempotente</p>
    <p style="color:#666; font-size:13px; margin-bottom:12px;">
      Demuestra cómo evitar pagos duplicados. Cada pago lleva una <b>clave de idempotencia</b> única.
      Si haces clic dos veces con la misma clave, solo se cobra una vez.
    </p>
    <button class="btn-green" onclick="enviarPago()">Enviar Pago ($25.00)</button>
    <button class="btn-orange" onclick="enviarPago()">Reenviar Mismo Pago</button>
    <button class="btn-red" onclick="nuevoPago()">Nuevo Pago (Nueva Clave)</button>
    <button class="btn-blue" onclick="verPagos()">Ver Pagos del Pod</button>
    <p style="margin-top:8px; font-size:12px; color:#999;">Clave actual: <code id="currentKey">—</code></p>
  </div>

  <div class="card">
    <p class="section-title">Resultado</p>
    <pre id="result">Haz clic en un botón para ver el resultado aquí...</pre>
  </div>

  <script>
    let currentIdempotencyKey = crypto.randomUUID();
    document.getElementById('currentKey').textContent = currentIdempotencyKey;

    async function incrementar() {
      const r = await fetch('/increment', { method: 'POST' });
      const data = await r.json();
      document.getElementById('result').textContent = JSON.stringify(data, null, 2);
    }

    async function enviarPago() {
      const r = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: currentIdempotencyKey,
          amount: 25.00,
          currency: 'USD',
          description: 'Pago de prueba del laboratorio'
        })
      });
      const data = await r.json();
      document.getElementById('result').textContent = JSON.stringify(data, null, 2);
    }

    function nuevoPago() {
      currentIdempotencyKey = crypto.randomUUID();
      document.getElementById('currentKey').textContent = currentIdempotencyKey;
      document.getElementById('result').textContent = 'Nueva clave generada: ' + currentIdempotencyKey + '\\nAhora haz clic en "Enviar Pago" para procesar.';
    }

    async function verPagos() {
      const r = await fetch('/api/payments');
      const data = await r.json();
      document.getElementById('result').textContent = JSON.stringify(data, null, 2);
    }
  </script>
</body>
</html>`;

    res.writeHead(200, commonHeaders());
    return res.end(html);
  }

  res.writeHead(404, commonHeaders('application/json; charset=utf-8'));
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Distributed App Lab ${APP_VERSION} listening on port ${PORT}`);
  console.log(`Hostname: ${os.hostname()}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor de forma controlada...');
  server.close(() => {
    console.log('Servidor cerrado.');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
});
