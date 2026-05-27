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
    // 다른 패널이 없으면 오버레이도 닫기
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
      list.innerHTML = '<p style="color:var(--subtext);text-align:center;padding:20px">태그가 없습니다.<br>태그 관리에서 먼저 추가하세요.</p>';
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
      saveBtn.style.cssText = 'margin-top:14px;width:100%;padding:11px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px';
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

  return { showScreen, openPanel, closePanel, closeAllPanels, openSettings, openFontPanel, openTagPanel, openTagManager };
})();

// ── 태그 관리자 ──────────────────────────────────────────────────
const TagMgr = (() => {
  function render() {
    const tags = DB.getTags();
    const list = document.getElementById('tag-list-panel');
    list.innerHTML = '';
    if (!tags.length) {
      list.innerHTML = '<p style="color:var(--subtext);text-align:center;padding:16px">태그가 없습니다.</p>';
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

// ── 공유 인텐트 체크 (onNewIntent에서 호출) ──────────────────────
window.checkShared = function() {
  const shared = DB.getSharedText();
  if (shared && shared.text) { Editor.openNew(shared.text); return; }
  const imgPath = DB.getSharedImgPath();
  if (imgPath) { Editor.openNew(''); window.onImagePicked(imgPath); }
};

// ── 앱 초기화 ─────────────────────────────────────────────────────
function initApp() {
  Settings.load();
  List.render();
  // 공유 인텐트로 진입한 경우
  window.checkShared();
}

document.addEventListener('DOMContentLoaded', initApp);
