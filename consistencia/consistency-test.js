import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = 'http://localhost:30080';
const confirmados = new Counter('incrementos_confirmados');

export const options = {
    scenarios: {
        concurrencia: {
            executor: 'per-vu-iterations',
            vus: 100,
            iterations: 1,
            maxDuration: '30s',
        },
    },
    noConnectionReuse: true,
    thresholds: {
        http_req_failed: ['rate==0'],
        checks: ['rate==1'],
        incrementos_confirmados: ['count==100'],
    },
};

function readJson(res) {
    try {
        return res.json();
    } catch (_) {
        return {};
    }
}

export function setup() {
    const res = http.post(`${BASE}/reset`, null, {
        timeout: '5s',
    });
    const data = readJson(res);

    if (res.status !== 200 || data.counter !== 0 || !data.epoch) {
        throw new Error('No se pudo preparar el contador en cero');
    }

    console.log(`INICIAL: contador=${data.counter} | epoch=${data.epoch}`);
    return { epoch: data.epoch };
}

export default function (initial) {
    const operationId = `op-${__VU}`;

    const res = http.post(`${BASE}/increment`, null, {
        headers: {
            'Idempotency-Key': operationId,
        },
        timeout: '5s',
    });

    const data = readJson(res);

    const ok = check(res, {
        'incremento devuelve HTTP 200': (r) => r.status === 200,
        'operacion nueva': () => data.repeated === false,
        'identificador correcto': () => data.operationId === operationId,
        'contador entre 1 y 100': () =>
            Number.isInteger(data.counter) &&
            data.counter >= 1 &&
            data.counter <= 100,
        'coordinador no reiniciado': () => data.epoch === initial.epoch,
    });

    if (ok) confirmados.add(1);

    if (__VU <= 10) {
        console.log(
            `VU ${__VU} | Iteracion ${__ITER} | ` +
            `Pod: ${data.pod} | Version: ${data.version} | ` +
            `Operacion: ${operationId} | Contador: ${data.counter}`
        );
    }
}

export function teardown(initial) {
    const res = http.get(`${BASE}/counter`, {
        timeout: '5s',
    });
    const data = readJson(res);

    check(res, {
        'consulta final HTTP 200': (r) => r.status === 200,
        'contador final exactamente 100': () => data.counter === 100,
        '100 operaciones registradas': () => data.operations === 100,
        'misma instancia del coordinador': () => data.epoch === initial.epoch,
    });

    console.log(`RESULTADO FINAL: ${JSON.stringify(data)}`);
}