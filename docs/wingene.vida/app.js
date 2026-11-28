/**
 * Aplicativo Principal do PWA Wingene Vida
 * Controla autenticação, estado, interface, CRUD de entradas, visualização de IA
 * e sincronização bidirecional com o Google Drive (compatível com o app móvel Flutter).
 */

(function () {
  // Estado da Aplicação
  const state = {
    currentPassword: null,
    vaultData: { registros: [] },
    activePilar: 'ALL',
    searchQuery: '',
    editingUuid: null,
    pendingDeleteUuid: null,
    isFirstTimeSetup: false,
    isSyncingDrive: false
  };

  // Referências DOM
  const elements = {
    lockScreen: document.getElementById('lockScreen'),
    appScreen: document.getElementById('appScreen'),
    lockForm: document.getElementById('lockForm'),
    passwordInput: document.getElementById('passwordInput'),
    rememberPasswordCheck: document.getElementById('rememberPasswordCheck'),
    lockError: document.getElementById('lockError'),
    lockSubtitle: document.getElementById('lockSubtitle'),
    btnUnlock: document.getElementById('btnUnlock'),
    linkLoadSample: document.getElementById('linkLoadSample'),
    linkResetVault: document.getElementById('linkResetVault'),

    brandHomeBtn: document.getElementById('brandHomeBtn'),
    btnDriveSync: document.getElementById('btnDriveSync'),
    driveSyncIcon: document.getElementById('driveSyncIcon'),
    driveSyncText: document.getElementById('driveSyncText'),
    btnLock: document.getElementById('btnLock'),
    btnSettings: document.getElementById('btnSettings'),
    btnNewEntryHeader: document.getElementById('btnNewEntryHeader'),
    fabNewEntry: document.getElementById('fabNewEntry'),
    btnNewEntryEmpty: document.getElementById('btnNewEntryEmpty'),

    searchInput: document.getElementById('searchInput'),
    filterChips: document.querySelectorAll('.filter-chip'),
    entriesList: document.getElementById('entriesList'),
    emptyState: document.getElementById('emptyState'),
    entriesCountText: document.getElementById('entriesCountText'),
    entriesImpactText: document.getElementById('entriesImpactText'),

    entryModal: document.getElementById('entryModal'),
    modalEntryTitle: document.getElementById('modalEntryTitle'),
    entryForm: document.getElementById('entryForm'),
    entryUuid: document.getElementById('entryUuid'),
    modalPilarSelector: document.getElementById('modalPilarSelector'),
    entryConteudo: document.getElementById('entryConteudo'),
    entryData: document.getElementById('entryData'),
    entryImpacto: document.getElementById('entryImpacto'),
    entryImpactoDisplay: document.getElementById('entryImpactoDisplay'),
    entryTags: document.getElementById('entryTags'),
    entryCategoria: document.getElementById('entryCategoria'),
    entryProposito: document.getElementById('entryProposito'),
    btnOpenNewPropositoModal: document.getElementById('btnOpenNewPropositoModal'),
    modalAiPreviewBox: document.getElementById('modalAiPreviewBox'),
    modalAiPreviewComment: document.getElementById('modalAiPreviewComment'),
    modalAiPreviewKeyword: document.getElementById('modalAiPreviewKeyword'),
    btnCancelEntryModal: document.getElementById('btnCancelEntryModal'),
    btnCloseEntryModal: document.getElementById('btnCloseEntryModal'),
    btnSaveEntry: document.getElementById('btnSaveEntry'),

    // Editor em Tela Cheia
    btnToggleExtraOptions: document.getElementById('btnToggleExtraOptions'),
    extraOptionsIndicator: document.getElementById('extraOptionsIndicator'),
    editorExtraOptionsDrawer: document.getElementById('editorExtraOptionsDrawer'),
    btnCloseExtraOptionsDrawer: document.getElementById('btnCloseExtraOptionsDrawer'),
    btnDoneExtraOptions: document.getElementById('btnDoneExtraOptions'),
    drawerBackdrop: document.getElementById('drawerBackdrop'),
    editorWordCount: document.getElementById('editorWordCount'),

    quickPropositoModal: document.getElementById('quickPropositoModal'),
    btnCloseQuickPropositoModal: document.getElementById('btnCloseQuickPropositoModal'),
    btnCancelQuickProposito: document.getElementById('btnCancelQuickProposito'),
    btnSaveQuickProposito: document.getElementById('btnSaveQuickProposito'),
    newPropositoTitulo: document.getElementById('newPropositoTitulo'),
    newPropositoEixoSelector: document.getElementById('newPropositoEixoSelector'),
    newPropositoDescricao: document.getElementById('newPropositoDescricao'),

    deleteModal: document.getElementById('deleteModal'),
    btnCancelDelete: document.getElementById('btnCancelDelete'),
    btnCloseDeleteModal: document.getElementById('btnCloseDeleteModal'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),

    settingsModal: document.getElementById('settingsModal'),
    btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
    btnCloseSettingsModalBtn: document.getElementById('btnCloseSettingsModalBtn'),
    btnExportJson: document.getElementById('btnExportJson'),
    importFileInput: document.getElementById('importFileInput'),
    btnClearSavedPassword: document.getElementById('btnClearSavedPassword'),
    changePassNew: document.getElementById('changePassNew'),
    btnApplyNewPassword: document.getElementById('btnApplyNewPassword'),
    driveEncryptionPassword: document.getElementById('driveEncryptionPassword'),
    btnSaveDrivePassword: document.getElementById('btnSaveDrivePassword'),

    driveStatusBadge: document.getElementById('driveStatusBadge'),
    btnConnectDriveModal: document.getElementById('btnConnectDriveModal'),
    btnSyncNowModal: document.getElementById('btnSyncNowModal'),
    btnSwitchAccountSettings: document.getElementById('btnSwitchAccountSettings'),
    btnDisconnectDriveModal: document.getElementById('btnDisconnectDriveModal'),
    driveLastSyncTime: document.getElementById('driveLastSyncTime'),
    toastNotification: document.getElementById('toastNotification'),

    drivePasswordModal: document.getElementById('drivePasswordModal'),
    drivePasswordAccountNotice: document.getElementById('drivePasswordAccountNotice'),
    drivePasswordAccountEmail: document.getElementById('drivePasswordAccountEmail'),
    btnSwitchAccountInPasswordModal: document.getElementById('btnSwitchAccountInPasswordModal'),
    btnCloseDrivePasswordModal: document.getElementById('btnCloseDrivePasswordModal'),
    btnCancelDrivePasswordModal: document.getElementById('btnCancelDrivePasswordModal'),
    btnConfirmDrivePasswordModal: document.getElementById('btnConfirmDrivePasswordModal'),
    inputModalDrivePassword: document.getElementById('inputModalDrivePassword'),
    btnToggleDrivePassword: document.getElementById('btnToggleDrivePassword'),
    modalDrivePasswordError: document.getElementById('modalDrivePasswordError'),
    btnToggleDrivePasswordDiag: document.getElementById('btnToggleDrivePasswordDiag'),
    drivePasswordDiagBox: document.getElementById('drivePasswordDiagBox'),
    btnResetDriveAppData: document.getElementById('btnResetDriveAppData'),
    driveDiagDetails: document.getElementById('driveDiagDetails'),

    // Modal de Conflito Inicial
    syncConflictModal: document.getElementById('syncConflictModal'),
    btnCloseSyncConflictModal: document.getElementById('btnCloseSyncConflictModal'),
    btnCancelSyncConflictModal: document.getElementById('btnCancelSyncConflictModal'),
    btnMergeSyncConflictModal: document.getElementById('btnMergeSyncConflictModal'),
    btnReplaceSyncConflictModal: document.getElementById('btnReplaceSyncConflictModal'),
    syncConflictDescription: document.getElementById('syncConflictDescription')
  };

  // ─── Inicialização ────────────────────────────────────────────────────────────

  async function initApp() {
    setupEventListeners();

    // Inicializa o serviço do Google Drive em segundo plano
    if (window.GoogleDriveService) {
      GoogleDriveService.init().then(() => {
        updateDriveStatusUI();
      });
    }

    try {
      const initialized = await DBService.isVaultInitialized();
      state.isFirstTimeSetup = !initialized;

      if (state.isFirstTimeSetup) {
        // Primeiro acesso: usuário define a senha inicial
        elements.lockSubtitle.textContent = 'Defina a senha para criar seu cofre';
        elements.btnUnlock.textContent = 'Criar Cofre Seguro';
        elements.passwordInput.placeholder = 'Digite uma senha para o diário...';
      } else {
        // Já possui cofre: tenta desbloqueio silencioso se houver credencial salva
        elements.lockSubtitle.textContent = 'Cofre de Registros Pessoal';
        elements.btnUnlock.textContent = 'Desbloquear Diário';
        elements.passwordInput.placeholder = 'Digite sua senha...';

        const savedPassword = await CryptoService.getSavedPassword();
        if (savedPassword) {
          try {
            await unlockWithPassword(savedPassword);
            return;
          } catch (err) {
            console.warn('Credencial salva inválida ou desatualizada. Solicitando senha.');
            CryptoService.clearSavedPassword();
          }
        }
      }
    } catch (e) {
      showLockError('Erro ao inicializar banco de dados local: ' + e);
    }
  }

  // ─── Notificação Toast Flutuante ──────────────────────────────────────────────

  let toastTimeout = null;
  let toastHideTimeout = null;
  function showToast(message, duration = 3500) {
    if (!elements.toastNotification) return;

    if (toastTimeout) clearTimeout(toastTimeout);
    if (toastHideTimeout) clearTimeout(toastHideTimeout);

    elements.toastNotification.textContent = message;
    elements.toastNotification.classList.remove('hidden');
    elements.toastNotification.classList.remove('toast-hiding');

    toastTimeout = setTimeout(() => {
      elements.toastNotification.classList.add('toast-hiding');
      toastHideTimeout = setTimeout(() => {
        elements.toastNotification.classList.add('hidden');
        elements.toastNotification.classList.remove('toast-hiding');
      }, 300);
    }, duration);
  }

  // ─── Autenticação e Desbloqueio ───────────────────────────────────────────────

  async function handleUnlock() {
    hideLockError();
    const password = elements.passwordInput.value.trim();

    if (!password) {
      showLockError('Por favor, informe a senha.');
      return;
    }

    if (state.isFirstTimeSetup) {
      if (password.length < 4) {
        showLockError('A senha deve conter no mínimo 4 caracteres.');
        return;
      }

      // Cria cofre inicial vazio diretamente com a senha informada
      try {
        elements.btnUnlock.disabled = true;
        elements.btnUnlock.textContent = 'Criando cofre seguro...';

        state.currentPassword = password;
        state.vaultData = { registros: [] };
        await DBService.persistVault(state.vaultData, password);

        if (elements.rememberPasswordCheck.checked) {
          await CryptoService.savePasswordLocally(password);
        } else {
          CryptoService.clearSavedPassword();
        }

        state.isFirstTimeSetup = false;
        showAppScreen();
      } catch (err) {
        showLockError('Falha ao criar cofre: ' + err.message);
      } finally {
        elements.btnUnlock.disabled = false;
        elements.btnUnlock.textContent = 'Criar Cofre Seguro';
      }
      return;
    }

    // Desbloqueio com senha existente
    try {
      elements.btnUnlock.disabled = true;
      elements.btnUnlock.textContent = 'Descriptografando...';
      await unlockWithPassword(password);
    } catch (err) {
      showLockError('Senha incorreta ou integridade dos dados corrompida.');
    } finally {
      elements.btnUnlock.disabled = false;
      elements.btnUnlock.textContent = 'Desbloquear Diário';
    }
  }

  async function unlockWithPassword(password) {
    const data = await DBService.loadVault(password);
    state.currentPassword = password;
    state.vaultData = data;

    if (elements.rememberPasswordCheck.checked) {
      await CryptoService.savePasswordLocally(password);
    } else {
      CryptoService.clearSavedPassword();
    }

    showAppScreen();

    // Se já houver token do Drive ativo, sincroniza silenciosamente
    if (GoogleDriveService.isConnected()) {
      syncWithGoogleDrive(true);
    }
  }

  function showLockScreen() {
    cancelDebouncedDriveSync();
    state.currentPassword = null;
    state.vaultData = { registros: [] };
    elements.passwordInput.value = '';
    hideLockError();

    elements.appScreen.classList.add('hidden');
    elements.lockScreen.classList.remove('hidden');
    elements.passwordInput.focus();
  }

  function showAppScreen() {
    elements.lockScreen.classList.add('hidden');
    elements.appScreen.classList.remove('hidden');
    updateDriveStatusUI();
    renderEntries();
  }

  function showLockError(msg) {
    elements.lockError.textContent = msg;
    elements.lockError.classList.remove('hidden');
  }

  function hideLockError() {
    elements.lockError.classList.add('hidden');
    elements.lockError.textContent = '';
  }

  // ─── Sincronização com Google Drive ───────────────────────────────────────────

  const VIDA_STORAGE_KEYS = (window.GoogleDriveService && window.GoogleDriveService.STORAGE_KEYS) || {
    CLIENT_ID: 'wingene_vida_drive_client_id',
    TOKEN: 'wingene_vida_drive_token',
    TOKEN_EXP: 'wingene_vida_drive_token_exp',
    EMAIL: 'wingene_vida_drive_email',
    LAST_EMAIL: 'wingene_vida_last_drive_email',
    CUSTOM_PASS: 'wingene_vida_drive_custom_pass',
    LAST_SYNC: 'wingene_vida_last_drive_sync',
    LAST_REMOTE_CHANGE: 'wingene_vida_last_remote_change',
    passKey: (email) => `wingene_vida_drive_pass_${email ? email.trim().toLowerCase() : ''}`
  };

  function getVidaItem(key, legacyKey) {
    return localStorage.getItem(key) || (legacyKey ? localStorage.getItem(legacyKey) : null);
  }

  function updateDriveStatusUI() {
    const connected = GoogleDriveService.isConnected();
    const linked = GoogleDriveService.isLinked ? GoogleDriveService.isLinked() : false;
    const userEmail = GoogleDriveService.userEmail || getVidaItem(VIDA_STORAGE_KEYS.EMAIL, 'wingene_drive_email');
    if (connected || linked) {
      elements.btnDriveSync.classList.add('connected');
      elements.btnDriveSync.title = userEmail
        ? `Conectado (${userEmail}) • Clique para sincronizar agora`
        : 'Clique para sincronizar agora com o Google Drive';
      elements.driveSyncText.textContent = userEmail ? userEmail.split('@')[0] : 'Sincronizar';
      elements.driveStatusBadge.textContent = userEmail ? `Conectado (${userEmail})` : 'Conectado';
      elements.driveStatusBadge.style.color = '#34d399';
      elements.btnConnectDriveModal.classList.add('hidden');
      elements.btnDisconnectDriveModal.classList.remove('hidden');
      if (elements.btnSwitchAccountSettings) elements.btnSwitchAccountSettings.classList.remove('hidden');
      elements.btnSyncNowModal.disabled = false;
    } else {
      elements.btnDriveSync.classList.remove('connected');
      elements.btnDriveSync.title = 'Clique para conectar e sincronizar com o Google Drive';
      elements.driveSyncText.textContent = 'Conectar Drive';
      elements.driveStatusBadge.textContent = 'Desconectado';
      elements.driveStatusBadge.style.color = '#94a3b8';
      elements.btnConnectDriveModal.classList.remove('hidden');
      elements.btnDisconnectDriveModal.classList.add('hidden');
      if (elements.btnSwitchAccountSettings) elements.btnSwitchAccountSettings.classList.add('hidden');
      elements.btnSyncNowModal.disabled = true;
    }

    const lastSync = getVidaItem(VIDA_STORAGE_KEYS.LAST_SYNC, 'wingene_last_drive_sync');
    if (lastSync) {
      elements.driveLastSyncTime.textContent = `Última sincronização: ${new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      elements.driveLastSyncTime.textContent = '';
    }
  }

  function promptInitialSyncConflict(localCount, remoteCount) {
    return new Promise((resolve) => {
      const descEl = elements.syncConflictDescription;
      if (descEl) {
        descEl.innerHTML = `Identificamos <strong>${localCount} anotaç${localCount === 1 ? 'ão' : 'ões'}</strong> salva${localCount === 1 ? '' : 's'} neste navegador e <strong>${remoteCount} anotaç${remoteCount === 1 ? 'ão' : 'ões'}</strong> na sua conta do Google Drive.<br><br>Como deseja prosseguir com a sincronização inicial?`;
      }
      elements.syncConflictModal.classList.remove('hidden');

      const cleanup = () => {
        elements.syncConflictModal.classList.add('hidden');
        elements.btnMergeSyncConflictModal.removeEventListener('click', onMerge);
        elements.btnReplaceSyncConflictModal.removeEventListener('click', onReplace);
        elements.btnCancelSyncConflictModal.removeEventListener('click', onCancel);
        elements.btnCloseSyncConflictModal.removeEventListener('click', onCancel);
      };

      const onMerge = () => {
        cleanup();
        resolve('merge');
      };

      const onReplace = () => {
        cleanup();
        resolve('replace');
      };

      const onCancel = () => {
        cleanup();
        resolve('cancel');
      };

      elements.btnMergeSyncConflictModal.addEventListener('click', onMerge);
      elements.btnReplaceSyncConflictModal.addEventListener('click', onReplace);
      elements.btnCancelSyncConflictModal.addEventListener('click', onCancel);
      elements.btnCloseSyncConflictModal.addEventListener('click', onCancel);
    });
  }

  let driveSyncDebounceTimer = null;

  function cancelDebouncedDriveSync() {
    if (driveSyncDebounceTimer) {
      clearTimeout(driveSyncDebounceTimer);
      driveSyncDebounceTimer = null;
    }
  }

  function scheduleDebouncedDriveSync(delayMs = 15000) {
    cancelDebouncedDriveSync();
    driveSyncDebounceTimer = setTimeout(() => {
      driveSyncDebounceTimer = null;
      syncWithGoogleDrive(true);
    }, delayMs);
  }

  async function syncWithGoogleDrive(silent = false, forceFullSync = false) {
    cancelDebouncedDriveSync();
    if (state.isSyncingDrive) return;
    if (!state.currentPassword) {
      if (!silent) alert('Por favor, desbloqueie o diário para sincronizar.');
      return;
    }

    try {
      state.isSyncingDrive = true;
      elements.btnDriveSync.classList.add('syncing');
      elements.driveSyncIcon.classList.add('spin-icon');
      if (elements.driveSyncText) {
        elements.driveSyncText.textContent = 'Sincronizando...';
      }
      elements.btnSyncNowModal.disabled = true;
      elements.btnSyncNowModal.textContent = 'Sincronizando...';

      if (!silent) {
        showToast('Verificando alterações no Drive...');
      }

      // 1. Garante autenticação e obtém e-mail da conta conectada
      await GoogleDriveService.requestToken();
      await GoogleDriveService.fetchUserEmail();
      updateDriveStatusUI();

      const currentEmail = GoogleDriveService.userEmail;
      const lastDriveEmail = getVidaItem(VIDA_STORAGE_KEYS.LAST_EMAIL, 'wingene_last_drive_email');

      // Se trocou de conta Google, limpa os dados locais imediatamente para não misturar diários
      if (currentEmail && lastDriveEmail && lastDriveEmail.trim().toLowerCase() !== currentEmail.trim().toLowerCase()) {
        console.log(`[Drive] Troca de conta detectada: de "${lastDriveEmail}" para "${currentEmail}". Limpando dados locais anteriores.`);
        showToast(`Conta alterada para ${currentEmail}. Limpando dados locais...`);

        state.vaultData = {
          registros: [],
          resumos_mensais: [],
          insights: [],
          propositos: []
        };
        await DBService.persistVault(state.vaultData, state.currentPassword);
        GoogleDriveService.clearSyncCache();
        localStorage.removeItem(VIDA_STORAGE_KEYS.LAST_SYNC);
        localStorage.removeItem('wingene_last_drive_sync');
        renderEntries();

        forceFullSync = true;
      }
      if (currentEmail) {
        localStorage.setItem(VIDA_STORAGE_KEYS.LAST_EMAIL, currentEmail);
      }

      // 2. Resolve a senha da conta Google atual
      const emailKey = currentEmail ? currentEmail.trim().toLowerCase() : null;
      let drivePassword = emailKey ? getVidaItem(VIDA_STORAGE_KEYS.passKey(emailKey), `wingene_drive_pass_${emailKey}`) : null;

      if (!drivePassword) {
        drivePassword =
          sessionStorage.getItem(VIDA_STORAGE_KEYS.CUSTOM_PASS) ||
          sessionStorage.getItem('wingene_drive_custom_pass') ||
          getVidaItem(VIDA_STORAGE_KEYS.CUSTOM_PASS, 'wingene_drive_custom_pass') ||
          state.currentPassword;
      }

      // 3. Fast-path (5 unidades via files.get) quando nada mudou na nuvem
      const token = await GoogleDriveService.requestToken();
      let fileHashCache = forceFullSync ? {} : GoogleDriveService.getFileHashCache();
      const initialDirtyYears = new Set(GoogleDriveService.getDirtySyncYears());
      const lastDriveSync = getVidaItem(VIDA_STORAGE_KEYS.LAST_SYNC, 'wingene_last_drive_sync');
      const isMergeMode = forceFullSync || !lastDriveSync;

      const cachedTsEntry = fileHashCache[GoogleDriveService.TIMESTAMP_FILENAME];
      const hasShardsInCache = Object.keys(fileHashCache).some((k) => GoogleDriveService.isYearShardFilename(k));
      const cachedValEntry = fileHashCache[GoogleDriveService.VALIDATION_FILENAME];
      let validationCacheReady = !cachedValEntry;
      if (cachedValEntry && cachedValEntry.md5) {
        const passFp = await GoogleDriveService.hashPasswordFingerprint(drivePassword || '');
        validationCacheReady =
          cachedValEntry.md5 === localStorage.getItem(GoogleDriveService.STORAGE_KEYS.VALIDATED_HASH_MD5) &&
          passFp === localStorage.getItem(GoogleDriveService.STORAGE_KEYS.VALIDATED_PASS_HASH);
      }

      if (!forceFullSync && !isMergeMode && cachedTsEntry && cachedTsEntry.id && hasShardsInCache && validationCacheReady) {
        const remoteTs = await GoogleDriveService.getFileMetadataById(cachedTsEntry.id, token);
        if (remoteTs && !GoogleDriveService.hasRemoteFileChanged(remoteTs, cachedTsEntry)) {
          const localRecsFast = state.vaultData.registros || [];
          const fastDirtyYears = new Set(initialDirtyYears);
          localRecsFast.forEach((r) => {
            const y = GoogleDriveService.extractRecordYear(r.data);
            if (r.sincronizado === 0 || (r.deletado !== 1 && !fileHashCache[GoogleDriveService.shardFilenameForYear(y)])) {
              fastDirtyYears.add(y);
            }
          });
          const localPropsFast = state.vaultData.propositos || [];
          const needsUploadPropsFast =
            localPropsFast.some((p) => p.sincronizado === 0) ||
            (!fileHashCache[GoogleDriveService.PROPOSITOS_FILENAME] && localPropsFast.length > 0);

          if (fastDirtyYears.size === 0 && !needsUploadPropsFast) {
            console.log('[Drive] Fast-path (files.get 5u): remoto e local inalterados.');
            localStorage.setItem(VIDA_STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
            updateDriveStatusUI();
            if (!silent) showToast('✅ Tudo atualizado! Nenhuma alteração pendente.');
            return;
          }

          let staleIdDetected = false;
          const uploadedFastMap = new Map();
          const cachedRef = (name) => (fileHashCache[name] && fileHashCache[name].id ? { id: fileHashCache[name].id, name } : null);

          try {
            if (fastDirtyYears.size > 0) {
              const grouped = new Map();
              localRecsFast.forEach((rec) => {
                const y = GoogleDriveService.extractRecordYear(rec.data);
                if (!grouped.has(y)) grouped.set(y, []);
                grouped.get(y).push(rec);
              });
              for (const year of fastDirtyYears) {
                const fileName = GoogleDriveService.shardFilenameForYear(year);
                const existingRef = cachedRef(fileName);
                const upMeta = await GoogleDriveService.uploadRecordsFile(
                  fileName,
                  grouped.get(year) || [],
                  drivePassword,
                  existingRef,
                  !existingRef
                );
                if (upMeta) {
                  fileHashCache[fileName] = GoogleDriveService.fileToCacheEntry(upMeta);
                  uploadedFastMap.set(fileName, upMeta);
                }
              }
              localRecsFast.forEach((r) => {
                if (fastDirtyYears.has(GoogleDriveService.extractRecordYear(r.data))) {
                  r.sincronizado = 1;
                }
              });
              GoogleDriveService.clearDirtySyncYears(Array.from(fastDirtyYears));
            }

            if (needsUploadPropsFast) {
              const propRef = cachedRef(GoogleDriveService.PROPOSITOS_FILENAME);
              const upPropMeta = await GoogleDriveService.uploadPropositos(
                localPropsFast,
                drivePassword,
                propRef,
                !propRef,
                true
              );
              if (upPropMeta) {
                fileHashCache[GoogleDriveService.PROPOSITOS_FILENAME] = GoogleDriveService.fileToCacheEntry(upPropMeta);
                uploadedFastMap.set(GoogleDriveService.PROPOSITOS_FILENAME, upPropMeta);
              }
              localPropsFast.forEach((p) => (p.sincronizado = 1));
            }

            await DBService.persistVault(state.vaultData, state.currentPassword);
            const tsMeta = await GoogleDriveService.updateSyncTimestamp(token, remoteTs, false);
            if (tsMeta) {
              fileHashCache[GoogleDriveService.TIMESTAMP_FILENAME] = GoogleDriveService.fileToCacheEntry(tsMeta);
              if (tsMeta.modifiedTime) {
                localStorage.setItem(VIDA_STORAGE_KEYS.LAST_REMOTE_CHANGE, tsMeta.modifiedTime);
              }
            }
            GoogleDriveService.saveFileHashCache(fileHashCache);
            localStorage.setItem(VIDA_STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
            updateDriveStatusUI();
            if (fastDirtyYears.size > 0) {
              showToast(`✅ ${fastDirtyYears.size} partição(ões) salva(s) no Google Drive!`);
            } else {
              showToast('✅ Propósitos sincronizados com o Google Drive!');
            }
            return;
          } catch (fastErr) {
            if (fastErr && fastErr.status === 404) {
              console.warn('[Drive] Fast-path detectou fileId obsoleto (404). Voltando para listagem completa...');
              staleIdDetected = true;
              fileHashCache = {};
              GoogleDriveService.saveFileHashCache({});
            } else {
              throw fastErr;
            }
          }
          if (!staleIdDetected) return;
        }
      }

      // 4. Listagem única da appDataFolder e snapshot completo
      const allFiles = await GoogleDriveService.listAllAppDataFiles();
      const snapshot = GoogleDriveService.buildSnapshot(allFiles);

      // Valida a senha se houver validar.hash (com cache MD5 + SHA-256)
      if (snapshot.validationFile) {
        const isValid = await GoogleDriveService.validatePasswordWithHash(
          drivePassword,
          snapshot.validationFile,
          allFiles,
          forceFullSync
        );
        if (!isValid) {
          throw new Error('PASSWORD_INCORRECT: A senha informada está incorreta para os dados criptografados desta conta no Google Drive.');
        }
        fileHashCache[GoogleDriveService.VALIDATION_FILENAME] = GoogleDriveService.fileToCacheEntry(snapshot.validationFile);
      }

      const localRecords = state.vaultData.registros || [];
      const downloadedShards = new Map();
      const downloadedShardFiles = new Map();
      let authoritativeMaster = null;
      let additiveMaster = null;
      let anyRemoteDownloaded = false;

      // 4. Baixa somente os arquivos necessários (particionados por ano ou master legado)
      if (snapshot.shardFiles.size === 0) {
        if (snapshot.masterFile && snapshot.masterFile.id) {
          const masterChanged =
            isMergeMode ||
            GoogleDriveService.hasRemoteFileChanged(
              snapshot.masterFile,
              fileHashCache[GoogleDriveService.MASTER_FILENAME]
            );
          if (masterChanged || snapshot.shardFiles.size === 0) {
            const dl = await GoogleDriveService.downloadRecordsFile(snapshot.masterFile.id, drivePassword, token);
            authoritativeMaster = dl.records;
            fileHashCache[GoogleDriveService.MASTER_FILENAME] = GoogleDriveService.fileToCacheEntry(snapshot.masterFile);
            anyRemoteDownloaded = true;
          }
        } else if (snapshot.legacyFiles.length > 0) {
          const legList = [];
          for (const lf of snapshot.legacyFiles) {
            try {
              const dl = await GoogleDriveService.downloadRecordsFile(lf.id, drivePassword, token);
              if (dl.records.length > 0) {
                legList.push(...dl.records);
              }
            } catch (err) {
              console.warn(`Erro no arquivo legado ${lf.name}:`, err);
            }
          }
          authoritativeMaster = legList;
          anyRemoteDownloaded = true;
        }
      } else {
        for (const [year, shardFile] of snapshot.shardFiles.entries()) {
          const fileName = shardFile.name || GoogleDriveService.shardFilenameForYear(year);
          const changed =
            isMergeMode ||
            GoogleDriveService.hasRemoteFileChanged(shardFile, fileHashCache[fileName]);
          if (!changed) continue;

          const dl = await GoogleDriveService.downloadRecordsFile(shardFile.id, drivePassword, token);
          downloadedShards.set(year, dl.records);
          downloadedShardFiles.set(fileName, shardFile);
          anyRemoteDownloaded = true;
        }

        // Compatibilidade com clientes antigos que gravam em diario_sync_master.json
        if (snapshot.masterFile && snapshot.masterFile.id) {
          const cachedMaster = fileHashCache[GoogleDriveService.MASTER_FILENAME];
          let shouldCheckMaster = false;
          if (cachedMaster) {
            shouldCheckMaster = GoogleDriveService.hasRemoteFileChanged(snapshot.masterFile, cachedMaster);
          } else {
            const masterMs = snapshot.masterFile.modifiedTime ? new Date(snapshot.masterFile.modifiedTime).getTime() : 0;
            if (masterMs > 0 && (snapshot.latestShardMs === 0 || masterMs > snapshot.latestShardMs + 5000)) {
              shouldCheckMaster = true;
            } else {
              fileHashCache[GoogleDriveService.MASTER_FILENAME] = GoogleDriveService.fileToCacheEntry(snapshot.masterFile);
            }
          }

          if (shouldCheckMaster) {
            const dl = await GoogleDriveService.downloadRecordsFile(snapshot.masterFile.id, drivePassword, token);
            additiveMaster = dl.records;
            fileHashCache[GoogleDriveService.MASTER_FILENAME] = GoogleDriveService.fileToCacheEntry(snapshot.masterFile);
            anyRemoteDownloaded = true;
          }
        }
      }

      // Junta todos os registros remotos baixados para detectar conflito inicial (quando aplicável)
      const allRemoteDownloaded = [];
      if (authoritativeMaster) allRemoteDownloaded.push(...authoritativeMaster);
      downloadedShards.forEach((recs) => allRemoteDownloaded.push(...recs));
      if (additiveMaster) allRemoteDownloaded.push(...additiveMaster);

      let syncAction = 'merge';
      let mergedCount = 0;

      if (!lastDriveSync && localRecords.length > 0 && allRemoteDownloaded.length > 0) {
        const remoteUuidSet = new Set(allRemoteDownloaded.map((r) => r.uuid));
        const hasLocalUnique = localRecords.some((r) => !remoteUuidSet.has(r.uuid));
        if (hasLocalUnique) {
          syncAction = await promptInitialSyncConflict(localRecords.length, allRemoteDownloaded.length);
          if (syncAction === 'cancel') {
            showToast('Sincronização cancelada.');
            return;
          }
        }
      }

      let didUploadRemote = false;
      const uploadedMetaMap = new Map();

      if (syncAction === 'replace') {
        const replaceMap = new Map();
        allRemoteDownloaded.forEach((raw) => {
          const norm = DBService.normalizeRecord(raw);
          norm.sincronizado = 1;
          const prev = replaceMap.get(norm.uuid);
          if (!prev || (norm.versao || 1) > (prev.versao || 1)) {
            replaceMap.set(norm.uuid, norm);
          }
        });
        const normalized = Array.from(replaceMap.values()).filter((r) => r.deletado !== 1);
        state.vaultData.registros = normalized;
        state.vaultData.propositos = [];
        await DBService.persistVault(state.vaultData, state.currentPassword);
        downloadedShardFiles.forEach((file, name) => {
          fileHashCache[name] = GoogleDriveService.fileToCacheEntry(file);
        });
        GoogleDriveService.clearDirtySyncYears();
        renderEntries();
        showToast(`✅ Dados locais zerados. ${normalized.length} registros baixados do Drive.`);
      } else {
        const parseTimestampMs = (r) => {
          const t = new Date(r.lastModified || r.data || 0).getTime();
          return Number.isNaN(t) ? 0 : t;
        };

        const localMap = new Map();
        localRecords.forEach((r) => localMap.set(r.uuid, { ...r }));
        const dirtyYears = new Set(initialDirtyYears);

        // Caso A: Migração a partir de diario_sync_master.json ou legado
        if (authoritativeMaster !== null) {
          const remoteUuidSet = new Set();
          authoritativeMaster.forEach((rawRemote) => {
            const normRemote = DBService.normalizeRecord(rawRemote);
            normRemote.sincronizado = 1;
            remoteUuidSet.add(normRemote.uuid);
            const localRecord = localMap.get(normRemote.uuid);

            if (!localRecord) {
              if (normRemote.deletado !== 1) {
                localMap.set(normRemote.uuid, normRemote);
                mergedCount++;
              }
            } else {
              const localVer = localRecord.versao || 1;
              const remoteVer = normRemote.versao || 1;
              const localTime = parseTimestampMs(localRecord);
              const remoteTime = parseTimestampMs(normRemote);
              if (localRecord.deletado === 1 && normRemote.deletado === 0) {
                if (localRecord.sincronizado === 0) dirtyYears.add(GoogleDriveService.extractRecordYear(localRecord.data));
              } else if (normRemote.deletado === 1 && localRecord.deletado === 0) {
                if (localRecord.sincronizado !== 0) {
                  localMap.set(normRemote.uuid, normRemote);
                  mergedCount++;
                }
              } else if (remoteVer > localVer || remoteTime > localTime + 1000) {
                if (localRecord.sincronizado !== 0 || remoteTime > localTime + 1000) {
                  localMap.set(normRemote.uuid, normRemote);
                  mergedCount++;
                }
              }
            }
          });

          // Cria partições por ano para todos os anos presentes após o merge inicial
          localMap.forEach((rec) => {
            dirtyYears.add(GoogleDriveService.extractRecordYear(rec.data));
          });
          snapshot.shardFiles.forEach((_, yr) => dirtyYears.add(yr));
        }

        // Caso B: Merge por ano dos shards baixados
        for (const [shardYear, remoteRegs] of downloadedShards.entries()) {
          const remoteUuidSet = new Set();

          for (const rawRemote of remoteRegs) {
            const normRemote = DBService.normalizeRecord(rawRemote);
            normRemote.sincronizado = 1;
            remoteUuidSet.add(normRemote.uuid);
            const localRec = localMap.get(normRemote.uuid);

            if (!localRec) {
              if (normRemote.deletado !== 1) {
                localMap.set(normRemote.uuid, normRemote);
                mergedCount++;
              }
              continue;
            }

            const localYear = GoogleDriveService.extractRecordYear(localRec.data);
            const localTime = parseTimestampMs(localRec);
            const remoteTime = parseTimestampMs(normRemote);
            const remoteWins =
              (normRemote.versao || 1) > (localRec.versao || 1) ||
              remoteTime > localTime + 1000;

            if (localYear !== shardYear) {
              if (localRec.sincronizado === 0 || !remoteWins) {
                dirtyYears.add(shardYear);
              } else {
                localMap.set(normRemote.uuid, normRemote);
                mergedCount++;
                dirtyYears.add(localYear);
              }
              continue;
            }

            if (localRec.deletado === 1 && normRemote.deletado === 0) {
              if (localRec.sincronizado === 0) dirtyYears.add(shardYear);
            } else if (normRemote.deletado === 1 && localRec.deletado === 0) {
              if (localRec.sincronizado === 0) {
                dirtyYears.add(shardYear);
              } else {
                localMap.set(normRemote.uuid, normRemote);
                mergedCount++;
              }
            } else if (localRec.sincronizado === 0) {
              if (remoteWins && remoteTime > localTime + 1000) {
                localMap.set(normRemote.uuid, normRemote);
                mergedCount++;
              } else {
                dirtyYears.add(shardYear);
              }
            } else if (remoteWins) {
              localMap.set(normRemote.uuid, normRemote);
              mergedCount++;
            }
          }

          // Registros locais deste ano ausentes no shard remoto autoritativo
          for (const rec of localMap.values()) {
            if (GoogleDriveService.extractRecordYear(rec.data) !== shardYear) continue;
            if (remoteUuidSet.has(rec.uuid)) continue;
            if (rec.sincronizado === 0) {
              dirtyYears.add(shardYear);
            } else if (rec.deletado !== 1) {
              rec.deletado = 1;
              rec.sincronizado = 1;
              mergedCount++;
            }
          }
        }

        // Atualiza cache dos shards baixados
        downloadedShardFiles.forEach((file, name) => {
          fileHashCache[name] = GoogleDriveService.fileToCacheEntry(file);
        });

        // Fallback aditivo: se cliente antigo gravou em diario_sync_master.json
        if (additiveMaster !== null) {
          for (const rawRemote of additiveMaster) {
            const normRemote = DBService.normalizeRecord(rawRemote);
            normRemote.sincronizado = 1;
            const remoteYear = GoogleDriveService.extractRecordYear(normRemote.data);
            const localRec = localMap.get(normRemote.uuid);

            if (!localRec) {
              if (normRemote.deletado !== 1) {
                localMap.set(normRemote.uuid, normRemote);
                mergedCount++;
                dirtyYears.add(remoteYear);
              }
              continue;
            }

            const localYear = GoogleDriveService.extractRecordYear(localRec.data);
            const localTime = parseTimestampMs(localRec);
            const remoteTime = parseTimestampMs(normRemote);
            const remoteWins =
              (normRemote.versao || 1) > (localRec.versao || 1) ||
              remoteTime > localTime + 1000;

            if (localRec.deletado === 1 && normRemote.deletado === 0) {
              if (localRec.sincronizado === 0) dirtyYears.add(localYear);
            } else if (normRemote.deletado === 1 && localRec.deletado === 0) {
              if (localRec.sincronizado === 0) {
                dirtyYears.add(localYear);
              } else {
                localMap.set(normRemote.uuid, normRemote);
                mergedCount++;
                dirtyYears.add(remoteYear);
                if (localYear !== remoteYear) dirtyYears.add(localYear);
              }
            } else if (remoteWins && localRec.sincronizado !== 0) {
              localMap.set(normRemote.uuid, normRemote);
              mergedCount++;
              dirtyYears.add(remoteYear);
              if (localYear !== remoteYear) dirtyYears.add(localYear);
            } else if (localRec.sincronizado === 0) {
              dirtyYears.add(localYear);
            }
          }
        }

        // Garante que qualquer ano com alterações locais pendentes ou ainda sem shard remoto seja enviado
        localMap.forEach((rec) => {
          const y = GoogleDriveService.extractRecordYear(rec.data);
          if (rec.sincronizado === 0) {
            dirtyYears.add(y);
          } else if (rec.deletado !== 1 && !snapshot.shardFiles.has(y)) {
            dirtyYears.add(y);
          }
        });

        state.vaultData.registros = Array.from(localMap.values());
        if (mergedCount > 0) {
          await DBService.persistVault(state.vaultData, state.currentPassword);
          renderEntries();
        }

        // 5. Upload seletivo APENAS das partições (anos) alteradas
        if (dirtyYears.size > 0) {
          const groupedByYear = new Map();
          state.vaultData.registros.forEach((rec) => {
            const y = GoogleDriveService.extractRecordYear(rec.data);
            if (!groupedByYear.has(y)) groupedByYear.set(y, []);
            groupedByYear.get(y).push(rec);
          });

          for (const year of dirtyYears) {
            const regsForYear = groupedByYear.get(year) || [];
            const fileName = GoogleDriveService.shardFilenameForYear(year);
            const existingShard = snapshot.shardFiles.get(year) || null;
            const uploadedMeta = await GoogleDriveService.uploadRecordsFile(
              fileName,
              regsForYear,
              drivePassword,
              existingShard,
              !existingShard
            );
            if (uploadedMeta) {
              fileHashCache[fileName] = GoogleDriveService.fileToCacheEntry(uploadedMeta);
              uploadedMetaMap.set(fileName, uploadedMeta);
            }
          }

          // Se a nuvem ainda não tinha diario_sync_master.json e há registros locais, cria o inicial
          if (!snapshot.masterFile && state.vaultData.registros.length > 0) {
            const createdMaster = await GoogleDriveService.uploadRecordsFile(
              GoogleDriveService.MASTER_FILENAME,
              state.vaultData.registros,
              drivePassword,
              null,
              true
            );
            if (createdMaster) {
              fileHashCache[GoogleDriveService.MASTER_FILENAME] = GoogleDriveService.fileToCacheEntry(createdMaster);
              uploadedMetaMap.set(GoogleDriveService.MASTER_FILENAME, createdMaster);
            }
          }

          state.vaultData.registros.forEach((r) => {
            if (dirtyYears.has(GoogleDriveService.extractRecordYear(r.data))) {
              r.sincronizado = 1;
            }
          });
          await DBService.persistVault(state.vaultData, state.currentPassword);
          GoogleDriveService.clearDirtySyncYears(Array.from(dirtyYears));
          didUploadRemote = true;

          if (mergedCount > 0) {
            showToast(`✅ Sincronizado! ${mergedCount} alterações mescladas.`);
          } else {
            showToast(`✅ ${dirtyYears.size} partição(ões) salva(s) no Google Drive!`);
          }
        } else if (mergedCount > 0 || anyRemoteDownloaded) {
          if (mergedCount > 0) {
            showToast(`✅ ${mergedCount} registro(s) atualizado(s) da nuvem!`);
          } else if (!silent) {
            showToast('✅ Tudo atualizado! Nenhuma alteração pendente.');
          }
        } else if (!snapshot.masterFile && snapshot.shardFiles.size === 0 && state.vaultData.registros.length === 0) {
          if (!silent) {
            const emailMsg = GoogleDriveService.userEmail ? `na conta ${GoogleDriveService.userEmail}` : 'no Google Drive';
            alert(`Nenhum arquivo de diário encontrado ${emailMsg}.\n\n💡 Verifique se você fez login com a mesma conta Google utilizada no aplicativo móvel.`);
          }
        } else if (!silent) {
          showToast('✅ Tudo atualizado! Nenhuma alteração pendente.');
        }
      }

      // Garante validar.hash apenas se ausente na nuvem e houver dados/senha
      if (
        !snapshot.validationFile &&
        drivePassword &&
        (didUploadRemote || snapshot.shardFiles.size > 0 || snapshot.masterFile)
      ) {
        const createdVal = await GoogleDriveService.createOrUpdateValidationFile(drivePassword, null, true);
        if (createdVal) {
          fileHashCache[GoogleDriveService.VALIDATION_FILENAME] = GoogleDriveService.fileToCacheEntry(createdVal);
        }
      }

      // Limpa duplicatas apenas se realmente encontradas no snapshot
      if (snapshot.duplicates.length > 0) {
        await GoogleDriveService.cleanupDuplicates(token, allFiles);
      }

      // 6. Sincronização de Propósitos (propositos_backup.json) por MD5
      try {
        const propFile = snapshot.propositosFile;
        const propFileName = GoogleDriveService.PROPOSITOS_FILENAME;
        const remotePropChanged =
          !!propFile &&
          (forceFullSync ||
            isMergeMode ||
            GoogleDriveService.hasRemoteFileChanged(propFile, fileHashCache[propFileName]));

        let propLocalModified = false;
        if (remotePropChanged && syncAction !== 'replace') {
          const remoteProps = await GoogleDriveService.downloadPropositos(drivePassword, propFile, false);
          if (remoteProps && remoteProps.length > 0) {
            const propMap = new Map();
            (state.vaultData.propositos || []).forEach((p) => {
              if (p && p.uuid) propMap.set(p.uuid, p);
            });
            remoteProps.forEach((rp) => {
              if (rp && rp.uuid) {
                if (!propMap.has(rp.uuid)) {
                  propMap.set(rp.uuid, rp);
                  propLocalModified = true;
                } else {
                  const localP = propMap.get(rp.uuid);
                  if (localP.sincronizado !== 0) {
                    propMap.set(rp.uuid, { ...localP, ...rp, sincronizado: 1 });
                    propLocalModified = true;
                  }
                }
              }
            });
            state.vaultData.propositos = Array.from(propMap.values());
          }
          fileHashCache[propFileName] = GoogleDriveService.fileToCacheEntry(propFile);
        }

        const localProps = state.vaultData.propositos || [];
        const localHasUnsyncedProps = localProps.some((p) => p.sincronizado === 0);
        const missingRemoteProps = !propFile && localProps.length > 0;

        if (localHasUnsyncedProps || missingRemoteProps) {
          const upMeta = await GoogleDriveService.uploadPropositos(
            localProps,
            drivePassword,
            propFile,
            !propFile
          );
          if (upMeta) {
            fileHashCache[propFileName] = GoogleDriveService.fileToCacheEntry(upMeta);
            uploadedMetaMap.set(propFileName, upMeta);
          }
          localProps.forEach((p) => (p.sincronizado = 1));
          propLocalModified = true;
          didUploadRemote = true;
        }

        if (propLocalModified) {
          await DBService.persistVault(state.vaultData, state.currentPassword);
        }
      } catch (propErr) {
        console.warn('[Drive] Aviso na sincronização de propósitos:', propErr);
      }

      // 7. Atualiza timestamp remoto apenas se houve upload e persiste cache de hashes
      if (didUploadRemote) {
        const tsMeta = await GoogleDriveService.updateSyncTimestamp(
          token,
          snapshot.timestampFile,
          !snapshot.timestampFile
        );
        if (tsMeta) {
          fileHashCache[GoogleDriveService.TIMESTAMP_FILENAME] = GoogleDriveService.fileToCacheEntry(tsMeta);
        }
        const newModTime = (tsMeta && tsMeta.modifiedTime) || new Date().toISOString();
        localStorage.setItem(VIDA_STORAGE_KEYS.LAST_REMOTE_CHANGE, newModTime);
      } else if (snapshot.timestampFile) {
        fileHashCache[GoogleDriveService.TIMESTAMP_FILENAME] = GoogleDriveService.fileToCacheEntry(snapshot.timestampFile);
        if (snapshot.timestampFile.modifiedTime) {
          localStorage.setItem(VIDA_STORAGE_KEYS.LAST_REMOTE_CHANGE, snapshot.timestampFile.modifiedTime);
        }
      } else if (snapshot.latestShardMs > 0) {
        localStorage.setItem(VIDA_STORAGE_KEYS.LAST_REMOTE_CHANGE, new Date(snapshot.latestShardMs).toISOString());
      } else if (snapshot.masterFile && snapshot.masterFile.modifiedTime) {
        localStorage.setItem(VIDA_STORAGE_KEYS.LAST_REMOTE_CHANGE, snapshot.masterFile.modifiedTime);
      }

      GoogleDriveService.saveFileHashCache(fileHashCache);

      // 8. Atualiza informações de diagnóstico na tela reutilizando metadados locais (zero listagens extras)
      if (elements.driveDiagDetails) {
        const diagMap = new Map();
        allFiles.forEach((f) => diagMap.set(f.name, f));
        uploadedMetaMap.forEach((f, name) => diagMap.set(name, f));
        const diagFiles = Array.from(diagMap.values());
        const filesInfo = diagFiles.length > 0
          ? diagFiles.map((f) => `• ${f.name} (ID: ${(f.id || '').slice(0, 10)}..., modificado: ${f.modifiedTime ? new Date(f.modifiedTime).toLocaleTimeString() : 'agora'})`).join('\n')
          : 'Nenhum arquivo listado.';
        elements.driveDiagDetails.textContent =
          `Conta: ${GoogleDriveService.userEmail || 'N/A'}\n` +
          `Registros no PWA: ${state.vaultData.registros.length}\n` +
          `Arquivos no Drive:\n${filesInfo}`;
      }

      const now = Date.now();
      localStorage.setItem(VIDA_STORAGE_KEYS.LAST_SYNC, new Date(now).toISOString());
      updateDriveStatusUI();
    } catch (err) {
      console.error('Erro na sincronização com o Drive:', err);
      const isPasswordError =
        err.message &&
        (err.message.includes('PASSWORD_INCORRECT') ||
         err.message.includes('PASSWORD_REQUIRED') ||
         err.message.includes('senha informada') ||
         err.message.includes('Unexpected token') ||
         err.message.includes('corrompida'));

      if (isPasswordError) {
        showToast('Senha de criptografia do Drive necessária.');
        promptDrivePassword(GoogleDriveService.userEmail, err.message || 'Senha de criptografia incorreta para esta conta do Google Drive.');
      } else if (!silent) {
        alert('Erro ao sincronizar com o Google Drive: ' + err.message);
        showToast('Falha ao sincronizar com o Drive');
      }
    } finally {
      state.isSyncingDrive = false;
      elements.btnDriveSync.classList.remove('syncing');
      elements.driveSyncIcon.classList.remove('spin-icon');
      updateDriveStatusUI();
      elements.btnSyncNowModal.disabled = false;
      elements.btnSyncNowModal.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Sincronizar Agora
      `;
    }
  }

  // ─── Renderização de Entradas e Visualização de IA ───────────────────────────

  function getFilteredEntries() {
    const all = (state.vaultData && state.vaultData.registros) || [];

    return all.filter((entry) => {
      // Ignora registros deletados
      if (entry.deletado === 1) return false;

      // Filtro por pilar
      if (state.activePilar !== 'ALL' && entry.pilar !== state.activePilar) {
        return false;
      }

      // Filtro de busca textual
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const content = (entry.conteudo || '').toLowerCase();
        const tags = (entry.tags || '').toLowerCase();
        const obs = (entry.observacao || '').toLowerCase();
        const comentario = (entry.comentarioVida || '').toLowerCase();
        const palavraChave = (entry.palavraChave || '').toLowerCase();

        const matches =
          content.includes(q) ||
          tags.includes(q) ||
          obs.includes(q) ||
          comentario.includes(q) ||
          palavraChave.includes(q);

        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
  }

  function renderEntries() {
    const entries = getFilteredEntries();

    elements.entriesCountText.textContent = `${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'}`;

    if (entries.length > 0) {
      const somaImpacto = entries.reduce((acc, curr) => acc + (curr.impacto || 0), 0);
      const media = (somaImpacto / entries.length).toFixed(1);
      elements.entriesImpactText.textContent = `Impacto médio: ${media > 0 ? '+' : ''}${media}`;
    } else {
      elements.entriesImpactText.textContent = 'Impacto médio: 0.0';
    }

    if (entries.length === 0) {
      elements.entriesList.innerHTML = '';
      elements.emptyState.classList.remove('hidden');
      return;
    }

    elements.emptyState.classList.add('hidden');

    const propositos = state.vaultData.propositos || [];
    const propositosMap = new Map();
    propositos.forEach((p) => {
      if (p && p.uuid) propositosMap.set(p.uuid, p);
    });

    const html = entries.map((entry) => {
      const pilarClass = `pilar-${(entry.pilar || 'V').toLowerCase()}`;
      const pilarNome = {
        V: 'Valores',
        I: 'Imperfeições',
        D: 'Decisões',
        A: 'Atenção'
      }[entry.pilar] || entry.pilar;

      let dateDisplay = entry.data;
      try {
        const d = new Date(entry.data);
        if (!isNaN(d.getTime())) {
          dateDisplay = d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (_) {}

      const imp = typeof entry.impacto === 'number' ? entry.impacto : 0;
      let impactoClass = 'neutro';
      let impactoText = `${imp}`;
      if (imp > 0) {
        impactoClass = 'positivo';
        impactoText = `+${imp}`;
      } else if (imp < 0) {
        impactoClass = 'negativo';
      }

      const tagsList = (entry.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const tagsHtml = tagsList
        .map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`)
        .join('');

      // Propósito associado
      const propUuid = entry.propositoUuid || entry.proposito_uuid;
      const prop = propUuid ? propositosMap.get(propUuid) : null;
      let propositoHtml = '';
      if (prop) {
        const eixoClass = `pilar-${(prop.eixo || 'v').toLowerCase()}`;
        propositoHtml = `
          <span class="proposito-badge ${eixoClass}" title="Propósito: ${escapeHtml(prop.titulo)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            ${escapeHtml(prop.titulo)}
          </span>
        `;
      }

      // Bloco de Resultados da IA (Somente Leitura)
      let aiHtml = '';
      const hasAi = entry.comentarioVida && entry.comentarioVida.trim().length > 0;
      if (hasAi) {
        aiHtml = `
          <div class="ai-insight-box">
            <div class="ai-header">
              <span class="ai-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
                Mentor da Vida (IA)
              </span>
              <span class="ai-badge-readonly">Somente-leitura</span>
            </div>
            <p class="ai-comment">"${escapeHtml(entry.comentarioVida)}"</p>
            ${entry.palavraChave ? `<span class="ai-keyword-tag">Palavra-chave: ${escapeHtml(entry.palavraChave)}</span>` : ''}
            ${entry.observacao ? `<div class="ai-observation">${escapeHtml(entry.observacao)}</div>` : ''}
          </div>
        `;
      }

      return `
        <article class="entry-card ${pilarClass}" data-uuid="${entry.uuid}">
          <header class="entry-header">
            <div class="entry-badges">
              <span class="pilar-badge ${pilarClass}">${escapeHtml(pilarNome)}</span>
              <span class="impacto-badge ${impactoClass}">Impacto ${impactoText}</span>
              ${entry.categoria ? `<span class="tag-chip" style="font-weight:700;">${escapeHtml(entry.categoria)}</span>` : ''}
              ${propositoHtml}
            </div>
            <time class="entry-date">${dateDisplay}</time>
          </header>

          <div class="entry-content">${escapeHtml(entry.conteudo)}</div>

          ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ''}

          ${aiHtml}

          <footer class="entry-actions">
            <button class="btn btn-secondary btn-sm btn-edit" data-uuid="${entry.uuid}" title="Editar Entrada">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Editar
            </button>
            <button class="btn btn-secondary btn-sm btn-delete" data-uuid="${entry.uuid}" title="Excluir Entrada" style="color:#fb7185;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Excluir
            </button>
          </footer>
        </article>
      `;
    }).join('');

    elements.entriesList.innerHTML = html;
  }

  // ─── Propósitos no PWA ────────────────────────────────────────────────────────

  function populatePropositoSelect(selectedUuid = null) {
    if (!elements.entryProposito) return;
    const propositos = state.vaultData.propositos || [];
    // Filtra não deletados
    const disponiveis = propositos.filter((p) => p && p.deletado !== 1);

    let html = '<option value="">(Nenhum propósito selecionado)</option>';
    disponiveis.forEach((p) => {
      const eixo = (p.eixo || 'V').toUpperCase();
      const isSel = selectedUuid && String(p.uuid) === String(selectedUuid) ? 'selected' : '';
      html += `<option value="${escapeHtml(p.uuid)}" ${isSel}>[${eixo}] ${escapeHtml(p.titulo)}</option>`;
    });

    elements.entryProposito.innerHTML = html;
    if (selectedUuid) {
      elements.entryProposito.value = selectedUuid;
    }
  }

  function openQuickPropositoModal() {
    if (!elements.quickPropositoModal) return;
    if (elements.newPropositoTitulo) elements.newPropositoTitulo.value = '';
    if (elements.newPropositoDescricao) elements.newPropositoDescricao.value = '';

    // Sugere o mesmo pilar atualmente selecionado no modal de entrada
    const selectedOption = elements.modalPilarSelector.querySelector('.pilar-option.selected');
    const pilar = selectedOption ? selectedOption.dataset.pilar : 'V';
    selectEixoInPropositoModal(pilar);

    elements.quickPropositoModal.classList.remove('hidden');
    if (elements.newPropositoTitulo) elements.newPropositoTitulo.focus();
  }

  function closeQuickPropositoModal() {
    if (!elements.quickPropositoModal) return;
    elements.quickPropositoModal.classList.add('hidden');
  }

  function selectEixoInPropositoModal(eixoLetter) {
    if (!elements.newPropositoEixoSelector) return;
    elements.newPropositoEixoSelector.querySelectorAll('.pilar-option').forEach((opt) => {
      if (opt.dataset.eixo === eixoLetter) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });
  }

  async function saveQuickProposito() {
    if (!elements.newPropositoTitulo) return;
    const titulo = elements.newPropositoTitulo.value.trim();
    if (!titulo) {
      alert('Por favor, informe o título do propósito.');
      elements.newPropositoTitulo.focus();
      return;
    }

    const desc = elements.newPropositoDescricao ? elements.newPropositoDescricao.value.trim() : '';
    const selEixo = elements.newPropositoEixoSelector ? elements.newPropositoEixoSelector.querySelector('.pilar-option.selected') : null;
    const eixo = selEixo ? selEixo.dataset.eixo : 'V';

    const novoProp = {
      id: null,
      uuid: DBService.generateUUID(),
      titulo: titulo,
      descricao: desc,
      eixo: eixo,
      categoriaCodigo: '',
      dataCriacao: new Date().toISOString(),
      justificativaIA: '',
      progresso: 0,
      status: 0,
      sincronizado: 0,
      deletado: 0
    };

    state.vaultData.propositos = state.vaultData.propositos || [];
    state.vaultData.propositos.push(novoProp);

    await DBService.persistVault(state.vaultData, state.currentPassword);
    populatePropositoSelect(novoProp.uuid);
    closeQuickPropositoModal();
    showToast(`Propósito "${titulo}" criado e selecionado!`);

    // Sincroniza em segundo plano (com debounce) se conectado ao Google Drive
    if (GoogleDriveService.isConnected() || (GoogleDriveService.isLinked && GoogleDriveService.isLinked())) {
      scheduleDebouncedDriveSync();
    }
  }

  // ─── CRUD de Entradas (Editor em Tela Cheia) ─────────────────────────────────

  function updateEditorWordCount() {
    if (!elements.editorWordCount || !elements.entryConteudo) return;
    const text = elements.entryConteudo.value.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    elements.editorWordCount.textContent = `${words} palavra${words === 1 ? '' : 's'} • ${chars} caractere${chars === 1 ? '' : 's'}`;
  }

  function updateExtraOptionsIndicator() {
    if (!elements.extraOptionsIndicator) return;
    const imp = elements.entryImpacto ? elements.entryImpacto.value : '0';
    const tags = elements.entryTags ? elements.entryTags.value.trim() : '';
    const cat = elements.entryCategoria ? elements.entryCategoria.value.trim() : '';
    const hasAi = elements.modalAiPreviewBox && !elements.modalAiPreviewBox.classList.contains('hidden');
    const hasExtra = imp !== '0' || tags !== '' || cat !== '' || hasAi;
    elements.extraOptionsIndicator.classList.toggle('hidden', !hasExtra);
  }

  function openExtraOptionsDrawer() {
    if (elements.editorExtraOptionsDrawer) {
      elements.editorExtraOptionsDrawer.classList.remove('hidden');
    }
    if (elements.drawerBackdrop) {
      elements.drawerBackdrop.classList.remove('hidden');
    }
  }

  function closeExtraOptionsDrawer() {
    if (elements.editorExtraOptionsDrawer) {
      elements.editorExtraOptionsDrawer.classList.add('hidden');
    }
    if (elements.drawerBackdrop) {
      elements.drawerBackdrop.classList.add('hidden');
    }
  }

  function toggleExtraOptionsDrawer() {
    if (!elements.editorExtraOptionsDrawer) return;
    const isHidden = elements.editorExtraOptionsDrawer.classList.contains('hidden');
    if (isHidden) {
      openExtraOptionsDrawer();
    } else {
      closeExtraOptionsDrawer();
    }
  }

  function openNewEntryModal() {
    state.editingUuid = null;
    elements.modalEntryTitle.textContent = 'Nova Entrada';
    elements.entryUuid.value = '';
    elements.entryConteudo.value = '';

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    elements.entryData.value = localISOTime;

    selectPilarInModal('V');

    elements.entryImpacto.value = '0';
    updateImpactoDisplay(0);

    elements.entryTags.value = '';
    elements.entryCategoria.value = '';
    populatePropositoSelect(null);
    elements.modalAiPreviewBox.classList.add('hidden');

    closeExtraOptionsDrawer();
    updateExtraOptionsIndicator();
    updateEditorWordCount();

    elements.entryModal.classList.remove('hidden');
    elements.entryConteudo.focus();
  }

  function openEditEntryModal(uuid) {
    const entry = state.vaultData.registros.find((r) => r.uuid === uuid);
    if (!entry) return;

    state.editingUuid = uuid;
    elements.modalEntryTitle.textContent = 'Editar Entrada';
    elements.entryUuid.value = entry.uuid;
    elements.entryConteudo.value = entry.conteudo || '';

    try {
      const d = new Date(entry.data);
      const tzOffset = d.getTimezoneOffset() * 60000;
      elements.entryData.value = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    } catch (_) {
      elements.entryData.value = new Date().toISOString().slice(0, 16);
    }

    selectPilarInModal(entry.pilar || 'V');

    const imp = typeof entry.impacto === 'number' ? entry.impacto : 0;
    elements.entryImpacto.value = String(imp);
    updateImpactoDisplay(imp);

    elements.entryTags.value = entry.tags || '';
    elements.entryCategoria.value = entry.categoria || '';
    populatePropositoSelect(entry.propositoUuid || entry.proposito_uuid || null);

    if (entry.comentarioVida && entry.comentarioVida.trim()) {
      elements.modalAiPreviewComment.textContent = `"${entry.comentarioVida}"`;
      elements.modalAiPreviewKeyword.textContent = entry.palavraChave ? `Palavra-chave: ${entry.palavraChave}` : '';
      elements.modalAiPreviewBox.classList.remove('hidden');
    } else {
      elements.modalAiPreviewBox.classList.add('hidden');
    }

    closeExtraOptionsDrawer();
    updateExtraOptionsIndicator();
    updateEditorWordCount();

    elements.entryModal.classList.remove('hidden');
    elements.entryConteudo.focus();
  }

  function closeEntryModal() {
    closeExtraOptionsDrawer();
    elements.entryModal.classList.add('hidden');
    state.editingUuid = null;
  }

  async function saveEntry() {
    const conteudo = elements.entryConteudo.value.trim();
    if (!conteudo) {
      alert('Por favor, escreva o conteúdo da entrada.');
      elements.entryConteudo.focus();
      return;
    }

    const selectedOption = elements.modalPilarSelector.querySelector('.pilar-option.selected');
    const pilar = selectedOption ? selectedOption.dataset.pilar : 'V';
    const dataIso = new Date(elements.entryData.value).toISOString();
    const impacto = parseInt(elements.entryImpacto.value, 10) || 0;
    const tags = elements.entryTags.value.trim();
    const categoria = elements.entryCategoria.value.trim();
    const propositoUuid = elements.entryProposito && elements.entryProposito.value ? elements.entryProposito.value.trim() : null;
    const nowIso = new Date().toISOString();

    if (state.editingUuid) {
      // Atualizar entrada existente
      const idx = state.vaultData.registros.findIndex((r) => r.uuid === state.editingUuid);
      if (idx !== -1) {
        const existing = state.vaultData.registros[idx];
        const oldYear = GoogleDriveService.extractRecordYear(existing.data);
        const newYear = GoogleDriveService.extractRecordYear(dataIso);
        if (oldYear !== newYear) {
          GoogleDriveService.addDirtySyncYear(oldYear);
        }
        state.vaultData.registros[idx] = {
          ...existing,
          conteudo,
          pilar,
          pilarPrincipal: pilar,
          data: dataIso,
          impacto,
          impactos: String(impacto),
          tags,
          categoria,
          propositoUuid: propositoUuid || null,
          proposito_uuid: propositoUuid || null,
          lastModified: nowIso,
          versao: (existing.versao || 1) + 1,
          sincronizado: 0,
          origem: existing.origem || 'pwa'
        };
      }
    } else {
      // Nova entrada
      const newEntry = DBService.normalizeRecord({
        conteudo,
        pilar,
        pilarPrincipal: pilar,
        data: dataIso,
        impacto,
        impactos: String(impacto),
        tags,
        categoria,
        propositoUuid: propositoUuid || null,
        proposito_uuid: propositoUuid || null,
        lastModified: nowIso,
        versao: 1,
        sincronizado: 0,
        origem: 'pwa'
      });
      state.vaultData.registros.unshift(newEntry);
    }

    try {
      elements.btnSaveEntry.disabled = true;
      elements.btnSaveEntry.textContent = 'Salvando...';

      // 1. Salva no cofre local IndexedDB
      await DBService.persistVault(state.vaultData, state.currentPassword);
      closeEntryModal();
      renderEntries();
      showToast('Entrada salva com sucesso!');

      // 2. Se o Google Drive estiver conectado ou vinculado, agenda sync com debounce
      if (GoogleDriveService.isConnected() || (GoogleDriveService.isLinked && GoogleDriveService.isLinked())) {
        scheduleDebouncedDriveSync();
      }
    } catch (e) {
      alert('Erro ao salvar entrada: ' + e.message);
    } finally {
      elements.btnSaveEntry.disabled = false;
      elements.btnSaveEntry.textContent = 'Salvar Entrada';
    }
  }

  function promptDeleteEntry(uuid) {
    state.pendingDeleteUuid = uuid;
    elements.deleteModal.classList.remove('hidden');
  }

  function closeDeleteModal() {
    elements.deleteModal.classList.add('hidden');
    state.pendingDeleteUuid = null;
  }

  async function confirmDeleteEntry() {
    if (!state.pendingDeleteUuid) return;
    const uuid = state.pendingDeleteUuid;

    const idx = state.vaultData.registros.findIndex((r) => r.uuid === uuid);
    if (idx !== -1) {
      state.vaultData.registros[idx].deletado = 1;
      state.vaultData.registros[idx].lastModified = new Date().toISOString();
      state.vaultData.registros[idx].versao = (state.vaultData.registros[idx].versao || 1) + 1;
      state.vaultData.registros[idx].sincronizado = 0;

      try {
        await DBService.persistVault(state.vaultData, state.currentPassword);
        showToast('Entrada excluída.');

        if (GoogleDriveService.isConnected() || (GoogleDriveService.isLinked && GoogleDriveService.isLinked())) {
          scheduleDebouncedDriveSync();
        }
      } catch (e) {
        alert('Erro ao persistir exclusão: ' + e.message);
      }
    }

    closeDeleteModal();
    renderEntries();
  }

  // ─── Pilares e Impacto na UI ──────────────────────────────────────────────────

  function selectPilarInModal(pilarLetter) {
    elements.modalPilarSelector.querySelectorAll('.pilar-option').forEach((opt) => {
      if (opt.dataset.pilar === pilarLetter) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });
  }

  function updateImpactoDisplay(val) {
    elements.entryImpactoDisplay.textContent = val > 0 ? `+${val}` : `${val}`;
    if (val > 0) {
      elements.entryImpactoDisplay.style.color = '#34d399';
    } else if (val < 0) {
      elements.entryImpactoDisplay.style.color = '#fb7185';
    } else {
      elements.entryImpactoDisplay.style.color = 'var(--text-secondary)';
    }
    updateExtraOptionsIndicator();
  }

  // ─── Importação / Exportação de Backups ───────────────────────────────────────

  function exportBackup() {
    if (!state.vaultData) return;
    const jsonStr = JSON.stringify(state.vaultData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `wingene_vida_backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target.result;
        let drivePassword = state.currentPassword;
        if (!drivePassword) {
          const saved = await CryptoService.getSavedPasswordLocally();
          if (saved) drivePassword = saved;
        }

        let parsed = null;
        try {
          parsed = await CryptoService.decryptDartFormat(arrayBuffer, drivePassword);
        } catch (decryptErr) {
          const isPassErr = decryptErr.message && (
            decryptErr.message.includes('PASSWORD_') ||
            decryptErr.message.includes('senha') ||
            decryptErr.message.includes('corrompida')
          );
          if (isPassErr) {
            const userPass = prompt('Este arquivo de backup está protegido por senha. Digite a senha do seu diário para descriptografar:');
            if (!userPass) {
              alert('Importação cancelada: a senha é necessária para ler este arquivo de backup.');
              return;
            }
            parsed = await CryptoService.decryptDartFormat(arrayBuffer, userPass);
          } else {
            throw decryptErr;
          }
        }

        const importedRecords = DBService.importBackupData(parsed);

        if (importedRecords.length === 0) {
          alert('Nenhum registro encontrado no arquivo.');
          return;
        }

        const existingMap = new Map();
        (state.vaultData.registros || []).forEach((r) => existingMap.set(r.uuid, r));

        importedRecords.forEach((item) => {
          existingMap.set(item.uuid, item);
        });

        state.vaultData.registros = Array.from(existingMap.values());

        if (importedRecords.propositos && importedRecords.propositos.length > 0) {
          const propMap = new Map();
          (state.vaultData.propositos || []).forEach((p) => {
            if (p && p.uuid) propMap.set(p.uuid, p);
          });
          importedRecords.propositos.forEach((p) => {
            if (p && p.uuid) propMap.set(p.uuid, p);
          });
          state.vaultData.propositos = Array.from(propMap.values());
        }

        await DBService.persistVault(state.vaultData, state.currentPassword);

        renderEntries();
        alert(`✅ ${importedRecords.length} registros importados com sucesso!`);
        elements.settingsModal.classList.add('hidden');

        if (GoogleDriveService.isConnected() || (GoogleDriveService.isLinked && GoogleDriveService.isLinked())) {
          showToast('Sincronizando base completa com o Google Drive...');
          syncWithGoogleDrive(true);
        }
      } catch (err) {
        console.error('Falha ao importar backup:', err);
        alert('Falha ao importar backup: ' + (err.message || 'Arquivo inválido ou senha incorreta.'));
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function loadSampleMockData() {
    if (!confirm('Deseja carregar as 11 entradas de demonstração em português do Método VIDA?')) {
      return;
    }

    try {
      const res = await fetch('./diario_backup_mock_pt.json');
      if (!res.ok) {
        throw new Error('Não foi possível carregar o arquivo de exemplo local.');
      }
      const data = await res.json();
      const records = DBService.importBackupData(data);

      if (state.currentPassword) {
        state.vaultData.registros = records;
        await DBService.persistVault(state.vaultData, state.currentPassword);
        renderEntries();
        showToast('11 entradas de exemplo carregadas no seu diário!');
      } else {
        elements.passwordInput.value = '1234';
        handleUnlock().then(async () => {
          state.vaultData.registros = records;
          await DBService.persistVault(state.vaultData, state.currentPassword);
          renderEntries();
        });
      }
    } catch (err) {
      alert('Erro ao carregar dados de teste: ' + err.message);
    }
  }

  // ─── Gerenciamento de Senhas & Cofre ──────────────────────────────────────────

  async function applyNewPassword() {
    if (!elements.changePassNew) return;
    const newPass = elements.changePassNew.value.trim();

    if (!newPass || newPass.length < 4) {
      alert('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (!state.currentPassword) {
      alert('O diário deve estar desbloqueado para alterar a senha.');
      return;
    }

    try {
      await DBService.persistVault(state.vaultData, newPass);
      state.currentPassword = newPass;

      const saved = await CryptoService.getSavedPassword();
      if (saved) {
        await CryptoService.savePasswordLocally(newPass);
      }

      elements.changePassNew.value = '';
      showToast('Senha do diário alterada com sucesso!');
      alert('Senha do diário alterada com sucesso! Ela será solicitada nos próximos acessos.');
    } catch (err) {
      alert('Erro ao atualizar senha: ' + err.message);
    }
  }

  function saveCustomDrivePassword() {
    if (!elements.driveEncryptionPassword) return;
    const drivePass = elements.driveEncryptionPassword.value.trim();
    if (!drivePass) {
      alert('Por favor, digite a senha usada no Google Drive / App Móvel.');
      return;
    }

    const currentEmail = GoogleDriveService.userEmail;
    if (currentEmail) {
      localStorage.setItem(VIDA_STORAGE_KEYS.passKey(currentEmail), drivePass);
    }
    sessionStorage.setItem(VIDA_STORAGE_KEYS.CUSTOM_PASS, drivePass);
    localStorage.setItem(VIDA_STORAGE_KEYS.CUSTOM_PASS, drivePass);
    showToast('Senha do Drive configurada!');
    syncWithGoogleDrive(false, true);
  }

  function promptDrivePassword(accountEmail = null, errorMessage = null) {
    if (!elements.drivePasswordModal) return;

    // Se o modal de configurações estiver aberto, fecha-o para não sobrepor ou esconder
    if (elements.settingsModal && !elements.settingsModal.classList.contains('hidden')) {
      elements.settingsModal.classList.add('hidden');
    }

    const email = accountEmail || GoogleDriveService.userEmail || getVidaItem(VIDA_STORAGE_KEYS.LAST_EMAIL, 'wingene_last_drive_email');
    if (elements.drivePasswordAccountNotice && elements.drivePasswordAccountEmail) {
      if (email) {
        elements.drivePasswordAccountEmail.textContent = email;
        elements.drivePasswordAccountNotice.classList.remove('hidden');
      } else {
        elements.drivePasswordAccountNotice.classList.add('hidden');
      }
    }

    if (elements.modalDrivePasswordError) {
      if (errorMessage) {
        elements.modalDrivePasswordError.innerHTML =
          escapeHtml(errorMessage) +
          '<div style="font-size: 0.8rem; font-weight: normal; color: #fecdd3; margin-top: 0.35rem; line-height: 1.35;">' +
          '💡 Digite a <strong>Senha de Backup</strong> configurada nesta conta no app móvel (em <em>Configurações &gt; Backup e bloqueio</em>).' +
          '</div>';
        elements.modalDrivePasswordError.classList.remove('hidden');
      } else {
        elements.modalDrivePasswordError.classList.add('hidden');
        elements.modalDrivePasswordError.textContent = '';
      }
    }

    if (elements.inputModalDrivePassword) {
      elements.inputModalDrivePassword.value = '';
    }

    if (elements.drivePasswordDiagBox) {
      elements.drivePasswordDiagBox.classList.add('hidden');
      elements.drivePasswordDiagBox.textContent = 'Carregando detalhes...';
    }

    elements.drivePasswordModal.classList.remove('hidden');
    setTimeout(() => {
      elements.inputModalDrivePassword?.focus();
    }, 150);
  }

  function closeDrivePasswordModal() {
    if (elements.drivePasswordModal) {
      elements.drivePasswordModal.classList.add('hidden');
    }
  }

  async function renderDrivePasswordDiag() {
    if (!elements.drivePasswordDiagBox) return;
    elements.drivePasswordDiagBox.textContent = 'Consultando arquivos no Google Drive...';
    try {
      const allFiles = await GoogleDriveService.listAllAppDataFiles();
      const audit = GoogleDriveService.lastValidationAudit;

      let text = `[Conta Conectada]: ${GoogleDriveService.userEmail || 'N/A'}\n`;
      text += `[Arquivos na pasta privada appDataFolder (${allFiles.length})]:\n`;

      if (allFiles.length === 0) {
        text += '• Nenhum arquivo encontrado nesta conta Google.\n';
      } else {
        allFiles.forEach((f) => {
          const modStr = f.modifiedTime ? new Date(f.modifiedTime).toLocaleString('pt-BR') : 'Data desconhecida';
          text += `• ${f.name} (Tamanho: ${f.size || 0} bytes | Modificado: ${modStr})\n`;
        });
      }

      if (audit) {
        text += '\n[Último Teste de Senha]:\n';
        if (audit.hashAttempts && audit.hashAttempts.length > 0) {
          audit.hashAttempts.forEach((h, i) => {
            text += `• Hash #${i + 1}: ${h.success ? 'SUCESSO' : 'FALHOU'}${h.error ? ' (' + h.error + ')' : ''}${h.decryptedText ? ' (Decifrou texto: "' + h.decryptedText + '")' : ''}\n`;
          });
        }
        if (audit.masterAttempts && audit.masterAttempts.length > 0) {
          audit.masterAttempts.forEach((m, i) => {
            text += `• Master #${i + 1}: ${m.success ? 'SUCESSO (' + m.recordCount + ' registros)' : 'FALHOU'}${m.error ? ' (' + m.error + ')' : ''}\n`;
          });
        }
      }

      elements.drivePasswordDiagBox.textContent = text;
    } catch (e) {
      elements.drivePasswordDiagBox.textContent = `Erro ao consultar diagnóstico do Drive: ${e.message}`;
    }
  }

  async function handleResetCloudAppData() {
    const currentEmail = GoogleDriveService.userEmail || 'esta conta Google';
    const confirmed = confirm(
      `ATENÇÃO: Limpar nuvem da conta "${currentEmail}"?\n\n` +
      `Isso excluirá os arquivos de backup e validação antigos salvos na pasta privada do Google Drive desta conta.\n\n` +
      `Use isso caso a senha antiga esteja travando a sincronização.\n` +
      `Os dados salvos no seu smartphone e localmente neste navegador NÃO serão excluídos.\n\n` +
      `Deseja continuar?`
    );
    if (!confirmed) return;

    try {
      showToast('Limpando arquivos da pasta privada do Google Drive...');
      await GoogleDriveService.clearAppDataFolder();
      GoogleDriveService.clearSyncCache();
      localStorage.removeItem(VIDA_STORAGE_KEYS.LAST_SYNC);
      localStorage.removeItem('wingene_last_drive_sync');
      if (elements.modalDrivePasswordError) {
        elements.modalDrivePasswordError.classList.add('hidden');
      }
      closeDrivePasswordModal();
      alert(
        `✅ Pasta privada do Google Drive limpa com sucesso!\n\n` +
        `Agora faça o seguinte:\n` +
        `1. Abra o app Wingene Vida no seu celular;\n` +
        `2. Verifique se o celular está logado na mesma conta e com sua senha de backup configurada;\n` +
        `3. Toque em Sincronizar no celular para enviar a versão mais recente e criar uma nova chave na nuvem;\n` +
        `4. Depois volte aqui e toque no botão de sincronizar do PWA.`
      );
    } catch (e) {
      alert('Falha ao limpar nuvem: ' + e.message);
    }
  }

  async function submitDrivePasswordModal() {
    const pass = elements.inputModalDrivePassword ? elements.inputModalDrivePassword.value.trim() : '';
    if (!pass) {
      if (elements.modalDrivePasswordError) {
        elements.modalDrivePasswordError.innerHTML = 'Por favor, digite a <strong>Senha de Backup</strong> desta conta.';
        elements.modalDrivePasswordError.classList.remove('hidden');
      }
      return;
    }

    if (elements.btnConfirmDrivePasswordModal) {
      elements.btnConfirmDrivePasswordModal.disabled = true;
      elements.btnConfirmDrivePasswordModal.textContent = 'Verificando senha...';
    }

    try {
      const currentEmail = GoogleDriveService.userEmail;
      if (currentEmail) {
        localStorage.setItem(VIDA_STORAGE_KEYS.passKey(currentEmail), pass);
      }
      sessionStorage.setItem(VIDA_STORAGE_KEYS.CUSTOM_PASS, pass);
      localStorage.setItem(VIDA_STORAGE_KEYS.CUSTOM_PASS, pass);
      if (elements.driveEncryptionPassword) {
        elements.driveEncryptionPassword.value = pass;
      }

      closeDrivePasswordModal();
      showToast('Descriptografando diário com a senha informada...');
      await syncWithGoogleDrive(false, true);
    } catch (e) {
      if (elements.modalDrivePasswordError) {
        elements.modalDrivePasswordError.textContent = 'Erro: ' + e.message;
        elements.modalDrivePasswordError.classList.remove('hidden');
      }
    } finally {
      if (elements.btnConfirmDrivePasswordModal) {
        elements.btnConfirmDrivePasswordModal.disabled = false;
        elements.btnConfirmDrivePasswordModal.textContent = 'Descriptografar & Sincronizar';
      }
    }
  }

  async function handleResetVault(e) {
    if (e) e.preventDefault();
    const confirmed = confirm(
      'Deseja redefinir os dados salvos localmente neste navegador?\n\n' +
      '⚠️ Esta ação limpará o cofre local para que você possa definir uma nova senha ou reimportar seus dados.\n' +
      '(Os seus arquivos no Google Drive e no app móvel NÃO serão excluídos).'
    );
    if (!confirmed) return;

    try {
      await DBService.resetVault();
      CryptoService.clearSavedPassword();
      GoogleDriveService.clearSyncCache();
      localStorage.removeItem(VIDA_STORAGE_KEYS.LAST_SYNC);
      localStorage.removeItem('wingene_last_drive_sync');
      sessionStorage.removeItem(VIDA_STORAGE_KEYS.CUSTOM_PASS);
      sessionStorage.removeItem('wingene_drive_custom_pass');
      alert('Cofre local redefinido com sucesso.');
      location.reload();
    } catch (err) {
      alert('Erro ao redefinir cofre: ' + err.message);
    }
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────────

  function setupEventListeners() {
    // Autenticação
    elements.btnUnlock.addEventListener('click', handleUnlock);
    elements.passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUnlock();
    });
    elements.linkLoadSample.addEventListener('click', (e) => {
      e.preventDefault();
      loadSampleMockData();
    });
    if (elements.linkResetVault) {
      elements.linkResetVault.addEventListener('click', handleResetVault);
    }

    // Google Drive Sync - Se conectado ou vinculado, sincroniza direto; se desconectado, abre modal para conectar
    elements.btnDriveSync.addEventListener('click', () => {
      if (GoogleDriveService.isConnected() || (GoogleDriveService.isLinked && GoogleDriveService.isLinked())) {
        syncWithGoogleDrive(false);
      } else {
        elements.settingsModal.classList.remove('hidden');
      }
    });

    elements.btnConnectDriveModal.addEventListener('click', () => {
      syncWithGoogleDrive(false);
    });

    elements.btnSyncNowModal.addEventListener('click', () => {
      syncWithGoogleDrive(false);
    });

    elements.btnDisconnectDriveModal.addEventListener('click', () => {
      cancelDebouncedDriveSync();
      GoogleDriveService.signOut();
      sessionStorage.removeItem(VIDA_STORAGE_KEYS.CUSTOM_PASS);
      sessionStorage.removeItem('wingene_drive_custom_pass');
      updateDriveStatusUI();
      showToast('Desconectado do Google Drive.');
    });

    // Header & Navegação
    elements.btnLock.addEventListener('click', showLockScreen);
    elements.brandHomeBtn.addEventListener('click', () => {
      state.activePilar = 'ALL';
      state.searchQuery = '';
      elements.searchInput.value = '';
      elements.filterChips.forEach((c) => c.classList.toggle('active', c.dataset.pilar === 'ALL'));
      renderEntries();
    });

    // Busca e Filtros
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderEntries();
    });

    elements.filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        elements.filterChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.activePilar = chip.dataset.pilar;
        renderEntries();
      });
    });

    // Modais de Criação
    elements.btnNewEntryHeader.addEventListener('click', openNewEntryModal);
    elements.fabNewEntry.addEventListener('click', openNewEntryModal);
    elements.btnNewEntryEmpty.addEventListener('click', openNewEntryModal);
    elements.btnCloseEntryModal.addEventListener('click', closeEntryModal);
    elements.btnCancelEntryModal.addEventListener('click', closeEntryModal);
    elements.btnSaveEntry.addEventListener('click', saveEntry);

    // Seletor de pilar no modal
    elements.modalPilarSelector.addEventListener('click', (e) => {
      const opt = e.target.closest('.pilar-option');
      if (opt) {
        selectPilarInModal(opt.dataset.pilar);
      }
    });

    // Slider de impacto no modal
    elements.entryImpacto.addEventListener('input', (e) => {
      updateImpactoDisplay(parseInt(e.target.value, 10));
    });

    // Editor em Tela Cheia - Drawer de Outras Opções e Word Count
    if (elements.btnToggleExtraOptions) {
      elements.btnToggleExtraOptions.addEventListener('click', toggleExtraOptionsDrawer);
    }
    if (elements.btnCloseExtraOptionsDrawer) {
      elements.btnCloseExtraOptionsDrawer.addEventListener('click', closeExtraOptionsDrawer);
    }
    if (elements.btnDoneExtraOptions) {
      elements.btnDoneExtraOptions.addEventListener('click', closeExtraOptionsDrawer);
    }
    if (elements.drawerBackdrop) {
      elements.drawerBackdrop.addEventListener('click', closeExtraOptionsDrawer);
    }
    if (elements.entryConteudo) {
      elements.entryConteudo.addEventListener('input', updateEditorWordCount);
    }
    if (elements.entryTags) {
      elements.entryTags.addEventListener('input', updateExtraOptionsIndicator);
    }
    if (elements.entryCategoria) {
      elements.entryCategoria.addEventListener('input', updateExtraOptionsIndicator);
    }

    // Modal de Cadastro Rápido de Propósito
    if (elements.btnOpenNewPropositoModal) {
      elements.btnOpenNewPropositoModal.addEventListener('click', openQuickPropositoModal);
    }
    if (elements.btnCloseQuickPropositoModal) {
      elements.btnCloseQuickPropositoModal.addEventListener('click', closeQuickPropositoModal);
    }
    if (elements.btnCancelQuickProposito) {
      elements.btnCancelQuickProposito.addEventListener('click', closeQuickPropositoModal);
    }
    if (elements.btnSaveQuickProposito) {
      elements.btnSaveQuickProposito.addEventListener('click', saveQuickProposito);
    }
    if (elements.newPropositoEixoSelector) {
      elements.newPropositoEixoSelector.addEventListener('click', (e) => {
        const opt = e.target.closest('.pilar-option');
        if (opt && opt.dataset.eixo) {
          selectEixoInPropositoModal(opt.dataset.eixo);
        }
      });
    }

    // Delegação de cliques na lista de entradas
    elements.entriesList.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit');
      if (editBtn) {
        openEditEntryModal(editBtn.dataset.uuid);
        return;
      }

      const delBtn = e.target.closest('.btn-delete');
      if (delBtn) {
        promptDeleteEntry(delBtn.dataset.uuid);
        return;
      }
    });

    // Confirmação de Exclusão
    elements.btnCancelDelete.addEventListener('click', closeDeleteModal);
    elements.btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
    elements.btnConfirmDelete.addEventListener('click', confirmDeleteEntry);

    // Configurações & Backup
    elements.btnSettings.addEventListener('click', () => {
      updateDriveStatusUI();
      const customDrivePass = sessionStorage.getItem(VIDA_STORAGE_KEYS.CUSTOM_PASS) ||
        sessionStorage.getItem('wingene_drive_custom_pass') ||
        getVidaItem(VIDA_STORAGE_KEYS.CUSTOM_PASS, 'wingene_drive_custom_pass');
      if (customDrivePass && elements.driveEncryptionPassword) {
        elements.driveEncryptionPassword.value = customDrivePass;
      }
      elements.settingsModal.classList.remove('hidden');
    });
    elements.btnCloseSettingsModal.addEventListener('click', () => {
      elements.settingsModal.classList.add('hidden');
    });
    elements.btnCloseSettingsModalBtn.addEventListener('click', () => {
      elements.settingsModal.classList.add('hidden');
    });
    elements.btnExportJson.addEventListener('click', exportBackup);
    elements.importFileInput.addEventListener('change', handleFileImport);
    elements.btnClearSavedPassword.addEventListener('click', () => {
      CryptoService.clearSavedPassword();
      alert('A senha salva foi esquecida deste navegador.');
    });

    if (elements.btnApplyNewPassword) {
      elements.btnApplyNewPassword.addEventListener('click', applyNewPassword);
    }
    if (elements.changePassNew) {
      elements.changePassNew.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyNewPassword();
      });
    }
    if (elements.btnSaveDrivePassword) {
      elements.btnSaveDrivePassword.addEventListener('click', saveCustomDrivePassword);
    }
    if (elements.driveEncryptionPassword) {
      elements.driveEncryptionPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveCustomDrivePassword();
      });
    }

    // Modal de Senha do Google Drive
    if (elements.btnCloseDrivePasswordModal) {
      elements.btnCloseDrivePasswordModal.addEventListener('click', closeDrivePasswordModal);
    }
    if (elements.btnCancelDrivePasswordModal) {
      elements.btnCancelDrivePasswordModal.addEventListener('click', closeDrivePasswordModal);
    }
    if (elements.btnConfirmDrivePasswordModal) {
      elements.btnConfirmDrivePasswordModal.addEventListener('click', submitDrivePasswordModal);
    }
    if (elements.inputModalDrivePassword) {
      elements.inputModalDrivePassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitDrivePasswordModal();
      });
    }
    if (elements.btnToggleDrivePassword && elements.inputModalDrivePassword) {
      elements.btnToggleDrivePassword.addEventListener('click', () => {
        const isPass = elements.inputModalDrivePassword.type === 'password';
        elements.inputModalDrivePassword.type = isPass ? 'text' : 'password';
        const svg = elements.btnToggleDrivePassword.querySelector('svg');
        if (svg) {
          svg.innerHTML = isPass
            ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
            : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
      });
    }

    if (elements.btnToggleDrivePasswordDiag) {
      elements.btnToggleDrivePasswordDiag.addEventListener('click', () => {
        if (!elements.drivePasswordDiagBox) return;
        const isHidden = elements.drivePasswordDiagBox.classList.contains('hidden');
        if (isHidden) {
          elements.drivePasswordDiagBox.classList.remove('hidden');
          renderDrivePasswordDiag();
        } else {
          elements.drivePasswordDiagBox.classList.add('hidden');
        }
      });
    }

    if (elements.btnResetDriveAppData) {
      elements.btnResetDriveAppData.addEventListener('click', handleResetCloudAppData);
    }

    if (elements.btnSwitchAccountSettings) {
      elements.btnSwitchAccountSettings.addEventListener('click', handleSwitchDriveAccount);
    }
    if (elements.btnSwitchAccountInPasswordModal) {
      elements.btnSwitchAccountInPasswordModal.addEventListener('click', handleSwitchDriveAccount);
    }
  }

  async function handleSwitchDriveAccount() {
    try {
      showToast('Abrindo seletor de contas do Google...');
      await GoogleDriveService.switchAccount();
      const newEmail = GoogleDriveService.userEmail;
      updateDriveStatusUI();

      if (newEmail) {
        showToast(`Conectado à conta: ${newEmail}`);

        // Se trocou de conta, limpa os dados locais imediatamente para não misturar diários
        const lastDriveEmail = getVidaItem(VIDA_STORAGE_KEYS.LAST_EMAIL, 'wingene_last_drive_email');
        if (lastDriveEmail && lastDriveEmail.trim().toLowerCase() !== newEmail.trim().toLowerCase()) {
          state.vaultData = {
            registros: [],
            resumos_mensais: [],
            insights: [],
            propositos: []
          };
          await DBService.persistVault(state.vaultData, state.currentPassword);
          GoogleDriveService.clearSyncCache();
          localStorage.removeItem(VIDA_STORAGE_KEYS.LAST_SYNC);
          localStorage.removeItem('wingene_last_drive_sync');
          renderEntries();
        }
        localStorage.setItem(VIDA_STORAGE_KEYS.LAST_EMAIL, newEmail);

        if (elements.drivePasswordAccountEmail) {
          elements.drivePasswordAccountEmail.textContent = newEmail;
        }
        if (elements.modalDrivePasswordError) {
          elements.modalDrivePasswordError.classList.add('hidden');
        }

        // Inicia sincronização com a nova conta
        await syncWithGoogleDrive(false, true);
      }
    } catch (e) {
      console.warn('Troca de conta cancelada ou falhou:', e);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
