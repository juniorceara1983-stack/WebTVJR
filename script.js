(function () {
  var STORAGE_STREAM = 'fec_stream_url';
  var STORAGE_JSON = 'fec_programacao_url';
  var STORAGE_PROGRAMA_LOCAL = 'fec_programa_local';
  var fecPlayer = null;
  var lastRemoteStream = '';

  function apiBaseUrl() {
    var u = window.FEC_API && window.FEC_API.scriptUrl;
    if (!u || typeof u !== 'string') return '';
    u = u.trim();
    if (!u || u.indexOf('SEU_DEPLOYMENT') !== -1) return '';
    return u.replace(/\?+$/, '');
  }

  function hasRemoteApi() {
    var b = apiBaseUrl();
    return b.indexOf('http') === 0;
  }

  function fetchConfigJsonp(url) {
    return new Promise(function (resolve, reject) {
      var cb = 'fec_jsonp_' + Math.random().toString(36).slice(2);
      var s = document.createElement('script');
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('timeout'));
      }, 20000);
      function cleanup() {
        clearTimeout(timer);
        try {
          delete window[cb];
        } catch (e) {
          window[cb] = undefined;
        }
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      window[cb] = function (data) {
        cleanup();
        resolve(data);
      };
      s.onerror = function () {
        cleanup();
        reject(new Error('jsonp'));
      };
      s.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + encodeURIComponent(cb);
      document.head.appendChild(s);
    });
  }

  function fetchPublicConfig() {
    var base = apiBaseUrl();
    return fetch(base, { cache: 'no-cache', redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('http');
        return r.json();
      })
      .catch(function () {
        return fetchConfigJsonp(base);
      });
  }

  function getStreamUrlFallback() {
    var v = localStorage.getItem(STORAGE_STREAM);
    return v && v.length ? v : 'https://stream.minhafeconectada.com.br/index.m3u8';
  }

  function getProgramacaoUrl() {
    var v = localStorage.getItem(STORAGE_JSON);
    return v && v.length ? v : 'data/programacao.json';
  }

  function setProgramaEl(text) {
    var el = document.getElementById('programa-atual');
    if (el) el.textContent = text || '—';
  }

  function refreshPrograma() {
    if (hasRemoteApi()) {
      return fetchPublicConfig()
        .then(function (data) {
          if (data && data.ok !== false) {
            setProgramaEl(data.programaAtual || data.programa || '—');
            if (data.streamUrl && fecPlayer && data.streamUrl !== lastRemoteStream) {
              lastRemoteStream = data.streamUrl;
              fecPlayer.src({ src: data.streamUrl, type: 'application/x-mpegURL' });
            }
          } else {
            throw new Error('api');
          }
        })
        .catch(function () {
          var local = localStorage.getItem(STORAGE_PROGRAMA_LOCAL);
          setProgramaEl(local || 'Programação indisponível');
        });
    }
    var local = localStorage.getItem(STORAGE_PROGRAMA_LOCAL);
    if (local) {
      setProgramaEl(local);
      return Promise.resolve();
    }
    return fetch(getProgramacaoUrl(), { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (data) {
        setProgramaEl(data.programaAtual || data.programa || '—');
      })
      .catch(function () {
        setProgramaEl('Programação indisponível');
      });
  }

  function setupPictureInPicture(player) {
    var btn = document.getElementById('btn-pip');
    if (!btn) return;
    var videoEl = player.el().querySelector('video');
    if (!videoEl || !document.pictureInPictureEnabled) {
      btn.disabled = true;
      btn.title = 'Picture-in-Picture não disponível neste navegador';
      return;
    }
    btn.addEventListener('click', function () {
      try {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          videoEl.requestPictureInPicture();
        }
      } catch (e) {
        /* ignore */
      }
    });
  }

  function setupInstallPrompt() {
    var btn = document.getElementById('btn-instalar-pwa');
    if (!btn) return;
    var deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.title = 'Instalar como aplicativo';
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      btn.textContent = 'App instalado — obrigado!';
    });

    btn.addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          deferredPrompt = null;
        });
        return;
      }
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        alert(
          'No iPhone ou iPad: toque em Compartilhar e escolha "Adicionar à Tela de Início".'
        );
      } else {
        alert(
          'Use o ícone de instalação na barra do navegador ou o menu do Chrome (Instalar aplicativo).'
        );
      }
    });

    btn.title =
      'Em navegadores compatíveis, use também o menu para “Instalar aplicativo”.';
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js', { scope: './' }).catch(function () {});
      });
    }
  }

  function initPlayer(streamUrl) {
    if (typeof videojs === 'undefined') return;

    lastRemoteStream = streamUrl;
    var isSafari = videojs.browser && videojs.browser.IS_ANY_SAFARI;

    var options = {
      controls: true,
      fluid: true,
      responsive: true,
      preload: 'auto',
      techOrder: ['chromecast', 'html5'],
      html5: {
        vhs: {
          overrideNative: !isSafari,
        },
        nativeAudioTracks: true,
        nativeVideoTracks: true,
      },
      sources: [{ src: streamUrl, type: 'application/x-mpegURL' }],
      chromecast: {
        modifyLoadRequestFn: function (loadRequest) {
          if (loadRequest && loadRequest.media) {
            loadRequest.media.hlsSegmentFormat = 'fmp4';
            loadRequest.media.hlsVideoSegmentFormat = 'fmp4';
          }
          return loadRequest;
        },
        requestTitleFn: function () {
          return 'Fé Conectada';
        },
      },
      plugins: {
        chromecast: {
          addButtonToControlBar: true,
        },
      },
    };

    fecPlayer = videojs('fec-player', options);

    fecPlayer.ready(function () {
      var el = this.el().querySelector('video');
      if (el) {
        el.setAttribute('playsinline', '');
        el.setAttribute('webkit-playsinline', '');
        el.setAttribute('x-webkit-airplay', 'allow');
      }
      setupPictureInPicture(this);
    });
  }

  function switchChannel(url, cardEl) {
    if (!fecPlayer) return;
    fecPlayer.src({ src: url, type: 'application/x-mpegURL' });
    fecPlayer.play();
    var cards = document.querySelectorAll('.canal-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('canal-card--active');
      cards[i].setAttribute('aria-pressed', 'false');
    }
    if (cardEl) {
      cardEl.classList.add('canal-card--active');
      cardEl.setAttribute('aria-pressed', 'true');
    }
    var playerWrap = document.querySelector('.player-wrap');
    if (playerWrap) {
      playerWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderCanais(canais) {
    var lista = document.getElementById('canais-lista');
    if (!lista) return;
    if (!canais || !canais.length) {
      lista.innerHTML = '<p class="canais-loading">Nenhum canal disponível.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < canais.length; i++) {
      var c = canais[i];
      var safeNome = c.nome.replace(/"/g, '&quot;');
      var safeCat = (c.categoria || '').replace(/"/g, '&quot;');
      var safeUrl = c.url.replace(/"/g, '&quot;');
      html +=
        '<button type="button" class="canal-card" data-url="' + safeUrl + '" ' +
        'aria-pressed="false" title="' + safeNome + '">' +
        (c.logo ? '<img class="canal-card__logo" src="' + c.logo.replace(/"/g, '&quot;') + '" alt="" aria-hidden="true">' : '') +
        '<span class="canal-card__nome">' + c.nome + '</span>' +
        (c.categoria ? '<span class="canal-card__cat">' + c.categoria + '</span>' : '') +
        '</button>';
    }
    lista.innerHTML = html;
    var cards = lista.querySelectorAll('.canal-card');
    for (var j = 0; j < cards.length; j++) {
      (function (card) {
        card.addEventListener('click', function () {
          switchChannel(card.getAttribute('data-url'), card);
        });
      })(cards[j]);
    }
  }

  function loadCanais() {
    fetch('data/canais.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('bad status');
        return res.json();
      })
      .then(function (data) {
        renderCanais(data.canais || []);
      })
      .catch(function () {
        var lista = document.getElementById('canais-lista');
        if (lista) lista.innerHTML = '<p class="canais-loading">Não foi possível carregar os canais.</p>';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    registerServiceWorker();
    setupInstallPrompt();
    loadCanais();

    var streamUrl = getStreamUrlFallback();

    var boot = Promise.resolve();
    if (hasRemoteApi()) {
      boot = fetchPublicConfig()
        .then(function (data) {
          if (data && data.ok !== false && data.streamUrl) {
            streamUrl = data.streamUrl;
            localStorage.setItem(STORAGE_STREAM, data.streamUrl);
          }
          if (data && data.programaAtual) {
            setProgramaEl(data.programaAtual);
          }
        })
        .catch(function () {
          setProgramaEl('Carregando…');
        });
    }

    boot.finally(function () {
      initPlayer(streamUrl);
      refreshPrograma();
      setInterval(refreshPrograma, 60000);
    });
  });
})();
