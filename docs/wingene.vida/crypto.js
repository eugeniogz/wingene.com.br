/**
 * Módulo de Criptografia Web Crypto API
 * Suporta:
 * 1. Cofre local com PBKDF2 + AES-GCM (256 bits) para persistência ultra-segura no navegador.
 * 2. Formato nativo do app Wingene Vida Flutter (AES-256-CTR/SIC + PKCS7 + ZLIB) para sincronização direta com o Google Drive.
 */

const CryptoService = {
  SALT_STORAGE_KEY: 'wingene_vault_salt',
  DEVICE_KEY_STORAGE: 'wingene_device_auth',
  PBKDF2_ITERATIONS: 100000,

  // Utilitário para converter ArrayBuffer para Base64 e vice-versa
  bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },

  base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  // Preenche a chave até 32 bytes com '#' (padrão idêntico ao app Flutter)
  padKey(key) {
    if (!key) key = '';
    if (key.length >= 32) return key.substring(0, 32);
    return key.padEnd(32, '#');
  },

  // Gera um Salt aleatório de 16 bytes
  generateSalt() {
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    return salt;
  },

  // Obtém ou inicializa o Salt principal do cofre local
  getOrCreateVaultSalt() {
    let storedSalt = localStorage.getItem(this.SALT_STORAGE_KEY);
    if (!storedSalt) {
      const salt = this.generateSalt();
      storedSalt = this.bufferToBase64(salt.buffer);
      localStorage.setItem(this.SALT_STORAGE_KEY, storedSalt);
    }
    return new Uint8Array(this.base64ToBuffer(storedSalt));
  },

  // Deriva uma chave AES-GCM a partir de uma senha de texto e um Salt via PBKDF2
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Criptografa dados em formato texto/JSON usando AES-GCM (Cofre Local do Navegador)
  async encrypt(dataObj, password) {
    const salt = this.getOrCreateVaultSalt();
    const key = await this.deriveKey(password, salt);
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);

    const encoder = new TextEncoder();
    const encodedData = encoder.encode(JSON.stringify(dataObj));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );

    return {
      iv: this.bufferToBase64(iv.buffer),
      salt: this.bufferToBase64(salt.buffer),
      ciphertext: this.bufferToBase64(encryptedBuffer)
    };
  },

  // Descriptografa dados usando a senha fornecida (Cofre Local do Navegador)
  async decrypt(payload, password) {
    if (!payload || !payload.ciphertext || !payload.iv) {
      throw new Error('Formato de carga criptografada inválido.');
    }

    const salt = payload.salt
      ? new Uint8Array(this.base64ToBuffer(payload.salt))
      : this.getOrCreateVaultSalt();

    const iv = new Uint8Array(this.base64ToBuffer(payload.iv));
    const ciphertext = this.base64ToBuffer(payload.ciphertext);

    let key;
    try {
      key = await this.deriveKey(password, salt);
    } catch (e) {
      throw new Error('Falha ao derivar chave: ' + e.message);
    }

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);
      return JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Senha incorreta ou integridade dos dados corrompida.');
    }
  },

  // =========================================================================
  // COMPATIBILIDADE NATIVA COM O APP FLUTTER / GOOGLE DRIVE
  // Formato: AES-256-CTR (SIC) + PKCS7 + ZLIB (RFC 1950)
  // =========================================================================

  // Compactação ZLIB (deflate) nativa via CompressionStream
  async zlibCompress(uint8Array) {
    const stream = new Response(uint8Array).body.pipeThrough(new CompressionStream('deflate'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  },

  // Descompactação ZLIB (inflate) nativa via DecompressionStream
  async zlibDecompress(uint8Array) {
    const cleanBytes = uint8Array.slice();
    try {
      const stream = new Response(cleanBytes).body.pipeThrough(new DecompressionStream('deflate'));
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch (err) {
      // Fallback para deflate-raw caso o cabeçalho zlib seja ausente
      try {
        const streamRaw = new Response(cleanBytes).body.pipeThrough(new DecompressionStream('deflate-raw'));
        const bufRaw = await new Response(streamRaw).arrayBuffer();
        return new Uint8Array(bufRaw);
      } catch (_) {
        throw err;
      }
    }
  },

  // Adiciona padding PKCS7 a um Uint8Array (tamanho de bloco = 16 bytes)
  addPkcs7Padding(dataBytes) {
    const padLen = 16 - (dataBytes.length % 16);
    const padded = new Uint8Array(dataBytes.length + padLen);
    padded.set(dataBytes);
    padded.fill(padLen, dataBytes.length);
    return padded;
  },

  // Remove padding PKCS7 com validação estrita de cada byte
  removePkcs7Padding(paddedBytes) {
    if (!paddedBytes || paddedBytes.length === 0) return paddedBytes;
    const padLen = paddedBytes[paddedBytes.length - 1];
    if (padLen < 1 || padLen > 16) return paddedBytes; // Sem padding válido
    for (let i = paddedBytes.length - padLen; i < paddedBytes.length; i++) {
      if (paddedBytes[i] !== padLen) {
        return paddedBytes; // Não é PKCS7 autêntico, preserva os bytes
      }
    }
    return paddedBytes.slice(0, paddedBytes.length - padLen);
  },

  // Criptografa objeto no formato do arquivo do Google Drive do app móvel
  async encryptDartFormat(dataObj, password) {
    const jsonStr = JSON.stringify(dataObj);
    const encoder = new TextEncoder();
    const rawBytes = encoder.encode(jsonStr);

    // 1. Aplica compressão ZLIB
    const compressedBytes = await this.zlibCompress(rawBytes);

    if (!password || password.trim() === '') {
      return compressedBytes;
    }

    // 2. Padding PKCS7
    const paddedBytes = this.addPkcs7Padding(compressedBytes);

    // 3. Chave AES-256
    const paddedPassword = this.padKey(password);
    const key = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(paddedPassword),
      { name: 'AES-CTR' },
      false,
      ['encrypt']
    );

    // 4. IV aleatório de 16 bytes
    const iv = new Uint8Array(16);
    window.crypto.getRandomValues(iv);

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: iv, length: 128 },
      key,
      paddedBytes
    );

    // 5. Concatena IV (16 bytes) + Ciphertext
    const finalBytes = new Uint8Array(16 + cipherBuffer.byteLength);
    finalBytes.set(iv, 0);
    finalBytes.set(new Uint8Array(cipherBuffer), 16);
    return finalBytes;
  },

  // Descriptografa os bytes recebidos do Google Drive (diario_sync_master.json)
  async decryptDartFormat(rawBytes, password) {
    if (!rawBytes || rawBytes.length === 0) {
      return [];
    }

    const uint8 = new Uint8Array(rawBytes);

    // 1. Tenta primeiro se foi salvo sem criptografia (direto zlib ou JSON plain)
    if (uint8[0] === 0x78) {
      try {
        const uncompressed = await this.zlibDecompress(uint8);
        const jsonStr = new TextDecoder().decode(uncompressed).trim();
        if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
          return JSON.parse(jsonStr);
        }
      } catch (_) {}
    } else if (uint8[0] === 0x7b || uint8[0] === 0x5b) {
      try {
        const jsonStr = new TextDecoder().decode(uint8).trim();
        return JSON.parse(jsonStr);
      } catch (_) {}
    }

    if (!password || password.trim() === '' || uint8.length <= 16) {
      throw new Error('PASSWORD_REQUIRED: Arquivo criptografado. A senha do Google Drive é necessária.');
    }

    const iv = uint8.subarray(0, 16);
    const cipher = uint8.subarray(16);

    const encoder = new TextEncoder();
    const paddedPassword = this.padKey(password);
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

    const decryptedBytes = new Uint8Array(decryptedBuffer);
    const unpadded = this.removePkcs7Padding(decryptedBytes);
    let jsonStr = '';

    // 1. Tenta descompressão ZLIB nos bytes desempacotados
    let decompressed = false;
    if (unpadded.length > 2 && unpadded[0] === 0x78) {
      try {
        const uncompressed = await this.zlibDecompress(unpadded);
        jsonStr = new TextDecoder().decode(uncompressed);
        decompressed = true;
      } catch (e1) {
        console.warn('[Crypto] Falha zlib com unpadded, tentando com decryptedBytes original:', e1);
      }
    }

    // 2. Se falhou, tenta descompressão nos bytes diretos (sem unpadding)
    if (!decompressed && decryptedBytes.length > 2 && decryptedBytes[0] === 0x78) {
      try {
        const uncompressed = await this.zlibDecompress(decryptedBytes);
        jsonStr = new TextDecoder().decode(uncompressed);
        decompressed = true;
      } catch (e2) {
        console.warn('[Crypto] Falha zlib com decryptedBytes original:', e2);
      }
    }

    // 3. Se não for zlib ou se falhou, tenta ler diretamente como UTF-8 (fallback sem compressão)
    if (!decompressed) {
      try {
        const directStr = new TextDecoder().decode(unpadded);
        const trimmed = directStr.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          jsonStr = trimmed;
          decompressed = true;
        }
      } catch (_) {}
    }

    if (!decompressed || !jsonStr) {
      const firstByteHex = unpadded.length > 0 ? '0x' + unpadded[0].toString(16) : 'vazio';
      console.warn('[Crypto] Falha completa ao decodificar master. Primeiro byte:', firstByteHex);
      throw new Error(`PASSWORD_INCORRECT: A senha não conseguiu decifrar os dados da nuvem (primeiro byte decifrado: ${firstByteHex}).`);
    }

    const trimmed = jsonStr.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      console.warn('[Crypto] Texto decifrado não é JSON válido:', trimmed.slice(0, 50));
      throw new Error('PASSWORD_INCORRECT: O conteúdo decifrado da nuvem não é um JSON válido.');
    }

    try {
      return JSON.parse(trimmed);
    } catch (parseErr) {
      console.warn('[Crypto] Erro no JSON.parse dos dados decifrados:', parseErr);
      throw new Error('CORRUPTED_DATA: Falha ao interpretar estrutura JSON dos registros da nuvem.');
    }
  },

  // =========================================================================
  // ARMAZENAMENTO SEGURO DA SENHA NO BROWSER
  // =========================================================================

  async savePasswordLocally(password) {
    try {
      const deviceId = localStorage.getItem('wingene_device_id') || (() => {
        const id = 'dev_' + Math.random().toString(36).substring(2) + Date.now();
        localStorage.setItem('wingene_device_id', id);
        return id;
      })();

      const salt = this.generateSalt();
      const deviceKey = await this.deriveKey(deviceId + '_wgn_sec', salt);
      const iv = new Uint8Array(12);
      window.crypto.getRandomValues(iv);

      const encoder = new TextEncoder();
      const encPass = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        deviceKey,
        encoder.encode(password)
      );

      const bundle = {
        iv: this.bufferToBase64(iv.buffer),
        salt: this.bufferToBase64(salt.buffer),
        secret: this.bufferToBase64(encPass)
      };

      localStorage.setItem(this.DEVICE_KEY_STORAGE, JSON.stringify(bundle));
    } catch (e) {
      console.warn('Não foi possível salvar senha localmente:', e);
    }
  },

  async getSavedPassword() {
    try {
      const raw = localStorage.getItem(this.DEVICE_KEY_STORAGE);
      const deviceId = localStorage.getItem('wingene_device_id');
      if (!raw || !deviceId) return null;

      const bundle = JSON.parse(raw);
      const salt = new Uint8Array(this.base64ToBuffer(bundle.salt));
      const iv = new Uint8Array(this.base64ToBuffer(bundle.iv));
      const secret = this.base64ToBuffer(bundle.secret);

      const deviceKey = await this.deriveKey(deviceId + '_wgn_sec', salt);
      const decBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        deviceKey,
        secret
      );

      const decoder = new TextDecoder();
      return decoder.decode(decBuffer);
    } catch (e) {
      console.warn('Erro ao restaurar credencial do dispositivo:', e);
      return null;
    }
  },

  clearSavedPassword() {
    localStorage.removeItem(this.DEVICE_KEY_STORAGE);
  },

  hasSavedPassword() {
    return !!localStorage.getItem(this.DEVICE_KEY_STORAGE);
  }
};

window.CryptoService = CryptoService;
