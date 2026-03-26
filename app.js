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

// 공원 더미 데이터 (API 실패 시 사용)
const DUMMY_PARKS = [
  { name: '서울숲 공원',      lat: 37.5443, lng: 127.0374, address: '성동구 뚝섬로 273' },
  { name: '한강공원 (여의도)', lat: 37.5286, lng: 126.9326, address: '영등포구 여의동로 330' },
  { name: '북서울꿈의숲',     lat: 37.6178, lng: 127.0473, address: '강북구 월계로 173' },
  { name: '올림픽공원',       lat: 37.5215, lng: 127.1219, address: '송파구 올림픽로 424' },
  { name: '월드컵공원',       lat: 37.5713, lng: 126.8886, address: '마포구 하늘공원로 95' },
  { name: '보라매공원',       lat: 37.4947, lng: 126.9188, address: '동작구 보라매로5길 15' },
  { name: '남산공원',         lat: 37.5512, lng: 126.9882, address: '중구 삼일대로 231' },
];

// 음식점 더미 데이터 (API 실패 시 사용)
const DUMMY_RESTAURANTS = [
  { name: '멍멍 레스토랑 (홍대)',    lat: 37.5517, lng: 126.9215, address: '마포구 홍익로 10' },
  { name: '펫 키친 한남',            lat: 37.5348, lng: 126.9991, address: '용산구 이태원로 245' },
  { name: '강아지야 밥먹자 (성수)',  lat: 37.5441, lng: 127.0568, address: '성동구 성수이로 78' },
  { name: '바크버거 (연남)',          lat: 37.5617, lng: 126.9249, address: '마포구 연남로 25' },
  { name: '포우 레스토랑 (반포)',     lat: 37.5063, lng: 126.9967, address: '서초구 반포대로 55' },
];

// 카페는 별도 공공 API가 없어 항상 더미 데이터 사용
const DUMMY_CAFES = [
  { name: '어글리베이커리 (서울숲)', lat: 37.5462, lng: 127.0413, address: '성동구 서울숲2길 44' },
  { name: '멍하니커피 (합정)',        lat: 37.5490, lng: 126.9056, address: '마포구 토정로 35' },
  { name: '폴스커피 (이태원)',        lat: 37.5344, lng: 126.9949, address: '용산구 이태원로 200' },
  { name: '도그트리 카페 (망원)',     lat: 37.5557, lng: 126.9030, address: '마포구 망원동 415' },
  { name: '바우와우 카페 (강남)',     lat: 37.5012, lng: 127.0244, address: '강남구 논현로 502' },
  { name: '꼬리별 카페 (북촌)',       lat: 37.5814, lng: 126.9833, address: '종로구 북촌로 45' },
];

// 대기질 더미 데이터 (API 실패 시 사용)
const DUMMY_AIR_PM10 = 45; // 단위: ㎍/m³


// ----------------------------------------------------------------
// 4. 전역 상태 변수
// ----------------------------------------------------------------

let map;            // 카카오맵 객체 (initMap에서 생성)
let allMarkers = []; // 전체 마커 목록 { marker, popup, category }
let activePopup = null; // 현재 열려 있는 팝업 오버레이 (하나만 유지)


// ----------------------------------------------------------------
// 5. 카테고리별 색상/아이콘 반환 헬퍼 함수
// ----------------------------------------------------------------

// 카테고리 → 마커 배경색
function getCategoryColor(category) {
  const colors = {
    park:       '#43A047', // 초록
    restaurant: '#EF5350', // 빨강
    cafe:       '#8D6E63', // 브라운
  };
  return colors[category] || '#888';
}

// 카테고리 → 마커 이모지
function getCategoryIcon(category) {
  const icons = {
    park:       '🌳',
    restaurant: '🍽️',
    cafe:       '☕',
  };
  return icons[category] || '📍';
}

// 카테고리 → 한글 라벨
function getCategoryLabel(category) {
  const labels = {
    park:       '공원',
    restaurant: '음식점',
    cafe:       '카페',
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
  if (pm10 <= 30)  return { cls: 'good',     icon: '😊', msg: `산책하기 완벽해요! 🐾` };
  if (pm10 <= 80)  return { cls: 'normal',   icon: '🙂', msg: `산책하기 좋아요` };
  if (pm10 <= 150) return { cls: 'bad',      icon: '😷', msg: `짧게만 산책해요` };
  return               { cls: 'very-bad', icon: '😰', msg: `오늘은 집에서 쉬어요` };
}

// 배너 DOM 업데이트
function updateAirBanner(pm10) {
  const banner = document.getElementById('air-banner');
  const icon   = document.getElementById('air-icon');
  const text   = document.getElementById('air-text');

  const info = getAirGrade(pm10);

  // 이전 클래스 제거 후 새 등급 클래스 적용
  banner.className = `air-banner ${info.cls}`;
  icon.textContent = info.icon;
  text.textContent = `미세먼지 ${pm10}㎍ · ${info.msg}`;
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
    const validValues = rows
      .map(r => parseFloat(r.PM10))
      .filter(v => !isNaN(v) && v >= 0);

    const avgPm10 = Math.round(
      validValues.reduce((sum, v) => sum + v, 0) / validValues.length
    );

    updateAirBanner(avgPm10);
    console.log(`✅ 대기질 로드 완료: 서울 평균 PM10 ${avgPm10}㎍`);

  } catch (err) {
    // API 실패 → 더미 값으로 배너 표시
    console.warn('⚠️ 대기질 API 실패, 더미 값 사용:', err.message);
    updateAirBanner(DUMMY_AIR_PM10);
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
// 10. 서울시 식품위생업소 현황 API 호출
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
  const icon  = getCategoryIcon(category);

  return `
    <div
      class="custom-marker ${category}"
      style="background:${color};"
      onclick="onMarkerClick(${index})"
      title="${getCategoryLabel(category)} 마커"
    >
      <span>${icon}</span>
    </div>
  `;
}


// ----------------------------------------------------------------
// 12. 인포 팝업 HTML 생성
//     마커 클릭 시 마커 위에 뜨는 말풍선
// ----------------------------------------------------------------

function buildPopupHTML(place, category, index) {
  const label = getCategoryLabel(category);

  // ⚠️ onclick="closePopup()" → 전역 함수 closePopup() 호출
  return `
    <div class="info-popup">
      <button class="info-close-btn" onclick="closePopup()" title="닫기">✕</button>
      <div class="info-tag ${category}">${label}</div>
      <div class="info-name">${place.name}</div>
      <div class="info-addr">📍 ${place.address || '주소 정보 없음'}</div>
    </div>
  `;
}


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
      yAnchor:  2.6, // 마커 위쪽에 팝업이 뜨도록 높게 설정
      zIndex:   5,
    });
    // popup.setMap(map) 을 하지 않으면 숨겨진 상태

    // 전역 배열에 저장 (필터링 및 클릭 이벤트에 사용)
    allMarkers.push({ marker, popup, category });
  });
}


// ----------------------------------------------------------------
// 16. 카운트 표시 업데이트
//     현재 지도에 보이는 마커 수를 헤더에 표시
// ----------------------------------------------------------------

function updateCount() {
  // setMap(map) 되어 있으면 보이는 마커로 간주
  const visibleCount = allMarkers.filter(m => m.marker.getMap() !== null).length;
  document.getElementById('place-count-num').textContent = visibleCount;
}


// ----------------------------------------------------------------
// 17. 필터 버튼 이벤트 설정
// ----------------------------------------------------------------

function setupFilters() {
  const buttons = document.querySelectorAll('.filter-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // 모든 버튼의 active 클래스 제거
      buttons.forEach(b => b.classList.remove('active'));
      // 클릭한 버튼에만 active 추가
      btn.classList.add('active');

      const selected = btn.dataset.category; // 'all' / 'park' / 'restaurant' / 'cafe'

      // 열려 있는 팝업 먼저 닫기
      closePopup();

      // 마커 표시/숨김 처리
      allMarkers.forEach(({ marker, category }) => {
        if (selected === 'all' || selected === category) {
          marker.setMap(map); // 지도에 표시
        } else {
          marker.setMap(null); // 지도에서 제거
        }
      });

      updateCount();
    });
  });
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
    // ─── API 3개 동시 호출 ─────────────────────────────────────
    // Promise.allSettled: 하나가 실패해도 나머지는 계속 진행
    const [parksResult, restaurantsResult, airResult] = await Promise.allSettled([
      fetchParks(),        // ① 공원 데이터
      fetchRestaurants(),  // ② 음식점 데이터
      fetchAirQuality(),   // ③ 대기질 (배너 업데이트까지 내부에서 처리)
    ]);

    // 공원 마커 추가
    const parks = parksResult.status === 'fulfilled' ? parksResult.value : DUMMY_PARKS;
    addMarkers(parks, 'park');

    // 음식점 마커 추가
    const restaurants = restaurantsResult.status === 'fulfilled' ? restaurantsResult.value : DUMMY_RESTAURANTS;
    addMarkers(restaurants, 'restaurant');

    // 카페 마커 추가 (카페는 항상 더미 데이터)
    addMarkers(DUMMY_CAFES, 'cafe');

    // 필터 버튼 이벤트 연결
    setupFilters();

    // 초기 장소 개수 표시
    updateCount();

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

// 카카오맵 먼저 초기화
initMap();

// 데이터 로드 및 마커 추가 (비동기)
main();
