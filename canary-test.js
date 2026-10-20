import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const solicitudesV2 = new Counter('solicitudes_v2');
const solicitudesV3 = new Counter('solicitudes_v3');
const proporcionV3 = new Rate('proporcion_v3');

export const options = {
    vus: 10,
    duration: '30s',
    noConnectionReuse: true,
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
        checks: ['rate>0.99'],
    },
};

export default function () {
    const res = http.get('http://localhost:30080/api/info', {
        timeout: '5s',
    });

    let data = {};
    try {
        data = res.json();
    } catch (_) { }

    const versionValida =
        data.version === 'v2' || data.version === 'v3';

    check(res, {
        'status es 200': (r) => r.status === 200,
        'version reconocida': () => versionValida,
    });

    if (res.status === 200 && versionValida) {
        solicitudesV2.add(data.version === 'v2' ? 1 : 0);
        solicitudesV3.add(data.version === 'v3' ? 1 : 0);
        proporcionV3.add(data.version === 'v3');

        if (__ITER < 3) {
            console.log(
                `VU ${__VU} | Iteracion ${__ITER} | ` +
                `Pod: ${data.pod} | Version: ${data.version}`
            );
        }
    }

    sleep(0.2);
}