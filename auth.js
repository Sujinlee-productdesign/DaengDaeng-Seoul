// ================================================================
// 댕댕서울 — 인증 시스템 (localStorage 기반)
// 관리자 계정: sjlee / 123456
// 일반 계정: localStorage 저장
// ================================================================

const ADMIN_ID = 'sjlee';
const ADMIN_PW = '123456';

const KEY_USERS       = 'daengseoul_users';
const KEY_SESSION     = 'daengseoul_session';
const KEY_BM          = (uid) => `daengseoul_bm_${uid}`;
const KEY_CORRECTIONS = 'daengseoul_corrections';   // 정정 요청 목록
const KEY_EXCLUDED    = 'daengseoul_excluded';       // 관리자가 제외한 장소 이름 목록
const KEY_SUGGESTIONS = 'daengseoul_suggestions';   // 장소 등록 제안 목록

// 현재 세션 (전역 — app.js, ai.js에서도 참조)
let currentUser = null; // { id, role: 'admin'|'user' }


// ────────────────────────────────────────────────────────────────
// 사용자 목록 (localStorage)
// ────────────────────────────────────────────────────────────────
function getUsers() {
  try { return JSON.parse(localStorage.getItem(KEY_USERS) || '[]'); }
  catch (e) { return []; }
}
function saveUsers(u) { localStorage.setItem(KEY_USERS, JSON.stringify(u)); }


// ────────────────────────────────────────────────────────────────
// 인증
// ────────────────────────────────────────────────────────────────
function authLogin(id, pw) {
  if (id === ADMIN_ID && pw === ADMIN_PW) {
    currentUser = { id, role: 'admin' };
    localStorage.setItem(KEY_SESSION, JSON.stringify(currentUser));
    onAuthChange();
    return { ok: true };
  }
  const user = getUsers().find(u => u.id === id && u.pw === pw);
  if (user) {
    currentUser = { id, role: 'user' };
    localStorage.setItem(KEY_SESSION, JSON.stringify(currentUser));
    onAuthChange();
    return { ok: true };
  }
  return { ok: false, msg: '아이디 또는 비밀번호가 올바르지 않아요' };
}

function authSignup(id, pw) {
  if (!id || id.length < 2)  return { ok: false, msg: '아이디는 2자 이상이어야 해요' };
  if (!pw || pw.length < 6)  return { ok: false, msg: '비밀번호는 6자 이상이어야 해요' };
  if (id === ADMIN_ID)        return { ok: false, msg: '사용할 수 없는 아이디예요' };
  const users = getUsers();
  if (users.find(u => u.id === id)) return { ok: false, msg: '이미 사용 중인 아이디예요' };
  users.push({ id, pw });
  saveUsers(users);
  return { ok: true };
}

function authLogout() {
  currentUser = null;
  localStorage.removeItem(KEY_SESSION);
  onAuthChange();
}

function authResetPassword(targetId, newPw) {
  if (!currentUser)                                         return { ok: false, msg: '로그인이 필요해요' };
  if (currentUser.role !== 'admin' && currentUser.id !== targetId) return { ok: false, msg: '권한이 없어요' };
  if (!newPw || newPw.length < 6)                          return { ok: false, msg: '비밀번호는 6자 이상이어야 해요' };
  if (targetId === ADMIN_ID)                                return { ok: false, msg: '관리자 비밀번호는 변경할 수 없어요' };
  const users = getUsers();
  const idx = users.findIndex(u => u.id === targetId);
  if (idx === -1) return { ok: false, msg: '계정을 찾을 수 없어요' };
  users[idx].pw = newPw;
  saveUsers(users);
  return { ok: true };
}

function authDeleteAccount(targetId) {
  if (!currentUser)                                         return { ok: false, msg: '로그인이 필요해요' };
  if (currentUser.role !== 'admin' && currentUser.id !== targetId) return { ok: false, msg: '권한이 없어요' };
  if (targetId === ADMIN_ID)                                return { ok: false, msg: '관리자 계정은 삭제할 수 없어요' };
  saveUsers(getUsers().filter(u => u.id !== targetId));
  // 북마크도 삭제
  localStorage.removeItem(KEY_BM(targetId));
  if (currentUser.id === targetId) authLogout();
  return { ok: true };
}


// ────────────────────────────────────────────────────────────────
// 북마크
// ────────────────────────────────────────────────────────────────
function getBookmarks() {
  if (!currentUser) return [];
  try { return JSON.parse(localStorage.getItem(KEY_BM(currentUser.id)) || '[]'); }
  catch (e) { return []; }
}

function saveBookmarks(list) {
  if (!currentUser) return;
  localStorage.setItem(KEY_BM(currentUser.id), JSON.stringify(list));
}

function isBookmarked(placeName) { return getBookmarks().includes(placeName); }

function toggleBookmark(placeName) {
  if (!currentUser) return false;
  const list = getBookmarks();
  const idx  = list.indexOf(placeName);
  if (idx === -1) list.push(placeName);
  else list.splice(idx, 1);
  saveBookmarks(list);
  return idx === -1; // true = 추가됨
}


// ────────────────────────────────────────────────────────────────
// Auth 상태 변경 시 UI 동기화
// ────────────────────────────────────────────────────────────────
function onAuthChange() {
  updateAuthUI();
  if (typeof window.refreshBookmarkChip === 'function') window.refreshBookmarkChip();
  if (typeof window.applyFiltersGlobal   === 'function') window.applyFiltersGlobal();
}

function updateAuthUI() {
  const loginBtn  = document.getElementById('auth-login-btn');
  const userChip  = document.getElementById('auth-user-chip');
  const userName  = document.getElementById('auth-user-name');
  const gnbLabel  = document.getElementById('gnb-mypage-label');

  const adminTabBtn = document.getElementById('admin-tab-btn');
  if (currentUser) {
    loginBtn?.classList.add('hidden');
    userChip?.classList.remove('hidden');
    const displayName = currentUser.role === 'admin' ? `👑 ${currentUser.id}` : currentUser.id;
    if (userName) userName.textContent = displayName;
    if (gnbLabel) gnbLabel.textContent = currentUser.id;
    if (adminTabBtn) adminTabBtn.classList.toggle('hidden', currentUser.role !== 'admin');
  } else {
    loginBtn?.classList.remove('hidden');
    userChip?.classList.add('hidden');
    if (gnbLabel) gnbLabel.textContent = '로그인';
    adminTabBtn?.classList.add('hidden');
  }
}


// ────────────────────────────────────────────────────────────────
// 모달 열기 / 닫기
// ────────────────────────────────────────────────────────────────
function openAuthModal(tab) {
  if (currentUser) { openMyPageModal(); return; }
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchAuthTab(tab || 'login');
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
}

function openMyPageModal() {
  if (!currentUser) { openAuthModal('login'); return; }
  const modal = document.getElementById('mypage-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  updateAccountPanel();
}

function closeMyPageModal() {
  document.getElementById('mypage-modal')?.classList.add('hidden');
}

function showLoginRequired() {
  document.getElementById('login-required-modal')?.classList.remove('hidden');
}

function closeLoginRequired() {
  document.getElementById('login-required-modal')?.classList.add('hidden');
}


// ────────────────────────────────────────────────────────────────
// 탭 전환 (로그인 ↔ 회원가입)
// ────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.auth-panel').forEach(p =>
    p.classList.toggle('hidden', p.dataset.panel !== tab));
  clearAuthErrors();
}

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(el => {
    el.textContent = '';
    el.style.color = '';
  });
  document.getElementById('signup-success')?.classList.add('hidden');
  document.getElementById('account-pw-error') && (document.getElementById('account-pw-error').textContent = '');
}


// ────────────────────────────────────────────────────────────────
// 내 계정 패널 업데이트
// ────────────────────────────────────────────────────────────────
function updateAccountPanel() {
  if (!currentUser) return;
  const idEl       = document.getElementById('account-user-id');
  const roleEl     = document.getElementById('account-role-badge');
  const pwEl       = document.getElementById('mypage-pw-section');
  const adminTabBtn = document.getElementById('admin-tab-btn');

  if (idEl)   idEl.textContent   = currentUser.id;
  if (roleEl) roleEl.textContent = currentUser.role === 'admin' ? '관리자' : '일반';

  // 관리자는 비밀번호 변경 숨김 (하드코딩이므로)
  if (pwEl) pwEl.classList.toggle('hidden', currentUser.role === 'admin');

  // 관리 탭 버튼 — 관리자에게만 표시
  if (adminTabBtn) {
    adminTabBtn.classList.toggle('hidden', currentUser.role !== 'admin');
    if (currentUser.role === 'admin') renderAdminUserList();
  }
}


// ────────────────────────────────────────────────────────────────
// 관리자 패널
// ────────────────────────────────────────────────────────────────
function renderAdminUserList() {
  const listEl = document.getElementById('admin-user-list');
  if (!listEl) return;
  const users = getUsers();
  if (users.length === 0) {
    listEl.innerHTML = '<div class="admin-empty">등록된 사용자가 없어요</div>';
    return;
  }
  listEl.innerHTML = users.map(u => `
    <div class="admin-user-row">
      <span class="admin-user-id">${u.id}</span>
      <button class="admin-del-btn" onclick="adminDeleteUser('${u.id}')">삭제</button>
    </div>
  `).join('');
}

function adminDeleteUser(targetId) {
  if (!confirm(`'${targetId}' 계정을 삭제하시겠어요?`)) return;
  authDeleteAccount(targetId);
  renderAdminUserList();
}


// ────────────────────────────────────────────────────────────────
// 이벤트 연결 + 세션 복원 (DOMContentLoaded)
// ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 세션 복원
  try {
    const saved = localStorage.getItem(KEY_SESSION);
    if (saved) currentUser = JSON.parse(saved);
  } catch (e) {}

  updateAuthUI();

  // ── 헤더 버튼 ────────────────────────────────────────────────
  document.getElementById('auth-login-btn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('auth-user-chip')?.addEventListener('click', () => openMyPageModal());

  // ── 모달 배경 클릭 닫기 ──────────────────────────────────────
  document.getElementById('auth-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'auth-modal') closeAuthModal();
  });
  document.getElementById('mypage-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'mypage-modal') closeMyPageModal();
  });
  document.getElementById('login-required-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'login-required-modal') closeLoginRequired();
  });

  // ── 탭 전환 ──────────────────────────────────────────────────
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  // ── 로그인 ───────────────────────────────────────────────────
  document.getElementById('auth-login-submit')?.addEventListener('click', () => {
    const id  = document.getElementById('login-id')?.value.trim();
    const pw  = document.getElementById('login-pw')?.value;
    const err = document.getElementById('login-error');
    const res = authLogin(id, pw);
    if (res.ok) {
      closeAuthModal();
    } else {
      if (err) err.textContent = res.msg;
    }
  });

  // login-id / login-pw 엔터키
  ['login-id', 'login-pw'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('auth-login-submit')?.click();
    });
  });

  // ── 회원가입 ─────────────────────────────────────────────────
  document.getElementById('auth-signup-submit')?.addEventListener('click', () => {
    const id    = document.getElementById('signup-id')?.value.trim();
    const pw    = document.getElementById('signup-pw')?.value;
    const pw2   = document.getElementById('signup-pw2')?.value;
    const err   = document.getElementById('signup-error');
    if (pw !== pw2) { if (err) err.textContent = '비밀번호가 일치하지 않아요'; return; }
    const res = authSignup(id, pw);
    if (res.ok) {
      document.getElementById('signup-success')?.classList.remove('hidden');
      if (err) err.textContent = '';
      setTimeout(() => switchAuthTab('login'), 1400);
    } else {
      if (err) err.textContent = res.msg;
    }
  });

  // ── 로그아웃 ─────────────────────────────────────────────────
  document.getElementById('auth-logout-btn')?.addEventListener('click', () => {
    authLogout();
    closeMyPageModal();
  });

  // ── 비밀번호 변경 ─────────────────────────────────────────────
  document.getElementById('account-pw-submit')?.addEventListener('click', () => {
    if (!currentUser) return;
    const newPw = document.getElementById('account-new-pw')?.value;
    const err   = document.getElementById('account-pw-error');
    const res   = authResetPassword(currentUser.id, newPw);
    if (err) {
      err.style.color = res.ok ? 'var(--park)' : 'var(--restaurant)';
      err.textContent = res.ok ? '비밀번호가 변경됐어요 ✓' : res.msg;
    }
    if (res.ok) document.getElementById('account-new-pw').value = '';
  });

  // ── 계정 삭제 ────────────────────────────────────────────────
  document.getElementById('account-delete-btn')?.addEventListener('click', () => {
    if (!currentUser) return;
    if (!confirm(`정말로 '${currentUser.id}' 계정을 삭제할까요?\n북마크 데이터도 함께 삭제돼요.`)) return;
    authDeleteAccount(currentUser.id);
    closeMyPageModal();
  });

  // ── 로그인 필요 모달 ─────────────────────────────────────────
  document.getElementById('login-required-go')?.addEventListener('click', () => {
    closeLoginRequired();
    openAuthModal('login');
  });

  // ── 관리자 패널 ──────────────────────────────────────────────
  document.getElementById('admin-refresh-btn')?.addEventListener('click', () => {
    renderAdminUserList();
    renderCorrectionList();
    renderSuggestionList();
  });

  // ── 장소 등록 제안 FAB ────────────────────────────────────────
  document.getElementById('map-suggest-btn')?.addEventListener('click', () => {
    document.getElementById('suggest-modal')?.classList.remove('hidden');
  });

  document.getElementById('suggest-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'suggest-modal')
      document.getElementById('suggest-modal').classList.add('hidden');
  });

  document.getElementById('suggest-submit-btn')?.addEventListener('click', () => {
    const name     = document.getElementById('suggest-name')?.value || '';
    const category = document.getElementById('suggest-category')?.value || 'cafe';
    const desc     = document.getElementById('suggest-desc-input')?.value || '';
    const kakaoUrl = document.getElementById('suggest-kakao-url')?.value || '';
    const errEl    = document.getElementById('suggest-error');
    const okEl     = document.getElementById('suggest-success');

    const res = window.submitPlaceSuggestion(name, category, desc, kakaoUrl);
    if (!res.ok) {
      if (errEl) errEl.textContent = res.msg;
      return;
    }
    if (errEl) errEl.textContent = '';
    okEl?.classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('suggest-modal')?.classList.add('hidden');
      okEl?.classList.add('hidden');
      document.getElementById('suggest-name').value     = '';
      document.getElementById('suggest-desc-input').value = '';
      document.getElementById('suggest-kakao-url').value = '';
    }, 2000);
  });

  // 초기 뱃지 업데이트
  updateSuggBadge();

  document.getElementById('admin-reset-submit')?.addEventListener('click', () => {
    const targetId = document.getElementById('admin-target-id')?.value.trim();
    const newPw    = document.getElementById('admin-new-pw')?.value;
    const err      = document.getElementById('admin-error');
    const res      = authResetPassword(targetId, newPw);
    if (err) {
      err.style.color = res.ok ? 'var(--park)' : 'var(--restaurant)';
      err.textContent = res.ok ? `${targetId} 초기화 완료 ✓` : res.msg;
    }
    if (res.ok) {
      document.getElementById('admin-target-id').value = '';
      document.getElementById('admin-new-pw').value    = '';
    }
  });
});


// ================================================================
//  정정 요청 & 장소 제외 관리
// ================================================================

// ── localStorage 헬퍼 ────────────────────────────────────────────
function getCorrections() {
  try { return JSON.parse(localStorage.getItem(KEY_CORRECTIONS) || '[]'); } catch { return []; }
}
function saveCorrections(list) {
  localStorage.setItem(KEY_CORRECTIONS, JSON.stringify(list));
}
function getExcluded() {
  try { return JSON.parse(localStorage.getItem(KEY_EXCLUDED) || '[]'); } catch { return []; }
}
function saveExcluded(list) {
  localStorage.setItem(KEY_EXCLUDED, JSON.stringify(list));
}

// 제외 여부 확인 (app.js에서 마커 렌더 시 사용)
window.isPlaceExcluded = function(placeName) {
  return getExcluded().includes(placeName);
};

// ── 정정 요청 제출 (팝업 버튼 → 모달 → 여기 호출) ─────────────
window.submitCorrectionReport = function(name, address, category, reason) {
  if (!reason.trim()) return;
  const list = getCorrections();
  list.push({
    id:        Date.now(),
    name,
    address,
    category,
    reason:    reason.trim(),
    timestamp: new Date().toLocaleString('ko-KR'),
    status:    'pending',
  });
  saveCorrections(list);
};

// ── 관리자: 장소 목록에서 제외 처리 ──────────────────────────────
window.adminExcludePlace = function(correctionId, placeName) {
  // 제외 목록에 추가
  const excl = getExcluded();
  if (!excl.includes(placeName)) {
    excl.push(placeName);
    saveExcluded(excl);
    // 마커 즉시 숨김 (app.js의 allMarkers 순회)
    if (window.allMarkers) {
      window.allMarkers.forEach(m => {
        if (m.placeData?.name === placeName) m.kakaoMarker?.setMap(null);
      });
    }
  }
  // 해당 정정 요청 resolved 처리
  const list = getCorrections().map(c =>
    c.id === correctionId ? { ...c, status: 'resolved', action: 'excluded' } : c
  );
  saveCorrections(list);
  renderCorrectionList();
};

// ── 관리자: 정정 요청 무시 ───────────────────────────────────────
window.adminIgnoreCorrection = function(correctionId) {
  const list = getCorrections().map(c =>
    c.id === correctionId ? { ...c, status: 'resolved', action: 'ignored' } : c
  );
  saveCorrections(list);
  renderCorrectionList();
};

// ── 관리자 패널 정정 요청 목록 렌더 ─────────────────────────────
function renderCorrectionList() {
  const el = document.getElementById('admin-correction-list');
  if (!el) return;
  const pending = getCorrections().filter(c => c.status === 'pending');
  if (pending.length === 0) {
    el.innerHTML = '<div class="admin-empty">처리 대기 중인 요청이 없어요</div>';
    return;
  }
  el.innerHTML = pending.map(c => `
    <div class="admin-correction-item" id="corr-${c.id}">
      <div class="corr-name">${c.name}</div>
      <div class="corr-addr">${c.address || ''}</div>
      <div class="corr-reason">${c.reason}</div>
      <div class="corr-time">${c.timestamp}</div>
      <div class="corr-actions">
        <button class="corr-exclude-btn" onclick="adminExcludePlace(${c.id}, '${c.name.replace(/'/g, "\\'")}')">목록에서 제외</button>
        <button class="corr-ignore-btn"  onclick="adminIgnoreCorrection(${c.id})">무시</button>
      </div>
    </div>
  `).join('');
}

// updateAccountPanel 호출 시 정정 목록도 갱신
const _origUpdateAccountPanel = typeof updateAccountPanel === 'function' ? updateAccountPanel : null;
function updateAccountPanel() {
  if (_origUpdateAccountPanel) _origUpdateAccountPanel();
  if (currentUser?.role === 'admin') {
    renderCorrectionList();
    renderSuggestionList();
  }
}


// ================================================================
//  장소 등록 제안 관리
// ================================================================

function getSuggestions() {
  try { return JSON.parse(localStorage.getItem(KEY_SUGGESTIONS) || '[]'); } catch { return []; }
}
function saveSuggestions(list) {
  localStorage.setItem(KEY_SUGGESTIONS, JSON.stringify(list));
}

function updateSuggBadge() {
  const badge = document.getElementById('sugg-badge');
  if (!badge) return;
  const count = getSuggestions().filter(s => s.status === 'pending').length;
  badge.textContent = count || '';
  badge.classList.toggle('hidden', count === 0);
}

// 제출 (누구나 가능)
window.submitPlaceSuggestion = function(name, category, desc, kakaoUrl) {
  if (!name.trim())     return { ok: false, msg: '장소 이름을 입력해주세요' };
  if (!kakaoUrl.trim()) return { ok: false, msg: '카카오맵 링크를 입력해주세요' };
  if (!kakaoUrl.startsWith('http')) return { ok: false, msg: '올바른 URL 형식으로 입력해주세요' };

  const list = getSuggestions();
  list.push({
    id:        Date.now(),
    name:      name.trim(),
    category,
    desc:      desc.trim(),
    kakaoUrl:  kakaoUrl.trim(),
    timestamp: new Date().toLocaleString('ko-KR'),
    status:    'pending',
  });
  saveSuggestions(list);
  updateSuggBadge();
  return { ok: true };
};

// 관리자: 승인
window.adminApproveSuggestion = function(suggId) {
  const list = getSuggestions().map(s =>
    s.id === suggId ? { ...s, status: 'approved' } : s
  );
  saveSuggestions(list);
  renderSuggestionList();
};

// 관리자: 반려
window.adminRejectSuggestion = function(suggId) {
  const list = getSuggestions().map(s =>
    s.id === suggId ? { ...s, status: 'rejected' } : s
  );
  saveSuggestions(list);
  renderSuggestionList();
};

const CAT_LABEL = {
  park: '공원', cafe: '애견카페', restaurant: '음식점',
  'pf-cafe': '애견동반카페', vet: '동물병원', playground: '반려견놀이터',
};

function renderSuggestionList() {
  const el = document.getElementById('admin-suggestion-list');
  if (!el) return;
  const pending = getSuggestions().filter(s => s.status === 'pending');
  updateSuggBadge();
  if (pending.length === 0) {
    el.innerHTML = '<div class="admin-empty">등록 제안이 없어요</div>';
    return;
  }
  el.innerHTML = pending.map(s => `
    <div class="admin-correction-item" id="sugg-${s.id}">
      <div class="corr-name">${s.name}
        <span class="sugg-cat-badge">${CAT_LABEL[s.category] || s.category}</span>
      </div>
      ${s.desc ? `<div class="corr-reason">${s.desc}</div>` : ''}
      <a href="${s.kakaoUrl}" target="_blank" rel="noopener" class="sugg-kakao-link">카카오맵에서 보기 →</a>
      <div class="corr-time">${s.timestamp}</div>
      <div class="corr-actions">
        <button class="corr-exclude-btn" onclick="adminApproveSuggestion(${s.id})">등록 승인</button>
        <button class="corr-ignore-btn"  onclick="adminRejectSuggestion(${s.id})">반려</button>
      </div>
    </div>
  `).join('');
}
