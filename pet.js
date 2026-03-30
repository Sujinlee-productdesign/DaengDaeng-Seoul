// ================================================================
// 댕댕서울 — 펫 상권 분석 + AI 산책 추천 탭 로직
// ================================================================


// ----------------------------------------------------------------
// 1. 펫 상권 분석 — 구별 장소 밀집도 분석
//    sidebarPlaces(전역, app.js에서 설정)를 구별로 집계
// ----------------------------------------------------------------

let commercialInitialized = false;

// 카테고리 한글 레이블 + 이모지
const CATEGORY_META = {
  park:       { emoji: '🌳', label: '공원' },
  restaurant: { emoji: '🍽️', label: '음식점' },
  cafe:       { emoji: '☕', label: '카페' },
  'pf-cafe':  { emoji: '🐶', label: '애견카페' },
  vet:        { emoji: '🏥', label: '동물병원' },
  playground: { emoji: '🎾', label: '놀이터' },
};

function initCommercial() {
  if (commercialInitialized) return;
  commercialInitialized = true;

  // sidebarPlaces가 아직 없으면 잠시 후 재시도
  if (!window.sidebarPlaces || window.sidebarPlaces.length === 0) {
    setTimeout(initCommercial, 800);
    commercialInitialized = false;
    return;
  }

  buildCommercialRanking();
  buildCommercialChart();
  populateCommercialGuSelect();
}

// ── 구별 집계 ────────────────────────────────────────────────────
function aggregateByGu() {
  // { 구명: { total: N, park: N, restaurant: N, ... } }
  const map = {};
  (window.sidebarPlaces || []).forEach(p => {
    const gu = extractGu(p.address || '');
    if (!gu) return;
    if (!map[gu]) {
      map[gu] = { total: 0 };
      Object.keys(CATEGORY_META).forEach(k => { map[gu][k] = 0; });
    }
    map[gu].total++;
    if (map[gu][p.category] !== undefined) map[gu][p.category]++;
  });
  return map;
}

// 주소에서 "OO구" 추출
function extractGu(address) {
  const m = address.match(/([가-힣]+구)/);
  return m ? m[1] : null;
}

// ── TOP 10 순위 렌더 ─────────────────────────────────────────────
function buildCommercialRanking() {
  const agg = aggregateByGu();
  const sorted = Object.entries(agg)
    .map(([gu, d]) => ({ gu, ...d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const maxCount = sorted[0]?.total || 1;
  const el = document.getElementById('commercial-ranking');
  if (!el) return;

  if (sorted.length === 0) {
    el.innerHTML = '<div class="commercial-loading">데이터가 없습니다. 먼저 댕댕지도 탭을 열어주세요.</div>';
    return;
  }

  el.innerHTML = sorted.map((item, i) => `
    <div class="rank-item">
      <div class="rank-num">${i + 1}</div>
      <div class="rank-gu">${item.gu}</div>
      <div class="rank-bar-wrap">
        <div class="rank-bar" style="width:${Math.round((item.total / maxCount) * 100)}%"></div>
      </div>
      <div class="rank-count">${item.total}곳</div>
    </div>
  `).join('');
}

// ── 카테고리 도넛 차트 ───────────────────────────────────────────
function buildCommercialChart() {
  const canvas = document.getElementById('chart-commercial');
  if (!canvas) return;

  // 카테고리별 합계
  const counts = {};
  Object.keys(CATEGORY_META).forEach(k => { counts[k] = 0; });
  (window.sidebarPlaces || []).forEach(p => {
    if (counts[p.category] !== undefined) counts[p.category]++;
  });

  const labels = Object.keys(CATEGORY_META).map(k => `${CATEGORY_META[k].emoji} ${CATEGORY_META[k].label}`);
  const data   = Object.keys(CATEGORY_META).map(k => counts[k]);
  const colors = ['#34C759','#FF8C42','#8E6A4B','#5856D6','#FF2D55','#30B0C7'];

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { family: 'Pretendard', size: 12 }, padding: 12 },
        },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 11 },
          formatter: (val) => val > 0 ? val : '',
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

// ── 구 선택 셀렉트박스 ───────────────────────────────────────────
function populateCommercialGuSelect() {
  const agg    = aggregateByGu();
  const select = document.getElementById('commercial-gu-select');
  if (!select) return;

  const guList = Object.keys(agg).sort();
  guList.forEach(gu => {
    const opt = document.createElement('option');
    opt.value = gu;
    opt.textContent = gu;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    const gu = select.value;
    if (!gu) return;
    renderGuDetail(gu, agg[gu]);
  });
}

// ── 구 상세 렌더 ─────────────────────────────────────────────────
function renderGuDetail(gu, data) {
  const el = document.getElementById('commercial-gu-detail');
  if (!el || !data) return;
  el.classList.remove('hidden');

  const cats = Object.keys(CATEGORY_META).map(k => ({
    key: k,
    emoji: CATEGORY_META[k].emoji,
    label: CATEGORY_META[k].label,
    count: data[k] || 0,
  }));

  el.innerHTML = `
    <div class="gu-detail-name">📍 ${gu} — 총 ${data.total}곳</div>
    <div class="gu-category-grid">
      ${cats.map(c => `
        <div class="gu-category-item">
          <div class="gu-category-emoji">${c.emoji}</div>
          <div class="gu-category-label">${c.label}</div>
          <div class="gu-category-count">${c.count}</div>
        </div>
      `).join('')}
    </div>
  `;
}


// ----------------------------------------------------------------
// 2. AI 산책 추천 — Claude API 챗봇
//    서버 /ai-chat 엔드포인트로 프록시 (CLAUDE_API_KEY 필요)
// ----------------------------------------------------------------

let aiChatHistory = []; // 대화 히스토리 (Claude messages 형식)
let aiTyping      = false;

// 메시지 추가 렌더 함수
function appendMessage(role, text) {
  const container = document.getElementById('aichat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `aichat-msg aichat-msg-${role === 'user' ? 'user' : 'bot'}`;

  div.innerHTML = role === 'user'
    ? `<div class="aichat-msg-bubble">${escapeHtml(text)}</div>`
    : `
        <span class="aichat-msg-avatar">🐶</span>
        <div class="aichat-msg-bubble">${formatBotText(text)}</div>
      `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// 타이핑 인디케이터 표시
function showTyping() {
  const container = document.getElementById('aichat-messages');
  if (!container) return null;
  const div = document.createElement('div');
  div.className = 'aichat-msg aichat-msg-bot';
  div.id = 'aichat-typing-indicator';
  div.innerHTML = `
    <span class="aichat-msg-avatar">🐶</span>
    <div class="aichat-msg-bubble">
      <div class="aichat-typing"><span></span><span></span><span></span></div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function removeTyping() {
  document.getElementById('aichat-typing-indicator')?.remove();
}

// XSS 방지용 이스케이프
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

// 봇 응답에 기본 포맷 적용 (줄바꿈, ** 볼드)
function formatBotText(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// 메시지 전송 핵심 함수
async function sendMessage(text) {
  if (!text.trim() || aiTyping) return;
  aiTyping = true;

  // 입력창 초기화 및 버튼 비활성화
  const input  = document.getElementById('aichat-input');
  const btn    = document.getElementById('aichat-send');
  const quick  = document.getElementById('aichat-quick-btns');
  if (input) input.value = '';
  if (btn)   btn.disabled = true;
  if (quick) quick.style.display = 'none'; // 첫 전송 후 빠른버튼 숨김

  // 유저 메시지 표시
  appendMessage('user', text);

  // 대화 히스토리에 추가
  aiChatHistory.push({ role: 'user', content: text });

  // 타이핑 인디케이터 표시
  showTyping();

  try {
    const response = await fetch('/ai-chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: aiChatHistory }),
    });

    removeTyping();

    if (!response.ok) {
      throw new Error(`서버 오류 ${response.status}`);
    }

    const data    = await response.json();
    const botText = data.content || '죄송해요, 응답을 받지 못했어요. 다시 시도해주세요.';

    // 봇 응답 표시 및 히스토리 저장
    appendMessage('bot', botText);
    aiChatHistory.push({ role: 'assistant', content: botText });

  } catch (err) {
    removeTyping();
    console.error('AI 채팅 오류:', err);
    appendMessage('bot',
      'AI 서비스에 일시적인 문제가 발생했어요 😥\n\n' +
      '서버에 CLAUDE_API_KEY가 설정되어 있는지 확인해주세요.\n' +
      '잠시 후 다시 시도해주세요!');
  }

  if (btn) btn.disabled = false;
  aiTyping = false;
}

// 빠른 질문 버튼 클릭
function sendQuickMsg(text) {
  sendMessage(text);
}

// DOMContentLoaded 이벤트 연결
document.addEventListener('DOMContentLoaded', () => {

  // ── AI 채팅 전송 버튼 ──────────────────────────────────────────
  document.getElementById('aichat-send')?.addEventListener('click', () => {
    const input = document.getElementById('aichat-input');
    sendMessage(input?.value || '');
  });

  // ── 엔터키 전송 (Shift+Enter: 줄바꿈) ──────────────────────────
  document.getElementById('aichat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('aichat-send')?.click();
    }
  });

  // ── textarea 자동 높이 조절 ────────────────────────────────────
  document.getElementById('aichat-input')?.addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  });

});
