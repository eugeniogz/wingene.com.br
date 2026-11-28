/**
 * Módulo de Integração com Google Drive API v3 (Google Identity Services)
 * Permite sincronização bidirecional particionada por ano ('diario_sync_YYYY.json')
 * com retrocompatibilidade total com 'diario_sync_master.json' e legado na pasta 'appDataFolder'.
 */

const GoogleDriveService = {
  CLIENT_ID: '97862926817-cfc6qmu5fm8e3pqtou7ra7c7pl394mb6.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.appdata email profile',
  MASTER_FILENAME: 'diario_sync_master.json',
  TIMESTAMP_FILENAME: 'sync_timestamp.txt',
  VALIDATION_FILENAME: 'validar.hash',
  PROPOSITOS_FILENAME: 'propositos_backup.json',
  SHARD_REGEX: /^diario_sync_(\d{4})\.json$/,

  STORAGE_KEYS: {
    CLIENT_ID: 'wingene_vida_drive_client_id',
    TOKEN: 'wingene_vida_drive_token',
    TOKEN_EXP: 'wingene_vida_drive_token_exp',
    EMAIL: 'wingene_vida_drive_email',
    LAST_EMAIL: 'wingene_vida_last_drive_email',
    CUSTOM_PASS: 'wingene_vida_drive_custom_pass',
    LAST_SYNC: 'wingene_vida_last_drive_sync',
    LAST_REMOTE_CHANGE: 'wingene_vida_last_remote_change',
    FILE_HASHES: 'wingene_vida_drive_file_hashes',
    VALIDATED_HASH_MD5: 'wingene_vida_validated_hash_md5',
    VALIDATED_PASS_HASH: 'wingene_vida_validated_pass_hash',
    DIRTY_SYNC_YEARS: 'wingene_vida_dirty_sync_years',
    passKey: (email) => `wingene_vida_drive_pass_${email ? email.trim().toLowerCase() : ''}`
  },

  tokenClient: null,
  accessToken: null,
  tokenExpiresAt: 0,
  userEmail: null,

  // ─── Helpers de Particionamento, Compactação e Cache de Hashes ─────────────

  extractRecordYear(dateStr) {
    if (!dateStr) return '0000';
    const trimmed = String(dateStr).trim();
    const match = /^(\d{4})/.exec(trimmed);
    if (match) return match[1];
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return String(d.getFullYear()).padStart(4, '0');
    }
    return '0000';
  },

  isYearShardFilename(name) {
    return typeof name === 'string' && this.SHARD_REGEX.test(name);
  },

  extractYearFromShardFilename(name) {
    if (typeof name !== 'string') return null;
    const m = this.SHARD_REGEX.exec(name);
    return m ? m[1] : null;
  },

  shardFilenameForYear(year) {
    return `diario_sync_${year}.json`;
  },

  // JSON compacto retrocompatível com Registro.fromMap e DBService.normalizeRecord
  compactRecordForSync(rec) {
    const data = rec.data || new Date().toISOString();
    const lastModified =
      rec.lastModified && String(rec.lastModified).trim() !== ''
        ? rec.lastModified
        : data;
    const map = {
      uuid: rec.uuid,
      conteudo: rec.conteudo || '',
      data: data,
      lastModified: lastModified,
      sincronizado: 1
    };

    if (rec.pilar && String(rec.pilar).trim() !== '') map.pilar = rec.pilar;
    if (rec.categoria && String(rec.categoria).trim() !== '') map.categoria = rec.categoria;
    if (typeof rec.impacto === 'number' && rec.impacto !== 0) map.impacto = rec.impacto;
    if (rec.impactos && String(rec.impactos).trim() !== '') map.impactos = rec.impactos;
    if (rec.observacao && String(rec.observacao).trim() !== '') map.observacao = rec.observacao;
    if (rec.tags && String(rec.tags).trim() !== '') map.tags = rec.tags;
    if (rec.comentarioVida && String(rec.comentarioVida).trim() !== '') map.comentarioVida = rec.comentarioVida;
    if (rec.palavraChave && String(rec.palavraChave).trim() !== '') map.palavraChave = rec.palavraChave;
    if (typeof rec.versao === 'number' && rec.versao !== 1) map.versao = rec.versao;
    if (typeof rec.deletado === 'number' && rec.deletado !== 0) map.deletado = rec.deletado;

    const insightId = rec.insight_id !== undefined ? rec.insight_id : rec.insightId;
    if (insightId !== null && insightId !== undefined) map.insight_id = insightId;

    const propUuid = rec.proposito_uuid || rec.propositoUuid;
    if (propUuid && String(propUuid).trim() !== '') map.proposito_uuid = propUuid;

    if (typeof rec.propositoAvaliado === 'number' && rec.propositoAvaliado !== 0) {
      map.propositoAvaliado = rec.propositoAvaliado;
    }
    if (rec.origem && String(rec.origem).trim() !== '') map.origem = rec.origem;
    return map;
  },

  hasRemoteFileChanged(remoteFile, cachedEntry) {
    if (!remoteFile || !remoteFile.id) return false;
    if (!cachedEntry) return true;
    if (remoteFile.md5Checksum && cachedEntry.md5) {
      return remoteFile.md5Checksum !== cachedEntry.md5;
    }
    if (cachedEntry.id !== remoteFile.id) return true;
    if (!remoteFile.modifiedTime || !cachedEntry.modifiedTime) return true;
    const remoteMs = new Date(remoteFile.modifiedTime).getTime();
    const cachedMs = new Date(cachedEntry.modifiedTime).getTime();
    if (Number.isNaN(remoteMs) || Number.isNaN(cachedMs)) return true;
    return remoteMs > cachedMs + 2000;
  },

  fileToCacheEntry(file) {
    if (!file) return null;
    const entry = {};
    if (file.id) entry.id = file.id;
    if (file.md5Checksum) entry.md5 = file.md5Checksum;
    if (file.modifiedTime) entry.modifiedTime = file.modifiedTime;
    return entry;
  },

  async hashPasswordFingerprint(password) {
    const data = new TextEncoder().encode(password || '');
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },

  computeBackoffDelayMs(attempt, maxBackoffMs = 32000, randFn = Math.random) {
    const exp = Math.max(0, Math.min(attempt, 10));
    const baseMs = (1 << exp) * 1000;
    const jitterMs = Math.floor(randFn() * 1000);
    return Math.min(baseMs + jitterMs, maxBackoffMs);
  },

  isRateLimitResponse(status, bodyText = '') {
    if (status === 429) return true;
    if (status === 403) {
      const lower = String(bodyText || '').toLowerCase();
      return (
        lower.includes('ratelimitexceeded') ||
        lower.includes('userratelimitexceeded') ||
        lower.includes('sharingratelimitexceeded') ||
        lower.includes('too many requests') ||
        lower.includes('quota exceeded for quota metric')
      );
    }
    return false;
  },

  isTransientServerStatus(status) {
    return status === 500 || status === 502 || status === 503 || status === 504;
  },

  async fetchWithBackoff(url, options = {}, maxRetries = 4) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, options);
      if (res.ok) return res;

      const isTransient = this.isTransientServerStatus(res.status);
      let isRateLimit = res.status === 429;
      if (!isRateLimit && res.status === 403) {
        const clonedText = await res.clone().text().catch(() => '');
        isRateLimit = this.isRateLimitResponse(res.status, clonedText);
      }

      if ((isRateLimit || isTransient) && attempt < maxRetries) {
        let delayMs = this.computeBackoffDelayMs(attempt);
        const retryAfter = res.headers && res.headers.get ? res.headers.get('Retry-After') : null;
        if (retryAfter && /^\d+$/.test(retryAfter.trim())) {
          const headerMs = Number(retryAfter.trim()) * 1000;
          if (headerMs > 0) delayMs = Math.min(headerMs, 32000);
        }
        console.warn(`[Drive] Rate-limit/erro ${res.status} (tentativa ${attempt + 1}). Aguardando ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return res;
    }
  },

  // Lê apenas metadados de um arquivo pelo fileId (5 unidades de cota)
  async getFileMetadataById(fileId, token = null) {
    if (!fileId) return null;
    const activeToken = token || (await this.requestToken());
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime,md5Checksum,size,trashed`;
    const res = await this.fetchWithBackoff(url, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      if (res.status === 401) {
        this.signOut();
        const authErr = new Error('Sessão expirada no Google Drive. Por favor reconecte.');
        authErr.status = 401;
        throw authErr;
      }
      const errData = await res.json().catch(() => null);
      const err = new Error(`Erro ao consultar metadados do arquivo (${fileId}): ${errData?.error?.message || res.status}`);
      err.status = res.status;
      throw err;
    }
    const meta = await res.json();
    if (!meta || meta.trashed) return null;
    return meta;
  },

  getFileHashCache() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.FILE_HASHES);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  },

  saveFileHashCache(cache) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.FILE_HASHES, JSON.stringify(cache || {}));
    } catch (_) {}
  },

  getDirtySyncYears() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.DIRTY_SYNC_YEARS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  },

  addDirtySyncYear(year) {
    if (!year) return;
    const current = new Set(this.getDirtySyncYears());
    current.add(String(year));
    try {
      localStorage.setItem(this.STORAGE_KEYS.DIRTY_SYNC_YEARS, JSON.stringify(Array.from(current)));
    } catch (_) {}
  },

  clearDirtySyncYears(uploadedYears = null) {
    try {
      if (!uploadedYears) {
        localStorage.removeItem(this.STORAGE_KEYS.DIRTY_SYNC_YEARS);
        return;
      }
      const uploadedSet = new Set(uploadedYears);
      const remaining = this.getDirtySyncYears().filter((y) => !uploadedSet.has(y));
      if (remaining.length === 0) {
        localStorage.removeItem(this.STORAGE_KEYS.DIRTY_SYNC_YEARS);
      } else {
        localStorage.setItem(this.STORAGE_KEYS.DIRTY_SYNC_YEARS, JSON.stringify(remaining));
      }
    } catch (_) {}
  },

  clearSyncCache() {
    localStorage.removeItem(this.STORAGE_KEYS.FILE_HASHES);
    localStorage.removeItem(this.STORAGE_KEYS.VALIDATED_HASH_MD5);
    localStorage.removeItem(this.STORAGE_KEYS.VALIDATED_PASS_HASH);
    localStorage.removeItem(this.STORAGE_KEYS.DIRTY_SYNC_YEARS);
    localStorage.removeItem(this.STORAGE_KEYS.LAST_REMOTE_CHANGE);
    localStorage.removeItem('wingene_last_remote_change');
  },

  buildSnapshot(allFiles) {
    const sorted = [...(allFiles || [])].sort(
      (a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0)
    );
    let masterFile = null;
    let validationFile = null;
    let timestampFile = null;
    let propositosFile = null;
    const shardFiles = new Map();
    const legacyFiles = [];
    const duplicates = [];

    for (const f of sorted) {
      const name = f.name || '';
      if (name === this.MASTER_FILENAME) {
        if (!masterFile) masterFile = f;
        else duplicates.push(f);
      } else if (name === this.VALIDATION_FILENAME) {
        if (!validationFile) validationFile = f;
        else duplicates.push(f);
      } else if (name === this.TIMESTAMP_FILENAME) {
        if (!timestampFile) timestampFile = f;
        else duplicates.push(f);
      } else if (name === this.PROPOSITOS_FILENAME) {
        if (!propositosFile) propositosFile = f;
        else duplicates.push(f);
      } else {
        const year = this.extractYearFromShardFilename(name);
        if (year !== null) {
          if (!shardFiles.has(year)) shardFiles.set(year, f);
          else duplicates.push(f);
        } else if (name.startsWith('registro_') && name.endsWith('.json')) {
          legacyFiles.push(f);
        }
      }
    }

    let latestShardMs = 0;
    shardFiles.forEach((f) => {
      if (f.modifiedTime) {
        const ms = new Date(f.modifiedTime).getTime();
        if (!Number.isNaN(ms) && ms > latestShardMs) latestShardMs = ms;
      }
    });

    return {
      allFiles: sorted,
      masterFile,
      shardFiles,
      legacyFiles,
      validationFile,
      timestampFile,
      propositosFile,
      duplicates,
      latestShardMs
    };
  },

  // ─── Autenticação & Sessão Google Identity Services ────────────────────────

  isLinked() {
    return !!(this.userEmail || localStorage.getItem(this.STORAGE_KEYS.EMAIL) || localStorage.getItem('wingene_drive_email'));
  },

  init() {
    return new Promise((resolve) => {
      try {
        const legacyAmbiguousClientId = localStorage.getItem('wingene_drive_client_id');
        if (legacyAmbiguousClientId) {
          localStorage.removeItem('wingene_drive_client_id');
        }
      } catch (_) {}

      if (!localStorage.getItem(this.STORAGE_KEYS.TOKEN)) {
        const legToken = localStorage.getItem('wingene_drive_token');
        const legExp = localStorage.getItem('wingene_drive_token_exp');
        const legEmail = localStorage.getItem('wingene_drive_email');
        if (legToken) localStorage.setItem(this.STORAGE_KEYS.TOKEN, legToken);
        if (legExp) localStorage.setItem(this.STORAGE_KEYS.TOKEN_EXP, legExp);
        if (legEmail) localStorage.setItem(this.STORAGE_KEYS.EMAIL, legEmail);
      }

      const savedClientId = localStorage.getItem(this.STORAGE_KEYS.CLIENT_ID);
      if (savedClientId !== this.CLIENT_ID) {
        localStorage.removeItem(this.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXP);
        localStorage.removeItem(this.STORAGE_KEYS.EMAIL);
        localStorage.setItem(this.STORAGE_KEYS.CLIENT_ID, this.CLIENT_ID);
      }

      const savedToken = localStorage.getItem(this.STORAGE_KEYS.TOKEN) || localStorage.getItem('wingene_drive_token');
      const savedExp = localStorage.getItem(this.STORAGE_KEYS.TOKEN_EXP) || localStorage.getItem('wingene_drive_token_exp');
      const savedEmail = localStorage.getItem(this.STORAGE_KEYS.EMAIL) || localStorage.getItem('wingene_drive_email');

      if (savedToken && savedExp && Number(savedExp) > Date.now()) {
        this.accessToken = savedToken;
        this.tokenExpiresAt = Number(savedExp);
        this.userEmail = savedEmail;
      } else if (savedEmail) {
        this.userEmail = savedEmail;
      }

      const checkGsiInterval = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          clearInterval(checkGsiInterval);
          try {
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: this.CLIENT_ID,
              scope: this.SCOPES,
              callback: async (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                  this.accessToken = tokenResponse.access_token;
                  this.tokenExpiresAt = Date.now() + (Number(tokenResponse.expires_in || 3600) - 60) * 1000;
                  localStorage.setItem(this.STORAGE_KEYS.TOKEN, this.accessToken);
                  localStorage.setItem(this.STORAGE_KEYS.TOKEN_EXP, String(this.tokenExpiresAt));

                  await this.fetchUserEmail();
                  window.dispatchEvent(new CustomEvent('drive-auth-success'));
                }
              },
              error_callback: (err) => {
                console.warn('Erro na autenticação GIS Google:', err);
                window.dispatchEvent(new CustomEvent('drive-auth-error', { detail: err }));
              }
            });
            resolve(true);
          } catch (e) {
            console.error('Falha ao inicializar token client GIS:', e);
            resolve(false);
          }
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkGsiInterval);
        resolve(false);
      }, 5000);
    });
  },

  isConnected() {
    return !!this.accessToken && Date.now() < this.tokenExpiresAt;
  },

  async fetchUserEmail() {
    if (!this.accessToken) return null;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.userEmail = data.email || null;
        if (this.userEmail) {
          localStorage.setItem(this.STORAGE_KEYS.EMAIL, this.userEmail);
        }
        return this.userEmail;
      }
    } catch (e) {
      console.warn('Não foi possível obter email do perfil:', e);
    }
    return null;
  },

  needsAccountSelect: false,

  requestToken(options = {}) {
    return new Promise((resolve, reject) => {
      if (this.isConnected() && !options.forceSelect) {
        resolve(this.accessToken);
        return;
      }

      if (!this.tokenClient) {
        reject(new Error('Google Identity Services não carregado. Verifique sua conexão.'));
        return;
      }

      const successHandler = () => {
        window.removeEventListener('drive-auth-success', successHandler);
        window.removeEventListener('drive-auth-error', errorHandler);
        resolve(this.accessToken);
      };

      const errorHandler = (evt) => {
        window.removeEventListener('drive-auth-success', successHandler);
        window.removeEventListener('drive-auth-error', errorHandler);
        reject(new Error(evt.detail?.message || 'Falha ao autenticar com o Google Drive.'));
      };

      window.addEventListener('drive-auth-success', successHandler);
      window.addEventListener('drive-auth-error', errorHandler);

      const promptOption = (options.forceSelect || this.needsAccountSelect) ? 'select_account' : '';
      this.needsAccountSelect = false;

      const emailHint = this.userEmail || localStorage.getItem(this.STORAGE_KEYS.EMAIL) || localStorage.getItem('wingene_drive_email') || undefined;
      const requestConfig = { prompt: promptOption };
      if (promptOption !== 'select_account' && emailHint) {
        requestConfig.hint = emailHint;
      }
      this.tokenClient.requestAccessToken(requestConfig);
    });
  },

  signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch (_) {}
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.userEmail = null;
    this.needsAccountSelect = true;
    localStorage.removeItem(this.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXP);
    localStorage.removeItem(this.STORAGE_KEYS.EMAIL);
    localStorage.removeItem(this.STORAGE_KEYS.LAST_EMAIL);
    localStorage.removeItem(this.STORAGE_KEYS.CUSTOM_PASS);
    sessionStorage.removeItem(this.STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXP);
    sessionStorage.removeItem(this.STORAGE_KEYS.EMAIL);
    sessionStorage.removeItem(this.STORAGE_KEYS.CUSTOM_PASS);
    localStorage.removeItem('wingene_drive_token');
    localStorage.removeItem('wingene_drive_token_exp');
    localStorage.removeItem('wingene_drive_email');
    localStorage.removeItem('wingene_last_drive_email');
    localStorage.removeItem('wingene_drive_custom_pass');
    sessionStorage.removeItem('wingene_drive_token');
    sessionStorage.removeItem('wingene_drive_token_exp');
    sessionStorage.removeItem('wingene_drive_email');
    sessionStorage.removeItem('wingene_drive_custom_pass');
    this.clearSyncCache();
  },

  async switchAccount() {
    this.signOut();
    await this.requestToken({ forceSelect: true });
    await this.fetchUserEmail();
    return this.userEmail;
  },

  lastValidationAudit: null,

  // Lista todos os arquivos na pasta privada appDataFolder (com paginação e md5Checksum)
  async listAllAppDataFiles() {
    const token = await this.requestToken();
    const query = encodeURIComponent(`trashed = false and 'appDataFolder' in parents`);
    const files = [];
    let pageToken = null;

    do {
      let url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&orderBy=modifiedTime%20desc&fields=nextPageToken,files(id,name,modifiedTime,md5Checksum,size)&pageSize=1000`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await this.fetchWithBackoff(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const detail = errData?.error?.message || `HTTP ${res.status}`;
        if (res.status === 401) {
          this.signOut();
          throw new Error('Sessão expirada no Google Drive. Por favor reconecte.');
        }
        if (res.status === 403 && detail.toLowerCase().includes('drive.googleapis.com')) {
          throw new Error('A Google Drive API não está ativada no projeto Google Cloud. Ative a Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=wingene-vida-24a89');
        }
        throw new Error(`Erro ao listar arquivos do Drive: ${detail}`);
      }

      const data = await res.json();
      if (Array.isArray(data.files)) {
        files.push(...data.files);
      }
      pageToken = data.nextPageToken || null;
    } while (pageToken);

    files.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
    return files;
  },

  // Valida a senha contra validar.hash (com cache MD5 + SHA-256) ou fallback
  async validatePasswordWithHash(password, validationFile = null, allFilesInput = null, bypassCache = false) {
    if (!password || password.trim() === '') return false;

    const audit = {
      timestamp: new Date().toISOString(),
      accountEmail: this.userEmail,
      filesFound: [],
      hashAttempts: [],
      masterAttempts: [],
      legacyAttempts: [],
      result: false
    };

    let allFiles = Array.isArray(allFilesInput) ? allFilesInput : [];
    let validationFiles = validationFile ? [validationFile] : [];
    let shardFiles = [];
    let masterFiles = [];
    let legacyFiles = [];

    if (!validationFile && allFiles.length === 0) {
      try {
        allFiles = await this.listAllAppDataFiles();
      } catch (e) {
        console.warn('[Drive] Erro ao listar arquivos na appDataFolder:', e);
        audit.listError = e.message || String(e);
      }
    }

    if (allFiles.length > 0) {
      audit.filesFound = allFiles.map((f) => ({
        name: f.name,
        id: f.id,
        size: f.size,
        modifiedTime: f.modifiedTime
      }));
      if (validationFiles.length === 0) {
        validationFiles = allFiles.filter((f) => f.name === this.VALIDATION_FILENAME);
      }
      shardFiles = allFiles.filter((f) => this.isYearShardFilename(f.name));
      masterFiles = allFiles.filter((f) => f.name === this.MASTER_FILENAME);
      legacyFiles = allFiles.filter((f) => f.name && f.name.startsWith('registro_') && f.name.endsWith('.json'));
    }

    // Cache de validação por MD5 de validar.hash + SHA-256 da senha
    const passHash = await this.hashPasswordFingerprint(password);
    if (!bypassCache && validationFiles.length > 0 && validationFiles[0].md5Checksum) {
      const cachedMd5 = localStorage.getItem(this.STORAGE_KEYS.VALIDATED_HASH_MD5);
      const cachedPass = localStorage.getItem(this.STORAGE_KEYS.VALIDATED_PASS_HASH);
      if (cachedMd5 && cachedMd5 === validationFiles[0].md5Checksum && cachedPass === passHash) {
        audit.hashAttempts.push({ fileId: validationFiles[0].id, success: true, cached: true });
        audit.result = true;
        this.lastValidationAudit = audit;
        return true;
      }
    }

    const token = await this.requestToken().catch(() => null);

    // 1. Tenta validar com validar.hash
    for (const vFile of validationFiles) {
      if (!token) break;
      try {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${vFile.id}?alt=media`;
        const res = await this.fetchWithBackoff(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          if (uint8.length > 16) {
            const iv = uint8.subarray(0, 16);
            const cipher = uint8.subarray(16);

            const encoder = new TextEncoder();
            const paddedPassword = CryptoService.padKey(password);
            const key = await window.crypto.subtle.importKey(
              'raw',
              encoder.encode(paddedPassword),
              { name: 'AES-CTR' },
              false,
              ['decrypt']
            );

            const decryptedBuffer = await window.crypto.subtle.decrypt(
              { name: 'AES-CTR', counter: iv, length: 128 },
              key,
              cipher
            );

            const unpadded = CryptoService.removePkcs7Padding(new Uint8Array(decryptedBuffer));
            const str = new TextDecoder().decode(unpadded);
            if (str === 'WINGENE_VIDA_VALIDATION') {
              console.log(`[Drive] Senha confirmada com sucesso via validar.hash (${vFile.id})!`);
              if (vFile.md5Checksum) {
                localStorage.setItem(this.STORAGE_KEYS.VALIDATED_HASH_MD5, vFile.md5Checksum);
                localStorage.setItem(this.STORAGE_KEYS.VALIDATED_PASS_HASH, passHash);
              }
              audit.hashAttempts.push({ fileId: vFile.id, success: true, text: str });
              audit.result = true;
              this.lastValidationAudit = audit;
              return true;
            } else {
              audit.hashAttempts.push({ fileId: vFile.id, success: false, decryptedText: str.slice(0, 30) });
            }
          } else {
            audit.hashAttempts.push({ fileId: vFile.id, success: false, error: 'Arquivo menor que 16 bytes' });
          }
        } else {
          audit.hashAttempts.push({ fileId: vFile.id, success: false, httpStatus: res.status });
        }
      } catch (err) {
        audit.hashAttempts.push({ fileId: vFile.id, success: false, error: err.message || String(err) });
      }
    }

    // 2. Fallback: testa contra shards ou diario_sync_master.json
    const dataCandidates = [...shardFiles, ...masterFiles];
    for (const mFile of dataCandidates) {
      if (!token) break;
      console.log(`[Drive] Testando senha diretamente contra ${mFile.name} (${mFile.id})...`);
      try {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${mFile.id}?alt=media`;
        const res = await this.fetchWithBackoff(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const parsed = await CryptoService.decryptDartFormat(ab, password);
          if (parsed && (Array.isArray(parsed) || parsed.registros || typeof parsed === 'object')) {
            console.log(`[Drive] ${mFile.name} (${mFile.id}) descriptografado com sucesso!`);
            audit.masterAttempts.push({ fileId: mFile.id, success: true, recordCount: Array.isArray(parsed) ? parsed.length : (parsed.registros?.length || 'obj') });
            this.createOrUpdateValidationFile(password, validationFiles[0] || null, validationFiles.length === 0)
              .catch((e) => console.warn('[Drive] Falha ao recriar validar.hash:', e));
            audit.result = true;
            this.lastValidationAudit = audit;
            return true;
          }
        }
      } catch (masterErr) {
        console.warn(`[Drive] Teste no ${mFile.name} (${mFile.id}) falhou:`, masterErr.message || masterErr);
        audit.masterAttempts.push({ fileId: mFile.id, success: false, error: masterErr.message || String(masterErr) });
      }
    }

    // 3. Fallback legado
    if (dataCandidates.length === 0 && legacyFiles.length > 0 && token) {
      const sampleLegacy = legacyFiles[0];
      try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${sampleLegacy.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const parsed = await CryptoService.decryptDartFormat(ab, password);
          if (parsed && (parsed.uuid || parsed.conteudo)) {
            console.log(`[Drive] Arquivo legado (${sampleLegacy.name}) descriptografado com sucesso!`);
            audit.legacyAttempts.push({ fileId: sampleLegacy.id, success: true });
            this.createOrUpdateValidationFile(password, null, true).catch(() => {});
            audit.result = true;
            this.lastValidationAudit = audit;
            return true;
          }
        }
      } catch (legErr) {
        audit.legacyAttempts.push({ fileId: sampleLegacy.id, success: false, error: legErr.message || String(legErr) });
      }
    }

    // 4. Conta sem arquivos relevantes
    if (validationFiles.length === 0 && shardFiles.length === 0 && masterFiles.length === 0 && legacyFiles.length === 0) {
      console.log('[Drive] Nenhum arquivo de dados ou validação encontrado nesta conta.');
      audit.result = true;
      audit.isNewAccount = true;
      this.lastValidationAudit = audit;
      return true;
    }

    if (audit.result === true) {
      this.lastValidationAudit = audit;
      return true;
    }

    audit.result = false;
    this.lastValidationAudit = audit;
    return false;
  },

  // Limpa todos os arquivos da pasta appDataFolder desta conta (Reset total da nuvem)
  async clearAppDataFolder() {
    const token = await this.requestToken();
    const allFiles = await this.listAllAppDataFiles();
    console.log(`[Drive] Limpando ${allFiles.length} arquivos da pasta privada appDataFolder...`);
    for (const f of allFiles) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`[Drive] Arquivo removido: ${f.name} (${f.id})`);
      } catch (e) {
        console.warn(`[Drive] Falha ao remover ${f.name}:`, e);
      }
    }
    this.clearSyncCache();
    return true;
  },

  // Cria ou atualiza o validar.hash sem listagem extra quando existingFile/knownMissing é informado
  async createOrUpdateValidationFile(password, existingFile = null, knownMissing = false) {
    if (!password) return null;
    try {
      const token = await this.requestToken();
      let targetFile = existingFile;
      if (!targetFile && !knownMissing) {
        const allFiles = await this.listAllAppDataFiles();
        targetFile = allFiles.find((f) => f.name === this.VALIDATION_FILENAME) || null;
      }

      const contentBytes = new TextEncoder().encode('WINGENE_VIDA_VALIDATION');
      const paddedBytes = CryptoService.addPkcs7Padding(contentBytes);
      const paddedPassword = CryptoService.padKey(password);
      const encoder = new TextEncoder();

      const key = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(paddedPassword),
        { name: 'AES-CTR' },
        false,
        ['encrypt']
      );

      const iv = new Uint8Array(16);
      window.crypto.getRandomValues(iv);

      const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: iv, length: 128 },
        key,
        paddedBytes
      );

      const finalBytes = new Uint8Array(16 + cipherBuffer.byteLength);
      finalBytes.set(iv, 0);
      finalBytes.set(new Uint8Array(cipherBuffer), 16);

      let resultMeta = null;
      if (targetFile && targetFile.id) {
        const res = await this.fetchWithBackoff(
          `https://www.googleapis.com/upload/drive/v3/files/${targetFile.id}?uploadType=media&fields=id,name,modifiedTime,md5Checksum,size`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/octet-stream'
            },
            body: finalBytes
          }
        );
        if (res.ok) {
          resultMeta = await res.json().catch(() => null);
        } else {
          console.warn('Erro ao atualizar validar.hash (PATCH):', res.status, await res.text().catch(() => ''));
        }
      } else {
        const boundary = '-------validar_hash_' + Math.random().toString(36).substring(2);
        const metadata = JSON.stringify({
          name: this.VALIDATION_FILENAME,
          parents: ['appDataFolder']
        });
        const p1 = encoder.encode(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
        );
        const p3 = encoder.encode(`\r\n--${boundary}--`);

        const combined = new Uint8Array(p1.length + finalBytes.length + p3.length);
        combined.set(p1, 0);
        combined.set(finalBytes, p1.length);
        combined.set(p3, p1.length + finalBytes.length);

        const res = await this.fetchWithBackoff(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,md5Checksum,size',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: combined
          }
        );
        if (res.ok) {
          resultMeta = await res.json().catch(() => null);
        } else {
          console.warn('Erro ao criar validar.hash (POST):', res.status, await res.text().catch(() => ''));
        }
      }

      if (resultMeta && resultMeta.md5Checksum) {
        localStorage.setItem(this.STORAGE_KEYS.VALIDATED_HASH_MD5, resultMeta.md5Checksum);
        localStorage.setItem(this.STORAGE_KEYS.VALIDATED_PASS_HASH, await this.hashPasswordFingerprint(password));
      }
      return resultMeta;
    } catch (e) {
      console.warn('Não foi possível gravar validar.hash:', e);
      return null;
    }
  },

  extractRecordList(rawData) {
    if (Array.isArray(rawData)) {
      return rawData;
    }
    if (rawData && rawData.registros && Array.isArray(rawData.registros)) {
      return rawData.registros;
    }
    if (rawData && typeof rawData === 'object') {
      const values = Object.values(rawData);
      if (values.length > 0 && values.some((v) => v && typeof v === 'object' && (v.conteudo !== undefined || v.uuid !== undefined || v.pilar !== undefined))) {
        return values.filter((v) => v && typeof v === 'object' && (v.conteudo !== undefined || v.uuid !== undefined));
      }
    }
    return [];
  },

  // Baixa e descriptografa um arquivo específico de registros (shard YYYY ou master)
  async downloadRecordsFile(fileId, password, token = null) {
    const activeToken = token || (await this.requestToken());
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await this.fetchWithBackoff(downloadUrl, {
      headers: { Authorization: `Bearer ${activeToken}` }
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const err = new Error(`Erro ao baixar arquivo (${fileId}): ${errData?.error?.message || res.status}`);
      err.status = res.status;
      throw err;
    }

    const arrayBuffer = await res.arrayBuffer();
    const rawData = await CryptoService.decryptDartFormat(arrayBuffer, password);
    return {
      records: this.extractRecordList(rawData),
      byteLength: arrayBuffer.byteLength
    };
  },

  // Faz upload compacto + criptografado de um arquivo de registros e retorna os metadados atualizados
  async uploadRecordsFile(filename, records, password, existingFile = null, knownMissing = false) {
    const token = await this.requestToken();
    const encoder = new TextEncoder();

    const compactList = (records || []).map((r) => this.compactRecordForSync(r));
    const jsonStr = JSON.stringify(compactList);
    const encryptedBytes = await CryptoService.encryptDartFormat(jsonStr, password);

    let targetFile = existingFile;
    if (!targetFile && !knownMissing) {
      const allFiles = await this.listAllAppDataFiles();
      targetFile = allFiles.find((f) => f.name === filename) || null;
    }

    let updatedMeta;
    if (targetFile && targetFile.id) {
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${targetFile.id}?uploadType=media&fields=id,name,modifiedTime,md5Checksum,size`;
      const res = await this.fetchWithBackoff(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream'
        },
        body: encryptedBytes
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const err = new Error(`Falha ao atualizar ${filename} no Drive: ${errData?.error?.message || res.status}`);
        err.status = res.status;
        throw err;
      }
      updatedMeta = await res.json().catch(() => ({ id: targetFile.id, name: filename }));
    } else {
      const boundary = '-------wingene_boundary_' + Math.random().toString(36).substring(2);
      const metadata = JSON.stringify({
        name: filename,
        parents: ['appDataFolder']
      });

      const p1 = encoder.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
      );
      const p2 = encryptedBytes;
      const p3 = encoder.encode(`\r\n--${boundary}--`);

      const combined = new Uint8Array(p1.length + p2.length + p3.length);
      combined.set(p1, 0);
      combined.set(p2, p1.length);
      combined.set(p3, p1.length + p2.length);

      const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,md5Checksum,size';
      const res = await this.fetchWithBackoff(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: combined
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const err = new Error(`Falha ao criar ${filename} no Drive: ${errData?.error?.message || res.status}`);
        err.status = res.status;
        throw err;
      }
      updatedMeta = await res.json().catch(() => ({ name: filename }));
    }

    if (updatedMeta && !updatedMeta.name) updatedMeta.name = filename;
    return updatedMeta;
  },

  // Mantido para compatibilidade caso seja chamado externamente
  async downloadMasterData(password, options = {}) {
    const allFiles = await this.listAllAppDataFiles();
    const snapshot = this.buildSnapshot(allFiles);
    const { masterFile, timestampFile, validationFile, legacyFiles } = snapshot;

    if (validationFile) {
      const isValid = await this.validatePasswordWithHash(password, validationFile, allFiles);
      if (!isValid) {
        throw new Error('PASSWORD_INCORRECT: A senha informada está incorreta para os dados criptografados desta conta no Google Drive.');
      }
    }

    if (options.onlyIfModifiedSince && masterFile && masterFile.modifiedTime) {
      const lastKnown = new Date(options.onlyIfModifiedSince).getTime();
      const masterMod = new Date(masterFile.modifiedTime).getTime();
      const tsMod = timestampFile && timestampFile.modifiedTime ? new Date(timestampFile.modifiedTime).getTime() : 0;
      const latestRemote = Math.max(masterMod, tsMod);

      if (latestRemote <= lastKnown + 2000) {
        return {
          fileFound: true,
          unchanged: true,
          modifiedTime: masterFile.modifiedTime,
          records: null,
          source: 'cache',
          filesInDrive: allFiles.map((f) => f.name)
        };
      }
    }

    const token = await this.requestToken();
    let list = [];
    let source = 'none';
    let masterBufferLength = 0;

    if (masterFile && masterFile.id) {
      const dl = await this.downloadRecordsFile(masterFile.id, password, token);
      list = dl.records;
      masterBufferLength = dl.byteLength;
      source = 'master';
    }

    if (list.length === 0 && legacyFiles.length > 0) {
      for (const lf of legacyFiles) {
        try {
          const dl = await this.downloadRecordsFile(lf.id, password, token);
          if (dl.records.length > 0) {
            list.push(...dl.records);
          } else {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${lf.id}?alt=media`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const ab = await res.arrayBuffer();
              const recData = await CryptoService.decryptDartFormat(ab, password);
              if (recData && typeof recData === 'object' && (recData.conteudo !== undefined || recData.uuid !== undefined)) {
                list.push(recData);
              }
            }
          }
        } catch (err) {
          console.warn(`Erro no arquivo legado ${lf.name}:`, err);
        }
      }
      if (list.length > 0) source = 'legacy';
    }

    if (masterFile || legacyFiles.length > 0) {
      return {
        fileFound: true,
        unchanged: false,
        modifiedTime: masterFile ? masterFile.modifiedTime : null,
        source,
        fileInfo: masterFile,
        fileSizeBytes: masterBufferLength || (masterFile ? masterFile.size : 0),
        filesInDrive: allFiles.map((f) => `${f.name} (${f.size || 0}B)`),
        records: list
      };
    }

    return {
      fileFound: false,
      unchanged: false,
      source: 'none',
      records: [],
      filesInDrive: allFiles.map((f) => `${f.name} (${f.size || 0}B)`)
    };
  },

  async uploadMasterData(records, password) {
    const token = await this.requestToken();
    const allFiles = await this.listAllAppDataFiles();
    const snapshot = this.buildSnapshot(allFiles);
    await this.uploadRecordsFile(this.MASTER_FILENAME, records, password, snapshot.masterFile, !snapshot.masterFile);
    if (snapshot.duplicates.length > 0) {
      await this.cleanupDuplicates(token, allFiles);
    }
    if (!snapshot.validationFile) {
      await this.createOrUpdateValidationFile(password, null, true);
    }
    const tsMeta = await this.updateSyncTimestamp(token, snapshot.timestampFile, !snapshot.timestampFile);
    return { success: true, modifiedTime: tsMeta?.modifiedTime || new Date().toISOString() };
  },

  async updateSyncTimestamp(token, existingFile = null, knownMissing = false) {
    const nowIso = new Date().toISOString();
    try {
      let existing = existingFile;
      if (!existing && !knownMissing) {
        const allFiles = await this.listAllAppDataFiles();
        allFiles.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
        existing = allFiles.find((f) => f.name === this.TIMESTAMP_FILENAME) || null;
      }
      const bytes = new TextEncoder().encode(nowIso);

      if (existing && existing.id) {
        const res = await this.fetchWithBackoff(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media&fields=id,name,modifiedTime,md5Checksum`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'text/plain'
            },
            body: bytes
          }
        );
        if (!res.ok) {
          if (res.status === 404) {
            const err = new Error('sync_timestamp.txt não encontrado (404)');
            err.status = 404;
            throw err;
          }
          console.warn('Erro ao atualizar sync_timestamp.txt (PATCH):', res.status, await res.text().catch(() => ''));
          return null;
        }
        const meta = await res.json().catch(() => ({ id: existing.id, modifiedTime: nowIso }));
        if (!meta.name) meta.name = this.TIMESTAMP_FILENAME;
        return meta;
      } else {
        const boundary = '-------timestamp_boundary_' + Math.random().toString(36).substring(2);
        const metadata = JSON.stringify({
          name: this.TIMESTAMP_FILENAME,
          parents: ['appDataFolder']
        });
        const multipartBody =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: text/plain\r\n\r\n${nowIso}\r\n--${boundary}--`;

        const res = await this.fetchWithBackoff(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,md5Checksum',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
          }
        );
        if (!res.ok) {
          console.warn('Erro ao criar sync_timestamp.txt (POST):', res.status, await res.text().catch(() => ''));
          return null;
        }
        const meta = await res.json().catch(() => ({ modifiedTime: nowIso }));
        if (!meta.name) meta.name = this.TIMESTAMP_FILENAME;
        return meta;
      }
    } catch (e) {
      if (e && e.status === 404) throw e;
      console.warn('Não foi possível atualizar sync_timestamp.txt:', e);
      return null;
    }
  },

  // Remove arquivos duplicados na pasta privada appDataFolder sem nova listagem quando allFiles é fornecido
  async cleanupDuplicates(token, allFilesInput = null) {
    try {
      const allFiles = Array.isArray(allFilesInput) ? allFilesInput : await this.listAllAppDataFiles();
      const snapshot = this.buildSnapshot(allFiles);
      if (!snapshot.duplicates || snapshot.duplicates.length === 0) {
        return 0;
      }
      let removed = 0;
      for (const file of snapshot.duplicates) {
        console.log(`[Drive] Removendo duplicata de ${file.name} (ID: ${file.id})...`);
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((r) => {
            if (r.ok) removed++;
          })
          .catch(() => {});
      }
      return removed;
    } catch (e) {
      console.warn('[Drive] Aviso ao limpar duplicatas:', e);
      return 0;
    }
  },

  // Baixa e descriptografa propósitos da nuvem (propositos_backup.json)
  async downloadPropositos(password, existingFile = null, knownMissing = false) {
    try {
      let propFile = existingFile;
      if (!propFile && !knownMissing) {
        const allFiles = await this.listAllAppDataFiles();
        propFile = allFiles.find((f) => f.name === this.PROPOSITOS_FILENAME) || null;
      }
      if (!propFile || !propFile.id) return [];

      const token = await this.requestToken();
      const res = await this.fetchWithBackoff(`https://www.googleapis.com/drive/v3/files/${propFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return [];

      const arrayBuffer = await res.arrayBuffer();
      const rawData = await CryptoService.decryptDartFormat(arrayBuffer, password);
      if (Array.isArray(rawData)) {
        return rawData;
      }
      return [];
    } catch (e) {
      console.warn('[Drive] Aviso ao baixar propósitos:', e);
      return [];
    }
  },

  // Faz upload criptografado da lista de propósitos e retorna os metadados atualizados
  async uploadPropositos(propositos, password, existingFile = null, knownMissing = false, throwOnNotFound = false) {
    try {
      if (!propositos || !Array.isArray(propositos)) return null;
      const token = await this.requestToken();
      const encoder = new TextEncoder();
      const jsonStr = JSON.stringify(propositos);
      const encryptedBytes = await CryptoService.encryptDartFormat(jsonStr, password);

      let propFile = existingFile;
      if (!propFile && !knownMissing) {
        const allFiles = await this.listAllAppDataFiles();
        propFile = allFiles.find((f) => f.name === this.PROPOSITOS_FILENAME) || null;
      }

      if (propFile && propFile.id) {
        const res = await this.fetchWithBackoff(
          `https://www.googleapis.com/upload/drive/v3/files/${propFile.id}?uploadType=media&fields=id,name,modifiedTime,md5Checksum,size`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/octet-stream'
            },
            body: encryptedBytes
          }
        );
        if (throwOnNotFound && res.status === 404) {
          const err = new Error('propositos_backup.json não encontrado (404)');
          err.status = 404;
          throw err;
        }
        return res.ok ? await res.json().catch(() => null) : null;
      } else {
        const boundary = '-------wingene_propositos_' + Math.random().toString(36).substring(2);
        const metadata = JSON.stringify({
          name: this.PROPOSITOS_FILENAME,
          parents: ['appDataFolder']
        });
        const p1 = encoder.encode(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
        );
        const p2 = encryptedBytes;
        const p3 = encoder.encode(`\r\n--${boundary}--`);

        const combined = new Uint8Array(p1.length + p2.length + p3.length);
        combined.set(p1, 0);
        combined.set(p2, p1.length);
        combined.set(p3, p1.length + p2.length);

        const res = await this.fetchWithBackoff(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,md5Checksum,size',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: combined
          }
        );
        return res.ok ? await res.json().catch(() => null) : null;
      }
    } catch (e) {
      if (throwOnNotFound && e && e.status === 404) throw e;
      console.warn('[Drive] Falha ao enviar propósitos:', e);
      return null;
    }
  }
};

window.GoogleDriveService = GoogleDriveService;
