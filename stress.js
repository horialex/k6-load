import { sleep, check } from 'k6'
import http from 'k6/http'


let hostname = __ENV.HOSTNAME;
if(hostname == null) hostname = "http://172.22.4.19";



export const options = {
    stages: [
        {duration: '2m', target: 50},
        {duration: '5m', target: 50}, 
        {duration: '2m', target: 100},
        {duration: '5m', target: 100},
        // {duration: '2m', target: 150}, 
        // {duration: '5m', target: 150},
        // {duration: '2m', target: 200}, 
        // {duration: '5m', target: 200},
        // {duration: '2m', target: 250},
        // {duration: '5m', target: 250},
        // {duration: '2m', target: 300},
        // {duration: '5m', target: 300},
        // {duration: '5m', target: 0},
    ],
    thresholds: {
        http_req_duration: ['p(95) < 1000']
    }
}

export default () => {
    const res = http.get(hostname);
    check(res, {'200': (r) => r.status === 200});
    sleep(1);
}