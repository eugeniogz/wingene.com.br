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
    confirmPasswordGroup: document.getElementById('confirmPasswordGroup'),
    confirmPasswordInput: document.getElementById('confirmPasswordInput'),
    rememberPasswordCheck: document.getElementById('rememberPasswordCheck'),
    lockError: document.getElementById('lockError'),
    lockSubtitle: document.getElementById('lockSubtitle'),
    btnUnlock: document.getElementById('btnUnlock'),
    linkLoadSample: document.getElementById('linkLoadSample'),

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
    modalAiPreviewBox: document.getElementById('modalAiPreviewBox'),
    modalAiPreviewComment: document.getElementById('modalAiPreviewComment'),
    modalAiPreviewKeyword: document.getElementById('modalAiPreviewKeyword'),
    btnCancelEntryModal: document.getElementById('btnCancelEntryModal'),
    btnCloseEntryModal: document.getElementById('btnCloseEntryModal'),
    btnSaveEntry: document.getElementById('btnSaveEntry'),

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

    driveStatusBadge: document.getElementById('driveStatusBadge'),
    btnConnectDriveModal: document.getElementById('btnConnectDriveModal'),
    btnSyncNowModal: document.getElementById('btnSyncNowModal'),
    btnDisconnectDriveModal: document.getElementById('btnDisconnectDriveModal'),
    driveLastSyncTime: document.getElementById('driveLastSyncTime'),
    toastNotification: document.getElementById('toastNotification')
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
        // Primeiro acesso: usuário deve definir a senha
        elements.lockSubtitle.textContent = 'Defina uma senha mestre para criar seu cofre';
        elements.confirmPasswordGroup.classList.remove('hidden');
        elements.btnUnlock.textContent = 'Criar Cofre Seguro';
        elements.passwordInput.placeholder = 'Crie uma senha forte...';
      } else {
        // Já possui cofre: tenta desbloqueio silencioso se houver credencial salva
        elements.lockSubtitle.textContent = 'Cofre de Registros Pessoal';
        elements.confirmPasswordGroup.classList.add('hidden');
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
  function showToast(message, duration = 3500) {
    if (!elements.toastNotification) return;
    elements.toastNotification.textContent = message;
    elements.toastNotification.classList.remove('hidden');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      elements.toastNotification.classList.add('hidden');
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
      const confirmPassword = elements.confirmPasswordInput.value.trim();
      if (password.length < 4) {
        showLockError('A senha deve conter no mínimo 4 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        showLockError('As senhas não coincidem. Digite novamente.');
        return;
      }

      // Cria cofre inicial vazio
      try {
        elements.btnUnlock.disabled = true;
        elements.btnUnlock.textContent = 'Criando cofre criptografado...';

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
    state.currentPassword = null;
    state.vaultData = { registros: [] };
    elements.passwordInput.value = '';
    elements.confirmPasswordInput.value = '';
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

  function updateDriveStatusUI() {
    const connected = GoogleDriveService.isConnected();
    const userEmail = GoogleDriveService.userEmail;
    if (connected) {
      elements.btnDriveSync.classList.add('connected');
      elements.driveSyncText.textContent = userEmail ? userEmail.split('@')[0] : 'Drive Conectado';
      elements.driveStatusBadge.textContent = userEmail ? `Conectado (${userEmail})` : 'Conectado';
      elements.driveStatusBadge.style.color = '#34d399';
      elements.btnConnectDriveModal.classList.add('hidden');
      elements.btnDisconnectDriveModal.classList.remove('hidden');
      elements.btnSyncNowModal.disabled = false;
    } else {
      elements.btnDriveSync.classList.remove('connected');
      elements.driveSyncText.textContent = 'Conectar Drive';
      elements.driveStatusBadge.textContent = 'Desconectado';
      elements.driveStatusBadge.style.color = '#94a3b8';
      elements.btnConnectDriveModal.classList.remove('hidden');
      elements.btnDisconnectDriveModal.classList.add('hidden');
      elements.btnSyncNowModal.disabled = true;
    }

    const lastSync = localStorage.getItem('wingene_last_drive_sync');
    if (lastSync) {
      elements.driveLastSyncTime.textContent = `Última sincronização: ${new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      elements.driveLastSyncTime.textContent = '';
    }
  }

  async function syncWithGoogleDrive(silent = false) {
    if (state.isSyncingDrive) return;
    if (!state.currentPassword) {
      if (!silent) alert('Por favor, desbloqueie o diário para sincronizar.');
      return;
    }

    try {
      state.isSyncingDrive = true;
      elements.driveSyncIcon.classList.add('spin-icon');
      elements.btnSyncNowModal.disabled = true;
      elements.btnSyncNowModal.textContent = 'Sincronizando...';

      if (!silent) {
        showToast('Conectando ao Google Drive...');
      }

      // 1. Garante autenticação e obtém e-mail da conta conectada
      await GoogleDriveService.requestToken();
      await GoogleDriveService.fetchUserEmail();
      updateDriveStatusUI();

      // 2. Baixa registros existentes no Drive
      const remoteRes = await GoogleDriveService.downloadMasterData(state.currentPassword);
      let mergedCount = 0;

      if (remoteRes.fileFound && remoteRes.records && remoteRes.records.length > 0) {
        const localMap = new Map();
        (state.vaultData.registros || []).forEach((r) => localMap.set(r.uuid, r));

        remoteRes.records.forEach((remoteRecord) => {
          const normRemote = DBService.normalizeRecord(remoteRecord);
          const localRecord = localMap.get(normRemote.uuid);

          if (!localRecord) {
            localMap.set(normRemote.uuid, normRemote);
            mergedCount++;
          } else {
            const localVer = localRecord.versao || 1;
            const remoteVer = normRemote.versao || 1;
            if (remoteVer > localVer) {
              localMap.set(normRemote.uuid, normRemote);
              mergedCount++;
            }
          }
        });

        state.vaultData.registros = Array.from(localMap.values());
        await DBService.persistVault(state.vaultData, state.currentPassword);
        renderEntries();
        showToast(`${remoteRes.records.length} registros carregados do Google Drive!`);
      } else {
        const filesList = (remoteRes.filesInDrive || []).join(', ');
        const emailMsg = GoogleDriveService.userEmail ? `na conta ${GoogleDriveService.userEmail}` : 'no Google Drive';

        if (!silent) {
          alert(`Nenhum arquivo de diário encontrado ${emailMsg}.\n\nArquivos encontrados na pasta privada: ${filesList || 'Nenhum'}.\n\n💡 Verifique se você fez login com a mesma conta Google utilizada no aplicativo móvel.`);
        }
      }

      // 3. Somente faz upload se o usuário tiver registros locais a enviar
      const localHasUnsynced = (state.vaultData.registros || []).some((r) => r.sincronizado === 0);
      if (state.vaultData.registros && state.vaultData.registros.length > 0 && (localHasUnsynced || remoteRes.fileFound)) {
        await GoogleDriveService.uploadMasterData(state.vaultData.registros, state.currentPassword);
        state.vaultData.registros.forEach((r) => (r.sincronizado = 1));
        await DBService.persistVault(state.vaultData, state.currentPassword);
      }

      const now = new Date();
      localStorage.setItem('wingene_last_drive_sync', now.toISOString());
      updateDriveStatusUI();
    } catch (err) {
      console.error('Erro na sincronização com o Drive:', err);
      if (!silent) {
        alert('Erro ao sincronizar com o Google Drive: ' + err.message);
      }
      showToast('Falha ao sincronizar com o Drive');
    } finally {
      state.isSyncingDrive = false;
      elements.driveSyncIcon.classList.remove('spin-icon');
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

  // ─── CRUD de Entradas ─────────────────────────────────────────────────────────

  function openNewEntryModal() {
    state.editingUuid = null;
    elements.modalEntryTitle.textContent = 'Nova Entrada no Diário';
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
    elements.modalAiPreviewBox.classList.add('hidden');

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

    if (entry.comentarioVida && entry.comentarioVida.trim()) {
      elements.modalAiPreviewComment.textContent = `"${entry.comentarioVida}"`;
      elements.modalAiPreviewKeyword.textContent = entry.palavraChave ? `Palavra-chave: ${entry.palavraChave}` : '';
      elements.modalAiPreviewBox.classList.remove('hidden');
    } else {
      elements.modalAiPreviewBox.classList.add('hidden');
    }

    elements.entryModal.classList.remove('hidden');
    elements.entryConteudo.focus();
  }

  function closeEntryModal() {
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
    const nowIso = new Date().toISOString();

    if (state.editingUuid) {
      // Atualizar entrada existente
      const idx = state.vaultData.registros.findIndex((r) => r.uuid === state.editingUuid);
      if (idx !== -1) {
        const existing = state.vaultData.registros[idx];
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
          lastModified: nowIso,
          versao: (existing.versao || 1) + 1,
          sincronizado: 0
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
        lastModified: nowIso,
        versao: 1,
        sincronizado: 0
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

      // 2. Se o Google Drive estiver conectado, salva automaticamente no Drive
      if (GoogleDriveService.isConnected()) {
        syncWithGoogleDrive(true);
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

        if (GoogleDriveService.isConnected()) {
          syncWithGoogleDrive(true);
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
        const parsed = JSON.parse(evt.target.result);
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
        await DBService.persistVault(state.vaultData, state.currentPassword);

        renderEntries();
        alert(`${importedRecords.length} registros processados e importados com sucesso!`);
        elements.settingsModal.classList.add('hidden');

        if (GoogleDriveService.isConnected()) {
          syncWithGoogleDrive(true);
        }
      } catch (err) {
        alert('Falha ao importar backup: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
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
        elements.confirmPasswordInput.value = '1234';
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

  // ─── Event Listeners ──────────────────────────────────────────────────────────

  function setupEventListeners() {
    // Autenticação
    elements.btnUnlock.addEventListener('click', handleUnlock);
    elements.passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUnlock();
    });
    elements.confirmPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUnlock();
    });
    elements.linkLoadSample.addEventListener('click', (e) => {
      e.preventDefault();
      loadSampleMockData();
    });

    // Google Drive Sync
    elements.btnDriveSync.addEventListener('click', () => {
      if (!GoogleDriveService.isConnected()) {
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
      GoogleDriveService.signOut();
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
