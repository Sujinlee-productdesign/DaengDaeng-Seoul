// ================================================================
// 댕댕서울 — 우리 동네 현황 대시보드
// Chart.js를 이용한 서울시 구별 반려견 통계 시각화
// 코로플레스 지도: 순수 SVG (카카오맵 의존 없음, 줌/팬 없음)
// ================================================================


// ----------------------------------------------------------------
// 1. 서울 25개 구 더미 데이터
// ----------------------------------------------------------------

const DISTRICT_DATA = [
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
  { gu: '마포구',   dogs: 18234, parkArea: 7340000 },
  { gu: '서대문구', dogs: 13456, parkArea: 3210000 },
  { gu: '서초구',   dogs: 22345, parkArea: 4560000 },
  { gu: '성동구',   dogs: 15678, parkArea: 3890000 },
  { gu: '성북구',   dogs: 14234, parkArea: 2340000 },
  { gu: '송파구',   dogs: 24567, parkArea: 8920000 },
  { gu: '양천구',   dogs: 16789, parkArea: 2130000 },
  { gu: '영등포구', dogs: 15432, parkArea: 4560000 },
  { gu: '용산구',   dogs: 13456, parkArea: 2670000 },
  { gu: '은평구',   dogs: 17654, parkArea: 3450000 },
  { gu: '종로구',   dogs:  8765, parkArea: 5670000 },
  { gu: '중구',     dogs:  6543, parkArea: 2340000 },
  { gu: '중랑구',   dogs: 13234, parkArea: 2890000 },
];


// ----------------------------------------------------------------
// 2. 탭 전환 로직
// ----------------------------------------------------------------

function setupTabs() {
  const tabBtns     = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const sidebar     = document.getElementById('sidebar');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');

      if (sidebar) {
        sidebar.style.display = target === 'map' ? 'flex' : 'none';
      }

      if (target === 'dashboard' && !dashboardInitialized) {
        initDashboard();
        dashboardInitialized = true;
      }
    });
  });
}

let dashboardInitialized = false;


// ----------------------------------------------------------------
// 3. 통계 카드 업데이트
// ----------------------------------------------------------------

function updateStatCards() {
  const topDogs = [...DISTRICT_DATA].sort((a, b) => b.dogs - a.dogs)[0];
  document.getElementById('stat-top-gu').textContent =
    `${topDogs.gu} (${topDogs.dogs.toLocaleString()}마리)`;

  const topPark = [...DISTRICT_DATA]
    .map(d => ({ ...d, ratio: Math.round(d.parkArea / d.dogs) }))
    .sort((a, b) => b.ratio - a.ratio)[0];
  document.getElementById('stat-top-park').textContent =
    `${topPark.gu} (${topPark.ratio.toLocaleString()}㎡)`;

  const total = DISTRICT_DATA.reduce((sum, d) => sum + d.dogs, 0);
  document.getElementById('stat-total').textContent =
    `${total.toLocaleString()}마리`;

  const SEOUL_POP = 9413000;
  const ratio = Math.round(SEOUL_POP / total);
  document.getElementById('stat-ratio').textContent =
    `약 ${ratio.toLocaleString()}명 중 1명`;
}


// ----------------------------------------------------------------
// 4. 차트 팔레트 — 파스텔톤
// ----------------------------------------------------------------

function getPalette(count) {
  const pastels = [
    '#FF8A80', '#FFAB76', '#FFE082', '#A5D6A7',
    '#CE93D8', '#90CAF9', '#F48FB1', '#80DEEA',
    '#B0BEC5', '#BCAAA4',
  ];
  return pastels.slice(0, count);
}


// ----------------------------------------------------------------
// 5. 차트 인스턴스 (강조 기능 위해 모듈 수준에서 보관)
// ----------------------------------------------------------------

let chartDogs = null;
let chartPark = null;

// chartjs-plugin-datalabels 전역 등록 (CDN 로드 시 ChartDataLabels 전역 노출)
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}


// Chart.js 플러그인: 선택된 막대에 그림자 + 확대 효과
const barHighlightPlugin = {
  id: 'barHighlight',
  beforeDatasetsDraw(chart) {
    const idx = chart._highlightIndex;
    if (idx == null || idx < 0) return;
    const ctx  = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    const bar  = meta.data[idx];
    if (!bar) return;

    const props = bar.getProps(['x', 'y', 'base', 'height'], true);
    const left  = Math.min(props.base, props.x);
    const right = Math.max(props.base, props.x);
    const top   = props.y - props.height / 2;

    ctx.save();
    ctx.shadowColor   = 'rgba(255,140,66,0.50)';
    ctx.shadowBlur    = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle     = '#FF8C42';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(left - 5, top - 4, (right - left) + 10, props.height + 8, 8);
    } else {
      ctx.rect(left - 5, top - 4, (right - left) + 10, props.height + 8);
    }
    ctx.fill();
    ctx.restore();
  },
};


// 공통 datalabels 옵션 생성 (차트별 suffix 설정)
function makeDatalabelsOptions(suffix) {
  return {
    anchor: 'end',
    align: 'end',
    clamp: true,
    formatter: (value, ctx) => {
      const idx = ctx.chart._highlightIndex;
      return value.toLocaleString() + suffix;
    },
    font: (ctx) => {
      const idx = ctx.chart._highlightIndex;
      const isSelected = idx != null && ctx.dataIndex === idx;
      return {
        family: 'Pretendard, -apple-system, sans-serif',
        weight: isSelected ? '900' : '500',
        size:   isSelected ? 12 : 10,
      };
    },
    color: (ctx) => {
      const idx = ctx.chart._highlightIndex;
      if (idx == null) return '#8E8E93';
      return ctx.dataIndex === idx ? '#FF8C42' : '#AEAEB2';
    },
    padding: { left: 4 },
  };
}


// ----------------------------------------------------------------
// 6. 차트 1: 구별 반려견 등록 수 Top 10
// ----------------------------------------------------------------

function drawDogChart() {
  const top10 = [...DISTRICT_DATA]
    .sort((a, b) => b.dogs - a.dogs)
    .slice(0, 10);

  const labels = top10.map(d => d.gu);
  const values = top10.map(d => d.dogs);

  const ctx = document.getElementById('chart-dogs').getContext('2d');
  chartDogs = new Chart(ctx, {
    type: 'bar',
    plugins: [barHighlightPlugin],
    data: {
      labels,
      datasets: [{
        label: '반려견 등록 수 (마리)',
        data: values,
        backgroundColor: getPalette(10),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 72 } }, // datalabels 공간 확보
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.raw.toLocaleString()}마리` },
        },
        datalabels: makeDatalabelsOptions('마리'),
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => v.toLocaleString() },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: (ctx) => {
              const chart = ctx.chart;
              const idx   = chart._highlightIndex;
              const isSel = idx != null && ctx.index === idx;
              return {
                family: 'Pretendard, -apple-system, sans-serif',
                weight: isSel ? '900' : '600',
                size:   isSel ? 13 : 12,
              };
            },
            color: (ctx) => {
              const chart = ctx.chart;
              const idx   = chart._highlightIndex;
              if (idx == null) return '#48484A';
              return ctx.index === idx ? '#FF8C42' : '#AEAEB2';
            },
          },
        },
      },
    },
  });
}


// ----------------------------------------------------------------
// 7. 차트 2: 강아지 1마리당 공원 면적 Top 10
// ----------------------------------------------------------------

function drawParkChart() {
  const top10 = [...DISTRICT_DATA]
    .map(d => ({ gu: d.gu, ratio: Math.round(d.parkArea / d.dogs) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 10);

  const labels = top10.map(d => d.gu);
  const values = top10.map(d => d.ratio);

  const ctx = document.getElementById('chart-park').getContext('2d');
  chartPark = new Chart(ctx, {
    type: 'bar',
    plugins: [barHighlightPlugin],
    data: {
      labels,
      datasets: [{
        label: '1마리당 공원 면적 (㎡)',
        data: values,
        backgroundColor: getPalette(10).reverse(),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 80 } }, // datalabels 공간 확보
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.raw.toLocaleString()}㎡` },
        },
        datalabels: makeDatalabelsOptions('㎡'),
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { callback: v => `${v.toLocaleString()}㎡` },
        },
        y: {
          grid: { display: false },
          ticks: {
            font: (ctx) => {
              const chart = ctx.chart;
              const idx   = chart._highlightIndex;
              const isSel = idx != null && ctx.index === idx;
              return {
                family: 'Pretendard, -apple-system, sans-serif',
                weight: isSel ? '900' : '600',
                size:   isSel ? 13 : 12,
              };
            },
            color: (ctx) => {
              const chart = ctx.chart;
              const idx   = chart._highlightIndex;
              if (idx == null) return '#48484A';
              return ctx.index === idx ? '#FF8C42' : '#AEAEB2';
            },
          },
        },
      },
    },
  });
}


// ----------------------------------------------------------------
// 8. 차트 막대 강조 / 해제
// ----------------------------------------------------------------

function highlightChartBar(guName) {
  [
    { chart: chartDogs, origColors: getPalette(10) },
    { chart: chartPark, origColors: getPalette(10).reverse() },
  ].forEach(({ chart, origColors }) => {
    if (!chart) return;
    const labels = chart.data.labels;
    const idx    = labels.indexOf(guName);

    // 선택 구 → 브랜드색, 나머지 → 회색
    chart.data.datasets[0].backgroundColor =
      labels.map((_, i) => (i === idx ? '#FF8C42' : '#D1D1D6'));
    chart._highlightIndex = idx >= 0 ? idx : null;
    chart.update('none');
  });
}

function clearChartHighlight() {
  if (chartDogs) {
    chartDogs.data.datasets[0].backgroundColor = getPalette(10);
    chartDogs._highlightIndex = null;
    chartDogs.update('none');
  }
  if (chartPark) {
    chartPark.data.datasets[0].backgroundColor = getPalette(10).reverse();
    chartPark._highlightIndex = null;
    chartPark.update('none');
  }
}


// ----------------------------------------------------------------
// 9. 코로플레스 지도 색상 계산
// ----------------------------------------------------------------

function getDogColor(dogs) {
  const min   = Math.min(...DISTRICT_DATA.map(d => d.dogs));
  const max   = Math.max(...DISTRICT_DATA.map(d => d.dogs));
  const ratio = (dogs - min) / (max - min);

  // 연한 살구 → 진한 오렌지
  const r = 255;
  const g = Math.round(243 - ratio * 180);
  const b = Math.round(224 - ratio * 224);
  return `rgb(${r},${g},${b})`;
}


// ----------------------------------------------------------------
// 10. 순수 SVG 코로플레스 지도 (카카오맵 의존 없음, 줌/팬 없음)
// ----------------------------------------------------------------

let selectedGu   = null;
let svgTooltipEl = null;
let svgEl        = null;

async function drawChoroplethMap() {
  const container = document.getElementById('district-map');
  if (!container) return;

  const GEO_URL = 'https://raw.githubusercontent.com/southkorea/seoul-maps/master/kostat/2013/json/seoul_municipalities_geo_simple.json';
  let geoData;
  try {
    const res = await fetch(GEO_URL);
    geoData = await res.json();
  } catch (e) {
    console.warn('⚠️ 서울 GeoJSON 로드 실패:', e);
    container.innerHTML = '<p style="padding:20px;color:#888;font-size:0.85rem;">지도 데이터를 불러올 수 없습니다.</p>';
    return;
  }

  const dogMap = {};
  DISTRICT_DATA.forEach(d => { dogMap[d.gu] = d.dogs; });

  // 모든 좌표 범위 계산
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  geoData.features.forEach(f => {
    const rings = f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates.flatMap(p => p)
      : f.geometry.coordinates;
    rings.forEach(ring => ring.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }));
  });

  const VW = 600, VH = 420, PAD = 20;

  function project(lng, lat) {
    const x = PAD + ((lng - minLng) / (maxLng - minLng)) * (VW - PAD * 2);
    const y = PAD + ((maxLat - lat) / (maxLat - minLat)) * (VH - PAD * 2);
    return [x, y];
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';
  svgEl = svg;

  geoData.features.forEach(feature => {
    const guName = feature.properties.name;
    const dogs   = dogMap[guName] || 0;
    const color  = getDogColor(dogs);

    const geom  = feature.geometry;
    const rings = geom.type === 'MultiPolygon'
      ? geom.coordinates.map(p => p[0])
      : [geom.coordinates[0]];

    // 구 중심점 — 바운딩박스 중심 (정점 평균보다 시각적으로 정확)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rings[0].forEach(([lng, lat]) => {
      const [px, py] = project(lng, lat);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const g = document.createElementNS(NS, 'g');
    g.dataset.gu   = guName;
    g.dataset.dogs = dogs;
    g.dataset.cx   = cx;
    g.dataset.cy   = cy;
    g.style.cursor = 'pointer';

    rings.forEach(ring => {
      const pts  = ring.map(([lng, lat]) => project(lng, lat).join(',')).join(' ');
      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', pts);
      poly.setAttribute('fill', color);
      poly.setAttribute('stroke', '#ffffff');
      poly.setAttribute('stroke-width', '1.5');
      poly.setAttribute('stroke-linejoin', 'round');
      poly.dataset.origColor = color;
      g.appendChild(poly);
    });

    // 구 이름 텍스트 레이블 (white halo + shadow for readability)
    const lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', cx);
    lbl.setAttribute('y', cy + 1);
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('dominant-baseline', 'middle');
    lbl.setAttribute('font-size', '12');
    lbl.setAttribute('font-family', 'Pretendard, -apple-system, sans-serif');
    lbl.setAttribute('font-weight', '700');
    lbl.setAttribute('fill', '#1C1C1E');
    lbl.setAttribute('paint-order', 'stroke');
    lbl.setAttribute('stroke', 'rgba(255,255,255,0.85)');
    lbl.setAttribute('stroke-width', '3.5');
    lbl.setAttribute('stroke-linejoin', 'round');
    lbl.setAttribute('pointer-events', 'none');
    lbl.textContent = guName.replace('구', '');
    g.appendChild(lbl);

    // 호버 효과
    g.addEventListener('mouseenter', () => {
      if (selectedGu === guName) return;
      g.querySelectorAll('polygon').forEach(p => {
        const isGrayed = selectedGu !== null; // 다른 구가 선택된 상태
        p.style.filter = isGrayed ? 'brightness(1.1)' : 'brightness(0.88)';
        p.setAttribute('stroke-width', '2');
      });
    });
    g.addEventListener('mouseleave', () => {
      if (selectedGu === guName) return;
      g.querySelectorAll('polygon').forEach(p => {
        p.style.filter = '';
        p.setAttribute('stroke-width', selectedGu ? '0.8' : '1.5');
      });
    });

    g.addEventListener('click', e => {
      e.stopPropagation();
      onDistrictClick(guName, dogs, g);
    });

    svg.appendChild(g);
  });

  // SVG 배경 클릭 → 선택 해제
  svg.addEventListener('click', () => {
    deselectDistrict();
  });

  // 툴팁 div
  const tooltip = document.createElement('div');
  tooltip.className  = 'district-tooltip';
  tooltip.style.display = 'none';
  svgTooltipEl = tooltip;

  container.innerHTML = '';
  container.style.position = 'relative';
  container.appendChild(svg);
  container.appendChild(tooltip);

  console.log('✅ SVG 코로플레스 지도 초기화 완료');
}


// ----------------------------------------------------------------
// 11. 구 선택 / 해제 상태 관리
// ----------------------------------------------------------------

function onDistrictClick(guName, dogs, clickedG) {
  if (selectedGu === guName) {
    deselectDistrict();
    return;
  }
  selectedGu = guName;

  // 폴리곤 스타일 업데이트
  if (svgEl) {
    svgEl.querySelectorAll('g[data-gu]').forEach(g => {
      const polys = g.querySelectorAll('polygon');
      if (g.dataset.gu === guName) {
        polys.forEach(p => {
          p.setAttribute('fill', p.dataset.origColor);
          p.setAttribute('stroke', '#FF8C42');
          p.setAttribute('stroke-width', '2.5');
          p.setAttribute('filter', 'drop-shadow(0 3px 10px rgba(255,140,66,0.55))');
        });
      } else {
        polys.forEach(p => {
          p.setAttribute('fill', '#D1D1D6');
          p.setAttribute('stroke', '#ffffff');
          p.setAttribute('stroke-width', '0.8');
          p.removeAttribute('filter');
        });
      }
    });
  }

  // 툴팁 위치 — 구 바운딩박스 중심 기준, 좌우 끝 클램핑
  if (svgTooltipEl) {
    const cx = parseFloat(clickedG.dataset.cx);
    const cy = parseFloat(clickedG.dataset.cy);
    svgTooltipEl.innerHTML =
      `<div class="dt-gu">${guName}</div>` +
      `<div class="dt-count">${parseInt(dogs).toLocaleString()}마리</div>`;
    svgTooltipEl.style.display = 'block';

    // 퍼센트 위치 계산
    const leftPct = (cx / 600) * 100;
    const topPct  = (cy / 420) * 100;

    // 툴팁 너비(~130px) 고려해 SVG 영역 밖으로 나가지 않도록 클램핑
    const container    = svgTooltipEl.parentElement;
    const containerW   = container ? container.offsetWidth : 600;
    const tipW         = 130;
    const halfPct      = (tipW / 2 / containerW) * 100;
    const clampedLeft  = Math.min(Math.max(leftPct, halfPct), 100 - halfPct);

    svgTooltipEl.style.left = `${clampedLeft}%`;
    svgTooltipEl.style.top  = `${topPct}%`;
  }

  // 차트 막대 강조
  highlightChartBar(guName);
}

function deselectDistrict() {
  selectedGu = null;

  if (svgEl) {
    svgEl.querySelectorAll('g[data-gu]').forEach(g => {
      g.querySelectorAll('polygon').forEach(p => {
        p.setAttribute('fill', p.dataset.origColor);
        p.setAttribute('stroke', '#ffffff');
        p.setAttribute('stroke-width', '1.5');
        p.removeAttribute('filter');
      });
    });
  }

  if (svgTooltipEl) svgTooltipEl.style.display = 'none';

  clearChartHighlight();
}


// ----------------------------------------------------------------
// 12. 서울 공공데이터 API — 반려동물 등록 현황
// ----------------------------------------------------------------

async function fetchDogRegistrationData() {
  const url = `${SEOUL_API_BASE}/${SEOUL_API_KEY}/json/SDOGANIMALREG/1/100/`;

  try {
    const res  = await fetch(url);
    const json = await res.json();

    const rows = json?.SDOGANIMALREG?.row
               ?? json?.AnimalRegStat?.row
               ?? json?.row
               ?? null;

    if (!rows || rows.length === 0) throw new Error('반려견 등록 데이터 없음');

    rows.forEach(r => {
      const guName = r.SIGUN_NM ?? r.GU_NM ?? r.CTPV_NM ?? r.LEGALDONG_NM ?? null;
      const count  = parseInt(r.ANIMAL_CNT ?? r.REG_CNT ?? r.TOT_CNT ?? 0, 10);
      if (!guName || isNaN(count)) return;
      const target = DISTRICT_DATA.find(d => d.gu === guName || guName.includes(d.gu));
      if (target) target.dogs = count;
    });

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
// 13. 대시보드 초기화
// ----------------------------------------------------------------

async function initDashboard() {
  await fetchDogRegistrationData();
  updateStatCards();
  drawDogChart();
  drawParkChart();
  drawChoroplethMap();
  console.log('✅ 대시보드 초기화 완료');
}


// ----------------------------------------------------------------
// 14. 탭 설정은 DOM 로드 후 바로 실행
// ----------------------------------------------------------------

setupTabs();
