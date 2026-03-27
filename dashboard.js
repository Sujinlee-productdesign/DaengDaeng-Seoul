// ================================================================
// 댕댕서울 88 - 우리 동네 현황 대시보드
// Chart.js를 이용한 서울시 구별 반려견 통계 시각화
// ================================================================


// ----------------------------------------------------------------
// 1. 서울 25개 구 더미 데이터
//    실제 서울시 반려동물 등록 현황 데이터와 유사한 수치
//    추후 서울 열린데이터광장 API로 교체 가능
// ----------------------------------------------------------------

const DISTRICT_DATA = [
  // { gu: 구 이름, dogs: 등록 반려견 수, parkArea: 공원 면적(㎡) }
  { gu: '강남구',   dogs: 27543, parkArea: 3250000 },
  { gu: '강동구',   dogs: 16234, parkArea: 2180000 },
  { gu: '강북구',   dogs: 11892, parkArea: 4520000 },
  { gu: '강서구',   dogs: 19876, parkArea: 5830000 },
  { gu: '관악구',   dogs: 14523, parkArea: 1920000 },
  { gu: '광진구',   dogs: 13456, parkArea: 2340000 },
  { gu: '구로구',   dogs: 14321, parkArea: 2670000 },
  { gu: '금천구',   dogs:  8976, parkArea: 1430000 },
  { gu: '노원구',   dogs: 21345, parkArea: 6780000 },
  { gu: '도봉구',   dogs: 13678, parkArea: 5230000 },
  { gu: '동대문구', dogs: 12345, parkArea: 1560000 },
  { gu: '동작구',   dogs: 14567, parkArea: 2890000 },
  { gu: '마포구',   dogs: 18234, parkArea: 7340000 }, // 월드컵공원
  { gu: '서대문구', dogs: 13456, parkArea: 3210000 },
  { gu: '서초구',   dogs: 22345, parkArea: 4560000 },
  { gu: '성동구',   dogs: 15678, parkArea: 3890000 }, // 서울숲
  { gu: '성북구',   dogs: 14234, parkArea: 2340000 },
  { gu: '송파구',   dogs: 24567, parkArea: 8920000 }, // 올림픽공원
  { gu: '양천구',   dogs: 16789, parkArea: 2130000 },
  { gu: '영등포구', dogs: 15432, parkArea: 4560000 },
  { gu: '용산구',   dogs: 13456, parkArea: 2670000 },
  { gu: '은평구',   dogs: 17654, parkArea: 3450000 },
  { gu: '종로구',   dogs:  8765, parkArea: 5670000 }, // 남산
  { gu: '중구',     dogs:  6543, parkArea: 2340000 },
  { gu: '중랑구',   dogs: 13234, parkArea: 2890000 },
];


// ----------------------------------------------------------------
// 2. 탭 전환 로직
//    .tab-btn 클릭 → .tab-content 표시/숨김
// ----------------------------------------------------------------

function setupTabs() {
  const tabBtns     = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const sidebar     = document.getElementById('sidebar');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab; // 'map' / 'recommend' / 'dashboard'

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');

      // 사이드바: 지도 탭에서만 표시
      if (sidebar) {
        sidebar.style.display = target === 'map' ? 'flex' : 'none';
      }

      // 대시보드 탭 처음 열 때 차트 초기화
      if (target === 'dashboard' && !dashboardInitialized) {
        initDashboard();
        dashboardInitialized = true;
      }
    });
  });
}

// 차트가 이미 그려졌는지 체크 (중복 생성 방지)
let dashboardInitialized = false;


// ----------------------------------------------------------------
// 3. 통계 카드 업데이트
// ----------------------------------------------------------------

function updateStatCards() {
  // 반려견 최다 등록 구
  const topDogs = [...DISTRICT_DATA].sort((a, b) => b.dogs - a.dogs)[0];
  document.getElementById('stat-top-gu').textContent =
    `${topDogs.gu} (${topDogs.dogs.toLocaleString()}마리)`;

  // 1마리당 공원 면적 최대 구
  const topPark = [...DISTRICT_DATA]
    .map(d => ({ ...d, ratio: Math.round(d.parkArea / d.dogs) }))
    .sort((a, b) => b.ratio - a.ratio)[0];
  document.getElementById('stat-top-park').textContent =
    `${topPark.gu} (${topPark.ratio.toLocaleString()}㎡)`;

  // 서울시 총 반려견 수
  const total = DISTRICT_DATA.reduce((sum, d) => sum + d.dogs, 0);
  document.getElementById('stat-total').textContent =
    `${total.toLocaleString()}마리`;

  // 서울시민 N명 중 1명이 반려견 보호자
  // 서울시 인구 약 9,413,000명 기준 (2023년 주민등록 통계)
  const SEOUL_POP = 9413000;
  const ratio = Math.round(SEOUL_POP / total);
  document.getElementById('stat-ratio').textContent =
    `약 ${ratio.toLocaleString()}명 중 1명`;
}


// ----------------------------------------------------------------
// 4. 차트 공통 색상 팔레트 — 파스텔톤 (빨강/주황/노랑/초록/보라/파랑)
// ----------------------------------------------------------------

function getPalette(count) {
  const pastels = [
    '#FF8A80', // 파스텔 빨강
    '#FFAB76', // 파스텔 주황
    '#FFE082', // 파스텔 노랑
    '#A5D6A7', // 파스텔 초록
    '#CE93D8', // 파스텔 보라
    '#90CAF9', // 파스텔 파랑
    '#F48FB1', // 파스텔 핑크
    '#80DEEA', // 파스텔 민트
    '#B0BEC5', // 파스텔 블루그레이
    '#BCAAA4', // 파스텔 브라운
  ];
  return pastels.slice(0, count);
}


// ----------------------------------------------------------------
// 5. 차트 1: 구별 반려견 등록 수 (Top 10 가로 막대)
// ----------------------------------------------------------------

function drawDogChart() {
  // 등록 수 내림차순 Top 10
  const top10 = [...DISTRICT_DATA]
    .sort((a, b) => b.dogs - a.dogs)
    .slice(0, 10);

  const labels = top10.map(d => d.gu);
  const values = top10.map(d => d.dogs);

  const ctx = document.getElementById('chart-dogs').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '반려견 등록 수 (마리)',
        data: values,
        backgroundColor: getPalette(10),
        borderRadius: 6,     // 막대 모서리 둥글게
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y', // 가로 막대 그래프
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // 툴팁에 단위 추가
            label: ctx => ` ${ctx.raw.toLocaleString()}마리`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: v => v.toLocaleString(), // 숫자 천단위 콤마
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'Nanum Gothic', weight: '700' } },
        },
      },
    },
  });
}


// ----------------------------------------------------------------
// 6. 차트 2: 강아지 1마리당 공원 면적 (Top 10 가로 막대)
// ----------------------------------------------------------------

function drawParkChart() {
  // 1마리당 공원 면적 = 공원 면적(㎡) / 등록 반려견 수
  const top10 = [...DISTRICT_DATA]
    .map(d => ({ gu: d.gu, ratio: Math.round(d.parkArea / d.dogs) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);

  const labels = top10.map(d => d.gu);
  const values = top10.map(d => d.ratio);

  const ctx = document.getElementById('chart-park').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '1마리당 공원 면적 (㎡)',
        data: values,
        backgroundColor: getPalette(10).reverse(), // 색상 순서 반전
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw.toLocaleString()}㎡`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: v => `${v.toLocaleString()}㎡`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'Nanum Gothic', weight: '700' } },
        },
      },
    },
  });
}


// ----------------------------------------------------------------
// 7. 코로플레스 지도: 서울 구별 반려견 수 시각화
//    - 카카오 지도 + GeoJSON 폴리곤
//    - 반려견 수 비례 오렌지 색상 강도
//    - 구 클릭 → 말풍선 툴팁 표시
// ----------------------------------------------------------------

let choroplethMap  = null;  // 대시보드 전용 카카오맵 인스턴스
let activeDistrictTooltip = null; // 현재 보이는 툴팁 CustomOverlay

// 반려견 수 → 오렌지 계열 색상 (연한 = 적음, 진한 = 많음)
function getDogColor(dogs) {
  const min   = Math.min(...DISTRICT_DATA.map(d => d.dogs));
  const max   = Math.max(...DISTRICT_DATA.map(d => d.dogs));
  const ratio = (dogs - min) / (max - min); // 0 ~ 1

  // #FFF3E0 (연한) → #E65100 (진한)  오렌지 그라디언트
  const r = 255;
  const g = Math.round(243 - ratio * 180); // 243 → 63
  const b = Math.round(224 - ratio * 224); // 224 → 0
  return `rgb(${r},${g},${b})`;
}

// GeoJSON 폴리곤의 시각적 중심점(무게중심) 계산
function getCentroid(coords) {
  const lats = coords.map(c => c[1]);
  const lngs = coords.map(c => c[0]);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
}

// 구 클릭 시 말풍선 툴팁 생성
function showDistrictTooltip(guName, dogs, center) {
  if (activeDistrictTooltip) activeDistrictTooltip.setMap(null);

  const content = `
    <div class="district-tooltip">
      <div class="dt-gu">${guName}</div>
      <div class="dt-count">${dogs.toLocaleString()}마리</div>
      <div class="dt-arrow"></div>
    </div>`;

  activeDistrictTooltip = new kakao.maps.CustomOverlay({
    position : new kakao.maps.LatLng(center.lat, center.lng),
    content,
    yAnchor  : 1.25,
    zIndex   : 10,
  });
  activeDistrictTooltip.setMap(choroplethMap);
}

// 메인 코로플레스 지도 그리기
async function drawChoroplethMap() {
  const container = document.getElementById('district-map');
  if (!container || !window.kakao) return;

  // 카카오 지도 초기화 (서울 중심, 레벨 9 = 시 전체)
  choroplethMap = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(37.5590, 126.9910),
    level : 9,
  });

  // 지도 클릭 시 툴팁 닫기
  kakao.maps.event.addListener(choroplethMap, 'click', () => {
    if (activeDistrictTooltip) activeDistrictTooltip.setMap(null);
  });

  // 서울시 구 경계 GeoJSON (공개 데이터 – southkorea/seoul-maps)
  const GEO_URL = 'https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json';
  let geoData;
  try {
    const res = await fetch(GEO_URL);
    geoData = await res.json();
  } catch (e) {
    console.warn('⚠️ 서울 GeoJSON 로드 실패:', e);
    return;
  }

  // 구 이름 → 반려견 수 빠른 조회 맵
  const dogMap = {};
  DISTRICT_DATA.forEach(d => { dogMap[d.gu] = d.dogs; });

  // GeoJSON feature → Kakao Polygon
  geoData.features.forEach(feature => {
    const guName = feature.properties.name; // '강남구'
    const dogs   = dogMap[guName] || 0;
    const color  = getDogColor(dogs);

    // Polygon / MultiPolygon 모두 처리
    const geom   = feature.geometry;
    const rings  = geom.type === 'MultiPolygon'
      ? geom.coordinates.map(p => p[0])   // 각 폴리곤의 외곽선
      : [geom.coordinates[0]];            // 단일 폴리곤 외곽선

    rings.forEach(ring => {
      const path = ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));

      const polygon = new kakao.maps.Polygon({
        map         : choroplethMap,
        path,
        strokeWeight: 1.5,
        strokeColor : '#ffffff',
        strokeOpacity: 0.9,
        fillColor   : color,
        fillOpacity : 0.72,
      });

      const centroid = getCentroid(ring);

      // 호버 → 말풍선 표시 + 밝기 강조
      kakao.maps.event.addListener(polygon, 'mouseover', () => {
        polygon.setOptions({ fillOpacity: 0.95 });
        showDistrictTooltip(guName, dogs, centroid);
      });

      // 호버 아웃 → 말풍선 닫기 + 원래 투명도
      kakao.maps.event.addListener(polygon, 'mouseout', () => {
        polygon.setOptions({ fillOpacity: 0.72 });
        if (activeDistrictTooltip) activeDistrictTooltip.setMap(null);
      });
    });
  });

  console.log('✅ 코로플레스 지도 초기화 완료');
}


// ----------------------------------------------------------------
// 8. 서울 공공데이터 API — 반려동물 등록 현황
//    엔드포인트: 서울 열린데이터광장 동물등록현황
//    성공 시 DISTRICT_DATA를 실데이터로 교체, 실패 시 더미 유지
// ----------------------------------------------------------------

async function fetchDogRegistrationData() {
  // SEOUL_API_KEY, SEOUL_API_BASE 는 app.js에서 전역 선언됨
  const url = `${SEOUL_API_BASE}/${SEOUL_API_KEY}/json/SDOGANIMALREG/1/100/`;

  try {
    const res  = await fetch(url);
    const json = await res.json();

    // 응답 키는 API에 따라 다를 수 있음 — 실제 응답을 보고 조정
    const rows = json?.SDOGANIMALREG?.row
               ?? json?.AnimalRegStat?.row
               ?? json?.row
               ?? null;

    if (!rows || rows.length === 0) throw new Error('반려견 등록 데이터 없음');

    // 구 이름과 등록 수를 DISTRICT_DATA 형식으로 변환
    rows.forEach(r => {
      // 필드명은 실제 API 응답에 맞게 조정 (일반적 필드명 후보 목록)
      const guName = r.SIGUN_NM ?? r.GU_NM ?? r.CTPV_NM ?? r.LEGALDONG_NM ?? null;
      const count  = parseInt(r.ANIMAL_CNT ?? r.REG_CNT ?? r.TOT_CNT ?? 0, 10);

      if (!guName || isNaN(count)) return;

      const target = DISTRICT_DATA.find(d => d.gu === guName || guName.includes(d.gu));
      if (target) target.dogs = count;
    });

    // 차트 설명 & 하단 노트 업데이트
    const descEl = document.getElementById('chart-dogs-desc');
    const noteEl = document.getElementById('dashboard-note');
    if (descEl) descEl.textContent = '서울시 반려동물 등록 현황 (공공데이터 실시간)';
    if (noteEl) noteEl.textContent = '서울시 공공데이터 API 기반 실시간 데이터입니다.';

    console.log('✅ 반려견 등록 실데이터 로드 완료');

  } catch (err) {
    console.warn('⚠️ 반려견 등록 API 실패, 더미 데이터 사용:', err.message);
    const noteEl = document.getElementById('dashboard-note');
    if (noteEl) noteEl.textContent = '현재 더미 데이터 기반입니다. 서울시 공공데이터 API 연결 후 실제 수치로 교체됩니다.';
  }
}


// ----------------------------------------------------------------
// 9. 대시보드 초기화 (탭 전환 시 최초 1회 실행)
// ----------------------------------------------------------------

async function initDashboard() {
  // 실데이터 시도 → DISTRICT_DATA 갱신 → 차트 렌더
  await fetchDogRegistrationData();

  updateStatCards();
  drawDogChart();
  drawParkChart();
  drawChoroplethMap();
  console.log('✅ 대시보드 초기화 완료');
}


// ----------------------------------------------------------------
// 10. 탭 설정은 DOM 로드 후 바로 실행
// ----------------------------------------------------------------

setupTabs();
