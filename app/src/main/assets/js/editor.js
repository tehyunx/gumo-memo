const Editor = (() => {
  let currentNoteId = null;
  let currentPaper = 'lined';
  let currentFontSize = 16;
  let pendingImages = [];
  let pendingTagIds = [];

  const PAPERS = ['lined', 'grid', 'blank'];
  const PAPER_LABELS = { lined: '▤ 줄', grid: '⊞ 격자', blank: '☐ 무선' };

  function openNew(prefilledText = '') {
    currentNoteId = null;
    currentPaper = Settings.getDefaultPaper();
    currentFontSize = Settings.getDefaultFontSize();
    pendingImages = [];
    pendingTagIds = [];

    document.getElementById('note-title').value = '';
    const contentEl = document.getElementById('note-content');
    contentEl.innerHTML = '';
    if (prefilledText) contentEl.innerText = prefilledText;
    document.getElementById('note-images').innerHTML = '';
    document.getElementById('editor-font-size').value = currentFontSize;
    document.getElementById('editor-font-size-label').textContent = currentFontSize + 'px';

    applyPaper(currentPaper);
    applyFontSize(currentFontSize);
    UI.showScreen('screen-editor');

    setTimeout(() => {
      const el = document.getElementById('note-content');
      el.focus();
      if (prefilledText) {
        // 커서를 텍스트 끝으로
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 120);
  }

  function openExisting(id) {
    const note = DB.getNote(id);
    if (!note) return;

    currentNoteId = id;
    currentPaper = note.paper_style || 'lined';
    currentFontSize = note.font_size || 16;
    pendingImages = [];
    pendingTagIds = (note.tags || []).map(t => t.id);

    document.getElementById('note-title').value = note.title || '';
    document.getElementById('note-content').innerHTML = note.content || '';
    document.getElementById('editor-font-size').value = currentFontSize;
    document.getElementById('editor-font-size-label').textContent = currentFontSize + 'px';

    const imgContainer = document.getElementById('note-images');
    imgContainer.innerHTML = '';
    (note.images || []).forEach(img => addImageToUI(img.file_path, img.id));

    applyPaper(currentPaper);
    applyFontSize(currentFontSize);
    UI.showScreen('screen-editor');
  }

  function applyPaper(style) {
    currentPaper = style;
    const el = document.getElementById('note-content');
    PAPERS.forEach(p => el.classList.remove('paper-' + p));
    el.classList.add('paper-' + style);
    document.getElementById('btn-paper').textContent = PAPER_LABELS[style] || '▤';
  }

  function cyclePaper() {
    const idx = PAPERS.indexOf(currentPaper);
    applyPaper(PAPERS[(idx + 1) % PAPERS.length]);
  }

  function applyFontSize(size) {
    currentFontSize = parseInt(size);
    // inline style 대신 CSS variable 사용 → contenteditable에서 더 안정적
    document.getElementById('editor-scroll').style.setProperty('--editor-font-size', currentFontSize + 'px');
  }

  function setFontSize(val) {
    applyFontSize(val);
    document.getElementById('editor-font-size-label').textContent = val + 'px';
  }

  function save() {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').innerHTML;

    const result = DB.saveNote({
      id: currentNoteId || 0,
      title,
      content,
      paper_style: currentPaper,
      font_size: currentFontSize,
      is_folded: 0
    });

    const noteId = result.id;
    if (!noteId) { UI.showScreen('screen-list'); List.render(); return; }

    // 태그 저장
    DB.setNoteTags(noteId, pendingTagIds);

    // 신규 노트의 pending 이미지 연결
    pendingImages.forEach(path => DB.addImageToNote(noteId, path));
    pendingImages = [];

    UI.showScreen('screen-list');
    List.render();
  }

  function pickImage() { DB.pickImage(); }

  function addImageToUI(filePath, dbId) {
    const container = document.getElementById('note-images');
    const wrap = document.createElement('div');
    wrap.className = 'note-img-wrapper';
    if (dbId) wrap.dataset.dbId = dbId;
    else wrap.dataset.path = filePath;

    const img = document.createElement('img');
    img.src = 'file://' + filePath;
    img.loading = 'lazy';

    const del = document.createElement('button');
    del.className = 'note-img-del';
    del.textContent = '✕';
    del.onclick = () => {
      if (wrap.dataset.dbId) {
        DB.deleteImage(wrap.dataset.dbId);
      } else {
        pendingImages = pendingImages.filter(p => p !== filePath);
      }
      wrap.remove();
    };

    wrap.append(img, del);
    container.appendChild(wrap);
  }

  // MainActivity에서 호출 (onActivityResult)
  window.onImagePicked = function(filePath) {
    if (currentNoteId) {
      const result = DB.addImageToNote(currentNoteId, filePath);
      addImageToUI(filePath, result && result.id);
    } else {
      pendingImages.push(filePath);
      addImageToUI(filePath, null);
    }
  };

  // 태그 선택 패널에서 현재 태그 목록 가져오기
  function getCurrentTagIds() { return pendingTagIds; }
  function setCurrentTagIds(ids) { pendingTagIds = ids; }
  function getCurrentNoteId() { return currentNoteId; }

  return {
    openNew, openExisting, save, cyclePaper, pickImage,
    setFontSize, getCurrentTagIds, setCurrentTagIds, getCurrentNoteId,
  };
})();
