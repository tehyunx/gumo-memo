// Android JavascriptInterface 래퍼
const DB = (() => {
  const A = window.Android;

  function parse(raw) {
    if (!raw || raw === 'null') return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function str(v) { return String(v); }

  return {
    saveNote:        (note) => parse(A.saveNote(JSON.stringify(note))) || { ok: false },
    getNotes:        (tagId = -1) => parse(A.getNotes(str(tagId))) || [],
    getNote:         (id) => parse(A.getNote(str(id))),
    deleteNote:      (id) => A.deleteNote(str(id)),
    setFolded:       (id, folded) => A.setFolded(str(id), folded),

    saveTag:         (name, color = '#888888') => A.saveTag(name, color),
    getTags:         () => parse(A.getTags()) || [],
    deleteTag:       (id) => A.deleteTag(str(id)),
    setNoteTags:     (noteId, tagIds) => A.setNoteTags(str(noteId), JSON.stringify(tagIds)),

    pickImage:       () => A.pickImageFromGallery(),
    captureImage:    () => A.captureImageFromCamera(),
    addImageToNote:  (noteId, path) => parse(A.addImageToNote(str(noteId), path)),
    deleteImage:     (id) => A.deleteImage(str(id)),

    getSharedText:   () => parse(A.getSharedText()),
    getSharedImgPath:() => { const v = A.getSharedImagePath(); return v === 'null' ? null : v; },

    getSetting:      (key) => A.getSetting(key),
    setSetting:      (key, val) => A.setSetting(key, str(val)),
  };
})();
