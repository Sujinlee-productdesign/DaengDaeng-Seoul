// ================================================================
// 댕댕서울 88 - 지도 & 서울 공공데이터 연결 로직
//
// 사용 API:
//   ① 서울시 공원 현황        (SeoulPark)
//   ② 서울시 식품위생업소 현황 (LOCALDATA_072404)
//   ③ 서울 실시간 대기환경    (RealtimeCityAir)
//
// 흐름: initMap() → main() → API 3개 동시 호출 → 마커 표시
// ================================================================


// ----------------------------------------------------------------
// 1. 설정값
//    API 키는 여기 한 곳만 바꾸면 전체 적용됩니다.
// ----------------------------------------------------------------

// 서울 열린데이터광장 API 키 (https://data.seoul.go.kr 에서 발급)
// ⚠️ MY_API_KEY 자리에 본인 인증키를 넣어주세요
const SEOUL_API_KEY  = '4e66424d4f676b6436386b73716d42';

// 서울 Open API 기본 주소
// - 로컬(file://)에서는 http 직접 접근
// - Netlify 배포 후에는 /seoul-api 프록시 경유 (netlify.toml 설정)
const isDeployed     = location.protocol === 'https:';
const SEOUL_API_BASE = isDeployed
  ? '/seoul-api'
  : 'http://openAPI.seoul.go.kr:8088';

// ⚠️ http:// API 주의사항:
//   - 로컬 파일(file://)에서 테스트할 때는 정상 작동
//   - https:// 서버에 배포하면 혼합 콘텐츠 차단이 걸릴 수 있음
//   → 배포 시 서버 측 프록시 또는 HTTPS API 버전으로 교체 필요

// 카카오맵 초기 중심 좌표 (서울 시청)
const MAP_CENTER = { lat: 37.5665, lng: 126.9780 };

// 카카오맵 초기 줌 레벨 (숫자가 클수록 축소 / 서울 전체: 8)
const MAP_ZOOM_LEVEL = 8;


// ----------------------------------------------------------------
// 2. 서울 공공 API URL
// ----------------------------------------------------------------

// ① 서울시 공원 현황 (1번째~100번째 데이터)
const API_PARKS = `${SEOUL_API_BASE}/${SEOUL_API_KEY}/json/SeoulPark/1/100/`;

// ② 서울시 식품위생업소 현황 - 일반음식점 (1번째~100번째)
const API_RESTAURANTS = `${SEOUL_API_BASE}/${SEOUL_API_KEY}/json/LOCALDATA_072404/1/100/`;

// ③ 서울 실시간 대기환경 (측정소 25개)
const API_AIR = `${SEOUL_API_BASE}/${SEOUL_API_KEY}/json/RealtimeCityAir/1/25/`;


// ----------------------------------------------------------------
// 3. 더미(Fallback) 데이터
//    API 호출 실패 시 서비스가 멈추지 않도록 대체 데이터 제공
// ----------------------------------------------------------------

// 공원 더미 데이터 (API 실패 시 사용) — 서울 25개 구 전체 커버 (25구 × 4개 = 100개)
const DUMMY_PARKS = [
  // 강남구
  { name: '대모산근린공원',       lat: 37.5122, lng: 127.0513, address: '강남구 개포로 617' },
  { name: '양재시민의숲',         lat: 37.5232, lng: 127.0388, address: '강남구 언주로 220' },
  { name: '수서근린공원',         lat: 37.5087, lng: 127.0558, address: '강남구 광평로56길 48' },
  { name: '봉은사근린공원',       lat: 37.5152, lng: 127.0423, address: '강남구 봉은사로 531' },
  // 강동구
  { name: '길동생태공원',         lat: 37.5351, lng: 127.1288, address: '강동구 천호대로 1291' },
  { name: '명일근린공원',         lat: 37.5241, lng: 127.1178, address: '강동구 명일로 160' },
  { name: '고덕산근린공원',       lat: 37.5411, lng: 127.1348, address: '강동구 고덕로 234' },
  { name: '천호근린공원',         lat: 37.5261, lng: 127.1128, address: '강동구 천호대로 1015' },
  // 강북구
  { name: '북서울꿈의숲',         lat: 37.6346, lng: 127.0305, address: '강북구 월계로 173' },
  { name: '오패산근린공원',       lat: 37.6446, lng: 127.0205, address: '강북구 오패산로 100' },
  { name: '번동근린공원',         lat: 37.6296, lng: 127.0355, address: '강북구 번동 산85' },
  { name: '수유근린공원',         lat: 37.6496, lng: 127.0155, address: '강북구 수유로 310' },
  // 강서구
  { name: '방화근린공원',         lat: 37.5559, lng: 126.8545, address: '강서구 방화동로 200' },
  { name: '우장산근린공원',       lat: 37.5459, lng: 126.8445, address: '강서구 우장산로 65' },
  { name: '강서한강공원',         lat: 37.5609, lng: 126.8395, address: '강서구 화곡로68길 72' },
  { name: '화곡근린공원',         lat: 37.5409, lng: 126.8595, address: '강서구 화곡로 200' },
  // 관악구
  { name: '관악산공원',           lat: 37.4834, lng: 126.9566, address: '관악구 관악산길 1' },
  { name: '낙성대공원',           lat: 37.4684, lng: 126.9616, address: '관악구 낙성대로 77' },
  { name: '삼성산근린공원',       lat: 37.4884, lng: 126.9416, address: '관악구 삼성산길 100' },
  { name: '신림근린공원',         lat: 37.4734, lng: 126.9466, address: '관악구 신림로 350' },
  // 광진구
  { name: '아차산근린공원',       lat: 37.5435, lng: 127.0873, address: '광진구 능동로 216' },
  { name: '어린이대공원',         lat: 37.5485, lng: 127.0773, address: '광진구 능동로 216' },
  { name: '광진둘레길공원',       lat: 37.5285, lng: 127.0923, address: '광진구 자양번영로 150' },
  { name: '자양근린공원',         lat: 37.5385, lng: 127.0773, address: '광진구 자양로 150' },
  // 구로구
  { name: '안양천생태공원',       lat: 37.4904, lng: 126.8924, address: '구로구 안양천로 697' },
  { name: '구로둘레길공원',       lat: 37.5004, lng: 126.8824, address: '구로구 구로동로 148' },
  { name: '항동청소년공원',       lat: 37.4854, lng: 126.8774, address: '구로구 항동 산60' },
  { name: '오류근린공원',         lat: 37.5054, lng: 126.8974, address: '구로구 오류동로 58' },
  // 금천구
  { name: '독산근린공원',         lat: 37.4619, lng: 126.8950, address: '금천구 독산로 300' },
  { name: '시흥근린공원',         lat: 37.4519, lng: 126.9050, address: '금천구 시흥대로 110' },
  { name: '호압산근린공원',       lat: 37.4669, lng: 126.9100, address: '금천구 호암로 300' },
  { name: '금천한내공원',         lat: 37.4569, lng: 126.8900, address: '금천구 금하로 180' },
  // 노원구
  { name: '불암산근린공원',       lat: 37.6592, lng: 127.0618, address: '노원구 불암산로 70' },
  { name: '중계근린공원',         lat: 37.6492, lng: 127.0518, address: '노원구 중계동 산40' },
  { name: '초안산근린공원',       lat: 37.6442, lng: 127.0668, address: '노원구 상계로 180' },
  { name: '당현천근린공원',       lat: 37.6642, lng: 127.0468, address: '노원구 동일로 1500' },
  // 도봉구
  { name: '도봉산공원',           lat: 37.6738, lng: 127.0519, address: '도봉구 도봉산길 86' },
  { name: '쌍문근린공원',         lat: 37.6638, lng: 127.0419, address: '도봉구 쌍문동 산58' },
  { name: '방학근린공원',         lat: 37.6788, lng: 127.0369, address: '도봉구 방학로 145' },
  { name: '초안산공원',           lat: 37.6588, lng: 127.0569, address: '도봉구 덕릉로 280' },
  // 동대문구
  { name: '배봉산근린공원',       lat: 37.5794, lng: 127.0446, address: '동대문구 배봉산로 54' },
  { name: '용두근린공원',         lat: 37.5694, lng: 127.0346, address: '동대문구 천호대로 156' },
  { name: '홍릉근린공원',         lat: 37.5894, lng: 127.0546, address: '동대문구 홍릉로 30' },
  { name: '답십리근린공원',       lat: 37.5644, lng: 127.0496, address: '동대문구 답십리로 62' },
  // 동작구
  { name: '보라매공원',           lat: 37.5174, lng: 126.9343, address: '동작구 보라매로5길 15' },
  { name: '국사봉근린공원',       lat: 37.5074, lng: 126.9443, address: '동작구 국사봉길 52' },
  { name: '동작근린공원',         lat: 37.5224, lng: 126.9293, address: '동작구 동작대로 130' },
  { name: '상도근린공원',         lat: 37.4974, lng: 126.9493, address: '동작구 상도로 368' },
  // 마포구
  { name: '월드컵공원',           lat: 37.5713, lng: 126.8966, address: '마포구 하늘공원로 95' },
  { name: '망원한강공원',         lat: 37.5563, lng: 126.9066, address: '마포구 망원동 442' },
  { name: '상암근린공원',         lat: 37.5663, lng: 126.8916, address: '마포구 상암동 1652' },
  { name: '성미산근린공원',       lat: 37.5563, lng: 126.9116, address: '마포구 성미산로 55' },
  // 서대문구
  { name: '안산근린공원',         lat: 37.5841, lng: 126.9318, address: '서대문구 안산자락로 240' },
  { name: '홍제천근린공원',       lat: 37.5741, lng: 126.9418, address: '서대문구 홍제천로 150' },
  { name: '연희근린공원',         lat: 37.5791, lng: 126.9268, address: '서대문구 연희로 172' },
  { name: '불광근린공원',         lat: 37.5891, lng: 126.9368, address: '서대문구 불광로 100' },
  // 서초구
  { name: '한강공원 (반포)',       lat: 37.5086, lng: 127.0027, address: '서초구 반포한강공원로 405' },
  { name: '우면산근린공원',       lat: 37.4686, lng: 127.0327, address: '서초구 우면산로 100' },
  { name: '방배근린공원',         lat: 37.4886, lng: 127.0377, address: '서초구 방배중앙로 50' },
  { name: '서초근린공원',         lat: 37.4786, lng: 127.0277, address: '서초구 서초대로 200' },
  // 성동구
  { name: '서울숲공원',           lat: 37.5443, lng: 127.0374, address: '성동구 뚝섬로 273' },
  { name: '응봉근린공원',         lat: 37.5534, lng: 127.0319, address: '성동구 응봉로 79' },
  { name: '매봉근린공원',         lat: 37.5484, lng: 127.0469, address: '성동구 왕십리로 410' },
  { name: '살곶이공원',           lat: 37.5584, lng: 127.0419, address: '성동구 살곶이길 77' },
  // 성북구
  { name: '북악산근린공원',       lat: 37.5944, lng: 127.0117, address: '성북구 북악산로 100' },
  { name: '정릉근린공원',         lat: 37.5994, lng: 127.0217, address: '성북구 정릉로 310' },
  { name: '개운산근린공원',       lat: 37.5844, lng: 127.0267, address: '성북구 개운사길 60' },
  { name: '월곡근린공원',         lat: 37.5894, lng: 127.0067, address: '성북구 월곡로 192' },
  // 송파구
  { name: '올림픽공원',           lat: 37.5198, lng: 127.1109, address: '송파구 올림픽로 424' },
  { name: '방이생태공원',         lat: 37.5098, lng: 127.1009, address: '송파구 방이동 88' },
  { name: '성내근린공원',         lat: 37.5148, lng: 127.1159, address: '송파구 성내로 40' },
  { name: '장지근린공원',         lat: 37.5048, lng: 127.1109, address: '송파구 장지로 90' },
  // 양천구
  { name: '목동근린공원',         lat: 37.5220, lng: 126.8716, address: '양천구 목동서로 225' },
  { name: '신정근린공원',         lat: 37.5120, lng: 126.8616, address: '양천구 신정로 102' },
  { name: '신월근린공원',         lat: 37.5170, lng: 126.8766, address: '양천구 신월로 200' },
  { name: '오목근린공원',         lat: 37.5270, lng: 126.8666, address: '양천구 오목로 380' },
  // 영등포구
  { name: '한강공원 (여의도)',     lat: 37.5314, lng: 126.9013, address: '영등포구 여의동로 330' },
  { name: '선유도공원',           lat: 37.5214, lng: 126.8913, address: '영등포구 선유로 343' },
  { name: '영등포공원',           lat: 37.5314, lng: 126.8963, address: '영등포구 영등포로 255' },
  { name: '당산근린공원',         lat: 37.5364, lng: 126.9013, address: '영등포구 당산로 154' },
  // 용산구
  { name: '용산가족공원',         lat: 37.5361, lng: 126.9760, address: '용산구 서빙고로 137' },
  { name: '남산공원',             lat: 37.5511, lng: 126.9860, address: '용산구 소월로 105' },
  { name: '효창근린공원',         lat: 37.5411, lng: 126.9710, address: '용산구 효창원로 177' },
  { name: '이촌한강공원',         lat: 37.5261, lng: 126.9710, address: '용산구 이촌로 72' },
  // 은평구
  { name: '북한산근린공원',       lat: 37.6227, lng: 126.9177, address: '은평구 북한산로 400' },
  { name: '불광근린공원',         lat: 37.6077, lng: 126.9327, address: '은평구 불광로 85' },
  { name: '진관근린공원',         lat: 37.6327, lng: 126.9127, address: '은평구 진관길 103' },
  { name: '응암근린공원',         lat: 37.6027, lng: 126.9177, address: '은평구 응암로 170' },
  // 종로구
  { name: '낙산공원',             lat: 37.5785, lng: 126.9840, address: '종로구 낙산성곽길 41' },
  { name: '인왕산근린공원',       lat: 37.5885, lng: 126.9740, address: '종로구 창의문로 18' },
  { name: '북악산공원',           lat: 37.5935, lng: 126.9790, address: '종로구 북악산로 250' },
  { name: '경복궁근린공원',       lat: 37.5685, lng: 126.9790, address: '종로구 사직로 161' },
  // 중구
  { name: '남산공원',             lat: 37.5691, lng: 126.9929, address: '중구 삼일대로 231' },
  { name: '약현근린공원',         lat: 37.5591, lng: 126.9879, address: '중구 서소문로 109' },
  { name: '장충근린공원',         lat: 37.5641, lng: 127.0079, address: '중구 장충단로 84' },
  { name: '예장근린공원',         lat: 37.5541, lng: 126.9929, address: '중구 소파로 42' },
  // 중랑구
  { name: '중랑캠핑숲',           lat: 37.6003, lng: 127.0882, address: '중랑구 망우로87길 94' },
  { name: '망우근린공원',         lat: 37.5903, lng: 127.0982, address: '중랑구 망우로 300' },
  { name: '봉화산근린공원',       lat: 37.6053, lng: 127.0832, address: '중랑구 봉화산로 120' },
  { name: '용마산근린공원',       lat: 37.5853, lng: 127.0932, address: '중랑구 용마산로 280' },
];

// 음식점 더미 데이터 — 서울 25개 구 전체 커버 (25구 × 4개 = 100개)
const DUMMY_RESTAURANTS = [
  // 강남구
  { name: '도그파크 다이닝 (압구정)',    lat: 37.5222, lng: 127.0423, address: '강남구 압구정로 80' },
  { name: '멍멍식당 (청담)',             lat: 37.5122, lng: 127.0523, address: '강남구 청담대로 102' },
  { name: '펫프렌들리 레스토랑 (역삼)',  lat: 37.5272, lng: 127.0373, address: '강남구 테헤란로 152' },
  { name: '왈왈밥상 (논현)',             lat: 37.5122, lng: 127.0423, address: '강남구 논현로 430' },
  // 강동구
  { name: '강동펫레스토랑 (천호)',       lat: 37.5251, lng: 127.1188, address: '강동구 천호대로 255' },
  { name: '멍멍한상 (암사)',             lat: 37.5351, lng: 127.1288, address: '강동구 암사동길 50' },
  { name: '펫프렌들리 레스토랑 (강동)',  lat: 37.5201, lng: 127.1138, address: '강동구 강동대로 400' },
  { name: '도그다이닝 (명일)',           lat: 37.5401, lng: 127.1238, address: '강동구 명일로 80' },
  // 강북구
  { name: '강북펫다이닝 (수유)',         lat: 37.6446, lng: 127.0205, address: '강북구 도봉로 215' },
  { name: '멍멍식탁 (미아)',             lat: 37.6346, lng: 127.0305, address: '강북구 삼양로 300' },
  { name: '펫프렌들리 레스토랑 (번동)', lat: 37.6496, lng: 127.0155, address: '강북구 번동로 90' },
  { name: '꼬리흔드는식당 (우이)',       lat: 37.6296, lng: 127.0255, address: '강북구 우이동길 100' },
  // 강서구
  { name: '강서펫레스토랑 (화곡)',       lat: 37.5559, lng: 126.8445, address: '강서구 공항대로 475' },
  { name: '멍멍비스트로 (목동)',         lat: 37.5459, lng: 126.8545, address: '강서구 화곡로 380' },
  { name: '펫프렌들리 레스토랑 (방화)', lat: 37.5609, lng: 126.8395, address: '강서구 방화대로 200' },
  { name: '도그키친 (가양)',             lat: 37.5409, lng: 126.8495, address: '강서구 강서로 388' },
  // 관악구
  { name: '관악펫식당 (신림)',           lat: 37.4834, lng: 126.9466, address: '관악구 신림로 275' },
  { name: '멍멍한상 (봉천)',             lat: 37.4684, lng: 126.9566, address: '관악구 봉천로 430' },
  { name: '펫프렌들리 레스토랑 (관악)', lat: 37.4884, lng: 126.9416, address: '관악구 관악로 188' },
  { name: '도그다이닝 (낙성대)',         lat: 37.4734, lng: 126.9516, address: '관악구 낙성대로 55' },
  // 광진구
  { name: '광진강변레스토랑 (자양)',     lat: 37.5435, lng: 127.0773, address: '광진구 자양강변길 30' },
  { name: '멍멍식탁 (구의)',             lat: 37.5285, lng: 127.0873, address: '광진구 능동로 70' },
  { name: '펫프렌들리 레스토랑 (광진)', lat: 37.5485, lng: 127.0923, address: '광진구 광나루로 360' },
  { name: '왈왈키친 (중곡)',             lat: 37.5385, lng: 127.0823, address: '광진구 중곡로 88' },
  // 구로구
  { name: '멍이랑밥 (구로디지털)',       lat: 37.5004, lng: 126.8824, address: '구로구 디지털로 300' },
  { name: '펫프렌들리 레스토랑 (개봉)', lat: 37.4904, lng: 126.8924, address: '구로구 개봉로 120' },
  { name: '도그밥상 (오류)',             lat: 37.4854, lng: 126.8774, address: '구로구 오류동로 58' },
  { name: '강아지야밥먹자 (신도림)',     lat: 37.5054, lng: 126.8874, address: '구로구 경인로 661' },
  // 금천구
  { name: '금천펫레스토랑 (독산)',       lat: 37.4619, lng: 126.8950, address: '금천구 시흥대로 166' },
  { name: '멍멍식탁 (시흥)',             lat: 37.4519, lng: 126.9050, address: '금천구 독산로 274' },
  { name: '펫프렌들리 레스토랑 (금천)', lat: 37.4669, lng: 126.9100, address: '금천구 금하로 180' },
  { name: '도그다이닝 (가산)',           lat: 37.4569, lng: 126.8900, address: '금천구 가산디지털2로 55' },
  // 노원구
  { name: '왈왈키친 (노원)',             lat: 37.6592, lng: 127.0618, address: '노원구 동일로 1326' },
  { name: '멍멍식탁 (상계)',             lat: 37.6492, lng: 127.0518, address: '노원구 상계로 200' },
  { name: '펫프렌들리 레스토랑 (중계)', lat: 37.6442, lng: 127.0668, address: '노원구 중계로 140' },
  { name: '도그밥상 (공릉)',             lat: 37.6642, lng: 127.0468, address: '노원구 공릉로 388' },
  // 도봉구
  { name: '도봉펫레스토랑 (창동)',       lat: 37.6688, lng: 127.0469, address: '도봉구 도봉로 600' },
  { name: '멍멍식당 (쌍문)',             lat: 37.6788, lng: 127.0369, address: '도봉구 쌍문로 88' },
  { name: '펫프렌들리 레스토랑 (방학)', lat: 37.6638, lng: 127.0519, address: '도봉구 방학로 145' },
  { name: '왈왈한상 (도봉)',             lat: 37.6588, lng: 127.0419, address: '도봉구 도봉산길 55' },
  // 동대문구
  { name: '동대문펫레스토랑 (답십리)',   lat: 37.5794, lng: 127.0346, address: '동대문구 전농로 100' },
  { name: '멍멍비스트로 (장안)',         lat: 37.5694, lng: 127.0446, address: '동대문구 장안로 155' },
  { name: '펫프렌들리 레스토랑 (이문)', lat: 37.5894, lng: 127.0546, address: '동대문구 이문로 60' },
  { name: '도그다이닝 (회기)',           lat: 37.5644, lng: 127.0396, address: '동대문구 회기로 89' },
  // 동작구
  { name: '동작펫다이닝 (사당)',         lat: 37.5174, lng: 126.9343, address: '동작구 사당로 200' },
  { name: '멍멍식탁 (노량진)',           lat: 37.5074, lng: 126.9443, address: '동작구 노량진로 110' },
  { name: '펫프렌들리 레스토랑 (동작)', lat: 37.5224, lng: 126.9293, address: '동작구 동작대로 130' },
  { name: '왈왈키친 (상도)',             lat: 37.4974, lng: 126.9493, address: '동작구 상도로 225' },
  // 마포구
  { name: '멍멍 레스토랑 (홍대)',        lat: 37.5563, lng: 126.8966, address: '마포구 홍익로 10' },
  { name: '바크버거 (연남)',             lat: 37.5713, lng: 126.9066, address: '마포구 연남로 25' },
  { name: '펫프렌들리 밥집 (망원)',      lat: 37.5663, lng: 126.9016, address: '마포구 망원동 10' },
  { name: '뭉클비스트로 (합정)',         lat: 37.5513, lng: 126.8916, address: '마포구 양화로 200' },
  // 서대문구
  { name: '솔솔비스트로 (신촌)',         lat: 37.5841, lng: 126.9318, address: '서대문구 신촌로 77' },
  { name: '멍멍식탁 (홍은)',             lat: 37.5741, lng: 126.9418, address: '서대문구 홍은로 45' },
  { name: '펫프렌들리 레스토랑 (가좌)', lat: 37.5791, lng: 126.9268, address: '서대문구 가좌로 100' },
  { name: '도그다이닝 (북가좌)',         lat: 37.5891, lng: 126.9368, address: '서대문구 증가로 150' },
  // 서초구
  { name: '멍이랑한상 (서초)',           lat: 37.4886, lng: 127.0277, address: '서초구 방배중앙로 24' },
  { name: '포우레스토랑 (반포)',         lat: 37.4686, lng: 127.0427, address: '서초구 반포대로 55' },
  { name: '펫프렌들리 레스토랑 (양재)', lat: 37.4786, lng: 127.0377, address: '서초구 양재대로 200' },
  { name: '도그다이닝 (우면)',           lat: 37.4986, lng: 127.0227, address: '서초구 우면로 100' },
  // 성동구
  { name: '강아지야밥먹자 (성수)',       lat: 37.5634, lng: 127.0419, address: '성동구 성수이로 78' },
  { name: '멍멍식탁 (왕십리)',           lat: 37.5534, lng: 127.0319, address: '성동구 왕십리로 83' },
  { name: '펫프렌들리 레스토랑 (행당)', lat: 37.5584, lng: 127.0469, address: '성동구 행당로 70' },
  { name: '왈왈키친 (금호)',             lat: 37.5484, lng: 127.0369, address: '성동구 금호로 180' },
  // 성북구
  { name: '성북반려견식당 (정릉)',       lat: 37.5944, lng: 127.0117, address: '성북구 동소문로 94' },
  { name: '멍멍비스트로 (길음)',         lat: 37.5844, lng: 127.0217, address: '성북구 돌곶이로 155' },
  { name: '펫프렌들리 레스토랑 (성북)', lat: 37.5994, lng: 127.0267, address: '성북구 보국문로 120' },
  { name: '도그다이닝 (석관)',           lat: 37.5794, lng: 127.0067, address: '성북구 화랑로 200' },
  // 송파구
  { name: '펫피크닉 (송파)',             lat: 37.5198, lng: 127.1009, address: '송파구 올림픽로 290' },
  { name: '멍멍식탁 (잠실)',             lat: 37.5098, lng: 127.1109, address: '송파구 잠실로 200' },
  { name: '펫프렌들리 레스토랑 (문정)', lat: 37.5048, lng: 127.1059, address: '송파구 문정로 90' },
  { name: '왈왈다이닝 (가락)',           lat: 37.5148, lng: 127.1159, address: '송파구 가락로 130' },
  // 양천구
  { name: '온더독 (목동)',               lat: 37.5220, lng: 126.8616, address: '양천구 목동서로 101' },
  { name: '멍멍식탁 (신정)',             lat: 37.5120, lng: 126.8716, address: '양천구 신정로 88' },
  { name: '펫프렌들리 레스토랑 (양천)', lat: 37.5170, lng: 126.8766, address: '양천구 오목로 310' },
  { name: '도그다이닝 (신월)',           lat: 37.5270, lng: 126.8666, address: '양천구 신월로 200' },
  // 영등포구
  { name: '강가식당 (여의도)',           lat: 37.5314, lng: 126.8913, address: '영등포구 여의대방로65길 30' },
  { name: '멍멍비스트로 (영등포)',       lat: 37.5214, lng: 126.9013, address: '영등포구 영등포로 192' },
  { name: '펫프렌들리 레스토랑 (당산)', lat: 37.5364, lng: 126.8963, address: '영등포구 당산로 200' },
  { name: '왈왈키친 (대림)',             lat: 37.5264, lng: 126.8863, address: '영등포구 도림로 100' },
  // 용산구
  { name: '펫키친 (한남)',               lat: 37.5361, lng: 126.9760, address: '용산구 이태원로 245' },
  { name: '뭉클비스트로 (이태원)',       lat: 37.5261, lng: 126.9860, address: '용산구 한남대로 25' },
  { name: '펫프렌들리 레스토랑 (용산)', lat: 37.5411, lng: 126.9710, address: '용산구 용산로 145' },
  { name: '도그다이닝 (삼각지)',         lat: 37.5211, lng: 126.9710, address: '용산구 한강대로 416' },
  // 은평구
  { name: '두릅하우스 (불광)',           lat: 37.6177, lng: 126.9177, address: '은평구 통일로 895' },
  { name: '멍멍식탁 (응암)',             lat: 37.6027, lng: 126.9327, address: '은평구 응암로 170' },
  { name: '펫프렌들리 레스토랑 (은평)', lat: 37.6327, lng: 126.9127, address: '은평구 진관길 88' },
  { name: '왈왈다이닝 (녹번)',           lat: 37.6077, lng: 126.9227, address: '은평구 녹번로 55' },
  // 종로구
  { name: '그린보울 (서촌)',             lat: 37.5785, lng: 126.9740, address: '종로구 자하문로 43' },
  { name: '멍멍식탁 (인사동)',           lat: 37.5685, lng: 126.9840, address: '종로구 인사동길 44' },
  { name: '펫프렌들리 레스토랑 (종로)', lat: 37.5885, lng: 126.9740, address: '종로구 종로 100' },
  { name: '도그다이닝 (북촌)',           lat: 37.5635, lng: 126.9790, address: '종로구 북촌로 77' },
  // 중구
  { name: '멍멍식탁 (명동)',             lat: 37.5641, lng: 126.9929, address: '중구 명동길 14' },
  { name: '펫프렌들리 레스토랑 (을지)', lat: 37.5541, lng: 126.9979, address: '중구 을지로 100' },
  { name: '도그다이닝 (충무)',           lat: 37.5691, lng: 127.0079, address: '중구 충무로 66' },
  { name: '왈왈비스트로 (신당)',         lat: 37.5591, lng: 126.9879, address: '중구 다산로 100' },
  // 중랑구
  { name: '중랑반려견밥집 (면목)',       lat: 37.6003, lng: 127.0882, address: '중랑구 면목로 461' },
  { name: '멍멍식탁 (상봉)',             lat: 37.5903, lng: 127.0982, address: '중랑구 상봉로 100' },
  { name: '펫프렌들리 레스토랑 (중랑)', lat: 37.6053, lng: 127.0832, address: '중랑구 중랑천로 220' },
  { name: '도그다이닝 (신내)',           lat: 37.5853, lng: 127.0932, address: '중랑구 신내로 150' },
];

// 카페 더미 데이터 — 서울 25개 구 전체 커버 (25구 × 4개 = 100개)
const DUMMY_CAFES = [
  // 강남구
  { name: '도기도기카페 (압구정)',       lat: 37.5222, lng: 127.0423, address: '강남구 압구정로64길 14' },
  { name: '바우와우카페 (청담)',         lat: 37.5122, lng: 127.0573, address: '강남구 청담동길 55' },
  { name: '퍼피라떼 (역삼)',             lat: 37.5272, lng: 127.0323, address: '강남구 테헤란로 88' },
  { name: '멍멍커피 (강남)',             lat: 37.5172, lng: 127.0423, address: '강남구 강남대로 390' },
  // 강동구
  { name: '강동퍼피카페 (천호)',         lat: 37.5251, lng: 127.1188, address: '강동구 올림픽로 696' },
  { name: '꼬리별카페 (암사)',           lat: 37.5351, lng: 127.1288, address: '강동구 암사대로 66' },
  { name: '멍멍라떼 (강동)',             lat: 37.5201, lng: 127.1138, address: '강동구 강동대로 350' },
  { name: '퍼피라떼 (명일)',             lat: 37.5401, lng: 127.1238, address: '강동구 명일로 44' },
  // 강북구
  { name: '강북퍼피카페 (수유)',         lat: 37.6446, lng: 127.0205, address: '강북구 삼양로 196' },
  { name: '멍멍커피 (미아)',             lat: 37.6346, lng: 127.0305, address: '강북구 도봉로 180' },
  { name: '꼬리별카페 (번동)',           lat: 37.6496, lng: 127.0155, address: '강북구 번동 산85' },
  { name: '퍼피라떼 (우이)',             lat: 37.6296, lng: 127.0255, address: '강북구 우이동로 55' },
  // 강서구
  { name: '강서멍멍카페 (화곡)',         lat: 37.5559, lng: 126.8445, address: '강서구 강서로 450' },
  { name: '퍼피라떼 (목동)',             lat: 37.5459, lng: 126.8545, address: '강서구 화곡로 300' },
  { name: '멍멍커피 (방화)',             lat: 37.5609, lng: 126.8395, address: '강서구 방화대로 150' },
  { name: '꼬리별카페 (가양)',           lat: 37.5409, lng: 126.8495, address: '강서구 가양로 88' },
  // 관악구
  { name: '관악멍멍카페 (신림)',         lat: 37.4834, lng: 126.9466, address: '관악구 관악로 166' },
  { name: '퍼피라떼 (봉천)',             lat: 37.4684, lng: 126.9566, address: '관악구 봉천로 200' },
  { name: '멍멍커피 (관악)',             lat: 37.4884, lng: 126.9416, address: '관악구 신림로 188' },
  { name: '꼬리별카페 (낙성대)',         lat: 37.4734, lng: 126.9516, address: '관악구 낙성대로 44' },
  // 광진구
  { name: '광진강변카페 (자양)',         lat: 37.5435, lng: 127.0773, address: '광진구 강변역로 27' },
  { name: '퍼피라떼 (구의)',             lat: 37.5285, lng: 127.0873, address: '광진구 자양로 150' },
  { name: '멍멍커피 (광진)',             lat: 37.5485, lng: 127.0923, address: '광진구 광나루로 300' },
  { name: '꼬리별카페 (중곡)',           lat: 37.5385, lng: 127.0823, address: '광진구 중곡로 55' },
  // 구로구
  { name: '구로멍멍카페 (구로디지털)',   lat: 37.5004, lng: 126.8824, address: '구로구 구로동로 258' },
  { name: '퍼피라떼 (개봉)',             lat: 37.4904, lng: 126.8924, address: '구로구 개봉로 80' },
  { name: '멍멍커피 (오류)',             lat: 37.4854, lng: 126.8774, address: '구로구 오류동로 35' },
  { name: '꼬리별카페 (신도림)',         lat: 37.5054, lng: 126.8874, address: '구로구 경인로 485' },
  // 금천구
  { name: '금천퍼피카페 (독산)',         lat: 37.4619, lng: 126.8950, address: '금천구 독산로 274' },
  { name: '멍멍라떼 (시흥)',             lat: 37.4519, lng: 126.9050, address: '금천구 시흥대로 55' },
  { name: '퍼피라떼 (가산)',             lat: 37.4669, lng: 126.9100, address: '금천구 가산디지털1로 100' },
  { name: '꼬리별카페 (금천)',           lat: 37.4569, lng: 126.8900, address: '금천구 금하로 88' },
  // 노원구
  { name: '멍멍커피 (노원)',             lat: 37.6592, lng: 127.0618, address: '노원구 노원로 447' },
  { name: '퍼피라떼 (상계)',             lat: 37.6492, lng: 127.0518, address: '노원구 상계로 300' },
  { name: '꼬리별카페 (중계)',           lat: 37.6442, lng: 127.0668, address: '노원구 중계로 200' },
  { name: '멍멍라떼 (공릉)',             lat: 37.6642, lng: 127.0468, address: '노원구 공릉로 260' },
  // 도봉구
  { name: '도봉멍멍카페 (창동)',         lat: 37.6688, lng: 127.0469, address: '도봉구 도봉로 380' },
  { name: '퍼피라떼 (쌍문)',             lat: 37.6788, lng: 127.0369, address: '도봉구 쌍문로 60' },
  { name: '멍멍커피 (방학)',             lat: 37.6638, lng: 127.0519, address: '도봉구 방학로 90' },
  { name: '꼬리별카페 (도봉)',           lat: 37.6588, lng: 127.0419, address: '도봉구 도봉산길 30' },
  // 동대문구
  { name: '동대문퍼피라떼 (답십리)',     lat: 37.5794, lng: 127.0346, address: '동대문구 전농로 85' },
  { name: '멍멍커피 (장안)',             lat: 37.5694, lng: 127.0446, address: '동대문구 장안로 100' },
  { name: '퍼피라떼 (이문)',             lat: 37.5894, lng: 127.0546, address: '동대문구 이문로 44' },
  { name: '꼬리별카페 (회기)',           lat: 37.5644, lng: 127.0396, address: '동대문구 회기로 55' },
  // 동작구
  { name: '멍멍커피 (사당)',             lat: 37.5174, lng: 126.9343, address: '동작구 사당로 100' },
  { name: '퍼피라떼 (노량진)',           lat: 37.5074, lng: 126.9443, address: '동작구 노량진로 88' },
  { name: '꼬리별카페 (동작)',           lat: 37.5224, lng: 126.9293, address: '동작구 동작대로 75' },
  { name: '멍멍라떼 (상도)',             lat: 37.4974, lng: 126.9493, address: '동작구 상도로 300' },
  // 마포구
  { name: '멍하니커피 (합정)',           lat: 37.5563, lng: 126.8966, address: '마포구 토정로 35' },
  { name: '퍼피라떼 (연남)',             lat: 37.5713, lng: 126.9016, address: '마포구 연남로3길 12' },
  { name: '도그트리카페 (망원)',         lat: 37.5663, lng: 126.9066, address: '마포구 망원동 415' },
  { name: '꼬리별카페 (홍대)',           lat: 37.5513, lng: 126.8916, address: '마포구 홍익로 55' },
  // 서대문구
  { name: '강아지천국 (신촌)',           lat: 37.5841, lng: 126.9318, address: '서대문구 신촌로3안길 12' },
  { name: '해피퍼피카페 (불광)',         lat: 37.5741, lng: 126.9418, address: '서대문구 불광천로 77' },
  { name: '멍멍커피 (홍은)',             lat: 37.5791, lng: 126.9268, address: '서대문구 홍은로 120' },
  { name: '퍼피라떼 (가좌)',             lat: 37.5891, lng: 126.9368, address: '서대문구 가좌로 77' },
  // 서초구
  { name: '멍멍라떼 (서초)',             lat: 37.4886, lng: 127.0277, address: '서초구 방배로 246' },
  { name: '포포카페 (반포)',             lat: 37.4686, lng: 127.0427, address: '서초구 반포대로28길 36' },
  { name: '퍼피라떼 (양재)',             lat: 37.4786, lng: 127.0377, address: '서초구 양재대로 155' },
  { name: '꼬리별카페 (우면)',           lat: 37.4986, lng: 127.0227, address: '서초구 우면산로 44' },
  // 성동구
  { name: '어글리베이커리 (서울숲)',     lat: 37.5634, lng: 127.0319, address: '성동구 서울숲2길 44' },
  { name: '왈왈카페 (성수)',             lat: 37.5534, lng: 127.0419, address: '성동구 성수이로7가길 30' },
  { name: '퍼피라떼 (왕십리)',           lat: 37.5584, lng: 127.0469, address: '성동구 왕십리로 200' },
  { name: '멍멍커피 (금호)',             lat: 37.5484, lng: 127.0369, address: '성동구 금호로 100' },
  // 성북구
  { name: '성북반려견카페 (정릉)',       lat: 37.5944, lng: 127.0117, address: '성북구 보문로 200' },
  { name: '퍼피라떼 (길음)',             lat: 37.5844, lng: 127.0217, address: '성북구 돌곶이로 80' },
  { name: '멍멍커피 (성북)',             lat: 37.5994, lng: 127.0267, address: '성북구 화랑로 150' },
  { name: '꼬리별카페 (석관)',           lat: 37.5794, lng: 127.0067, address: '성북구 북악산로 88' },
  // 송파구
  { name: '송파강아지카페 (잠실)',       lat: 37.5198, lng: 127.1009, address: '송파구 송파대로 560' },
  { name: '퍼피라떼 (문정)',             lat: 37.5098, lng: 127.1109, address: '송파구 문정로 55' },
  { name: '멍멍커피 (가락)',             lat: 37.5048, lng: 127.1059, address: '송파구 가락로 88' },
  { name: '꼬리별카페 (방이)',           lat: 37.5148, lng: 127.1159, address: '송파구 올림픽로 200' },
  // 양천구
  { name: '양천퍼피카페 (목동)',         lat: 37.5220, lng: 126.8616, address: '양천구 목동로 255' },
  { name: '와글와글카페 (신정)',         lat: 37.5120, lng: 126.8716, address: '양천구 목동서로 153' },
  { name: '멍멍커피 (신월)',             lat: 37.5170, lng: 126.8766, address: '양천구 신월로 150' },
  { name: '퍼피라떼 (오목)',             lat: 37.5270, lng: 126.8666, address: '양천구 오목로 200' },
  // 영등포구
  { name: '영등포퍼피라떼 (여의도)',     lat: 37.5314, lng: 126.8913, address: '영등포구 당산로 200' },
  { name: '멍멍커피 (영등포)',           lat: 37.5214, lng: 126.9013, address: '영등포구 영등포로 100' },
  { name: '꼬리별카페 (당산)',           lat: 37.5364, lng: 126.8963, address: '영등포구 당산로 120' },
  { name: '퍼피라떼 (대림)',             lat: 37.5264, lng: 126.8863, address: '영등포구 도림로 55' },
  // 용산구
  { name: '독도카페 (한남)',             lat: 37.5361, lng: 126.9760, address: '용산구 독서당로 60' },
  { name: '퍼피라떼 (이태원)',           lat: 37.5261, lng: 126.9860, address: '용산구 이태원로 200' },
  { name: '멍멍커피 (용산)',             lat: 37.5411, lng: 126.9710, address: '용산구 한강대로 100' },
  { name: '꼬리별카페 (삼각지)',         lat: 37.5211, lng: 126.9710, address: '용산구 한강대로 300' },
  // 은평구
  { name: '해피퍼피카페 (불광)',         lat: 37.6177, lng: 126.9177, address: '은평구 불광천로 77' },
  { name: '퍼피라떼 (응암)',             lat: 37.6027, lng: 126.9327, address: '은평구 응암로 88' },
  { name: '멍멍커피 (녹번)',             lat: 37.6327, lng: 126.9127, address: '은평구 녹번로 44' },
  { name: '꼬리별카페 (진관)',           lat: 37.6077, lng: 126.9227, address: '은평구 진관길 55' },
  // 종로구
  { name: '꼬리별카페 (북촌)',           lat: 37.5785, lng: 126.9740, address: '종로구 북촌로 45' },
  { name: '퍼피라떼 (인사동)',           lat: 37.5685, lng: 126.9840, address: '종로구 인사동5길 22' },
  { name: '멍멍커피 (서촌)',             lat: 37.5885, lng: 126.9740, address: '종로구 자하문로 100' },
  { name: '멍하니커피 (혜화)',           lat: 37.5635, lng: 126.9790, address: '종로구 혜화로 55' },
  // 중구
  { name: '멍멍커피 (명동)',             lat: 37.5641, lng: 126.9929, address: '중구 명동길 66' },
  { name: '퍼피라떼 (을지로)',           lat: 37.5541, lng: 126.9979, address: '중구 을지로 88' },
  { name: '꼬리별카페 (충무로)',         lat: 37.5691, lng: 127.0079, address: '중구 충무로 44' },
  { name: '멍멍라떼 (신당)',             lat: 37.5591, lng: 126.9879, address: '중구 다산로 55' },
  // 중랑구
  { name: '중랑펫카페 (면목)',           lat: 37.6003, lng: 127.0882, address: '중랑구 면목로 350' },
  { name: '퍼피라떼 (상봉)',             lat: 37.5903, lng: 127.0982, address: '중랑구 상봉로 77' },
  { name: '멍멍커피 (봉화산)',           lat: 37.6053, lng: 127.0832, address: '중랑구 봉화산로 88' },
  { name: '꼬리별카페 (신내)',           lat: 37.5853, lng: 127.0932, address: '중랑구 신내로 100' },
];

// 대기질 더미 데이터 (API 실패 시 사용)
const DUMMY_AIR_PM10 = 45; // 단위: ㎍/m³


// ----------------------------------------------------------------
// 4. 전역 상태 변수
// ----------------------------------------------------------------

let map;             // 카카오맵 객체 (initMap에서 생성)
let allMarkers = [];  // 전체 마커 목록 { marker, popup, category, place }
let activePopup = null; // 현재 열려 있는 팝업 오버레이 (하나만 유지)
let sidebarPlaces = []; // 사이드바 리스트용 장소 목록
let activeListItem = null; // 현재 선택된 사이드바 아이템

let userLocation    = null;   // { lat, lng } — 사용자 현재 위치
let currentSort     = 'dist'; // 'dist' | 'alpha'
let applyFiltersRef = null;   // setupFilters 내부 applyFilters 외부 노출용
let currentPm10     = null;   // 서울 평균 PM10 (산책 가능도 계산용)


// ----------------------------------------------------------------
// 5. 카테고리별 색상/아이콘 반환 헬퍼 함수
// ----------------------------------------------------------------

// 카테고리 → 마커 배경색
function getCategoryColor(category) {
  const colors = {
    park:       '#43A047',
    restaurant: '#EF5350',
    cafe:       '#8D6E63',
    'pf-cafe':  '#5856D6',
    vet:        '#FF2D55',
    playground: '#30B0C7',
  };
  return colors[category] || '#888';
}

// 카테고리 → 한글 라벨
function getCategoryLabel(category) {
  const labels = {
    park:       '공원',
    restaurant: '음식점',
    cafe:       '애견카페/운동장',
    'pf-cafe':  '애견동반 카페',
    vet:        '동물병원',
    playground: '반려견 놀이터',
  };
  return labels[category] || '장소';
}


// ----------------------------------------------------------------
// 6. 카카오맵 초기화
// ----------------------------------------------------------------

function initMap() {
  // 지도를 넣을 HTML 요소 가져오기
  const container = document.getElementById('map');

  // 지도 초기 옵션
  const options = {
    center: new kakao.maps.LatLng(MAP_CENTER.lat, MAP_CENTER.lng),
    level:  MAP_ZOOM_LEVEL,
  };

  // 카카오맵 객체 생성 (이 시점부터 지도가 화면에 보임)
  map = new kakao.maps.Map(container, options);

  console.log('✅ 카카오맵 초기화 완료');
}


// ----------------------------------------------------------------
// 7. 미세먼지 배너 관련 함수
// ----------------------------------------------------------------

// PM10 수치 → 등급 정보 반환
// 기준: 환경부 대기질 통합지수 (CAI) PM10 구간
function getAirGrade(pm10) {
  if (pm10 <= 30)  return { cls: 'good',     label: '좋음',     msg: '산책하기 완벽해요' };
  if (pm10 <= 80)  return { cls: 'normal',   label: '보통',     msg: '산책하기 좋아요' };
  if (pm10 <= 150) return { cls: 'bad',      label: '나쁨',     msg: '짧게만 산책해요' };
  return               { cls: 'very-bad', label: '매우 나쁨', msg: '오늘은 집에서 쉬어요' };
}

// 배너 DOM 업데이트
function updateAirBanner(pm10) {
  const banner = document.getElementById('air-banner');
  const text   = document.getElementById('air-text');

  const info = getAirGrade(pm10);

  // 이전 클래스 제거 후 새 등급 클래스 적용
  banner.className = `air-banner ${info.cls}`;
  text.innerHTML = `미세먼지 ${pm10}㎍/m³<br>${info.msg}`;
}

// 산책 가능도 카드 업데이트 (recommend 탭)
function updateWalkIndexCard(pm10) {
  currentPm10 = pm10;
  const info = getAirGrade(pm10);

  const badge = document.getElementById('walk-index-badge');
  const sub   = document.getElementById('walk-index-sub');
  const pm10Badge = document.getElementById('walk-pm10-badge');

  if (badge) {
    badge.className = `walk-index-badge ${info.cls}`;
    badge.textContent = info.label;
  }
  if (sub)  sub.textContent = info.msg;
  if (pm10Badge) pm10Badge.textContent = `PM10 ${pm10}㎍/m³`;
}

// ----------------------------------------------------------------
// 산책시간 모달 로직
// ----------------------------------------------------------------

// 견종 → 에너지 레벨 매핑 (키워드 기반)
const HIGH_ENERGY_KEYWORDS = [
  '허스키','리트리버','보더','콜리','스피츠','달마시안','비글','포메라니안',
  '잭 러셀','springer','husky','retriever','border','collie','beagle',
  'dalmatian','pomeranian','setter','pointer','corgi','코기','셸티',
];
const LOW_ENERGY_KEYWORDS = [
  '불독','바셋','페키니즈','시추','차우차우','마스티프','불마스티프',
  'bulldog','basset','pekingese','shih','chow','mastiff','bloodhound',
];

function getBreedEnergyLevel(breed) {
  const b = (breed || '').toLowerCase();
  if (HIGH_ENERGY_KEYWORDS.some(k => b.includes(k.toLowerCase()))) return 'high';
  if (LOW_ENERGY_KEYWORDS.some(k => b.includes(k.toLowerCase()))) return 'low';
  return 'medium';
}

// 체중 → 견종 크기 분류
function getSizeByWeight(weightKg) {
  if (weightKg <= 7)  return 'small';
  if (weightKg <= 25) return 'medium';
  return 'large';
}

// 기본 권장 산책 시간 (분/일) — 크기·에너지·중성화 기반
function calcBaseWalkTime(weightKg, breed, neutered) {
  const size   = getSizeByWeight(weightKg);
  const energy = getBreedEnergyLevel(breed);

  // [size][energy] 기본 분
  const base = {
    small:  { low: 20, medium: 30, high: 45 },
    medium: { low: 30, medium: 50, high: 70 },
    large:  { low: 45, medium: 70, high: 100 },
  };

  let minutes = base[size][energy];

  // 중성화 완료 → 에너지 약 10% 감소
  if (neutered === 'yes') minutes = Math.round(minutes * 0.9);

  return minutes;
}

// 대기질에 따른 산책 시간 조정 비율
function getAirMultiplier(pm10) {
  if (pm10 <= 30)  return 1.0;
  if (pm10 <= 80)  return 0.75;
  if (pm10 <= 150) return 0.4;
  return 0.15;
}

// 산책 추천 팁 생성
function getWalkTips(pm10, size, energy, neutered) {
  const tips = [];
  const grade = getAirGrade(pm10);

  if (grade.cls === 'bad' || grade.cls === 'very-bad') {
    tips.push('외출 시 강아지용 마스크 착용을 고려해보세요');
    tips.push('오전 이른 시간 또는 저녁 늦게 산책하면 미세먼지가 낮아요');
  }
  if (grade.cls === 'very-bad') {
    tips.push('오늘은 실내에서 놀아주는 것을 권장해요');
  }
  if (energy === 'high' && (grade.cls === 'good' || grade.cls === 'normal')) {
    tips.push('활동량이 많은 견종이에요. 하루 2회로 나눠 산책하면 좋아요');
  }
  if (size === 'small') {
    tips.push('소형견은 기온·바람에 민감해요. 추운 날은 짧게 자주 산책하세요');
  }
  if (size === 'large' && energy === 'high') {
    tips.push('대형 활동견은 산책만으로 부족할 수 있어요. 공원에서 자유 운동을 추천해요');
  }
  if (neutered === 'no' && energy === 'high') {
    tips.push('중성화 전 수컷은 영역 표시로 자주 멈출 수 있어요. 시간 여유를 두세요');
  }
  return tips.slice(0, 3);
}

function setupWalkModal() {
  const openBtn   = document.getElementById('walk-modal-open-btn');
  const backdrop  = document.getElementById('walk-modal-backdrop');
  const closeBtn  = document.getElementById('walk-modal-close');
  const submitBtn = document.getElementById('walk-modal-submit');

  if (!openBtn || !backdrop) return;

  openBtn.addEventListener('click', () => backdrop.classList.remove('hidden'));
  closeBtn.addEventListener('click', () => backdrop.classList.add('hidden'));
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.add('hidden');
  });

  submitBtn.addEventListener('click', () => {
    const weightVal  = parseFloat(document.getElementById('wm-weight').value);
    const breedVal   = document.getElementById('wm-breed').value.trim();
    const neuteredEl = document.querySelector('input[name="neuter"]:checked');
    const neutered   = neuteredEl ? neuteredEl.value : 'no';
    const resultEl   = document.getElementById('walk-modal-result');

    if (!weightVal || weightVal <= 0 || weightVal > 100) {
      document.getElementById('wm-weight').focus();
      return;
    }

    const pm10    = currentPm10 !== null ? currentPm10 : DUMMY_AIR_PM10;
    const base    = calcBaseWalkTime(weightVal, breedVal, neutered);
    const multi   = getAirMultiplier(pm10);
    const minutes = Math.max(5, Math.round(base * multi));
    const size    = getSizeByWeight(weightVal);
    const energy  = getBreedEnergyLevel(breedVal);
    const grade   = getAirGrade(pm10);
    const tips    = getWalkTips(pm10, size, energy, neutered);
    const sizeLabel = { small: '소형견', medium: '중형견', large: '대형견' }[size];

    const tipsHtml = tips.map(t => `<div class="wmr-tip">${t}</div>`).join('');
    const airNote  = grade.cls === 'good'
      ? '오늘 미세먼지 좋음 — 최적의 산책 날씨예요!'
      : `오늘 미세먼지 ${grade.label} (PM10 ${pm10}㎍/m³) — 기본값에서 조정됐어요`;

    resultEl.innerHTML = `
      <div class="wmr-head">${sizeLabel} · ${breedVal || '견종 미입력'} · 중성화 ${neutered === 'yes' ? '완료' : '미완료'}</div>
      <div class="wmr-time">${minutes}</div>
      <div class="wmr-unit">분 / 일 권장</div>
      <div class="wmr-tips">${tipsHtml}</div>
      <div class="wmr-air-note">${airNote}</div>
    `;
    resultEl.classList.remove('hidden');
  });
}


// ----------------------------------------------------------------
// 8-0. 날씨 API (Open-Meteo — API 키 불필요)
//      강아지 산책 적정 기온: 7~25°C (수의학 기준)
// ----------------------------------------------------------------

// WMO 날씨 코드 → 비/눈 여부
function isRainCode(code) {
  // 51-67 드리즐/비, 71-77 눈, 80-82 소나기, 85-86 눈소나기, 95-99 뇌우
  return (code >= 51 && code <= 67)
      || (code >= 71 && code <= 77)
      || (code >= 80 && code <= 82)
      || (code >= 85 && code <= 86)
      || (code >= 95 && code <= 99);
}

// WMO 날씨 코드 → 이모지+설명
function weatherCodeLabel(code) {
  if (code >= 95) return { emoji: '⛈', text: '뇌우' };
  if (code >= 85) return { emoji: '🌨', text: '눈' };
  if (code >= 80) return { emoji: '🌧', text: '소나기' };
  if (code >= 71) return { emoji: '❄️', text: '눈' };
  if (code >= 61) return { emoji: '🌧', text: '비' };
  if (code >= 51) return { emoji: '🌦', text: '이슬비' };
  return null;
}

// 날씨 배너 라인 업데이트
function updateWeatherLine(weatherData) {
  const lineEl = document.getElementById('weather-line');
  if (!lineEl || !weatherData) return;

  const { temp, feelsLike, weatherCode, precipProb } = weatherData;
  const rain = isRainCode(weatherCode) || precipProb >= 50;

  // 산책 온도 기준 (수의학 권장)
  // < 0°C: 영하 위험  /  0~7°C: 쌀쌀 주의  /  25~32°C: 더위 주의  /  ≥ 32°C: 폭염 위험
  const tooHot  = temp >= 32;
  const warmish = temp >= 25 && temp < 32;
  const cold    = temp > 0  && temp <= 7;
  const tooCold = temp <= 0;

  let cls = '', msg = '';

  if (rain) {
    cls = 'rain';
    const wl = weatherCodeLabel(weatherCode);
    msg = `${wl ? wl.emoji : '🌧'} ${wl ? wl.text : '비'} 예보 · 실내에서 많이 놀아주세요`;
  } else if (tooHot) {
    cls = 'hot';
    msg = `🌡 ${Math.round(temp)}°C · 폭염 위험 · 이른 아침·저녁 산책 추천`;
  } else if (warmish) {
    cls = 'hot';
    msg = `☀️ ${Math.round(temp)}°C · 아스팔트 화상 주의 · 그늘 산책하세요`;
  } else if (tooCold) {
    cls = 'cold';
    msg = `🥶 ${Math.round(temp)}°C · 영하 날씨 · 방한용품 필수`;
  } else if (cold) {
    cls = 'cold';
    msg = `🧥 ${Math.round(temp)}°C · 소형견은 옷을 입혀주세요`;
  }

  if (msg) {
    lineEl.className = `weather-line ${cls}`;
    lineEl.textContent = msg;
  } else {
    // 적정 날씨: 기온만 표시, 경고 없음
    lineEl.className = 'weather-line hidden';
  }

  // 산책 가능도 카드에도 기온 정보 반영
  const walkSub = document.getElementById('walk-index-sub');
  if (walkSub && msg) {
    const existing = walkSub.textContent;
    // 날씨 주의가 있으면 앞에 붙이기 (air quality 메시지 유지)
    walkSub.textContent = msg.replace(/^[^\s]+\s/, '') + ' · ' + existing;
  }
}

async function fetchWeather() {
  try {
    const params = new URLSearchParams({
      latitude:    37.5665,
      longitude:   126.9780,
      current:     'temperature_2m,precipitation,weathercode,apparent_temperature',
      hourly:      'precipitation_probability',
      timezone:    'Asia/Seoul',
      forecast_days: 1,
    });
    const res  = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const data = await res.json();

    // 현재 시각 기준 앞 6시간의 최대 강수 확률
    const now   = new Date();
    const hour  = now.getHours();
    const probs = (data.hourly?.precipitation_probability || []).slice(hour, hour + 6);
    const precipProb = probs.length > 0 ? Math.max(...probs) : 0;

    return {
      temp:        data.current.temperature_2m,
      feelsLike:   data.current.apparent_temperature,
      precip:      data.current.precipitation,
      weatherCode: data.current.weathercode,
      precipProb,
    };
  } catch (e) {
    console.warn('⚠️ 날씨 API 실패:', e.message);
    return null;
  }
}

// ----------------------------------------------------------------
// 8. 서울 실시간 대기환경 API 호출
// ----------------------------------------------------------------

async function fetchAirQuality() {
  try {
    const response = await fetch(API_AIR);
    if (!response.ok) throw new Error(`HTTP 상태 ${response.status}`);

    const data = await response.json();
    const rows = data?.RealtimeCityAir?.row;

    if (!rows || rows.length === 0) throw new Error('대기 데이터가 비어 있음');

    // 서울 전체 측정소 PM10 평균값 계산
    // PM10이 "-" 또는 음수로 올 수 있으므로 양수만 필터링
    console.log('대기질 API 응답 샘플:', rows[0]);
    const validValues = rows
      .map(r => parseFloat(r.PM10))
      .filter(v => !isNaN(v) && v > 0);

    let avgPm10;
    if (validValues.length > 0) {
      avgPm10 = Math.round(validValues.reduce((s, v) => s + v, 0) / validValues.length);
    } else {
      // PM10이 모두 없으면 통합대기환경지수(IDEX_MVL)로 대체
      const idxValues = rows
        .map(r => parseFloat(r.IDEX_MVL))
        .filter(v => !isNaN(v) && v > 0);
      if (idxValues.length === 0) throw new Error('유효한 대기질 데이터 없음');
      avgPm10 = Math.round(idxValues.reduce((s, v) => s + v, 0) / idxValues.length);
    }

    updateAirBanner(avgPm10);
    updateWalkIndexCard(avgPm10);
    console.log(`✅ 대기질 로드 완료: 서울 평균 PM10 ${avgPm10}㎍`);

  } catch (err) {
    // API 실패 → 더미 값으로 배너 표시
    console.warn('⚠️ 대기질 API 실패, 더미 값 사용:', err.message);
    updateAirBanner(DUMMY_AIR_PM10);
    updateWalkIndexCard(DUMMY_AIR_PM10);
  }
}


// ----------------------------------------------------------------
// 9. 서울시 공원 현황 API 호출
//    응답 데이터 → 내부 포맷 { name, lat, lng, address } 으로 변환
// ----------------------------------------------------------------

async function fetchParks() {
  try {
    const response = await fetch(API_PARKS);
    if (!response.ok) throw new Error(`HTTP 상태 ${response.status}`);

    const data = await response.json();
    const rows = data?.SeoulPark?.row;

    if (!rows || rows.length === 0) throw new Error('공원 데이터가 비어 있음');

    // 좌표가 있는 항목만 변환
    const parks = rows
      .filter(r => r.LATITUDE && r.LONGITUDE)
      .map(r => ({
        name:    r.P_PARK,
        lat:     parseFloat(r.LATITUDE),
        lng:     parseFloat(r.LONGITUDE),
        address: r.P_ADDR || r.P_ZONE || '',
      }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lng)); // 숫자 변환 실패 항목 제거

    console.log(`✅ 공원 데이터 로드: ${parks.length}개`);
    return parks;

  } catch (err) {
    console.warn('⚠️ 공원 API 실패, 더미 데이터 사용:', err.message);
    return DUMMY_PARKS; // fallback
  }
}


// ----------------------------------------------------------------
// 10. 카카오 Places 장소 검색 (services 라이브러리 활용)
//     키워드 검색 → 서울 bounds 내 최대 3페이지(45건) 수집
// ----------------------------------------------------------------

// 서울 LatLngBounds (전체 25개 구 포함)
const SEOUL_SW = { lat: 37.4133, lng: 126.7341 };
const SEOUL_NE = { lat: 37.7015, lng: 127.1839 };

// 단일 키워드 → 최대 45건 (3페이지 × 15건) 비동기 수집
function kakaoPlacesKeyword(query) {
  return new Promise(resolve => {
    if (!window.kakao?.maps?.services) { resolve([]); return; }

    const ps     = new kakao.maps.services.Places();
    const bounds = new kakao.maps.LatLngBounds(
      new kakao.maps.LatLng(SEOUL_SW.lat, SEOUL_SW.lng),
      new kakao.maps.LatLng(SEOUL_NE.lat, SEOUL_NE.lng)
    );
    const results  = [];
    let pageCount  = 0;
    const MAX_PAGE = 3;

    ps.keywordSearch(query, function cb(data, status, pagination) {
      if (status === kakao.maps.services.Status.OK) {
        results.push(...data);
        pageCount++;
        if (pagination.hasNextPage && pageCount < MAX_PAGE) {
          pagination.nextPage();
          return;
        }
      }
      resolve(results);
    }, { bounds, size: 15 });
  });
}

// 여러 키워드 검색 후 place_id 기준 중복 제거 → 내부 포맷 변환
// 서울 주소만 포함하도록 필터링
async function fetchKakaoPlaces(keywords) {
  const rawArrays = await Promise.all(keywords.map(q => kakaoPlacesKeyword(q)));
  const raw       = rawArrays.flat();

  const seen = new Set();
  return raw
    .filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      // 서울 소재 업체만
      const addr = p.road_address_name || p.address_name || '';
      return addr.startsWith('서울');
    })
    .map(p => ({
      name:    p.place_name,
      lat:     parseFloat(p.y),
      lng:     parseFloat(p.x),
      address: p.road_address_name || p.address_name || '',
      url:     p.place_url || '',
    }))
    .filter(p => !isNaN(p.lat) && !isNaN(p.lng));
}

// ① 애견카페/운동장 — 카카오에 "애견카페" 카테고리로 등록된 실제 업체
async function fetchPetCafes() {
  try {
    const places = await fetchKakaoPlaces(['애견카페', '강아지카페', '애견운동장']);
    console.log(`✅ 애견카페/운동장 검색: ${places.length}건`);
    return places.length > 0 ? places : DUMMY_CAFES;
  } catch (e) {
    console.warn('애견카페 검색 실패:', e);
    return DUMMY_CAFES;
  }
}

// ② 애견동반 음식점 — "강아지 동반 가능" 키워드 맛집
async function fetchPetRestaurants() {
  try {
    const places = await fetchKakaoPlaces([
      '반려견 동반 맛집',
      '강아지 동반 식당',
      '애견동반 음식점',
    ]);
    console.log(`✅ 애견동반 음식점 검색: ${places.length}건`);
    return places.length > 0 ? places : DUMMY_RESTAURANTS;
  } catch (e) {
    console.warn('애견동반 음식점 검색 실패:', e);
    return DUMMY_RESTAURANTS;
  }
}

// ④ 동물병원 레이어
async function fetchVets() {
  try {
    const places = await fetchKakaoPlaces(['동물병원']);
    console.log(`✅ 동물병원 검색: ${places.length}건`);
    return places;
  } catch (e) {
    console.warn('동물병원 검색 실패:', e);
    return [];
  }
}

// ⑤ 반려견 놀이터
async function fetchPlaygrounds() {
  try {
    const places = await fetchKakaoPlaces([
      '반려견 놀이터',
      '강아지 놀이터',
      '펫파크',
    ]);
    console.log(`✅ 반려견 놀이터 검색: ${places.length}건`);
    return places;
  } catch (e) {
    console.warn('반려견 놀이터 검색 실패:', e);
    return [];
  }
}

// ③ 애견동반 일반 카페 — 반려견 입장 허용 카페 (애견카페 제외)
async function fetchPetFriendlyCafes() {
  try {
    const places = await fetchKakaoPlaces([
      '반려견 동반 카페',
      '펫프렌들리 카페',
      '강아지 허용 카페',
    ]);
    console.log(`✅ 애견동반 일반 카페 검색: ${places.length}건`);
    return places;
  } catch (e) {
    console.warn('애견동반 카페 검색 실패:', e);
    return [];
  }
}


// ----------------------------------------------------------------
// 11. 서울시 식품위생업소 현황 API 호출 (기존 유지 — fallback용)
//     응답 포맷: X=경도(lng), Y=위도(lat) ← 순서 주의!
// ----------------------------------------------------------------

async function fetchRestaurants() {
  try {
    const response = await fetch(API_RESTAURANTS);
    if (!response.ok) throw new Error(`HTTP 상태 ${response.status}`);

    const data = await response.json();
    const rows = data?.LOCALDATA_072404?.row;

    if (!rows || rows.length === 0) throw new Error('음식점 데이터가 비어 있음');

    // 영업 중인 업소만 필터링 (DTLSTATEGBN: '01' = 영업 중)
    const restaurants = rows
      .filter(r => r.DTLSTATEGBN === '01' && r.X && r.Y)
      .map(r => ({
        name:    r.BPLCNM,
        lat:     parseFloat(r.Y), // Y가 위도 (latitude)
        lng:     parseFloat(r.X), // X가 경도 (longitude)
        address: r.RDNWHLADDR || r.SITEWHLADDR || '',
      }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lng));

    console.log(`✅ 음식점 데이터 로드: ${restaurants.length}개`);
    return restaurants;

  } catch (err) {
    console.warn('⚠️ 음식점 API 실패, 더미 데이터 사용:', err.message);
    return DUMMY_RESTAURANTS; // fallback
  }
}


// ----------------------------------------------------------------
// 11. 커스텀 마커 HTML 생성
//     카카오맵 CustomOverlay의 content 문자열로 사용됨
//     인라인 onclick으로 클릭 이벤트 처리 (index = allMarkers 배열 인덱스)
// ----------------------------------------------------------------

function buildMarkerHTML(category, index) {
  const color = getCategoryColor(category);

  return `
    <div
      class="custom-marker ${category}"
      style="background:${color};"
      onclick="onMarkerClick(${index})"
      title="${getCategoryLabel(category)} 마커"
    >
      <img src="icons/location-pin.svg" alt="" class="marker-icon">
    </div>
  `;
}


// ----------------------------------------------------------------
// 12. 인포 팝업 HTML 생성
//     마커 클릭 시 마커 위에 뜨는 말풍선
// ----------------------------------------------------------------

// 구별 주요 도로 (교통 혼잡도 표시용)
const GU_MAJOR_ROADS = {
  '강남구':  ['강남대로', '테헤란로'],   '강동구':  ['천호대로', '올림픽로'],
  '강북구':  ['도봉로', '미아로'],       '강서구':  ['공항대로', '강서로'],
  '관악구':  ['남부순환로', '관악로'],   '광진구':  ['천호대로', '능동로'],
  '구로구':  ['경인로', '구로디지털로'], '금천구':  ['시흥대로', '독산로'],
  '노원구':  ['동일로', '노원로'],       '도봉구':  ['도봉로', '방학로'],
  '동대문구':['천호대로', '답십리로'],   '동작구':  ['동작대로', '노들로'],
  '마포구':  ['마포대로', '서강대로'],   '서대문구':['통일로', '연세로'],
  '서초구':  ['강남대로', '반포대로'],   '성동구':  ['왕십리로', '성수일로'],
  '성북구':  ['동소문로', '정릉로'],     '송파구':  ['올림픽로', '위례성대로'],
  '양천구':  ['목동로', '신월로'],       '영등포구':['여의대로', '영등포로'],
  '용산구':  ['이태원로', '원효로'],     '은평구':  ['통일로', '연서로'],
  '종로구':  ['종로', '율곡로'],         '중구':    ['퇴계로', '을지로'],
  '중랑구':  ['망우로', '중랑천로'],
};

function getTrafficInfo(address) {
  const h = new Date().getHours();
  let label, color;
  if ((h >= 7 && h < 9) || (h >= 18 && h < 20)) { label = '혼잡'; color = '#FF3B30'; }
  else if ((h >= 9 && h < 11) || (h >= 16 && h < 18)) { label = '서행'; color = '#FF9500'; }
  else { label = '원활'; color = '#34C759'; }
  const roads = GU_MAJOR_ROADS[extractGu(address)] || [];
  return { label, color, roads };
}

function buildPopupHTML(place, category, index) {
  const label = getCategoryLabel(category);

  // 정보보기: Kakao 상세 페이지 (place_url 우선, 없으면 검색)
  const infoUrl      = place.url || `https://map.kakao.com/?q=${encodeURIComponent(place.name)}`;
  const kakaoNaviUrl = `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;

  // 북마크 상태
  const bmed    = (typeof currentUser !== 'undefined' && currentUser && typeof isBookmarked === 'function')
                  ? isBookmarked(place.name) : false;
  const escaped = place.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

  // 카테고리별 추가 HTML
  let extraHTML = '';

  // 공원: 전체 공원 면적 표시
  if (category === 'park') {
    const gu = extractGu(place.address);
    const ds = window.DISTRICT_DATA ? window.DISTRICT_DATA.find(d => d.gu === gu) : null;
    if (ds) {
      const totalArea  = ds.parkArea;
      const pyeong     = Math.round(totalArea / 3.30579);
      const areaText   = totalArea >= 10000
        ? `${(totalArea / 10000).toFixed(1)}만㎡` : `${totalArea.toLocaleString()}㎡`;
      const pyeongText = pyeong  >= 10000
        ? `${Math.round(pyeong / 10000)}만평` : `${pyeong.toLocaleString()}평`;
      extraHTML += `
        <div class="info-park-stat">
          <span class="info-park-stat-label">${gu} 전체 공원 면적</span>
          <span class="info-park-stat-val">${areaText} (${pyeongText})</span>
        </div>`;
    }
  }

  // 동물병원: 24시간 배지
  if (category === 'vet') {
    const is24h = /24|야간|응급/.test(place.name);
    extraHTML += `<div class="info-vet-badge">${is24h ? '🚨 24시간 · 응급' : '🏥 동물병원'}</div>`;
  }

  // 반려견 놀이터: 공공예약 링크
  if (category === 'playground') {
    extraHTML += `
      <a class="info-reservation-btn"
         href="https://yeyak.seoul.go.kr/web/reservation/selectReservationList.do"
         target="_blank" rel="noopener">
        📅 공공서비스예약에서 예약 확인
      </a>`;
  }

  // 교통 혼잡도
  const tf = getTrafficInfo(place.address);
  const trafficHTML = `
    <div class="info-traffic">
      <span class="traffic-label">주변 교통</span>
      <span class="traffic-dot" style="color:${tf.color}">●</span>
      <span class="traffic-status" style="color:${tf.color}">${tf.label}</span>
      <span class="traffic-note">· 시간대 예측</span>
      ${tf.roads.length ? `<span class="traffic-roads">${tf.roads.join(' · ')}</span>` : ''}
    </div>`;

  return `
    <div class="info-popup">
      <button class="info-close-btn" onclick="closePopup()"><img src="icons/close.svg" alt="닫기"></button>
      <button class="info-bookmark-btn${bmed ? ' active' : ''}"
              onclick="toggleBookmarkPlace('${escaped}')" title="${bmed ? '북마크 취소' : '북마크 저장'}">
        <img src="icons/bookmark.svg" alt="북마크">
      </button>
      <div class="info-tag ${category}">${label}</div>
      <div class="info-name">${place.name}</div>
      <div class="info-addr"><img src="icons/location-pin.svg" alt="">${place.address || '주소 정보 없음'}</div>
      ${extraHTML}
      ${trafficHTML}
      <div class="info-btn-row">
        <a class="info-btn info-btn-map" href="${infoUrl}" target="_blank" rel="noopener">
          <img src="icons/location.svg" alt="">정보 보기
        </a>
        <a class="info-btn info-btn-navi" href="${kakaoNaviUrl}" target="_blank" rel="noopener">
          <img src="icons/location-pin.svg" alt="">길찾기
        </a>
      </div>
    </div>
  `;
}

// 북마크 토글 (팝업 onclick에서 호출)
window.toggleBookmarkPlace = function(placeName) {
  if (typeof currentUser === 'undefined' || !currentUser) {
    if (typeof showLoginRequired === 'function') showLoginRequired();
    return;
  }
  if (typeof toggleBookmark !== 'function') return;
  const added = toggleBookmark(placeName);
  // 현재 팝업 내 북마크 버튼 즉시 업데이트
  const popup = document.querySelector('.info-popup');
  if (popup) {
    const btn = popup.querySelector('.info-bookmark-btn');
    if (btn) {
      btn.classList.toggle('active', added);
      btn.title = added ? '북마크 취소' : '북마크 저장';
    }
  }
  window.refreshBookmarkChip?.();
};


// ----------------------------------------------------------------
// 13. 마커 클릭 핸들러 (전역 함수 - HTML onclick에서 호출)
//     index: allMarkers 배열에서의 위치
// ----------------------------------------------------------------

function onMarkerClick(index) {
  // 이미 열려 있는 팝업 닫기
  if (activePopup) {
    activePopup.setMap(null);
    activePopup = null;
  }

  // 클릭한 마커의 팝업 꺼내기
  const { popup } = allMarkers[index];

  // 팝업을 지도에 표시
  popup.setMap(map);
  activePopup = popup;
}


// ----------------------------------------------------------------
// 14. 팝업 닫기 (전역 함수 - 팝업 내부 ✕ 버튼의 onclick에서 호출)
// ----------------------------------------------------------------

function closePopup() {
  if (activePopup) {
    activePopup.setMap(null);
    activePopup = null;
  }
}


// ----------------------------------------------------------------
// 15. 장소 배열 → 마커 + 팝업 생성 후 지도에 추가
// ----------------------------------------------------------------

function addMarkers(places, category) {
  places.forEach(place => {
    // 마커가 놓일 좌표
    const position = new kakao.maps.LatLng(place.lat, place.lng);

    // allMarkers에서 이 마커의 인덱스 (클릭 이벤트에 사용)
    const index = allMarkers.length;

    // ① 마커 CustomOverlay
    const marker = new kakao.maps.CustomOverlay({
      position,
      content:  buildMarkerHTML(category, index),
      yAnchor:  1.1, // y=1.0이 정확히 좌표 위치 → 1.1로 살짝 올림
      zIndex:   3,
    });

    marker.setMap(map); // 지도에 바로 표시

    // ② 팝업 CustomOverlay (처음에는 지도에 표시하지 않음)
    const popup = new kakao.maps.CustomOverlay({
      position,
      content:  buildPopupHTML(place, category, index),
      yAnchor:  1.45, // 마커에서 10px 위에 팝업이 뜨도록
      zIndex:   5,
    });
    // popup.setMap(map) 을 하지 않으면 숨겨진 상태

    // 전역 배열에 저장 (필터링 및 클릭 이벤트에 사용)
    allMarkers.push({ marker, popup, category, place });

    // 사이드바 리스트에도 저장
    sidebarPlaces.push({ ...place, category, markerIndex: allMarkers.length - 1 });
  });
}


// ----------------------------------------------------------------
// 16-0. 주소에서 구(區) 이름 추출
// ----------------------------------------------------------------

function extractGu(address) {
  const match = (address || '').match(/([가-힣]+구)/);
  return match ? match[1] : null;
}


// ----------------------------------------------------------------
// Haversine 거리 계산 (단위: km)
// ----------------------------------------------------------------

function calcDistance(lat1, lng1, lat2, lng2) {
  const R     = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 현재 sort 기준으로 장소 배열 정렬
function sortPlaces(places) {
  if (currentSort === 'dist' && userLocation) {
    return [...places].sort((a, b) => {
      const da = calcDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const db = calcDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return da - db;
    });
  }
  // 가나다순 (위치 없을 때도 fallback)
  return [...places].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}


// ----------------------------------------------------------------
// 사용자 위치 요청 — 지도 포커스 + 리스트 재정렬
// ----------------------------------------------------------------

function getUserLocation() {
  if (!navigator.geolocation) {
    console.warn('이 브라우저는 Geolocation을 지원하지 않습니다.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      console.log('✅ 위치 정보 획득:', userLocation);

      // 지도를 현재 위치로 이동 (구 레벨)
      if (map) {
        map.panTo(new kakao.maps.LatLng(userLocation.lat, userLocation.lng));
        map.setLevel(5);
      }

      // 사이드바 가까운순으로 재정렬
      if (applyFiltersRef) applyFiltersRef();
    },
    err => {
      console.warn('⚠️ 위치 정보 없음:', err.message);
      // 드롭다운은 가까운순 유지 — sortPlaces()가 위치 없을 때 자동으로 가나다순 적용
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
}


// 로드된 장소 데이터에서 구 목록 추출 → 드롭다운 옵션 생성
function populateGuDropdown() {
  const gus = [...new Set(
    sidebarPlaces.map(p => extractGu(p.address)).filter(Boolean)
  )].sort();

  const select = document.getElementById('gu-select');
  gus.forEach(gu => {
    const opt = document.createElement('option');
    opt.value = gu;
    opt.textContent = gu;
    select.appendChild(opt);
  });
}


// ----------------------------------------------------------------
// 16. 사이드바 리스트 렌더링
// ----------------------------------------------------------------

// 카테고리별 아이콘 이미지 경로 반환 (사이드바용)
function getCategoryIconSrc(category) {
  const icons = {
    park:       'icons/location.svg',
    restaurant: 'icons/location-pin.svg',
    cafe:       'icons/location-pin.svg',
    'pf-cafe':  'icons/location-pin.svg',
    vet:        'icons/heart.svg',
    playground: 'icons/location.svg',
  };
  return icons[category] || 'icons/location-pin.svg';
}

// 사이드바 리스트 렌더링
function renderSidebar(places) {
  const list  = document.getElementById('place-list');
  const count = document.getElementById('sidebar-count');

  // 스켈레톤 제거
  list.innerHTML = '';
  count.textContent = places.length;

  if (places.length === 0) {
    list.innerHTML = '<div class="place-empty">검색 결과가 없어요</div>';
    return;
  }

  places.forEach(item => {
    const el = document.createElement('div');
    el.className = 'place-item';
    el.dataset.index = item.markerIndex;

    // 현재 위치로부터 거리 계산
    let distLabel = '';
    if (userLocation) {
      const km = calcDistance(userLocation.lat, userLocation.lng, item.lat, item.lng);
      distLabel = km < 1
        ? `${Math.round(km * 1000)}m`
        : `${km.toFixed(1)}km`;
    }

    el.innerHTML = `
      <div class="place-item-icon ${item.category}">
        <img src="${getCategoryIconSrc(item.category)}" alt="${getCategoryLabel(item.category)}">
      </div>
      <div class="place-item-info">
        <div class="place-item-name">${item.name}</div>
        <div class="place-item-addr">${item.address || '주소 정보 없음'}</div>
      </div>
      ${distLabel ? `<span class="place-item-dist">${distLabel}</span>` : ''}
      <img src="icons/arrow-right.svg" class="place-item-arrow" alt="">
    `;

    // 리스트 클릭 → 지도 이동 + 팝업 표시
    el.addEventListener('click', () => {
      // 이전 선택 아이템 스타일 제거
      if (activeListItem) activeListItem.classList.remove('active');
      el.classList.add('active');
      activeListItem = el;

      // 지도를 해당 위치로 이동
      const pos = new kakao.maps.LatLng(item.lat, item.lng);
      map.panTo(pos);

      // 마커 팝업 열기
      onMarkerClick(item.markerIndex);
    });

    list.appendChild(el);
  });
}

// ----------------------------------------------------------------
// 17. 카운트 + 사이드바 동기화 업데이트
// ----------------------------------------------------------------

function updateCount(category = 'all') {
  const filtered = category === 'all'
    ? sidebarPlaces
    : sidebarPlaces.filter(p => p.category === category);
  renderSidebar(filtered);
}


// ----------------------------------------------------------------
// 18. 필터 & 검색 이벤트 설정
// ----------------------------------------------------------------

function setupFilters() {
  const chips       = document.querySelectorAll('.chip');
  const guSelect    = document.getElementById('gu-select');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const sortSelect  = document.getElementById('sort-select');

  let currentCategory = 'all';
  let currentGu       = 'all';
  let currentQuery    = '';

  // 현재 필터 조건에 맞는 장소 반환
  function getFiltered() {
    return sidebarPlaces.filter(p => {
      const matchCat   = currentCategory === 'all'
        || (currentCategory === 'bookmark' && typeof isBookmarked === 'function' && isBookmarked(p.name))
        || p.category === currentCategory;
      const matchGu    = currentGu === 'all' || extractGu(p.address) === currentGu;
      const matchName  = p.name.toLowerCase().includes(currentQuery);
      return matchCat && matchGu && matchName;
    });
  }

  // 필터 + 정렬 적용: 사이드바 + 지도 마커 동기화
  function applyFilters() {
    closePopup();
    const filtered = getFiltered();
    const sorted   = sortPlaces(filtered); // 현재 sort 기준 적용

    // 마커 표시/숨김
    allMarkers.forEach(({ marker, category, place }) => {
      const matchCat  = currentCategory === 'all'
        || (currentCategory === 'bookmark' && typeof isBookmarked === 'function' && isBookmarked(place.name))
        || category === currentCategory;
      const matchGu   = currentGu === 'all' || extractGu(place.address) === currentGu;
      const matchName = place.name.toLowerCase().includes(currentQuery);
      marker.setMap(matchCat && matchGu && matchName ? map : null);
    });

    renderSidebar(sorted);
  }

  // 카테고리 칩
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      applyFilters();
    });
  });

  // 구 드롭다운
  guSelect.addEventListener('change', () => {
    currentGu = guSelect.value;
    applyFilters();
  });

  // 정렬 드롭다운
  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      applyFilters();
    });
  }

  // 검색
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value.trim().toLowerCase();
    searchClear.classList.toggle('hidden', currentQuery === '');
    applyFilters();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    currentQuery = '';
    searchClear.classList.add('hidden');
    applyFilters();
  });

  // 외부에서 재트리거할 수 있도록 노출
  applyFiltersRef = applyFilters;
  window.applyFiltersGlobal = applyFilters;

  // 북마크 칩 카운트 새로고침
  window.refreshBookmarkChip = function() {
    const count = typeof getBookmarks === 'function' ? getBookmarks().length : 0;
    const badge = document.getElementById('bookmark-count-badge');
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
  };
  window.refreshBookmarkChip(); // 초기 렌더

  // 초기 렌더
  applyFilters();
}


// ----------------------------------------------------------------
// 18. 메인 실행 함수
//     API 3개를 동시에 호출하고 완료 후 마커 표시
// ----------------------------------------------------------------

async function main() {
  console.log('🚀 댕댕서울 88 앱 시작');

  // 로딩 오버레이 표시 (이미 HTML에서 보이지만 명시적으로 확인)
  document.getElementById('loading-overlay').classList.remove('hidden');

  try {
    // ─── API 동시 호출 (7개) ───────────────────────────────────
    const [
      parksResult,
      restaurantsResult,
      petCafesResult,
      pfCafesResult,
      airResult,
      vetsResult,
      playgroundsResult,
      weatherResult,
    ] = await Promise.allSettled([
      fetchParks(),              // ① 공원 (서울 공공데이터)
      fetchPetRestaurants(),     // ② 애견동반 음식점 (카카오 Places)
      fetchPetCafes(),           // ③ 애견카페/운동장 (카카오 Places)
      fetchPetFriendlyCafes(),   // ④ 애견동반 일반 카페 (카카오 Places)
      fetchAirQuality(),         // ⑤ 대기질
      fetchVets(),               // ⑥ 동물병원 (카카오 Places)
      fetchPlaygrounds(),        // ⑦ 반려견 놀이터 (카카오 Places)
      fetchWeather(),            // ⑧ 날씨 (Open-Meteo)
    ]);

    // 공원 마커 추가
    const parks = parksResult.status === 'fulfilled' ? parksResult.value : DUMMY_PARKS;
    addMarkers(parks, 'park');

    // 애견동반 음식점 마커 추가
    const restaurants = restaurantsResult.status === 'fulfilled' ? restaurantsResult.value : DUMMY_RESTAURANTS;
    addMarkers(restaurants, 'restaurant');

    // 애견카페/운동장 마커 추가
    const petCafes = petCafesResult.status === 'fulfilled' ? petCafesResult.value : DUMMY_CAFES;
    addMarkers(petCafes, 'cafe');

    // 애견동반 일반 카페 마커 추가
    const pfCafes = pfCafesResult.status === 'fulfilled' ? pfCafesResult.value : [];
    addMarkers(pfCafes, 'pf-cafe');

    // 동물병원 마커 추가
    const vets = vetsResult.status === 'fulfilled' ? vetsResult.value : [];
    addMarkers(vets, 'vet');

    // 반려견 놀이터 마커 추가
    const playgrounds = playgroundsResult.status === 'fulfilled' ? playgroundsResult.value : [];
    addMarkers(playgrounds, 'playground');

    // 날씨 배너 업데이트
    const weather = weatherResult?.status === 'fulfilled' ? weatherResult.value : null;
    if (weather) updateWeatherLine(weather);

    // 필터 + 정렬 이벤트 연결 (applyFilters 내부에서 초기 렌더까지 처리)
    setupFilters();

    // 사용자 위치 요청 → 지도 포커스 + 가까운순 정렬
    getUserLocation();

    console.log(`✅ 전체 마커 ${allMarkers.length}개 지도에 추가 완료`);

  } catch (err) {
    // 예상치 못한 에러가 나도 서비스는 멈추지 않게 처리
    console.error('❌ 앱 초기화 중 오류:', err);

  } finally {
    // 성공/실패 관계없이 로딩 오버레이 숨기기
    document.getElementById('loading-overlay').classList.add('hidden');
  }
}


// ----------------------------------------------------------------
// 19. 앱 시작점
//     카카오맵 초기화 → 데이터 로드 순서로 실행
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// 20. 모바일 바텀시트
//     핸들 탭 → 펼치기/접기 / 드래그로 임계값 초과 시 전환
// ----------------------------------------------------------------

function setupBottomSheet() {
  const sidebar = document.getElementById('sidebar');
  const handle  = document.getElementById('sidebar-handle');
  if (!handle || !sidebar) return;

  function isMobile() { return window.innerWidth <= 768; }

  let startY      = 0;
  let startHeight = 0;
  let startExpanded = false;
  let dragging    = false;

  handle.addEventListener('touchstart', (e) => {
    if (!isMobile()) return;
    startY        = e.touches[0].clientY;
    startHeight   = sidebar.offsetHeight;
    startExpanded = sidebar.classList.contains('sheet-expanded');
    dragging      = false;
    // 드래그 중 트랜지션 끔
    sidebar.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!isMobile()) return;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > 5) dragging = true;
    if (dragging) {
      const maxH = window.innerHeight * 0.92;
      const minH = 80;
      const newH = Math.max(minH, Math.min(startHeight - dy, maxH));
      sidebar.style.height = `${newH}px`;
    }
  }, { passive: true });

  handle.addEventListener('touchend', (e) => {
    if (!isMobile()) return;
    // 트랜지션 복원
    sidebar.style.transition = '';
    sidebar.style.height     = '';

    const dy        = e.changedTouches[0].clientY - startY;
    const THRESHOLD = 60;

    if (!dragging) {
      sidebar.classList.toggle('sheet-expanded');
    } else if (dy < -THRESHOLD) {
      sidebar.classList.add('sheet-expanded');
    } else if (dy > THRESHOLD) {
      sidebar.classList.remove('sheet-expanded');
    } else {
      // 임계 미달 → 원래 상태 유지 (이미 height: '' 초기화됨)
    }
  }, { passive: true });
}

// 카카오맵 먼저 초기화
initMap();

// 데이터 로드 및 마커 추가 (비동기)
main();

// 모바일 바텀시트 인터랙션
setupBottomSheet();

