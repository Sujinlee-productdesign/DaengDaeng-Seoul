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
    label:       '소형견',
    iconSrc:     'icons/location-pin.svg',
    iconClass:   'size-small',
    msg:         '소형견이군요! 반려견 카페에서 편하게 쉬어가세요.',
    filter:      'cafe',
    filterLabel: '카페',
    color:       '#8D6E63',
  },
  medium: {
    label:       '중형견',
    iconSrc:     'icons/location.svg',
    iconClass:   'size-medium',
    msg:         '중형견이군요! 공원도 카페도 모두 즐겨요.',
    filter:      'all',
    filterLabel: '전체',
    color:       '#FF8C42',
  },
  large: {
    label:       '대형견',
    iconSrc:     'icons/location.svg',
    iconClass:   'size-large',
    msg:         '대형견이군요! 넓은 공원에서 마음껏 뛰어요.',
    filter:      'park',
    filterLabel: '공원',
    color:       '#34C759',
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
    <div class="ai-result-header">
      <div class="ai-result-icon ${config.iconClass}">
        <img src="${config.iconSrc}" alt="" class="ai-icon-img">
      </div>
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
    btn.innerHTML = '<div class="btn-spinner"></div><span class="ai-fab-label">인식 중...</span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = '<img src="icons/search.svg" alt="" class="ai-fab-icon"><span class="ai-fab-label">견종 인식</span>';
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
      <div class="ai-result-icon">
        <img src="icons/search.svg" alt="" class="ai-icon-img">
      </div>
      <div>
        <div class="ai-result-breed">견종을 인식하지 못했어요</div>
        <div class="ai-result-size" style="color:#8E8E93">강아지 얼굴이 잘 보이는 사진을 써보세요</div>
      </div>
    </div>
    <p class="ai-result-msg" style="color:#8E8E93">인식된 내용: ${rawName}</p>
  `;

  panel.classList.remove('hidden');
}

// 네트워크/모델 오류
function showAiError() {
  const panel   = document.getElementById('ai-result-panel');
  const content = document.getElementById('ai-result-content');

  content.innerHTML = `
    <div class="ai-result-header">
      <div class="ai-result-icon">
        <img src="icons/close.svg" alt="" class="ai-icon-img">
      </div>
      <div>
        <div class="ai-result-breed">오류가 발생했어요</div>
        <div class="ai-result-size" style="color:#8E8E93">잠시 후 다시 시도해주세요</div>
      </div>
    </div>
  `;

  panel.classList.remove('hidden');
}


// ----------------------------------------------------------------
// 10. 이벤트 연결: 버튼 클릭 → 파일 선택 → 인식 실행
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// 10. 맞춤 추천 탭 - 견종 인식 결과 표시
// ----------------------------------------------------------------

// 카테고리별 아이콘 경로 (추천 탭용)
const CATEGORY_ICON_SRC = {
  park:       'icons/location.svg',
  restaurant: 'icons/location-pin.svg',
  cafe:       'icons/location-pin.svg',
};

function showRecommendResult(breed) {
  const config  = SIZE_CONFIG[breed.size];
  const result  = document.getElementById('recommend-result');
  const breedCard = document.getElementById('recommend-breed-card');
  const placeList = document.getElementById('recommend-place-list');

  // 견종 카드
  breedCard.innerHTML = `
    <div class="breed-card-icon">
      <img src="${config.iconSrc}" alt="" style="width:28px;height:28px;opacity:0.7;">
    </div>
    <div>
      <div class="breed-card-name">${breed.ko}</div>
      <div class="breed-card-size" style="color:${config.color}">${config.label} · 인식 정확도 ${breed.confidence}%</div>
      <div class="breed-card-msg">${config.msg}</div>
    </div>
  `;

  // sidebarPlaces에서 추천 카테고리 장소 필터링
  const recommended = (window.sidebarPlaces || [])
    .filter(p => config.filter === 'all' || p.category === config.filter)
    .slice(0, 8);

  placeList.innerHTML = recommended.length === 0
    ? '<p style="color:var(--text-3);font-size:0.85rem;">추천 장소를 불러오는 중이에요...</p>'
    : recommended.map(p => `
        <div class="recommend-place-item">
          <div class="place-item-icon ${p.category}">
            <img src="${CATEGORY_ICON_SRC[p.category] || 'icons/location-pin.svg'}" alt="">
          </div>
          <div class="place-item-info">
            <div class="place-item-name">${p.name}</div>
            <div class="place-item-addr">${p.address || '주소 정보 없음'}</div>
          </div>
        </div>
      `).join('');

  result.classList.remove('hidden');
}

// ----------------------------------------------------------------
// 11. 이벤트 연결: 맞춤 추천 탭 업로드 영역 + 파일 선택
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const fileInput  = document.getElementById('ai-file-input-tab');
  const uploadZone = document.getElementById('ai-upload-zone');
  const uploadBtn  = uploadZone?.querySelector('.ai-upload-btn');

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    // 업로드 영역에 이미지 미리보기
    const reader = new FileReader();
    reader.onload = (e) => {
      const inner = document.getElementById('ai-upload-inner');
      if (inner) {
        inner.innerHTML = `<img src="${e.target.result}" class="ai-upload-preview" alt="업로드 이미지">`;
      }
    };
    reader.readAsDataURL(file);

    // 견종 인식 실행
    runBreedDetectionForTab(file);
    fileInput.value = '';
  }

  // 버튼 클릭 → 파일 선택
  if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
  if (uploadZone) uploadZone.addEventListener('click', (e) => {
    if (e.target === uploadZone || e.target.id === 'ai-upload-inner') fileInput.click();
  });

  // 드래그앤드롭
  if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      handleFile(e.dataTransfer.files[0]);
    });
  }

  // 파일 선택 완료
  if (fileInput) {
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
  }
});

// 맞춤 추천 탭용 인식 (결과를 탭 내부에 표시)
async function runBreedDetectionForTab(file) {
  try {
    if (!mobilenetModel) mobilenetModel = await mobilenet.load();
    const imgEl      = await fileToImage(file);
    const predictions = await mobilenetModel.classify(imgEl, 5);
    const breed       = matchBreed(predictions);

    if (breed) {
      showRecommendResult(breed);
    } else {
      const result = document.getElementById('recommend-result');
      document.getElementById('recommend-breed-card').innerHTML = `
        <div class="breed-card-icon">
          <img src="icons/search.svg" alt="" style="width:28px;height:28px;opacity:0.5;">
        </div>
        <div>
          <div class="breed-card-name">견종을 인식하지 못했어요</div>
          <div class="breed-card-msg" style="color:var(--text-3)">강아지 얼굴이 잘 보이는 사진을 써주세요</div>
        </div>`;
      document.getElementById('recommend-place-list').innerHTML = '';
      result.classList.remove('hidden');
    }
  } catch (err) {
    console.error('견종 인식 오류:', err);
  }
}
