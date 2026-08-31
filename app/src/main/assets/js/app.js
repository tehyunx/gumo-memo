// ── UI 유틸리티 ──────────────────────────────────────────────────
const UI = (() => {
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function openPanel(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('overlay').classList.remove('hidden');
  }

  function closePanel(id) {
    document.getElementById(id).classList.add('hidden');
    const anyOpen = Array.from(document.querySelectorAll('.panel')).some(p => !p.classList.contains('hidden'));
    if (!anyOpen) document.getElementById('overlay').classList.add('hidden');
  }

  function closeAllPanels() {
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('overlay').classList.add('hidden');
  }

  function openSettings() { openPanel('panel-settings'); }
  function openFontPanel() { openPanel('panel-font'); }

  function openTagPanel() {
    const tags = DB.getTags();
    const currentIds = Editor.getCurrentTagIds();
    const list = document.getElementById('note-tag-list');
    list.innerHTML = '';

    if (!tags.length) {
      list.innerHTML = '<p style="color:#999;text-align:center;padding:20px">태그가 없습니다.<br>태그 관리에서 먼저 추가하세요.</p>';
    } else {
      tags.forEach(tag => {
        const item = document.createElement('label');
        item.className = 'note-tag-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = tag.id;
        cb.checked = currentIds.includes(tag.id) || currentIds.includes(String(tag.id));

        const dot = document.createElement('span');
        dot.className = 'note-tag-dot';
        dot.style.background = tag.color;

        const name = document.createElement('span');
        name.className = 'note-tag-name';
        name.textContent = '#' + tag.name;

        item.append(cb, dot, name);
        list.appendChild(item);
      });

      const saveBtn = document.createElement('button');
      saveBtn.textContent = '확인';
      saveBtn.style.cssText = 'margin-top:14px;width:100%;padding:11px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px';
      saveBtn.onclick = () => {
        const ids = Array.from(list.querySelectorAll('input:checked')).map(el => parseInt(el.value));
        Editor.setCurrentTagIds(ids);
        const noteId = Editor.getCurrentNoteId();
        if (noteId) DB.setNoteTags(noteId, ids);
        closePanel('panel-note-tags');
      };
      list.appendChild(saveBtn);
    }
    openPanel('panel-note-tags');
  }

  function openTagManager() {
    TagMgr.render();
    openPanel('panel-tags');
  }

  function openMoreMenu() {
    // 태그 칩 렌더링
    const row = document.getElementById('more-tag-chips');
    row.innerHTML = '';
    const tags = DB.getTags();

    const allChip = document.createElement('button');
    allChip.className = 'more-tag-chip' + (List.currentTag === 'all' || !List.currentTag ? ' active' : '');
    allChip.dataset.tagId = 'all';
    allChip.textContent = '전체';
    allChip.onclick = () => { List.filterByTag('all'); closePanel('panel-more'); };
    row.appendChild(allChip);

    tags.forEach(tag => {
      const chip = document.createElement('button');
      chip.className = 'more-tag-chip';
      chip.dataset.tagId = String(tag.id);
      chip.textContent = '#' + tag.name;
      chip.style.borderColor = tag.color;
      chip.onclick = () => { List.filterByTag(String(tag.id)); closePanel('panel-more'); };
      row.appendChild(chip);
    });

    // 글자 크기 라벨 동기화
    const lbl = document.getElementById('more-font-label');
    if (lbl) lbl.textContent = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--list-font-size')) || 18;

    openPanel('panel-more');
  }

  return { showScreen, openPanel, closePanel, closeAllPanels, openSettings, openFontPanel, openTagPanel, openTagManager, openMoreMenu };
})();

// ── 태그 관리자 ──────────────────────────────────────────────────
const TagMgr = (() => {
  function render() {
    const tags = DB.getTags();
    const list = document.getElementById('tag-list-panel');
    list.innerHTML = '';
    if (!tags.length) {
      list.innerHTML = '<p style="color:#999;text-align:center;padding:16px">태그가 없습니다.</p>';
      return;
    }
    tags.forEach(tag => {
      const row = document.createElement('div');
      row.className = 'tag-panel-item';

      const dot = document.createElement('span');
      dot.className = 'tag-panel-dot';
      dot.style.background = tag.color;

      const name = document.createElement('span');
      name.className = 'tag-panel-name';
      name.textContent = '#' + tag.name;

      const del = document.createElement('button');
      del.className = 'tag-panel-del';
      del.textContent = '✕';
      del.onclick = () => { DB.deleteTag(tag.id); render(); List.render(); };

      row.append(dot, name, del);
      list.appendChild(row);
    });
  }

  function createTag() {
    const name = document.getElementById('new-tag-name').value.trim();
    const color = document.getElementById('new-tag-color').value;
    if (!name) return;
    DB.saveTag(name, color);
    document.getElementById('new-tag-name').value = '';
    render();
    List.render();
  }

  return { render, createTag };
})();

// ── 뒤로가기 처리 ────────────────────────────────────────────────
window.onAndroidBack = function() {
  const anyOpen = Array.from(document.querySelectorAll('.panel')).some(p => !p.classList.contains('hidden'));
  if (anyOpen) { UI.closeAllPanels(); return true; }
  const editorActive = document.getElementById('screen-editor').classList.contains('active');
  if (editorActive) { Editor.save(); return true; }
  return false;
};

// ── 공유 인텐트 체크 ──────────────────────────────────────────────
window.checkShared = function() {
  const shared = DB.getSharedText();
  if (shared && shared.text) { Editor.openNew(shared.text); return; }
  const imgPath = DB.getSharedImgPath();
  if (imgPath) { Editor.openNew(''); window.onImagePicked(imgPath); }
};

// ── 앱 초기화 ─────────────────────────────────────────────────────
function initApp() {
  Settings.load();
  ListFont.load();
  List.initScroll();
  List.render();
  window.checkShared();
}

document.addEventListener('DOMContentLoaded', initApp);
