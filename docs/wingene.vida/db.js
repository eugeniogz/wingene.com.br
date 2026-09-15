/**
 * Gerenciador de Banco de Dados Local (IndexedDB com cofre criptografado)
 * Persiste os registros do Diário com segurança no dispositivo.
 */

const DBService = {
  DB_NAME: 'wingene_vida_db',
  DB_VERSION: 1,
  STORE_NAME: 'vault_store',
  VAULT_RECORD_KEY: 'encrypted_diary_vault',

  // Abre conexão com o IndexedDB
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        reject('Erro ao abrir IndexedDB: ' + event.target.error);
      };
    });
  },

  // Obtém o cofre criptografado bruto
  async getRawVault() {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(this.VAULT_RECORD_KEY);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  // Grava o cofre criptografado no IndexedDB
  async saveRawVault(payload) {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(payload, this.VAULT_RECORD_KEY);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Verifica se o cofre já foi inicializado com uma senha
  async isVaultInitialized() {
    const raw = await this.getRawVault();
    return raw !== null && !!raw.ciphertext;
  },

  // Descriptografa e carrega o conjunto de dados da sessão
  async loadVault(password) {
    const raw = await this.getRawVault();
    if (!raw) {
      return { registros: [], resumos_mensais: [], insights: [], propositos: [] };
    }
    const decrypted = await CryptoService.decrypt(raw, password);
    if (!decrypted.registros) {
      decrypted.registros = Array.isArray(decrypted) ? decrypted : [];
    }
    return decrypted;
  },

  // Criptografa e persiste o cofre com a senha atual
  async persistVault(data, password) {
    const encrypted = await CryptoService.encrypt(data, password);
    await this.saveRawVault(encrypted);
  },

  // Gera um UUID v4 no padrão RFC4122
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // Normaliza um registro garantindo todos os campos necessários
  normalizeRecord(raw) {
    const nowIso = new Date().toISOString();
    return {
      id: raw.id || null,
      uuid: raw.uuid || this.generateUUID(),
      pilar: (raw.pilar || 'V').toUpperCase(),
      pilarPrincipal: (raw.pilarPrincipal || raw.pilar || 'V').toUpperCase(),
      conteudo: raw.conteudo || '',
      data: raw.data || nowIso,
      categoria: raw.categoria || '',
      impacto: typeof raw.impacto === 'number' ? raw.impacto : 0,
      impactos: raw.impactos || (typeof raw.impacto === 'number' ? String(raw.impacto) : '0'),
      observacao: raw.observacao || '',
      tags: raw.tags || '',
      comentarioVida: raw.comentarioVida || '',
      palavraChave: raw.palavraChave || '',
      lastModified: raw.lastModified || nowIso,
      versao: raw.versao || 1,
      sincronizado: raw.sincronizado || 0,
      deletado: raw.deletado || 0,
      insightId: raw.insightId || null,
      propositoUuid: raw.propositoUuid || null,
      propositoAvaliado: raw.propositoAvaliado || 0
    };
  },

  // Importa registros de um backup em JSON
  importBackupData(jsonContent) {
    let list = [];
    if (Array.isArray(jsonContent)) {
      list = jsonContent;
    } else if (jsonContent && jsonContent.registros && Array.isArray(jsonContent.registros)) {
      list = jsonContent.registros;
    } else {
      throw new Error('Formato de backup inválido. Esperava uma lista de registros.');
    }

    return list.map((item) => this.normalizeRecord(item));
  }
};

window.DBService = DBService;
