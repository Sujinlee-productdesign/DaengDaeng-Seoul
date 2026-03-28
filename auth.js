// ================================================================
// 댕댕서울 — 인증 시스템 (localStorage 기반)
// 관리자 계정: admin / daeng2024!
// 일반 계정: localStorage 저장
// ================================================================

const ADMIN_ID = 'admin';
const ADMIN_PW = 'daeng2024!';

const KEY_USERS   = 'daengseoul_users';
const KEY_SESSION = 'daengseoul_session';
const KEY_BM      = (uid) => `daengseoul_bm_${uid}`;

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

  if (currentUser) {
    loginBtn?.classList.add('hidden');
    userChip?.classList.remove('hidden');
    if (userName) userName.textContent = currentUser.role === 'admin'
      ? `👑 ${currentUser.id}` : currentUser.id;
  } else {
    loginBtn?.classList.remove('hidden');
    userChip?.classList.add('hidden');
  }
}


// ────────────────────────────────────────────────────────────────
// 모달 열기 / 닫기
// ────────────────────────────────────────────────────────────────
function openAuthModal(tab) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const guestArea = document.getElementById('auth-guest-area');
  const userArea  = document.getElementById('auth-user-area');

  if (currentUser) {
    guestArea?.classList.add('hidden');
    userArea?.classList.remove('hidden');
    updateAccountPanel();
  } else {
    guestArea?.classList.remove('hidden');
    userArea?.classList.add('hidden');
    switchAuthTab(tab || 'login');
  }
}

function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.add('hidden');
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
  const idEl    = document.getElementById('account-user-id');
  const roleEl  = document.getElementById('account-role-badge');
  const adminEl = document.getElementById('admin-panel');
  const pwEl    = document.getElementById('account-pw-submit')?.closest('.account-section');

  if (idEl)   idEl.textContent   = currentUser.id;
  if (roleEl) roleEl.textContent = currentUser.role === 'admin' ? '관리자' : '일반';

  // 관리자는 비밀번호 변경 숨김 (하드코딩이므로)
  if (pwEl) pwEl.classList.toggle('hidden', currentUser.role === 'admin');

  if (adminEl) {
    adminEl.classList.toggle('hidden', currentUser.role !== 'admin');
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
  document.getElementById('auth-user-chip')?.addEventListener('click', () => openAuthModal());

  // ── 모달 배경 클릭 닫기 ──────────────────────────────────────
  document.getElementById('auth-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'auth-modal') closeAuthModal();
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
    closeAuthModal();
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
    closeAuthModal();
  });

  // ── 로그인 필요 모달 ─────────────────────────────────────────
  document.getElementById('login-required-go')?.addEventListener('click', () => {
    closeLoginRequired();
    openAuthModal('login');
  });

  // ── 관리자 패널 ──────────────────────────────────────────────
  document.getElementById('admin-refresh-btn')?.addEventListener('click', renderAdminUserList);

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
