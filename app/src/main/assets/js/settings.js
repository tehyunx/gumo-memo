const Settings = (() => {
  let fontSize = 16;
  let defaultPaper = 'lined';

  function load() {
    fontSize = parseInt(DB.getSetting('font_size')) || 16;
    defaultPaper = DB.getSetting('default_paper') || 'lined';
    document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    document.getElementById('setting-font-size').value = fontSize;
    document.getElementById('setting-font-size-label').textContent = fontSize + 'px';
    document.getElementById('setting-paper').value = defaultPaper;
  }

  function setFontSize(val) {
    fontSize = parseInt(val);
    document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    document.getElementById('setting-font-size-label').textContent = fontSize + 'px';
    DB.setSetting('font_size', val);
  }

  function setPaper(val) {
    defaultPaper = val;
    DB.setSetting('default_paper', val);
  }

  return {
    load,
    setFontSize,
    setPaper,
    getDefaultPaper: () => defaultPaper,
    getDefaultFontSize: () => fontSize,
  };
})();
