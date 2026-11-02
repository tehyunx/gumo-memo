// 비슷한 말 찾기 — 띄어쓰기·조사·오타·초성이 달라도 걸리게.
// 한글을 자모로 풀어(ㅘ→ㅗㅏ, ㄳ→ㄱㅅ) 비교하므로 "플래이"도 "플레이"에 걸린다.
const Fuzzy = (() => {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅗㅏ','ㅗㅐ','ㅗㅣ','ㅛ','ㅜ','ㅜㅓ','ㅜㅔ','ㅜㅣ','ㅠ','ㅡ','ㅡㅣ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  // 낱말 끝 조사·어미 (긴 것부터)
  const TAILS = ['에서는','으로는','에게서','한테서','이라고','합니다','했어요','해요','했다','했어','해서','하면','하는','하기','하고','하다',
    '라고','에서','으로','에게','한테','까지','부터','처럼','보다','이랑','이나','은','는','이','가','을','를','에','로','와','과','의','도','만','랑'];
  const SKIP = /[\s\p{P}\p{S}]/u;

  // 문자열 → 자모열과 각 자모의 원래 글자 위치
  function index(str) {
    const s = String(str || '').toLowerCase();
    let j = '', cho = '';
    const pos = [], cpos = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (SKIP.test(ch)) continue;
      const c = ch.charCodeAt(0) - 0xAC00;
      if (c >= 0 && c < 11172) {
        const parts = CHO[Math.floor(c / 588)] + JUNG[Math.floor(c % 588 / 28)] + JONG[c % 28];
        for (const p of parts) { j += p; pos.push(i); }
        cho += CHO[Math.floor(c / 588)];
      } else {
        j += ch; pos.push(i);
        cho += ch;
      }
      cpos.push(i);
    }
    return {raw: s, j, pos, cho, cpos};
  }

  function stem(w) {
    for (const t of TAILS) if (w.length > t.length && w.endsWith(t)) return w.slice(0, -t.length);
    return '';
  }

  function prepare(q) {
    return String(q || '').toLowerCase().split(/\s+/).filter(Boolean).map(w => {
      const st = stem(w);
      return {
        w, j: index(w).j,
        stemJ: st ? index(st).j : '',
        cho: /^[ㄱ-ㅎ]{2,}$/.test(w) ? w : '',
      };
    });
  }

  // 허용 오타 수: 자모 길이에 따라
  function allow(m) { return m < 5 ? 0 : m < 9 ? 1 : m < 14 ? 2 : 3; }

  // 근사 부분열 찾기(Sellers): 가장 적게 틀린 끝 위치
  function approx(p, t, k) {
    const m = p.length;
    let prev = new Array(m + 1), cur = new Array(m + 1);
    for (let i = 0; i <= m; i++) prev[i] = i;
    let best = k + 1, end = -1;
    for (let x = 0; x < t.length; x++) {
      cur[0] = 0;
      for (let i = 1; i <= m; i++) {
        const cost = p[i - 1] === t[x] ? 0 : 1;
        cur[i] = Math.min(prev[i - 1] + cost, prev[i] + 1, cur[i - 1] + 1);
      }
      if (cur[m] < best) { best = cur[m]; end = x; if (best === 0) break; }
      [prev, cur] = [cur, prev];
    }
    return end < 0 ? null : {d: best, end};
  }

  // 한 낱말의 가장 좋은 맞춤 → {s: 점수, a: 시작 글자, b: 끝 글자(포함)}
  function matchWord(ix, q) {
    let at = ix.raw.indexOf(q.w);
    if (at >= 0) return {s: 10, a: at, b: at + q.w.length - 1};
    if (!q.j) return null;
    at = ix.j.indexOf(q.j);
    if (at >= 0) return {s: 8, a: ix.pos[at], b: ix.pos[at + q.j.length - 1]};
    if (q.stemJ) {
      at = ix.j.indexOf(q.stemJ);
      if (at >= 0) return {s: 7, a: ix.pos[at], b: ix.pos[at + q.stemJ.length - 1]};
    }
    if (q.cho) {
      at = ix.cho.indexOf(q.cho);
      if (at >= 0) return {s: 6, a: ix.cpos[at], b: ix.cpos[at + q.cho.length - 1]};
    }
    const k = allow(q.j.length);
    if (!k) return null;
    const r = approx(q.j, ix.j, k);
    if (!r) return null;
    const a = ix.pos[Math.max(0, r.end - q.j.length + 1)];
    return {s: 5 - 1.5 * r.d, a, b: ix.pos[r.end]};
  }

  // 글 하나 채점: {n: 맞은 낱말 수, s: 점수, hit: 가장 좋은 맞춤}
  function score(ix, words, titleLen) {
    let n = 0, s = 0, hit = null;
    for (const q of words) {
      const r = matchWord(ix, q);
      if (!r) continue;
      const v = r.s * (r.a < (titleLen || 0) ? 1.3 : 1);
      n++; s += v;
      if (!hit || v > hit.v) hit = {v, a: r.a, b: r.b};
    }
    return {n, s, hit};
  }

  return {index, prepare, score};
})();
if (typeof module !== 'undefined') module.exports = Fuzzy;
