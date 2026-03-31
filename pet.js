// ================================================================
// 댕댕서울 — 펫 상권 분석 + AI 산책 추천
// ================================================================


// ================================================================
//  TAB 3 : 펫 상권 분석
//  동 단위 더미 소비 데이터 → 카카오맵 히트맵 오버레이 + TOP5 랭킹
// ================================================================

// ── 동 단위 더미 데이터 (B079 카드소비 기반, 추후 실데이터 교체) ──
// spending : 펫 관련 월평균 소비 (만원) / index : 상권 지수 0~100
const DONG_PET_DATA = [
  { name: '연남동',    gu: '마포구',   lat: 37.5665, lng: 126.9235, spending: 382, index: 92, types: ['cafe'] },
  { name: '성수동1가', gu: '성동구',   lat: 37.5444, lng: 127.0567, spending: 354, index: 88, types: ['cafe','hospital'] },
  { name: '청담동',    gu: '강남구',   lat: 37.5230, lng: 127.0491, spending: 412, index: 95, types: ['hospital'] },
  { name: '합정동',    gu: '마포구',   lat: 37.5497, lng: 126.9140, spending: 298, index: 80, types: ['cafe'] },
  { name: '한남동',    gu: '용산구',   lat: 37.5344, lng: 127.0006, spending: 336, index: 85, types: ['cafe'] },
  { name: '서교동',    gu: '마포구',   lat: 37.5530, lng: 126.9219, spending: 274, index: 76, types: ['cafe'] },
  { name: '역삼동',    gu: '강남구',   lat: 37.5007, lng: 127.0363, spending: 310, index: 82, types: ['hospital'] },
  { name: '반포동',    gu: '서초구',   lat: 37.5040, lng: 126.9945, spending: 288, index: 78, types: ['hospital','cafe'] },
  { name: '이태원동',  gu: '용산구',   lat: 37.5345, lng: 126.9944, spending: 266, index: 73, types: ['cafe'] },
  { name: '상수동',    gu: '마포구',   lat: 37.5479, lng: 126.9222, spending: 252, index: 70, types: ['cafe'] },
  { name: '망원동',    gu: '마포구',   lat: 37.5561, lng: 126.9036, spending: 241, index: 68, types: ['cafe'] },
  { name: '송파동',    gu: '송파구',   lat: 37.5011, lng: 127.1156, spending: 235, index: 66, types: ['hospital'] },
  { name: '잠실동',    gu: '송파구',   lat: 37.5133, lng: 127.1002, spending: 228, index: 64, types: ['hospital'] },
  { name: '화양동',    gu: '광진구',   lat: 37.5433, lng: 127.0685, spending: 214, index: 60, types: ['cafe'] },
  { name: '대치동',    gu: '강남구',   lat: 37.4940, lng: 127.0612, spending: 296, index: 79, types: ['hospital'] },
  { name: '도화동',    gu: '마포구',   lat: 37.5389, lng: 126.9519, spending: 188, index: 54, types: ['hospital'] },
  { name: '왕십리동',  gu: '성동구',   lat: 37.5613, lng: 127.0372, spending: 175, index: 50, types: ['hospital'] },
  { name: '공덕동',    gu: '마포구',   lat: 37.5440, lng: 126.9518, spending: 193, index: 56, types: ['cafe'] },
  { name: '혜화동',    gu: '종로구',   lat: 37.5830, lng: 127.0017, spending: 164, index: 48, types: ['cafe'] },
  { name: '신촌동',    gu: '서대문구', lat: 37.5597, lng: 126.9370, spending: 202, index: 58, types: ['cafe','hospital'] },
];

// TOP 5 랭킹 (spending 기준 자동 정렬, loadRealCommData 이후 재계산)
let TOP5 = [...DONG_PET_DATA]
  .sort((a, b) => b.spending - a.spending)
  .slice(0, 5);

const TYPE_LABEL = { hospital: '동물병원', cafe: '반려견카페' };

let comm2Map     = null;  // 카카오맵 인스턴스
let comm2Overlays = [];   // 히트맵 원형 오버레이 배열
let comm2PieChart = null; // 업종별 도넛 차트
let comm2Initialized = false;

// ── 탭 진입 시 초기화 ────────────────────────────────────────────
function initCommercial() {
  if (comm2Initialized) return;
  comm2Initialized = true;

  buildComm2Map();
  buildComm2Ranking();
  buildComm2Pie();
  bindComm2Filters();

  // 카카오 Places로 실제 업종 수 로드 후 UI 갱신
  loadRealCommData().then(() => {
    buildComm2Ranking();
    renderComm2Overlays('all');
    if (comm2PieChart) { comm2PieChart.destroy(); comm2PieChart = null; }
    buildComm2Pie();
  }).catch(() => {});
}

// ── 카카오 Places 기반 실 업종 수 로드 ──────────────────────────
async function loadRealCommData() {
  if (!window.kakao?.maps?.services) return;
  const ps = new kakao.maps.services.Places();

  const search = (kw, lat, lng) => new Promise(resolve => {
    ps.keywordSearch(kw, (result, status) => {
      resolve(status === kakao.maps.services.Status.OK ? result.length : 0);
    }, { location: new kakao.maps.LatLng(lat, lng), radius: 1000 });
  });

  for (const dong of DONG_PET_DATA) {
    // 연속 호출 부하 방지
    await new Promise(r => setTimeout(r, 80));

    const [hosp, cafe] = await Promise.all([
      search('동물병원', dong.lat, dong.lng),
      search('애견카페', dong.lat, dong.lng),
    ]);

    const raw = hosp * 10 + cafe * 8;
    if (raw > 0) {
      dong.index = raw;
      dong.types = [];
      if (hosp > 0) dong.types.push('hospital');
      if (cafe > 0) dong.types.push('cafe');
      if (!dong.types.length) dong.types = ['hospital'];
    }
  }

  // index 0~100 정규화 후 spending 재계산
  const maxIdx = Math.max(...DONG_PET_DATA.map(d => d.index), 1);
  DONG_PET_DATA.forEach(d => {
    d.index    = Math.round(d.index / maxIdx * 100);
    d.spending = Math.round(150 + d.index * 2.6); // 150~410만원 범위
  });

  // TOP5 갱신
  DONG_PET_DATA.sort((a, b) => b.spending - a.spending);
  TOP5 = DONG_PET_DATA.slice(0, 5);
  console.log('✅ 펫 상권 실데이터 로드 완료');
}

// ── 카카오맵 + 히트맵 오버레이 ──────────────────────────────────
function buildComm2Map() {
  const container = document.getElementById('comm2-map');
  if (!container || !window.kakao?.maps) return;

  // 서울 중심 좌표
  const options = {
    center: new kakao.maps.LatLng(37.5630, 127.0000),
    level: 8,
  };
  comm2Map = new kakao.maps.Map(container, options);

  renderComm2Overlays('all');
}

// 오버레이 렌더 (필터 적용)
function renderComm2Overlays(filter) {
  // 기존 오버레이 제거
  comm2Overlays.forEach(o => o.setMap(null));
  comm2Overlays = [];

  const filtered = filter === 'all'
    ? DONG_PET_DATA
    : DONG_PET_DATA.filter(d => d.types.includes(filter));

  const maxSpending = Math.max(...filtered.map(d => d.spending));

  filtered.forEach(dong => {
    const ratio   = dong.spending / maxSpending;
    const radius  = Math.round(300 + ratio * 500);   // 300~800m 원
    const opacity = (0.15 + ratio * 0.45).toFixed(2); // 0.15~0.60

    // 색상: 낮음(#FFE082 노랑) → 높음(#FF3B30 빨강)
    const r  = 255;
    const g  = Math.round(225 - ratio * 195);
    const b  = Math.round(130 - ratio * 130);
    const fillColor   = `rgb(${r},${g},${b})`;
    const strokeColor = `rgb(${Math.max(0,r-30)},${Math.max(0,g-40)},${Math.max(0,b-20)})`;

    const circle = new kakao.maps.Circle({
      center:        new kakao.maps.LatLng(dong.lat, dong.lng),
      radius,
      strokeWeight:  1,
      strokeColor,
      strokeOpacity: 0.4,
      fillColor,
      fillOpacity:   parseFloat(opacity),
    });
    circle.setMap(comm2Map);
    comm2Overlays.push(circle);

    // 마커 라벨 (상위 5개만)
    if (TOP5.find(t => t.name === dong.name)) {
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(dong.lat, dong.lng),
        content: `<div class="comm2-map-label">${dong.name}</div>`,
        yAnchor: 1.4,
      });
      overlay.setMap(comm2Map);
      comm2Overlays.push(overlay);
    }
  });
}

// ── TOP5 랭킹 렌더 ───────────────────────────────────────────────
function buildComm2Ranking() {
  const el = document.getElementById('comm2-ranking');
  if (!el) return;

  const medals = ['1', '2', '3', '4', '5'];
  el.innerHTML = TOP5.map((d, i) => {
    const typeLabels = d.types.map(t => TYPE_LABEL[t]).join(' · ');
    return `
      <div class="comm2-rank-item" onclick="comm2FocusDong('${d.name}')">
        <div class="comm2-rank-medal">${medals[i]}</div>
        <div class="comm2-rank-info">
          <div class="comm2-rank-name">${d.gu} ${d.name}</div>
          <div class="comm2-rank-sub">${typeLabels} · 상권지수 ${d.index}</div>
        </div>
        <div class="comm2-rank-score">${d.spending.toLocaleString()}만원</div>
      </div>
    `;
  }).join('');
}

// 랭킹 클릭 시 지도 이동
function comm2FocusDong(dongName) {
  const d = DONG_PET_DATA.find(x => x.name === dongName);
  if (!d || !comm2Map) return;
  comm2Map.setCenter(new kakao.maps.LatLng(d.lat, d.lng));
  comm2Map.setLevel(5);
}

// ── 업종별 도넛 차트 ─────────────────────────────────────────────
function buildComm2Pie() {
  const canvas = document.getElementById('chart-comm2-pie');
  if (!canvas) return;

  // 업종별 소비 합산
  const totals = { hospital: 0, cafe: 0 };
  DONG_PET_DATA.forEach(d => {
    d.types.forEach(t => { if (t in totals) totals[t] += d.spending; });
  });

  comm2PieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['동물병원', '반려견카페'],
      datasets: [{
        data: [totals.hospital, totals.cafe],
        backgroundColor: ['#FF2D55', '#FF8C42'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Pretendard', size: 12 }, padding: 10 } },
        tooltip: { callbacks: { label: c => ` ${c.raw.toLocaleString()}만원` } },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 11 },
          formatter: (val, ctx) => {
            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            return `${Math.round(val / sum * 100)}%`;
          },
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

// ── 필터 버튼 바인딩 ─────────────────────────────────────────────
function bindComm2Filters() {
  document.querySelectorAll('.comm2-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.comm2-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderComm2Overlays(btn.dataset.filter);
    });
  });
}


// ================================================================
//  TAB 4 : AI 산책 추천
//  버튼 선택 → 자동 Claude API 호출 → 결과 카드
// ================================================================

// 선택 상태 관리
const aiwSelections = { size: null, duration: null, place: null };

// ── 버튼 그룹 이벤트 바인딩 ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // 옵션 버튼 클릭
  document.querySelectorAll('.aiw-btn-group').forEach(group => {
    group.querySelectorAll('.aiw-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // 같은 그룹 내 선택 해제 후 현재 선택
        group.querySelectorAll('.aiw-opt-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        aiwSelections[group.dataset.field] = btn.dataset.val;
        checkAiwReady();
      });
    });
  });

  // 위치 드롭다운 변경
  document.getElementById('aiw-location')?.addEventListener('change', checkAiwReady);

  // 추천받기 버튼
  document.getElementById('aiw-submit')?.addEventListener('click', requestAiWalk);

  // 다시 추천받기
  document.getElementById('aiw-retry-btn')?.addEventListener('click', resetAiWalk);

  // 지도에서 보기
  document.getElementById('aiw-map-btn')?.addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="map"]')?.click();
  });
});

// 모든 항목 선택됐는지 체크 → 버튼 활성화
function checkAiwReady() {
  const loc = document.getElementById('aiw-location')?.value;
  const ready = aiwSelections.size && loc && aiwSelections.duration && aiwSelections.place;
  const btn = document.getElementById('aiw-submit');
  if (btn) btn.disabled = !ready;
}

// ── AI 산책 추천 요청 ────────────────────────────────────────────
async function requestAiWalk() {
  const location = document.getElementById('aiw-location')?.value;
  const { size, duration, place } = aiwSelections;
  if (!location || !size || !duration || !place) return;

  // 현재 대기질 정보 (app.js에서 전역 노출된 값 참조)
  const airInfo = window.currentAirInfo || '정보 없음';

  // UI 전환: 폼 숨김 → 로딩
  document.getElementById('aiw-form').classList.add('hidden');
  document.getElementById('aiw-result').classList.add('hidden');
  document.getElementById('aiw-loading').classList.remove('hidden');

  // Claude에 보낼 메시지 구성
  const userMsg = `
강아지 크기: ${size}
현재 위치: 서울 ${location}
산책 시간: ${duration}
선호 장소: ${place}
현재 대기질: ${airInfo}

위 조건에 맞는 서울 산책 코스를 추천해줘.
`.trim();

  try {
    const res = await fetch('/ai-chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemOverride: buildWalkSystemPrompt(airInfo),
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await res.json();
    const text = data.content || '추천 코스를 불러오지 못했어요. 다시 시도해주세요.';

    showAiwResult(text, location, size, duration, place);

  } catch (err) {
    console.error('AI 산책 추천 오류:', err);
    showAiwResult(
      '🙏 AI 서비스에 일시적인 문제가 생겼어요!\n잠시 후 다시 시도해주세요.',
      location, size, duration, place
    );
  }
}

// ── 시스템 프롬프트 (산책 특화) ──────────────────────────────────
function buildWalkSystemPrompt(airInfo) {
  return `너는 서울 반려견 산책 전문가야.
강아지 크기와 산책 시간에 맞는 오늘의 맞춤 코스를 추천해줘.

참고 정보:
- 현재 서울 대기질: ${airInfo}
- 서울 주요 반려견 공원: 월드컵공원(마포), 보라매공원(동작), 서울숲(성동), 올림픽공원(송파), 한강공원 각 지구
- 소형견은 혼잡하거나 언덕이 심한 곳을 피하고, 대형견은 뛸 수 있는 넓은 공간을 선호해

답변 형식 (반드시 아래 형식으로):
1. 🗺️ **오늘의 추천 코스**: 장소명 + 이유 (2~3곳)
2. 💡 **산책 팁**: 한 가지
3. ⚠️ **주의사항**: 한 가지

규칙:
- 항상 한국어로, 친근하고 귀엽게
- 이모지 적극 활용
- 간결하게 (전체 200자 이내)`;
}

// ── 결과 카드 렌더 ───────────────────────────────────────────────
function showAiwResult(text, location, size, duration, place) {
  document.getElementById('aiw-loading').classList.add('hidden');
  document.getElementById('aiw-result').classList.remove('hidden');

  const formatted = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  const tagHtml = [
    `<span class="aiw-tag">${size}</span>`,
    `<span class="aiw-tag">📍 ${location}</span>`,
    `<span class="aiw-tag">⏱️ ${duration}</span>`,
    `<span class="aiw-tag">${place}</span>`,
  ].join('');

  document.getElementById('aiw-result-content').innerHTML = `
    <div class="aiw-tags">${tagHtml}</div>
    <div class="aiw-result-text">${formatted}</div>
  `;
}

// ── 폼 리셋 ─────────────────────────────────────────────────────
function resetAiWalk() {
  aiwSelections.size = null;
  aiwSelections.duration = null;
  aiwSelections.place = null;

  document.querySelectorAll('.aiw-opt-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('aiw-location').value = '';
  document.getElementById('aiw-submit').disabled = true;
  document.getElementById('aiw-result').classList.add('hidden');
  document.getElementById('aiw-loading').classList.add('hidden');
  document.getElementById('aiw-form').classList.remove('hidden');
}
