/**
 * Code.gs — Google Apps Script para WebTV JR / Fé Conectada
 *
 * Planilha associada: https://docs.google.com/spreadsheets/d/12O7yJdRg8tgnWRXR6zAWJ_JcZ48M2jsPHFVdhXhNsFE
 *
 * CONFIGURAÇÃO (Propriedades do script):
 *   ADMIN_TOKEN  — frase secreta longa para autenticar o painel admin
 *   SPREADSHEET_ID — ID da planilha (obrigatório apenas no Modo B: projeto independente)
 *                    Valor padrão: 12O7yJdRg8tgnWRXR6zAWJ_JcZ48M2jsPHFVdhXhNsFE
 *
 * USO:
 *   1. Cole este arquivo no editor do Apps Script.
 *   2. Defina ADMIN_TOKEN nas Propriedades do script (⚙ → Propriedades do script).
 *   3. Execute setupSheet() uma vez para criar as abas e preencher os canais.
 *   4. Implante como Web App (Executar como: Eu; Acesso: Qualquer pessoa).
 *   5. Copie a URL /exec para api-config.js no repositório.
 */

var SHEET_CONFIG = 'Config';
var SHEET_CANAIS = 'Canais';
var PROP_ADMIN_TOKEN = 'ADMIN_TOKEN';
var PROP_SPREADSHEET_ID = 'SPREADSHEET_ID';
var DEFAULT_SPREADSHEET_ID = '12O7yJdRg8tgnWRXR6zAWJ_JcZ48M2jsPHFVdhXhNsFE';

// ---------------------------------------------------------------------------
// Helpers de planilha
// ---------------------------------------------------------------------------

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID;
  try {
    // Modo A: script vinculado à planilha
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active !== null && active !== undefined) return active;
  } catch (e) {
    // Modo B: projeto independente — cai para openById abaixo
  }
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet(name) {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

// ---------------------------------------------------------------------------
// Leitura e escrita da aba Config
// ---------------------------------------------------------------------------

function readConfig() {
  var sh = getOrCreateSheet(SHEET_CONFIG);
  var data = sh.getDataRange().getValues();
  var config = { streamUrl: '', programaAtual: '', legenda: '', atualizadoEm: '' };
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var val = String(data[i][1]).trim();
    if (key === 'streamUrl')    config.streamUrl    = val;
    if (key === 'programaAtual') config.programaAtual = val;
    if (key === 'legenda')       config.legenda       = val;
    if (key === 'atualizadoEm')  config.atualizadoEm  = val;
  }
  return config;
}

function writeConfig(streamUrl, programaAtual, legenda) {
  var sh = getOrCreateSheet(SHEET_CONFIG);
  var now = new Date().toISOString();
  var data = sh.getDataRange().getValues();
  var rowIndex = { streamUrl: -1, programaAtual: -1, legenda: -1, atualizadoEm: -1 };

  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0]).trim();
    // Only record the first occurrence of each key; ignore duplicates
    if (rowIndex[k] !== undefined && rowIndex[k] === -1) rowIndex[k] = i + 1; // 1-indexed
  }

  function upsert(key, value) {
    if (rowIndex[key] > 0) {
      sh.getRange(rowIndex[key], 2).setValue(value);
    } else {
      sh.appendRow([key, value]);
    }
  }

  upsert('streamUrl',    streamUrl);
  upsert('programaAtual', programaAtual);
  upsert('legenda',       legenda !== undefined ? legenda : '');
  upsert('atualizadoEm',  now);
  SpreadsheetApp.flush();
}

// ---------------------------------------------------------------------------
// Leitura da aba Canais
// ---------------------------------------------------------------------------

function readCanais() {
  var sh = getOrCreateSheet(SHEET_CANAIS);
  var data = sh.getDataRange().getValues();
  var canais = [];
  for (var i = 1; i < data.length; i++) {
    var nome = String(data[i][0] || '').trim();
    if (!nome) continue;
    canais.push({
      nome:      nome,
      url:       String(data[i][1] || '').trim(),
      categoria: String(data[i][2] || '').trim(),
      logo:      String(data[i][3] || '').trim()
    });
  }
  return canais;
}

// ---------------------------------------------------------------------------
// Web App — GET
// ---------------------------------------------------------------------------

function doGet(e) {
  var config = readConfig();
  var canais = readCanais();

  var output = {
    ok:           true,
    streamUrl:    config.streamUrl,
    programaAtual: config.programaAtual,
    legenda:      config.legenda,
    atualizadoEm: config.atualizadoEm,
    canais:       canais
  };

  var jsonStr = JSON.stringify(output);

  // Suporte a JSONP como fallback de CORS (conforme script.js do front-end).
  // O callback é validado por regex para aceitar apenas identificadores JS válidos,
  // mitigando injeção de código arbitrário na resposta.
  var cb = e && e.parameter && e.parameter.callback;
  if (cb && /^[a-zA-Z_$][a-zA-Z0-9_$.]{0,100}$/.test(cb)) {
    return ContentService
      .createTextOutput(cb + '(' + jsonStr + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Web App — POST
// ---------------------------------------------------------------------------

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var adminToken = props.getProperty(PROP_ADMIN_TOKEN) || '';

  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResp({ ok: false, error: 'JSON inválido' });
  }

  if (!adminToken) {
    return jsonResp({ ok: false, error: 'ADMIN_TOKEN não configurado nas propriedades do script.' });
  }
  if (!body.token || body.token !== adminToken) {
    return jsonResp({ ok: false, error: 'Token inválido.' });
  }

  var streamUrl    = String(body.streamUrl    || '').trim();
  var programaAtual = String(body.programaAtual || '').trim();
  var legenda       = String(body.legenda       || '').trim();

  writeConfig(streamUrl, programaAtual, legenda);

  return jsonResp({ ok: true, streamUrl: streamUrl, programaAtual: programaAtual, legenda: legenda });
}

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// setupSheet — execute uma vez para inicializar a planilha
// ---------------------------------------------------------------------------

function setupSheet() {
  var ss = getSpreadsheet();

  // ---- Aba Config ----
  var configSh = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);
  configSh.clearContents();
  configSh.getRange(1, 1, 1, 3).setValues([['Chave', 'Valor', 'Descrição']]);
  configSh.getRange(2, 1, 4, 3).setValues([
    ['streamUrl',    'index.m3u8',                   'URL do stream HLS (.m3u8) exibido no player principal'],
    ['programaAtual', 'Fé Conectada — ao vivo',       'Nome do programa exibido na tela para os visitantes'],
    ['legenda',       '',                              'Texto de legenda/aviso exibido sobre o player (deixe vazio para ocultar)'],
    ['atualizadoEm', new Date().toISOString(),         'Data/hora da última atualização (preenchido automaticamente)']
  ]);
  configSh.setFrozenRows(1);
  configSh.autoResizeColumns(1, 3);

  // ---- Aba Canais ----
  var canaisSh = ss.getSheetByName(SHEET_CANAIS) || ss.insertSheet(SHEET_CANAIS);
  canaisSh.clearContents();
  canaisSh.getRange(1, 1, 1, 4).setValues([['Nome', 'URL (M3U8)', 'Categoria', 'Logo (URL)']]);

  var canais = [
    // Canais católicos — programação geral
    ['TV Aparecida',      'https://cdn.jmvstream.com/w/LVW-9716/LVW9716_HbtQtezcaw/playlist.m3u8',                             'Católico',      ''],
    ['TV Canção Nova',    'https://5c65286fc6ace.streamlock.net/cancaonova/CancaoNova.stream_720p/playlist.m3u8',                'Católico',      ''],
    ['TV Evangelizar',    'https://5f593df7851db.streamlock.net/evangelizar/tv/playlist.m3u8',                                  'Católico',      ''],
    ['TV Pai Eterno',     'https://stmv1.srvstm.com/tvpaieterno/tvpaieterno/playlist.m3u8',                                     'Católico',      ''],
    ['Rede Vida',         'https://livestreamcdn.net:4443/redevida/redevida.sdp/playlist.m3u8',                                 'Católico',      ''],
    ['Rede Século 21',    'https://video01.logicahost.com.br/rs21/rs21/playlist.m3u8',                                          'Católico',      ''],
    ['TV Padre Cícero',   'https://video01.logicahost.com.br/tvpadrecicero/tvpadrecicero/playlist.m3u8',                        'Católico',      ''],
    ['Santa Cecília TV',  'https://5fb29de4928ea.streamlock.net/2063/2063/playlist.m3u8',                                       'Católico',      ''],
    ['Kuriakos Cine',     'https://w2.manasat.com/kcine/smil:kcine.smil/playlist.m3u8',                                        'Católico',      ''],
    // Canais católicos — kids / desenhos infantis
    ['Kuriakos Kids',     'https://w2.manasat.com/kkids/smil:kkids.smil/playlist.m3u8',                                        'Católico Kids', '']
  ];

  canaisSh.getRange(2, 1, canais.length, 4).setValues(canais);
  canaisSh.setFrozenRows(1);
  canaisSh.autoResizeColumns(1, 4);

  SpreadsheetApp.flush();
  Logger.log('✅ Planilha configurada com sucesso! Abas criadas: ' + SHEET_CONFIG + ', ' + SHEET_CANAIS);
}
