const List = (() => {
  let currentTagId = 'all';
  let searchQuery = '';
  const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const MAX_THUMBS = 4;

  function plainText(html) {
    return String(html || '')
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

  // 목록에 깔 썸네일 (최대 4장, 나머지는 +N)
  function buildThumbs(images) {
    const row = document.createElement('div');
    row.className = 'note-thumbs';
    images.slice(0, MAX_THUMBS).forEach(img => {
      const im = document.createElement('img');
      im.className = 'note-thumb';
      im.src = 'file://' + img.file_path;
      im.loading = 'lazy';
      im.onerror = () => im.classList.add('thumb-broken');
      row.appendChild(im);
    });
    const rest = images.length - MAX_THUMBS;
    if (rest > 0) {
      const more = document.createElement('div');
      more.className = 'note-thumb note-thumb-more';
      more.textContent = '+' + rest;
      row.appendChild(more);
    }
    return row;
  }

  function displayText(note) {
    const text = plainText(note.content);
    return note.title ? note.title + (text ? '\n' + text : '') : text;
  }

  // 검색용 자모 색인 — 글이 바뀔 때만 다시 만든다
  const indexCache = new Map();
  function noteIndex(note) {
    const c = indexCache.get(note.id);
    if (c && c.at === note.updated_at) return c.ix;
    const ix = Fuzzy.index(displayText(note));
    indexCache.set(note.id, {at: note.updated_at, ix});
    return ix;
  }

  // 찾은 자리 앞뒤 한 줄 (긴 글은 접혀서 안 보일 수 있으므로)
  function buildHit(display, hit) {
    const el = document.createElement('div');
    el.className = 'note-hit';
    const a = Math.max(0, hit.a - 20), b = Math.min(display.length, hit.b + 1 + 30);
    const flat = s => s.replace(/\s+/g, ' ');
    const mark = document.createElement('mark');
    mark.textContent = flat(display.slice(hit.a, hit.b + 1));
    el.append((a > 0 ? '…' : '') + flat(display.slice(a, hit.a)), mark,
              flat(display.slice(hit.b + 1, b)) + (b < display.length ? '…' : ''));
    return el;
  }

  function buildEntry(note, hit) {
    const display = displayText(note);
    const images = note.images || [];
    if (!display && !images.length) return null;

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
    const hitEl = hit ? buildHit(display, hit) : null;

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

    if (hitEl) dateHeader.after(hitEl);
    if (images.length) entry.appendChild(buildThumbs(images));

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

    const hits = new Map();
    let partial = false;
    if (searchQuery) {
      // 낱말마다 따로·비슷한 말도 — 다 맞는 글이 없으면 가장 많이 맞는 글
      const words = Fuzzy.prepare(searchQuery);
      const scored = notes.map(n => {
        const r = Fuzzy.score(noteIndex(n), words, (n.title || '').length);
        return {n, r};
      }).filter(x => x.r.n > 0);
      const most = scored.reduce((m, x) => Math.max(m, x.r.n), 0);
      partial = most < words.length;
      notes = scored.filter(x => x.r.n === most)
        .sort((a, b) => b.r.s - a.r.s || b.n.updated_at - a.n.updated_at)
        .map(x => { hits.set(x.n.id, x.r.hit); return x.n; });
    }

    const listEl = document.getElementById('note-list');
    listEl.innerHTML = '';

    if (!notes.length) {
      listEl.innerHTML = searchQuery
        ? '<p class="empty-msg">찾는 메모가 없습니다.</p>'
        : '<p class="empty-msg">메모가 없습니다.<br>✏ 버튼을 눌러 작성하세요.</p>';
      return;
    }
    if (partial) {
      const p = document.createElement('p');
      p.className = 'search-partial';
      p.textContent = '모든 낱말이 들어간 메모가 없어, 가장 많이 맞는 메모를 보여 드립니다.';
      listEl.appendChild(p);
    }
    notes.forEach(note => {
      const entry = buildEntry(note, hits.get(note.id));
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
