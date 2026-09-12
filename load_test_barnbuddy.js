import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. Cấu hình kịch bản tải thực tế (Ramp-up -> Hold -> Ramp-down)
export const options = {
    stages: [
        { duration: '10s', target: 50 },  // 10s đầu: Tăng tốc nhẹ nhàng lên 50 user
        { duration: '20s', target: 100 }, // 20s giữa: Giữ vững 100 user (Peak load)
        { duration: '10s', target: 0 },   // 10s cuối: Thoái trào về 0
    ],
    thresholds: {
        http_req_failed: ['rate<0.05'], 
        http_req_duration: ['p(95)<500'], 
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000'; 
// Nhận token từ ngoài vào qua biến môi trường để bypass AuthGuard
const REAL_INIT_DATA = __ENV.AUTH_TOKEN || 'MISSING_TOKEN'; 

export default function () {
    const headers = {
        'Content-Type': 'application/json',
        'x-init-data': REAL_INIT_DATA,
    };

    // --- KỊCH BẢN 1: TEST RACE CONDITION (ĐỒNG LOẠT TRỘM 1 MẢNH ĐẤT) ---
    const stealPayload = JSON.stringify({
        plotId: 'plot-target-123',
        targetUserId: 'user-victim-456'
    });

    const stealResponse = http.post(`${BASE_URL}/action/steal`, stealPayload, { headers: headers });

    // In log ra màn hình nếu thất bại để Dev bắt bệnh ngay
    if (stealResponse.status !== 200 && stealResponse.status !== 400) {
        console.log("[STEAL ERROR] Status: " + stealResponse.status + " - Body: " + stealResponse.body);
    }

    check(stealResponse, {
        'Steal status is 200 (Success) or 400 (Already Stolen)': (r) => r.status === 200 || r.status === 400,
        'Steal is NOT 500 (No DB Crash)': (r) => r.status !== 500,
    });

    // Nghỉ ngẫu nhiên 0.5s - 1.5s để mô phỏng độ trễ tay của người thật (Tránh bị Rate Limit chặn)
    sleep(Math.random() * 1 + 0.5); 

    // --- KỊCH BẢN 2: THU HOẠCH ---
    const harvestPayload = JSON.stringify({
        plotId: `plot-my-farm-${__VU}` // Dùng ID linh động theo từng User ảo (__VU) để test throughput thực tế
    });

    const harvestResponse = http.post(`${BASE_URL}/action/harvest`, harvestPayload, { headers: headers });

    if (harvestResponse.status !== 200 && harvestResponse.status !== 400) {
        console.log("[HARVEST ERROR] Status: " + harvestResponse.status + " - Body: " + harvestResponse.body);
    }

    check(harvestResponse, {
        'Harvest status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    });

    sleep(Math.random() * 1 + 0.5);
}