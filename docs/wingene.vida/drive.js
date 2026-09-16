/**
 * Módulo de Integração com Google Drive API v3 (Google Identity Services)
 * Permite sincronização bidirecional do arquivo mestre 'diario_sync_master.json'
 * e legado na pasta privada 'appDataFolder' do usuário.
 */

const GoogleDriveService = {
  CLIENT_ID: '97862926817-cfc6qmu5fm8e3pqtou7ra7c7pl394mb6.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.appdata email profile',
  MASTER_FILENAME: 'diario_sync_master.json',
  TIMESTAMP_FILENAME: 'sync_timestamp.txt',
  VALIDATION_FILENAME: 'validar.hash',

  tokenClient: null,
  accessToken: null,
  tokenExpiresAt: 0,
  userEmail: null,

  // Inicializa o cliente GIS (Google Identity Services)
  init() {
    return new Promise((resolve) => {
      const savedClientId = sessionStorage.getItem('wingene_drive_client_id');
      if (savedClientId !== this.CLIENT_ID) {
        sessionStorage.removeItem('wingene_drive_token');
        sessionStorage.removeItem('wingene_drive_token_exp');
        sessionStorage.removeItem('wingene_drive_email');
        sessionStorage.setItem('wingene_drive_client_id', this.CLIENT_ID);
      }

      const savedToken = sessionStorage.getItem('wingene_drive_token');
      const savedExp = sessionStorage.getItem('wingene_drive_token_exp');
      const savedEmail = sessionStorage.getItem('wingene_drive_email');

      if (savedToken && savedExp && Number(savedExp) > Date.now()) {
        this.accessToken = savedToken;
        this.tokenExpiresAt = Number(savedExp);
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
                  this.tokenExpiresAt = Date.now() + (Number(tokenResponse.expires_in) - 60) * 1000;
                  sessionStorage.setItem('wingene_drive_token', this.accessToken);
                  sessionStorage.setItem('wingene_drive_token_exp', String(this.tokenExpiresAt));

                  // Busca e-mail do usuário
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
          sessionStorage.setItem('wingene_drive_email', this.userEmail);
        }
        return this.userEmail;
      }
    } catch (e) {
      console.warn('Não foi possível obter email do perfil:', e);
    }
    return null;
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

  signOut() {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.accessToken, () => {});
      } catch (_) {}
    }
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.userEmail = null;
    sessionStorage.removeItem('wingene_drive_token');
    sessionStorage.removeItem('wingene_drive_token_exp');
    sessionStorage.removeItem('wingene_drive_email');
  },

  // Lista todos os arquivos na pasta privada appDataFolder
  async listAllAppDataFiles() {
    const token = await this.requestToken();
    const query = encodeURIComponent(`trashed = false and 'appDataFolder' in parents`);
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=1000`;

    const res = await fetch(url, {
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
    return data.files || [];
  },

  // Valida a senha contra validar.hash se este existir
  async validatePasswordWithHash(password, validationFile) {
    if (!validationFile || !validationFile.id) return true;
    const token = await this.requestToken();
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${validationFile.id}?alt=media`;

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return true; // se falhar o download do hash, ignora

    try {
      const arrayBuffer = await res.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      if (uint8.length <= 16) return true;

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
      return str === 'WINGENE_VIDA_VALIDATION';
    } catch (e) {
      return false;
    }
  },

  // Cria ou atualiza o validar.hash para proteger a integridade da senha
  async createOrUpdateValidationFile(password) {
    if (!password) return;
    try {
      const token = await this.requestToken();
      const allFiles = await this.listAllAppDataFiles();
      const existing = allFiles.find((f) => f.name === this.VALIDATION_FILENAME);

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

      if (existing && existing.id) {
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream'
          },
          body: finalBytes
        });
        if (!res.ok) {
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

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: combined
        });
        if (!res.ok) {
          console.warn('Erro ao criar validar.hash (POST):', res.status, await res.text().catch(() => ''));
        }
      }
    } catch (e) {
      console.warn('Não foi possível gravar validar.hash:', e);
    }
  },

  // Baixa e descriptografa os registros do Drive
  async downloadMasterData(password) {
    const allFiles = await this.listAllAppDataFiles();
    allFiles.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
    const masterFile = allFiles.find((f) => f.name === this.MASTER_FILENAME);
    const validationFile = allFiles.find((f) => f.name === this.VALIDATION_FILENAME);
    const legacyFiles = allFiles.filter((f) => f.name && f.name.startsWith('registro_') && f.name.endsWith('.json'));

    // Valida a senha se houver arquivo de validação
    if (validationFile) {
      const isValid = await this.validatePasswordWithHash(password, validationFile);
      if (!isValid) {
        throw new Error('PASSWORD_INCORRECT: A senha informada está incorreta para os dados criptografados desta conta no Google Drive.');
      }
    }

    const token = await this.requestToken();

    let list = [];
    let source = 'none';
    let masterBufferLength = 0;

    // 1. Tenta baixar o arquivo mestre consolidado
    if (masterFile && masterFile.id) {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${masterFile.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(`Erro ao baixar arquivo mestre: ${errData?.error?.message || res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      masterBufferLength = arrayBuffer.byteLength;
      const rawData = await CryptoService.decryptDartFormat(arrayBuffer, password);

      if (Array.isArray(rawData)) {
        list = rawData;
      } else if (rawData && rawData.registros && Array.isArray(rawData.registros)) {
        list = rawData.registros;
      } else if (rawData && typeof rawData === 'object') {
        const values = Object.values(rawData);
        if (values.length > 0 && values.some((v) => v && typeof v === 'object' && (v.conteudo !== undefined || v.uuid !== undefined || v.pilar !== undefined))) {
          list = values.filter((v) => v && typeof v === 'object' && (v.conteudo !== undefined || v.uuid !== undefined));
        }
      }

      source = 'master';
      console.log(`[Drive] Master baixado (${arrayBuffer.byteLength} bytes). Registros extraídos: ${list.length}.`);
    }

    // 2. Se o master estava vazio ou não existia, verifica arquivos legados registro_*.json
    if (list.length === 0 && legacyFiles.length > 0) {
      console.log(`[Drive] Verificando ${legacyFiles.length} arquivos legados no Drive...`);
      for (const lf of legacyFiles) {
        try {
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${lf.id}?alt=media`;
          const res = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const ab = await res.arrayBuffer();
            const recData = await CryptoService.decryptDartFormat(ab, password);
            if (Array.isArray(recData)) {
              list.push(...recData);
            } else if (recData && typeof recData === 'object' && (recData.conteudo !== undefined || recData.uuid !== undefined)) {
              list.push(recData);
            }
          }
        } catch (err) {
          console.warn(`Erro no arquivo legado ${lf.name}:`, err);
        }
      }
      if (list.length > 0) {
        source = 'legacy';
        console.log(`[Drive] ${list.length} registros recuperados dos arquivos legados!`);
      }
    }

    if (masterFile || legacyFiles.length > 0) {
      return {
        fileFound: true,
        source: source,
        fileInfo: masterFile,
        fileSizeBytes: masterBufferLength || (masterFile ? masterFile.size : 0),
        filesInDrive: allFiles.map((f) => `${f.name} (${f.size || 0}B)`),
        records: list
      };
    }

    // 3. Nenhum arquivo de dados encontrado
    return {
      fileFound: false,
      source: 'none',
      filesInDrive: allFiles.map((f) => f.name),
      records: []
    };
  },

  // Faz upload e sincroniza os registros no arquivo mestre do Google Drive
  async uploadMasterData(records, password) {
    const token = await this.requestToken();

    const payloadList = records.map((r) => {
      const copy = { ...r };
      delete copy.id;
      return copy;
    });

    const encryptedBytes = await CryptoService.encryptDartFormat(payloadList, password);
    const allFiles = await this.listAllAppDataFiles();
    allFiles.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
    const existingFile = allFiles.find((f) => f.name === this.MASTER_FILENAME);

    if (existingFile && existingFile.id) {
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
        const errData = await res.json().catch(() => null);
        throw new Error(`Falha no upload para o Drive: ${errData?.error?.message || res.status}`);
      }
    } else {
      const boundary = '-------wingene_drive_multipart_' + Math.random().toString(36).substring(2);
      const metadata = JSON.stringify({
        name: this.MASTER_FILENAME,
        parents: ['appDataFolder']
      });

      const encoder = new TextEncoder();
      const p1 = encoder.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`
      );
      const p2 = encryptedBytes;
      const p3 = encoder.encode(`\r\n--${boundary}--`);

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
        const errData = await res.json().catch(() => null);
        throw new Error(`Falha ao criar arquivo no Drive: ${errData?.error?.message || res.status}`);
      }
    }

    // Remove eventuais arquivos duplicados no appDataFolder para manter integridade
    await this.cleanupDuplicates(token);

    // Grava o arquivo de validação de senha e o timestamp
    await this.createOrUpdateValidationFile(password);
    await this.updateSyncTimestamp(token);

    return true;
  },

  async updateSyncTimestamp(token) {
    try {
      const nowIso = new Date().toISOString();
      const allFiles = await this.listAllAppDataFiles();
      allFiles.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
      const existing = allFiles.find((f) => f.name === this.TIMESTAMP_FILENAME);
      const bytes = new TextEncoder().encode(nowIso);

      if (existing && existing.id) {
        const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain'
          },
          body: bytes
        });
        if (!res.ok) {
          console.warn('Erro ao atualizar sync_timestamp.txt (PATCH):', res.status, await res.text().catch(() => ''));
        } else {
          console.log('[Drive] sync_timestamp.txt atualizado com sucesso via PATCH!');
        }
      } else {
        const boundary = '-------timestamp_boundary_' + Math.random().toString(36).substring(2);
        const metadata = JSON.stringify({
          name: this.TIMESTAMP_FILENAME,
          parents: ['appDataFolder']
        });
        const multipartBody =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: text/plain\r\n\r\n${nowIso}\r\n--${boundary}--`;

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
        if (!res.ok) {
          console.warn('Erro ao criar sync_timestamp.txt (POST):', res.status, await res.text().catch(() => ''));
        } else {
          console.log('[Drive] sync_timestamp.txt criado com sucesso via POST!');
        }
      }
    } catch (e) {
      console.warn('Não foi possível atualizar sync_timestamp.txt:', e);
    }
  },

  // Remove arquivos duplicados na pasta privada appDataFolder mantendo apenas o mais recente
  async cleanupDuplicates(token) {
    try {
      const allFiles = await this.listAllAppDataFiles();
      const targetNames = [this.MASTER_FILENAME, this.TIMESTAMP_FILENAME, this.VALIDATION_FILENAME];

      for (const name of targetNames) {
        const matching = allFiles.filter((f) => f.name === name);
        if (matching.length > 1) {
          matching.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
          const toDelete = matching.slice(1);
          for (const file of toDelete) {
            console.log(`[Drive] Removendo duplicata de ${name} (ID: ${file.id})...`);
            await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[Drive] Aviso ao limpar duplicatas:', e);
    }
  }
};

window.GoogleDriveService = GoogleDriveService;
