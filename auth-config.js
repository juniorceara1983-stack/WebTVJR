(function () {
  function d(b) {
    try {
      return atob(b);
    } catch (e) {
      return '';
    }
  }
  window.FEC_SITE = {
    adminQuery: { k: d('d2VidHZ0'), v: d('V2ViVHYyMDI2') },
    adminPassword: d('d2VidHYyMDI2'),
    storageTrust: 'fec_trust_adm',
    storageSession: 'fec_sess_adm',
  };
})();
