const List = (() => {
  let currentTagId = 'all';
  let searchQuery = '';
  const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  function plainText(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function formatDateHeader(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '.' + (d.getMonth()+1) + '.' + d.getDate() + ' ' + DOW[d.getDay()];
  }

  // 바텀바 스크롤 연동
  function initScroll() {
    const listEl = document.getElementById('note-list');
    const bar    = document.getElementById('bottom-bar');
    let lastY = 0;

    listEl.addEventListener('scroll', () => {
      const y = listEl.scrollTop;
      if (y > lastY + 8 && y > 40) {
        bar.classList.add('bb-hidden');
      } else if (y < lastY - 8) {
        bar.classList.remove('bb-hidden');
      }
      lastY = y;
    }, { passive: true });
  }

  function buildEntry(note) {
    const text = plainText(note.content);
    const display = note.title
      ? note.title + (text ? '\n' + text : '')
      : text;
    if (!display) return null;

    const entry = document.createElement('div');
    entry.className = 'note-entry';
    entry.dataset.id = note.id;

    // 날짜 + 수평선
    const dateHeader = document.createElement('div');
    dateHeader.className = 'note-date-header';
    const dateSpan = document.createElement('span');
    dateSpan.className = 'note-date-text';
    dateSpan.textContent = formatDateHeader(note.updated_at);
    const line = document.createElement('div');
    line.className = 'note-date-line';
    dateHeader.append(dateSpan, line);

    // 본문
    const body = document.createElement('div');
    body.className = 'note-body-text';
    body.textContent = display;

    // 16줄 초과 여부: 실제 줄 + 줄바꿈 없는 긴 단락 추정
    const lines = display.split('\n');
    const estLines = lines.reduce((s, l) => s + Math.max(1, Math.ceil(l.length / 22)), 0);
    const isLong = estLines > 16;

    if (isLong) {
      body.classList.add('body-collapsed');
      const dots = document.createElement('div');
      dots.className = 'note-expand-btn';
      dots.textContent = '⋮';
      dots.onclick = (e) => {
        e.stopPropagation();
        body.classList.remove('body-collapsed');
        dots.remove();
      };
      entry.append(dateHeader, body, dots);
    } else {
      entry.append(dateHeader, body);
    }

    // 탭 → 편집
    entry.onclick = () => Editor.openExisting(note.id);

    // 롱프레스 → 삭제
    let pressTimer;
    entry.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        if (confirm('이 메모를 삭제하시겠습니까?')) {
          DB.deleteNote(note.id);
          render();
        }
      }, 650);
    }, { passive: true });
    entry.addEventListener('touchend',  () => clearTimeout(pressTimer), { passive: true });
    entry.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });

    return entry;
  }

  function render() {
    const tagId = currentTagId === 'all' ? -1 : currentTagId;
    let notes = DB.getNotes(tagId);

    if (searchQuery) {
      notes = notes.filter(n => {
        const t = plainText(n.content).toLowerCase();
        return t.includes(searchQuery) || (n.title || '').toLowerCase().includes(searchQuery);
      });
    }

    const listEl = document.getElementById('note-list');
    listEl.innerHTML = '';

    if (!notes.length) {
      listEl.innerHTML = '<p class="empty-msg">메모가 없습니다.<br>✏ 버튼을 눌러 작성하세요.</p>';
      return;
    }
    notes.forEach(note => {
      const entry = buildEntry(note);
      if (entry) listEl.appendChild(entry);
    });
  }

  function filterByTag(tagId) {
    currentTagId = tagId;
    // 더보기 태그 칩 스타일 갱신
    document.querySelectorAll('.more-tag-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.tagId === String(tagId));
    });
    render();
  }

  function toggleSearch() {
    const bar   = document.getElementById('search-bar');
    const input = document.getElementById('search-input');
    if (bar.classList.contains('hidden')) {
      bar.classList.remove('hidden');
      setTimeout(() => input.focus(), 50);
    } else {
      closeSearch();
    }
  }

  function closeSearch() {
    document.getElementById('search-bar').classList.add('hidden');
    document.getElementById('search-input').value = '';
    searchQuery = '';
    render();
  }

  function search(q) {
    searchQuery = q.toLowerCase().trim();
    render();
  }

  function deleteNote(id) {
    if (!confirm('삭제하시겠습니까?')) return;
    DB.deleteNote(id);
    render();
  }

  return { render, filterByTag, toggleSearch, closeSearch, search, deleteNote, initScroll };
})();

// ── 목록 글자 크기 ──
const ListFont = (() => {
  let size = parseInt(localStorage.getItem('list_font_size')) || 18;

  function apply() {
    document.documentElement.style.setProperty('--list-font-size', size + 'px');
    const lbl = document.getElementById('more-font-label');
    if (lbl) lbl.textContent = size;
  }

  function inc() { if (size < 26) { size++; localStorage.setItem('list_font_size', size); apply(); } }
  function dec() { if (size > 12) { size--; localStorage.setItem('list_font_size', size); apply(); } }
  function load() { apply(); }

  return { inc, dec, load };
})();
