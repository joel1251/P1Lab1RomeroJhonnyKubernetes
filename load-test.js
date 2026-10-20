import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: Number(__ENV.VUS || 20),
    duration: '30s',
    noConnectionReuse: true,
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<250'],
        checks: ['rate>0.99'],
    },
};

export default function () {
    const res = http.get('http://localhost:30080/api/info', {
        timeout: '5s',
    });

    check(res, {
        'status es 200': (r) => r.status === 200,
    });

    if (__VU <= 3 && __ITER === 0 && res.status === 200) {
        const data = res.json();
        console.log(
            `VU ${__VU} | Iteracion ${__ITER} | ` +
            `Pod: ${data.pod} | Version: ${data.version}`
        );
    }

    sleep(0.1);
}  