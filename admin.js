(function () {
  var cfg = window.FEC_SITE;
  if (!cfg) return;

  var STORAGE_STREAM = 'fec_stream_url';
  var STORAGE_PROGRAMA = 'fec_programa_local';
  var STORAGE_TOKEN = 'fec_gs_token';

  function authed() {
    return (
      localStorage.getItem(cfg.storageTrust) === '1' ||
      sessionStorage.getItem(cfg.storageSession) === '1'
    );
  }

  if (!authed()) {
    var next = encodeURIComponent('admin.html');
    window.location.replace(
      'login.html?' +
        cfg.adminQuery.k +
        '=' +
        encodeURIComponent(cfg.adminQuery.v) +
        '&next=' +
        next
    );
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js', { scope: './' }).catch(function () {});
    });
  }

  function apiUrl() {
    var u = window.FEC_API && window.FEC_API.scriptUrl;
    if (!u || typeof u !== 'string') return '';
    u = u.trim();
    if (!u || u.indexOf('SEU_DEPLOYMENT') !== -1) return '';
    return u;
  }

  function hasApi() {
    return apiUrl().indexOf('http') === 0;
  }

  var streamEl = document.getElementById('field-stream');
  var programaEl = document.getElementById('field-programa');
  var tokenEl = document.getElementById('field-api-token');
  var tokenRow = document.getElementById('row-api-token');
  var hint = document.getElementById('save-hint');
  var errBox = document.getElementById('save-error');

  function showErr(msg) {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.hidden = false;
  }

  function hideErr() {
    if (errBox) errBox.hidden = true;
  }

  function loadFields() {
    streamEl.value = localStorage.getItem(STORAGE_STREAM) || 'https://stream.minhafeconectada.com.br/index.m3u8';
    programaEl.value = localStorage.getItem(STORAGE_PROGRAMA) || '';
    if (tokenEl) {
      tokenEl.value = sessionStorage.getItem(STORAGE_TOKEN) || '';
    }
    if (hasApi()) {
      if (tokenRow) tokenRow.hidden = false;
      fetch(apiUrl(), { cache: 'no-cache', redirect: 'follow' })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data && data.streamUrl) streamEl.value = data.streamUrl;
          if (data && data.programaAtual) programaEl.value = data.programaAtual;
        })
        .catch(function () {
          /* manter valores locais */
        });
    } else {
      if (tokenRow) tokenRow.hidden = true;
    }
  }

  loadFields();

  if (tokenEl) {
    tokenEl.addEventListener(
      'change',
      function () {
        sessionStorage.setItem(STORAGE_TOKEN, tokenEl.value.trim());
      },
      false
    );
  }

  document.getElementById('form-config').addEventListener('submit', function (e) {
    e.preventDefault();
    hideErr();
    var stream = streamEl.value.trim();
    var programa = programaEl.value.trim();
    var token = tokenEl ? tokenEl.value.trim() : '';

    if (hasApi()) {
      if (!token) {
        showErr('Informe o token da API (mesmo valor que ADMIN_TOKEN no Apps Script).');
        return;
      }
      sessionStorage.setItem(STORAGE_TOKEN, token);
      fetch(apiUrl(), {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          streamUrl: stream,
          programaAtual: programa,
        }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data && data.ok) {
            localStorage.setItem(STORAGE_STREAM, stream);
            localStorage.setItem(STORAGE_PROGRAMA, programa);
            hint.hidden = false;
            setTimeout(function () {
              hint.hidden = true;
            }, 4000);
          } else {
            showErr((data && data.error) || 'Falha ao salvar na planilha.');
          }
        })
        .catch(function () {
          showErr('Erro de rede ao falar com o Google Apps Script.');
        });
      return;
    }

    localStorage.setItem(STORAGE_STREAM, stream);
    localStorage.setItem(STORAGE_PROGRAMA, programa);
    hint.hidden = false;
    setTimeout(function () {
      hint.hidden = true;
    }, 3500);
  });

  document.getElementById('btn-logout').addEventListener('click', function () {
    localStorage.removeItem(cfg.storageTrust);
    sessionStorage.removeItem(cfg.storageSession);
    sessionStorage.removeItem(STORAGE_TOKEN);
    window.location.href = 'index.html';
  });

  /* ── Mini preview player & camera controls ── */
  var previewPlayer = null;
  var currentZoom = 100;   /* percent, 50–300 */
  var currentRot  = 0;     /* degrees, multiples of 90 */

  function applyTransform() {
    if (!previewPlayer) return;
    var videoEl = previewPlayer.el().querySelector('video');
    if (!videoEl) return;
    var scale = currentZoom / 100;
    videoEl.style.transform = 'scale(' + scale + ') rotate(' + currentRot + 'deg)';
    var zoomVal = document.getElementById('zoom-val');
    var rotVal  = document.getElementById('rot-val');
    if (zoomVal) zoomVal.textContent = currentZoom + '%';
    if (rotVal)  rotVal.textContent  = currentRot + '°';
  }

  function initPreviewPlayer() {
    if (typeof videojs === 'undefined') return;
    var streamUrl = localStorage.getItem(STORAGE_STREAM) ||
                    'https://stream.minhafeconectada.com.br/index.m3u8';
    var isSafari = videojs.browser && videojs.browser.IS_ANY_SAFARI;
    previewPlayer = videojs('admin-preview-player', {
      controls: true,
      fluid: false,
      muted: true,
      preload: 'auto',
      html5: {
        vhs: { overrideNative: !isSafari },
        nativeAudioTracks: true,
        nativeVideoTracks: true,
      },
      sources: [{ src: streamUrl, type: 'application/x-mpegURL' }],
    });
    previewPlayer.ready(function () {
      applyTransform();
    });

    /* zoom buttons */
    var btnZoomIn    = document.getElementById('btn-zoom-in');
    var btnZoomOut   = document.getElementById('btn-zoom-out');
    var btnZoomReset = document.getElementById('btn-zoom-reset');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', function () {
        currentZoom = Math.min(300, currentZoom + 10);
        applyTransform();
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', function () {
        currentZoom = Math.max(50, currentZoom - 10);
        applyTransform();
      });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', function () {
        currentZoom = 100;
        applyTransform();
      });
    }

    /* rotation buttons */
    var btnRotCw    = document.getElementById('btn-rot-cw');
    var btnRotCcw   = document.getElementById('btn-rot-ccw');
    var btnRotReset = document.getElementById('btn-rot-reset');
    if (btnRotCw) {
      btnRotCw.addEventListener('click', function () {
        currentRot = (currentRot + 90) % 360;
        applyTransform();
      });
    }
    if (btnRotCcw) {
      btnRotCcw.addEventListener('click', function () {
        currentRot = (currentRot - 90 + 360) % 360;
        applyTransform();
      });
    }
    if (btnRotReset) {
      btnRotReset.addEventListener('click', function () {
        currentRot = 0;
        applyTransform();
      });
    }

    /* update preview stream URL when form is saved */
    document.getElementById('form-config').addEventListener('submit', function () {
      var newStream = (streamEl.value || '').trim();
      if (newStream && previewPlayer) {
        previewPlayer.src({ src: newStream, type: 'application/x-mpegURL' });
        previewPlayer.play();
      }
    }, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreviewPlayer);
  } else {
    initPreviewPlayer();
  }
})();
