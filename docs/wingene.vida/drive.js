/**
 * Módulo de Integração com Google Drive API v3 (Google Identity Services)
 * Permite sincronização bidirecional do arquivo mestre 'diario_sync_master.json'
 * localizado na pasta privada 'appDataFolder' do usuário.
 */

const GoogleDriveService = {
  CLIENT_ID: '866070306664-c4t0598uonqfurjr86qvhjtmp0mu3pau.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.appdata',
  MASTER_FILENAME: 'diario_sync_master.json',
  TIMESTAMP_FILENAME: 'sync_timestamp.txt',

  tokenClient: null,
  accessToken: null,
  tokenExpiresAt: 0,
  userEmail: null,

  // Inicializa o cliente GIS (Google Identity Services)
  init() {
    return new Promise((resolve) => {
      // Tenta recuperar token persistido na sessão
      const savedToken = sessionStorage.getItem('wingene_drive_token');
      const savedExp = sessionStorage.getItem('wingene_drive_token_exp');
      if (savedToken && savedExp && Number(savedExp) > Date.now()) {
        this.accessToken = savedToken;
        this.tokenExpiresAt = Number(savedExp);
      }

      const checkGsiInterval = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          clearInterval(checkGsiInterval);
          try {
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: this.CLIENT_ID,
              scope: this.SCOPES,
              callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                  this.accessToken = tokenResponse.access_token;
                  this.tokenExpiresAt = Date.now() + (Number(tokenResponse.expires_in) - 60) * 1000;
                  sessionStorage.setItem('wingene_drive_token', this.accessToken);
                  sessionStorage.setItem('wingene_drive_token_exp', String(this.tokenExpiresAt));
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

      // Timeout de segurança após 5 segundos
      setTimeout(() => {
        clearInterval(checkGsiInterval);
        resolve(false);
      }, 5000);
    });
  },

  isConnected() {
    return !!this.accessToken && Date.now() < this.tokenExpiresAt;
  },

  // Solicita autorização e login via pop-up oficial do Google
  requestToken() {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
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

      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  },

  // Desconecta a sessão do Drive
  signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch (_) {}
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    sessionStorage.removeItem('wingene_drive_token');
    sessionStorage.removeItem('wingene_drive_token_exp');
  },

  // Busca o arquivo mestre no Google Drive (pasta appDataFolder)
  async getMasterFileInfo() {
    const token = await this.requestToken();
    const query = encodeURIComponent(`trashed = false and 'appDataFolder' in parents and name = '${this.MASTER_FILENAME}'`);
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.signOut();
        throw new Error('Sessão expirada no Google Drive. Por favor reconecte.');
      }
      throw new Error(`Erro ao buscar arquivos no Google Drive (status ${res.status}).`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  },

  // Baixa e descriptografa o arquivo mestre do Drive
  async downloadMasterData(password) {
    const fileInfo = await this.getMasterFileInfo();
    if (!fileInfo) {
      return { fileFound: false, records: [] };
    }

    const token = await this.requestToken();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileInfo.id}?alt=media`;

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(`Erro ao baixar arquivo do Drive: HTTP ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const rawData = await CryptoService.decryptDartFormat(arrayBuffer, password);

    let list = [];
    if (Array.isArray(rawData)) {
      list = rawData;
    } else if (rawData && rawData.registros && Array.isArray(rawData.registros)) {
      list = rawData.registros;
    }

    return {
      fileFound: true,
      fileInfo,
      records: list
    };
  },

  // Faz upload e sincroniza os registros no arquivo mestre do Google Drive
  async uploadMasterData(records, password) {
    const token = await this.requestToken();

    // Normaliza os registros para o formato de array esperado pelo app móvel
    const payloadList = records.map((r) => {
      const copy = { ...r };
      delete copy.id; // app mobile usa id autoincrement interno no sqlite
      return copy;
    });

    // Criptografa no formato Dart (AES-256-CTR + PKCS7 + ZLIB)
    const encryptedBytes = await CryptoService.encryptDartFormat(payloadList, password);

    // Verifica se o arquivo mestre já existe no Drive
    const existingFile = await this.getMasterFileInfo();

    if (existingFile && existingFile.id) {
      // Atualiza arquivo existente via PATCH
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream'
        },
        body: encryptedBytes
      });

      if (!res.ok) {
        throw new Error(`Falha no upload para o Drive: HTTP ${res.status}`);
      }
    } else {
      // Cria novo arquivo via POST Multipart na pasta appDataFolder
      const boundary = '-------wingene_drive_multipart_' + Math.random().toString(36).substring(2);
      const metadata = JSON.stringify({
        name: this.MASTER_FILENAME,
        parents: ['appDataFolder']
      });

      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + metadata;
      const mediaHeaderPart = 'Content-Type: application/octet-stream\r\n\r\n';

      const enc = new TextEncoder();
      const p1 = enc.encode(delimiter + metadataPart + delimiter + mediaHeaderPart);
      const p2 = encryptedBytes;
      const p3 = enc.encode(closeDelimiter);

      const combined = new Uint8Array(p1.length + p2.length + p3.length);
      combined.set(p1, 0);
      combined.set(p2, p1.length);
      combined.set(p3, p1.length + p2.length);

      const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: combined
      });

      if (!res.ok) {
        throw new Error(`Falha ao criar arquivo no Drive: HTTP ${res.status}`);
      }
    }

    // Atualiza o sync_timestamp.txt para sinalizar alterações ao app móvel
    await this.updateSyncTimestamp(token);

    return true;
  },

  // Atualiza ou cria sync_timestamp.txt na appDataFolder
  async updateSyncTimestamp(token) {
    try {
      const nowIso = new Date().toISOString();
      const query = encodeURIComponent(`trashed = false and 'appDataFolder' in parents and name = '${this.TIMESTAMP_FILENAME}'`);
      const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id)`;

      const res = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const bytes = new TextEncoder().encode(nowIso);

      if (data.files && data.files.length > 0) {
        const fileId = data.files[0].id;
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain'
          },
          body: bytes
        });
      } else {
        const boundary = '-------timestamp_boundary_' + Math.random().toString(36).substring(2);
        const metadata = JSON.stringify({
          name: this.TIMESTAMP_FILENAME,
          parents: ['appDataFolder']
        });
        const multipartBody =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: text/plain\r\n\r\n${nowIso}\r\n--${boundary}--`;

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
      }
    } catch (e) {
      console.warn('Não foi possível atualizar sync_timestamp.txt:', e);
    }
  }
};

window.GoogleDriveService = GoogleDriveService;
