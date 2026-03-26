// ================================================================
// 댕댕서울 88 - 견종 인식 AI
// TensorFlow.js + MobileNet으로 강아지 사진 → 견종 자동 인식
//
// 흐름: 사진 업로드 → MobileNet 분류 → 견종 매핑 → 팝업 표시
//       → 견종 크기(소형/중형/대형)에 따라 지도 필터 자동 전환
// ================================================================


// ----------------------------------------------------------------
// 1. 견종 한국어 이름 & 크기 매핑 테이블
//    MobileNet이 반환하는 영어 클래스명 → 한국어 + 크기 분류
// ----------------------------------------------------------------

const BREED_MAP = {
  // ─── 소형견 ───────────────────────────────────────────────
  'Chihuahua':           { ko: '치와와',           size: 'small' },
  'Japanese spaniel':    { ko: '재패니즈 친',       size: 'small' },
  'Maltese':             { ko: '말티즈',            size: 'small' },
  'Maltese dog':         { ko: '말티즈',            size: 'small' },
  'Pekinese':            { ko: '페키니즈',          size: 'small' },
  'Shih-Tzu':            { ko: '시추',              size: 'small' },
  'toy terrier':         { ko: '토이 테리어',       size: 'small' },
  'miniature pinscher':  { ko: '미니어처 핀셔',     size: 'small' },
  'Pomeranian':          { ko: '포메라니안',         size: 'small' },
  'toy poodle':          { ko: '토이 푸들',         size: 'small' },
  'Yorkshire terrier':   { ko: '요크셔 테리어',     size: 'small' },
  'miniature schnauzer': { ko: '미니어처 슈나우저', size: 'small' },
  'dachshund':           { ko: '닥스훈트',          size: 'small' },
  'papillon':            { ko: '파피용',            size: 'small' },
  'Blenheim spaniel':    { ko: '블레넘 스파니엘',   size: 'small' },

  // ─── 중형견 ───────────────────────────────────────────────
  'beagle':              { ko: '비글',              size: 'medium' },
  'French bulldog':      { ko: '프렌치 불독',       size: 'medium' },
  'English bulldog':     { ko: '불독',              size: 'medium' },
  'bulldog':             { ko: '불독',              size: 'medium' },
  'Shetland sheepdog':   { ko: '셸티',              size: 'medium' },
  'collie':              { ko: '콜리',              size: 'medium' },
  'cocker spaniel':      { ko: '코커 스파니엘',     size: 'medium' },
  'Shiba Inu':           { ko: '시바 이누',         size: 'medium' },
  'pug':                 { ko: '퍼그',              size: 'medium' },
  'Pembroke':            { ko: '펨브로크 코기',     size: 'medium' },
  'Cardigan':            { ko: '카디건 코기',       size: 'medium' },
  'miniature poodle':    { ko: '미니어처 푸들',     size: 'medium' },
  'standard schnauzer':  { ko: '슈나우저',          size: 'medium' },
  'Keeshond':            { ko: '키스훈트',          size: 'medium' },
  'Spitz':               { ko: '스피츠',            size: 'medium' },

  // ─── 대형견 ───────────────────────────────────────────────
  'Labrador retriever':  { ko: '래브라도 리트리버', size: 'large' },
  'golden retriever':    { ko: '골든 리트리버',     size: 'large' },
  'German shepherd':     { ko: '저먼 셰퍼드',       size: 'large' },
  'Siberian husky':      { ko: '시베리안 허스키',   size: 'large' },
  'Samoyed':             { ko: '사모예드',           size: 'large' },
  'border collie':       { ko: '보더 콜리',         size: 'large' },
  'Doberman':            { ko: '도베르만',           size: 'large' },
  'Rottweiler':          { ko: '로트와일러',         size: 'large' },
  'boxer':               { ko: '복서',              size: 'large' },
  'Great Dane':          { ko: '그레이트 데인',     size: 'large' },
  'Saint Bernard':       { ko: '세인트 버나드',     size: 'large' },
  'standard poodle':     { ko: '스탠다드 푸들',     size: 'large' },
  'Dalmatian':           { ko: '달마시안',           size: 'large' },
  'Weimaraner':          { ko: '바이마라너',         size: 'large' },
  'Irish setter':        { ko: '아이리시 세터',     size: 'large' },
};


// ----------------------------------------------------------------
// 2. 견종 크기 → 추천 메시지 & 지도 필터 연결
// ----------------------------------------------------------------

const SIZE_CONFIG = {
  small: {
    label:    '소형견',
    icon:     '🐩',
    msg:      '소형견이군요! 반려견 카페에서 편하게 쉬어가세요.',
    filter:   'cafe',   // 지도 필터 자동 전환 카테고리
    filterLabel: '☕ 카페',
    color:    '#8D6E63',
  },
  medium: {
    label:    '중형견',
    icon:     '🐕',
    msg:      '중형견이군요! 공원도 카페도 모두 즐겨요.',
    filter:   'all',
    filterLabel: '전체',
    color:    '#FF8C42',
  },
  large: {
    label:    '대형견',
    icon:     '🐕‍🦺',
    msg:      '대형견이군요! 넓은 공원에서 마음껏 뛰어요.',
    filter:   'park',
    filterLabel: '🌳 공원',
    color:    '#43A047',
  },
};


// ----------------------------------------------------------------
// 3. MobileNet 결과 → 견종 매핑
//    MobileNet className 예시: "Maltese dog, Maltese terrier, Maltese"
//    여러 단어 중 하나라도 BREED_MAP 키와 일치하면 반환
// ----------------------------------------------------------------

function matchBreed(predictions) {
  for (const pred of predictions) {
    const classLower = pred.className.toLowerCase();

    for (const [key, val] of Object.entries(BREED_MAP)) {
      if (classLower.includes(key.toLowerCase())) {
        return {
          ...val,
          confidence: Math.round(pred.probability * 100),
          rawName: pred.className,
        };
      }
    }
  }
  return null; // 매칭되는 견종 없음
}


// ----------------------------------------------------------------
// 4. 지도 필터 자동 전환 (app.js의 필터 버튼 클릭을 흉내냄)
// ----------------------------------------------------------------

function autoFilter(category) {
  // 해당 카테고리의 필터 버튼을 찾아 클릭 이벤트 발생
  const targetBtn = document.querySelector(`.filter-btn[data-category="${category}"]`);
  if (targetBtn) targetBtn.click();
}


// ----------------------------------------------------------------
// 5. AI 결과 팝업 표시
// ----------------------------------------------------------------

function showAiResult(breed) {
  const config  = SIZE_CONFIG[breed.size];
  const panel   = document.getElementById('ai-result-panel');
  const content = document.getElementById('ai-result-content');

  // 팝업 내용 HTML 생성
  content.innerHTML = `
    <div class="ai-result-header" style="border-bottom:3px solid ${config.color}">
      <span class="ai-result-icon">${config.icon}</span>
      <div>
        <div class="ai-result-breed">${breed.ko}</div>
        <div class="ai-result-size" style="color:${config.color}">${config.label} · 인식 정확도 ${breed.confidence}%</div>
      </div>
    </div>
    <p class="ai-result-msg">${config.msg}</p>
    <div class="ai-result-filter">
      지도 필터가 <strong style="color:${config.color}">${config.filterLabel}</strong> 으로 자동 변경됐어요!
    </div>
  `;

  // 팝업 표시
  panel.classList.remove('hidden');

  // 지도 필터 자동 전환
  autoFilter(config.filter);
}

// 결과 팝업 닫기 (index.html의 onclick에서 호출)
function closeAiResult() {
  document.getElementById('ai-result-panel').classList.add('hidden');
}


// ----------------------------------------------------------------
// 6. 인식 중 로딩 표시
// ----------------------------------------------------------------

function showAiLoading(on) {
  const btn = document.getElementById('ai-fab-btn');
  if (on) {
    btn.innerHTML = '<span style="animation:spin 1s linear infinite;display:inline-block">🌀</span><span class="ai-fab-label">인식 중...</span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = '🐶<span class="ai-fab-label">견종 인식</span>';
    btn.disabled = false;
  }
}


// ----------------------------------------------------------------
// 7. 이미지 파일 선택 → MobileNet 분류 실행
// ----------------------------------------------------------------

let mobilenetModel = null; // 모델은 최초 1회만 로드

async function runBreedDetection(file) {
  showAiLoading(true);
  closeAiResult(); // 이전 결과 닫기

  try {
    // 모델 로드 (최초 1회만 - 약 10~20초 소요)
    if (!mobilenetModel) {
      console.log('🧠 MobileNet 모델 로딩 중...');
      mobilenetModel = await mobilenet.load();
      console.log('✅ MobileNet 모델 로드 완료');
    }

    // FileReader로 이미지 파일을 읽어 <img> 요소 생성
    const imgEl = await fileToImage(file);

    // MobileNet으로 이미지 분류 (상위 5개 결과)
    const predictions = await mobilenetModel.classify(imgEl, 5);
    console.log('🐾 인식 결과:', predictions);

    // 견종 매핑
    const breed = matchBreed(predictions);

    if (breed) {
      showAiResult(breed);
    } else {
      // 강아지가 아닌 사진이거나 인식 불가
      showAiUnknown(predictions[0]?.className || '알 수 없음');
    }

  } catch (err) {
    console.error('❌ 견종 인식 실패:', err);
    showAiError();
  } finally {
    showAiLoading(false);
  }
}


// ----------------------------------------------------------------
// 8. File → HTMLImageElement 변환 헬퍼
// ----------------------------------------------------------------

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// ----------------------------------------------------------------
// 9. 인식 실패 케이스 처리
// ----------------------------------------------------------------

// 견종 매핑 실패 (강아지가 아닌 사진 등)
function showAiUnknown(rawName) {
  const panel   = document.getElementById('ai-result-panel');
  const content = document.getElementById('ai-result-content');

  content.innerHTML = `
    <div class="ai-result-header">
      <span class="ai-result-icon">🤔</span>
      <div>
        <div class="ai-result-breed">견종을 인식하지 못했어요</div>
        <div class="ai-result-size" style="color:#999">강아지 얼굴이 잘 보이는 사진을 써보세요</div>
      </div>
    </div>
    <p class="ai-result-msg" style="color:#999">인식된 내용: ${rawName}</p>
  `;

  panel.classList.remove('hidden');
}

// 네트워크/모델 오류
function showAiError() {
  const panel   = document.getElementById('ai-result-panel');
  const content = document.getElementById('ai-result-content');

  content.innerHTML = `
    <div class="ai-result-header">
      <span class="ai-result-icon">😵</span>
      <div>
        <div class="ai-result-breed">오류가 발생했어요</div>
        <div class="ai-result-size" style="color:#999">잠시 후 다시 시도해주세요</div>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');
}


// ----------------------------------------------------------------
// 10. 이벤트 연결: 버튼 클릭 → 파일 선택 → 인식 실행
// ----------------------------------------------------------------

// DOM이 준비된 후 이벤트 연결
document.addEventListener('DOMContentLoaded', () => {
  const fabBtn   = document.getElementById('ai-fab-btn');
  const fileInput = document.getElementById('ai-file-input');

  // FAB 버튼 클릭 → 파일 선택 다이얼로그 열기
  fabBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // 파일 선택 완료 → 인식 실행
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 이미지 파일인지 확인
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드해주세요 🐾');
      return;
    }

    runBreedDetection(file);

    // 같은 파일 재선택 가능하도록 input 초기화
    fileInput.value = '';
  });
});
