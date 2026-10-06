// Shared local-only navigation avatar. Self-contained for classic static pages.
export function initProfileNavigation() {
    var slots = document.querySelectorAll('[data-profile-avatar]');
    if (!slots.length) return;
    var hues = ['#DE8E79', '#B9D4BE', '#B29DD0', '#B6D4E4', '#E0A9B4', '#B7D9B0',
      '#D3A9DE', '#B9DCE8', '#E0B080', '#C0DEA8', '#AE8FC9', '#A9D4C4'];
    function you() {
      var access = window.zodiacsProfileAccess;
      if (document.documentElement.hasAttribute('data-account-sync-v2')
        && !(access && access.canRead && access.canRead() === true)) return null;
      var profile = JSON.parse(localStorage.getItem('zodiacs.profile.v1') || 'null');
      var own = profile && Array.isArray(profile.charts)
        ? profile.charts.filter(function (chart) { return chart && chart.relationship === 'self'; })
        : [];
      var self = own.length === 1 ? own[0] : null;
      var me = JSON.parse(localStorage.getItem('zodiacs.me.v1') || 'null');
      if (me && me.version === 1 && typeof me.photo === 'string' && me.photo.length <= 100000
        && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(me.photo)) return { photo: me.photo };
      var name = me && me.version === 1 && typeof me.displayName === 'string' ? me.displayName : '';
      // An automatic chart name ends in the birth date; it is not a name.
      if (!name && self && typeof self.name === 'string' && !/·\s*\d{4}-\d{2}-\d{2}\s*$/.test(self.name)) {
        name = self.name.split('·')[0];
      }
      var first = Array.from(name.replace(new RegExp('[\\p{Cc}\\p{Cf}]', 'gu'), '').normalize('NFC').trim())[0];
      if (!first || !new RegExp('^[\\p{L}\\p{N}]$', 'u').test(first)) return null;
      var letter = first.toUpperCase();
      if (Array.from(letter).length !== 1) letter = first;
      var bodies = self && self.summary && Array.isArray(self.summary.bodies) ? self.summary.bodies : [];
      var sun = bodies.filter(function (row) { return row && row.body === 'Sun'; })[0];
      var lon = sun ? Number(sun.lon) : NaN;
      var hue = '';
      if (isFinite(lon)) {
        lon = ((lon % 360) + 360) % 360;
        var index = Math.min(11, Math.floor(lon / 30));
        var within = lon - index * 30;
        var timeKnown = Boolean(self && self.birth && self.birth.timeKnown === true);
        // Without a birth time, a Sun within a day's motion of a cusp is unsettled.
        if (timeKnown || !(within < 1.02 || 30 - within < 1.02)) hue = hues[index];
      }
      return { letter: letter, hue: hue };
    }
    function render() {
      var mark = null;
      try { mark = you(); } catch (error) { mark = null; }
      for (var i = 0; i < slots.length; i += 1) {
        var slot = slots[i];
        slot.textContent = mark && mark.letter ? mark.letter : '';
        if (mark && mark.photo) {
          var photo = document.createElement('img');
          photo.src = mark.photo; photo.alt = ''; photo.width = photo.height = 28;
          slot.appendChild(photo);
        }
        if (mark && mark.hue) slot.style.setProperty('--sign', mark.hue);
        else slot.style.removeProperty('--sign');
        slot.hidden = !mark;
        if (slot.parentElement) slot.parentElement.classList.toggle('has-avatar', Boolean(mark));
      }
    }
    render();
    ['zodiacs:profile', 'zodiacs:profile-access', 'zodiacs:me'].forEach(function (name) {
      window.addEventListener(name, render);
    });
    function onStorage(event) {
      if (!event.key || event.key === 'zodiacs.me.v1' || event.key === 'zodiacs.profile.v1') render();
    }
    window.addEventListener('storage', onStorage);
    return function cleanup() {
      ['zodiacs:profile', 'zodiacs:profile-access', 'zodiacs:me'].forEach(function (name) {
        window.removeEventListener(name, render);
      });
      window.removeEventListener('storage', onStorage);
    };

}
