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

  needsAccountSelect: false,

  // Solicita autorização e login via pop-up oficial do Google
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
      this.tokenClient.requestAccessToken({ prompt: promptOption });
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
    sessionStorage.removeItem('wingene_drive_token');
    sessionStorage.removeItem('wingene_drive_token_exp');
    sessionStorage.removeItem('wingene_drive_email');
  },

  // Força desconexão e abre o seletor de contas do Google explicitamente
  async switchAccount() {
    this.signOut();
    await this.requestToken({ forceSelect: true });
    await this.fetchUserEmail();
    return this.userEmail;
  },

  // Objeto de auditoria para diagnóstico em tempo real
  lastValidationAudit: null,

  // Lista todos os arquivos na pasta privada appDataFolder
  async listAllAppDataFiles() {
    const token = await this.requestToken();
    const query = encodeURIComponent(`trashed = false and 'appDataFolder' in parents`);
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime,size)&pageSize=1000`;

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
    const files = data.files || [];
    // Garante ordenação decrescente por modifiedTime
    files.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
    return files;
  },

  // Valida a senha contra validar.hash ou diretamente contra diario_sync_master.json
  async validatePasswordWithHash(password, validationFile = null) {
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

    let allFiles = [];
    try {
      allFiles = await this.listAllAppDataFiles();
      audit.filesFound = allFiles.map((f) => ({
        name: f.name,
        id: f.id,
        size: f.size,
        modifiedTime: f.modifiedTime
      }));
    } catch (e) {
      console.warn('[Drive] Erro ao listar arquivos na appDataFolder:', e);
      audit.listError = e.message || String(e);
    }

    const validationFiles = allFiles.filter((f) => f.name === this.VALIDATION_FILENAME);
    const masterFiles = allFiles.filter((f) => f.name === this.MASTER_FILENAME);
    const legacyFiles = allFiles.filter((f) => f.name && f.name.startsWith('registro_') && f.name.endsWith('.json'));

    const token = await this.requestToken().catch(() => null);

    // 1. Tenta validar com validar.hash (se existirem)
    for (const vFile of validationFiles) {
      if (!token) break;
      try {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${vFile.id}?alt=media`;
        const res = await fetch(downloadUrl, {
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

    // 2. Se validar.hash não existir ou falhar, testa diretamente no diario_sync_master.json
    for (const mFile of masterFiles) {
      if (!token) break;
      console.log(`[Drive] Testando senha diretamente contra diario_sync_master.json (${mFile.id})...`);
      try {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${mFile.id}?alt=media`;
        const res = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          const parsed = await CryptoService.decryptDartFormat(ab, password);
          if (parsed && (Array.isArray(parsed) || parsed.registros || typeof parsed === 'object')) {
            console.log(`[Drive] diario_sync_master.json (${mFile.id}) descriptografado com sucesso!`);
            audit.masterAttempts.push({ fileId: mFile.id, success: true, recordCount: Array.isArray(parsed) ? parsed.length : (parsed.registros?.length || 'obj') });
            // Auto-recupera o validar.hash para as próximas validações
            this.createOrUpdateValidationFile(password).catch((e) => console.warn('[Drive] Falha ao recriar validar.hash:', e));
            audit.result = true;
            this.lastValidationAudit = audit;
            return true;
          }
        }
      } catch (masterErr) {
        console.warn(`[Drive] Teste no masterFile (${mFile.id}) falhou:`, masterErr.message || masterErr);
        audit.masterAttempts.push({ fileId: mFile.id, success: false, error: masterErr.message || String(masterErr) });
      }
    }

    // 3. Se não houver masterFile, tenta testar em um arquivo legado de registro
    if (masterFiles.length === 0 && legacyFiles.length > 0 && token) {
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
            this.createOrUpdateValidationFile(password).catch(() => {});
            audit.result = true;
            this.lastValidationAudit = audit;
            return true;
          }
        }
      } catch (legErr) {
        audit.legacyAttempts.push({ fileId: sampleLegacy.id, success: false, error: legErr.message || String(legErr) });
      }
    }

    // 4. Se a conta não tiver nenhum arquivo relevante salvo, aceita como válida para iniciar
    if (validationFiles.length === 0 && masterFiles.length === 0 && legacyFiles.length === 0) {
      console.log('[Drive] Nenhum arquivo de dados ou validação encontrado nesta conta.');
      audit.result = true;
      audit.isNewAccount = true;
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
    return true;
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
  async downloadMasterData(password, options = {}) {
    const allFiles = await this.listAllAppDataFiles();
    allFiles.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
    const masterFile = allFiles.find((f) => f.name === this.MASTER_FILENAME);
    const timestampFile = allFiles.find((f) => f.name === this.TIMESTAMP_FILENAME);
    const validationFile = allFiles.find((f) => f.name === this.VALIDATION_FILENAME);
    const legacyFiles = allFiles.filter((f) => f.name && f.name.startsWith('registro_') && f.name.endsWith('.json'));

    // Valida a senha se houver arquivo de validação ou masterFile
    if (validationFile || masterFile) {
      const isValid = await this.validatePasswordWithHash(password, validationFile);
      if (!isValid) {
        throw new Error('PASSWORD_INCORRECT: A senha informada não conseguiu decifrar os dados de backup desta conta no Google Drive.');
      }
    }

    // CHECK DE TIMESTAMP: Se foi passado onlyIfModifiedSince, verifica se o master ou timestamp foram alterados
    if (options.onlyIfModifiedSince && masterFile && masterFile.modifiedTime) {
      const lastKnown = new Date(options.onlyIfModifiedSince).getTime();
      const masterMod = new Date(masterFile.modifiedTime).getTime();
      const tsMod = timestampFile && timestampFile.modifiedTime ? new Date(timestampFile.modifiedTime).getTime() : 0;
      const latestRemote = Math.max(masterMod, tsMod);

      // Tolerância de 2 segundos (idêntica ao Flutter) para evitar falsos positivos
      if (latestRemote <= lastKnown + 2000) {
        console.log(`[Drive] Master remoto inalterado (Remoto: ${new Date(latestRemote).toISOString()} <= Local: ${new Date(lastKnown).toISOString()}). Pulando download.`);
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
        unchanged: false,
        modifiedTime: masterFile ? masterFile.modifiedTime : null,
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
      unchanged: false,
      source: 'none',
      records: [],
      filesInDrive: allFiles.map((f) => `${f.name} (${f.size || 0}B)`)
    };
  },

  // Faz upload consolidado dos registros para o Drive
  async uploadMasterData(records, password) {
    const token = await this.requestToken();
    const encoder = new TextEncoder();

    // 1. Gera o JSON criptografado no formato oficial Dart/Flutter
    const jsonStr = JSON.stringify({ registros: records });
    const encryptedBytes = await CryptoService.encryptDartFormat(jsonStr, password);

    // 2. Busca se já existe um arquivo mestre
    const allFiles = await this.listAllAppDataFiles();
    allFiles.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));
    const masterFile = allFiles.find((f) => f.name === this.MASTER_FILENAME);

    if (masterFile && masterFile.id) {
      // Atualiza arquivo existente via PATCH direto
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${masterFile.id}?uploadType=media`;
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
        throw new Error(`Falha ao atualizar arquivo no Drive: ${errData?.error?.message || res.status}`);
      }
    } else {
      // Cria novo arquivo com metadata multipart/related
      const boundary = '-------wingene_boundary_' + Math.random().toString(36).substring(2);
      const metadata = JSON.stringify({
        name: this.MASTER_FILENAME,
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
    const newTimestamp = await this.updateSyncTimestamp(token);

    return { success: true, modifiedTime: newTimestamp };
  },

  async updateSyncTimestamp(token) {
    const nowIso = new Date().toISOString();
    try {
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
