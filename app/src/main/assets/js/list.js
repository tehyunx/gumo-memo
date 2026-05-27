const List = (() => {
  let currentTagId = 'all';

  function formatDate(ts) {
    const d = new Date(ts), now = new Date();
    const diff = now - d;
    if (diff < 60000) return '방금';
    if (diff < 3600000) return Math.floor(diff / 60000) + '분 전';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '시간 전';
    if (d.getFullYear() === now.getFullYear())
      return (d.getMonth() + 1) + '/' + d.getDate();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function plainText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function renderTagBar(tags) {
    const scroll = document.querySelector('.tag-scroll');
    // 기존 태그 칩 제거 (전체 버튼 제외)
    scroll.querySelectorAll('.tag-chip:not([data-tag-id="all"])').forEach(el => el.remove());
    tags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-chip' + (String(tag.id) === String(currentTagId) ? ' active' : '');
      btn.dataset.tagId = tag.id;
      btn.textContent = '#' + tag.name;
      btn.style.borderColor = tag.color;
      if (String(tag.id) === String(currentTagId)) btn.style.background = tag.color;
      btn.onclick = () => filterByTag(String(tag.id), btn, tag.color);
      scroll.appendChild(btn);
    });
    // 전체 버튼 스타일 동기화
    const allBtn = scroll.querySelector('[data-tag-id="all"]');
    if (currentTagId === 'all') {
      allBtn.classList.add('active');
      allBtn.style.background = '';
    } else {
      allBtn.classList.remove('active');
    }
  }

  function filterByTag(tagId, el, color) {
    currentTagId = tagId;
    document.querySelectorAll('.tag-chip').forEach(c => {
      c.classList.remove('active');
      c.style.background = '';
    });
    el.classList.add('active');
    if (tagId !== 'all' && color) el.style.background = color;
    render();
  }

  function buildCard(note) {
    const card = document.createElement('div');
    const isExpanded = !note.is_folded;
    card.className = 'note-card' + (isExpanded ? ' expanded' : '');
    card.dataset.id = note.id;

    const preview = plainText(note.content);
    const displayTitle = note.title || preview.substring(0, 30) || '제목 없음';

    // 헤더 (버튼 포함 — 항상 보임)
    const header = document.createElement('div');
    header.className = 'note-card-header';

    const foldIcon = document.createElement('span');
    foldIcon.className = 'note-fold-icon';
    foldIcon.textContent = '▶';

    const meta = document.createElement('div');
    meta.className = 'note-card-meta';
    meta.innerHTML =
      '<div class="note-card-title">' + esc(displayTitle) + '</div>' +
      (preview ? '<div class="note-card-preview">' + esc(preview.substring(0, 60)) + '</div>' : '');

    const date = document.createElement('span');
    date.className = 'note-card-date';
    date.textContent = formatDate(note.updated_at);

    // 편집/삭제 버튼 — 헤더에 배치 (항상 접근 가능)
    const headerActions = document.createElement('div');
    headerActions.className = 'note-header-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-card';
    editBtn.textContent = '편집';
    editBtn.onclick = (e) => { e.stopPropagation(); Editor.openExisting(note.id); };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del-card';
    delBtn.textContent = '삭제';
    delBtn.onclick = (e) => { e.stopPropagation(); List.deleteNote(note.id); };

    headerActions.append(editBtn, delBtn);
    header.append(foldIcon, meta, date, headerActions);
    header.onclick = (e) => {
      if (e.target.closest('.note-header-actions')) return;
      toggleCard(card, note.id);
    };

    // 태그 뱃지
    const tagRow = document.createElement('div');
    tagRow.className = 'note-card-tags';
    (note.tags || []).forEach(t => {
      const b = document.createElement('span');
      b.className = 'note-tag-badge';
      b.style.background = t.color;
      b.textContent = '#' + t.name;
      tagRow.appendChild(b);
    });

    // 펼침 본문
    const body = document.createElement('div');
    body.className = 'note-card-body';

    const contentEl = document.createElement('div');
    contentEl.className = 'note-card-content';
    contentEl.style.fontSize = (note.font_size || 16) + 'px';
    contentEl.innerHTML = note.content || '';

    const imgsEl = document.createElement('div');
    imgsEl.className = 'note-card-images';
    (note.images || []).forEach(img => {
      const im = document.createElement('img');
      im.src = 'file://' + img.file_path;
      im.loading = 'lazy';
      imgsEl.appendChild(im);
    });

    body.append(contentEl, imgsEl);
    card.append(header, tagRow, body);
    return card;
  }

  function toggleCard(card, noteId) {
    const willExpand = !card.classList.contains('expanded');
    card.classList.toggle('expanded', willExpand);
    DB.setFolded(noteId, !willExpand);
  }

  function render() {
    const tagId = currentTagId === 'all' ? -1 : currentTagId;
    const notes = DB.getNotes(tagId);
    const tags = DB.getTags();
    renderTagBar(tags);
    const listEl = document.getElementById('note-list');
    listEl.innerHTML = '';
    if (!notes.length) {
      listEl.innerHTML = '<p class="empty-msg">메모가 없습니다.<br>＋ 버튼을 눌러 첫 메모를 작성하세요.</p>';
      return;
    }
    notes.forEach(note => listEl.appendChild(buildCard(note)));
  }

  function deleteNote(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    DB.deleteNote(id);
    render();
  }

  return { render, filterByTag, deleteNote };
})();
