/**
 * Module para Integração com Google Identity Services (GIS) e Google Drive API v3
 * Permite autenticação do usuário e salvamento privado dos dados em appDataFolder ou Drive do usuário.
 */

const DRIVE_CONFIG = {
  // CLIENT_ID configurável via UI ou constante
  CLIENT_ID: localStorage.getItem('wingene_drive_client_id') || '568890387136-7633o3djo84878srldube4rca4hg1r3h.apps.googleusercontent.com',
  SCOPES: 'openid profile email https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file',
  FILE_NAME: 'wingene_investimentos_data.json'
};

let tokenClient = null;
let accessToken = localStorage.getItem('wingene_drive_access_token') || null;
let googleUser = JSON.parse(localStorage.getItem('wingene_drive_user') || 'null');
let driveFileId = localStorage.getItem('wingene_drive_file_id') || null;

/**
 * Inicializa o token client do Google Identity Services
 */
function initGoogleAuth(clientId = null) {
  if (clientId) {
    DRIVE_CONFIG.CLIENT_ID = clientId;
    localStorage.setItem('wingene_drive_client_id', clientId);
  }

  renderUserProfileUI();

  if (!DRIVE_CONFIG.CLIENT_ID) {
    console.warn('Google Client ID não configurado.');
    updateDriveUIStatus('Desconectado (Modo Local)');
    return;
  }

  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    console.warn('Google Identity Services JS SDK não carregado ainda.');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: DRIVE_CONFIG.CLIENT_ID,
    scope: DRIVE_CONFIG.SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse.error) {
        console.error('Erro de Autenticação Google:', tokenResponse);
        updateDriveUIStatus('Erro na Autenticação', true);
        showToast('Erro de autenticação no Google: ' + (tokenResponse.error_description || tokenResponse.error), 'error');
        return;
      }
      accessToken = tokenResponse.access_token;
      localStorage.setItem('wingene_drive_access_token', accessToken);
      
      // Obter dados do usuário
      await fetchGoogleUserInfo();
      updateDriveUIStatus(`Conectado como ${googleUser ? (googleUser.name || googleUser.email) : 'Google Drive'}`);
      
      // Tentar carregar dados salvos no Drive automaticamente
      await syncFromDrive();
    },
    error_callback: (error) => {
      console.error('GIS Error Callback:', error);
      updateDriveUIStatus('Erro ao abrir Login Google', true);
      if (error.type === 'popup_closed') {
        showToast('Janela de login do Google fechada antes de concluir.', 'warning');
      } else if (error.type === 'popup_failed_to_open') {
        showToast('Pop-up bloqueado pelo navegador mobile. Habilite pop-ups para fazer login.', 'error');
      } else {
        showToast('Falha no Google Auth. Verifique se o domínio está autorizado no Google Cloud Console.', 'error');
      }
    }
  });

  if (accessToken) {
    updateDriveUIStatus(`Sessão Google ativa`);
    fetchGoogleUserInfo();
  }
}

/**
 * Dispara a janela pop-up de login do Google
 */
function requestGoogleLogin() {
  if (!DRIVE_CONFIG.CLIENT_ID) {
    const userClientId = prompt(
      'Para habilitar a Sincronização Google Drive, informe o seu Google OAuth Client ID:\n\n' +
      '(Se não tiver um Client ID do Google Cloud Console, a app continuará salvando localmente e permitindo backup JSON).'
    );
    if (userClientId && userClientId.trim() !== '') {
      initGoogleAuth(userClientId.trim());
    } else {
      return;
    }
  }

  if (tokenClient) {
    // Usar prompt: '' no mobile para evitar exigir consentimento forçado a cada login (evita tela branca em PWAs/Safari Mobile)
    tokenClient.requestAccessToken({ prompt: '' });
  } else {
    initGoogleAuth();
    if (tokenClient) tokenClient.requestAccessToken({ prompt: '' });
  }
}

/**
 * Busca perfil básico do usuário via UserInfo API
 */
async function fetchGoogleUserInfo() {
  if (!accessToken) return;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      googleUser = await res.json();
      localStorage.setItem('wingene_drive_user', JSON.stringify(googleUser));
      renderUserProfileUI();
    } else {
      if (handleGoogleAuthError(res.status)) return;
      // Se não tiver permissão para o perfil, mantém o login no Drive silenciosamente
      googleUser = null;
      localStorage.removeItem('wingene_drive_user');
      renderUserProfileUI();
    }
  } catch (err) {
    googleUser = null;
    renderUserProfileUI();
  }
}

/**
 * Procura o arquivo de dados na pasta appDataFolder ou raiz do Google Drive
 */
async function findDriveFile() {
  if (!accessToken) return null;
  
  try {
    // Procura na pasta reservada appDataFolder primeiro
    const q = `name = '${DRIVE_CONFIG.FILE_NAME}' and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=appDataFolder,drive&fields=files(id, name, modifiedTime)`;
    
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (res.status === 403) {
      console.warn('Escopo appDataFolder negado (403). Tentando buscar na pasta principal do Drive...');
      url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id, name, modifiedTime)`;
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    }

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        driveFileId = data.files[0].id;
        localStorage.setItem('wingene_drive_file_id', driveFileId);
        return driveFileId;
      }
    } else if (handleGoogleAuthError(res.status)) {
      return null;
    } else if (res.status === 403) {
      showToast('Erro 403: Ative a "Google Drive API" no Google Cloud Console.', 'error');
    }
  } catch (err) {
    console.error('Erro ao procurar arquivo no Google Drive:', err);
  }
  return null;
}

/**
 * Baixa e sincroniza dados do Google Drive para a aplicação
 */
async function syncFromDrive() {
  if (!accessToken) return false;

  try {
    updateDriveUIStatus('Sincronizando do Drive...');
    const fileId = driveFileId || await findDriveFile();
    
    if (!fileId) {
      console.log('Nenhum arquivo prévio encontrado no Google Drive. Um novo será criado no próximo salvamento.');
      updateDriveUIStatus('Conectado (Novo arquivo no Drive)');
      return false;
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const remoteData = await res.json();
      if (window.onDriveDataLoaded && typeof window.onDriveDataLoaded === 'function') {
        window.onDriveDataLoaded(remoteData);
      }
      updateDriveUIStatus('Dados sincronizados com sucesso!', false, true);
      return true;
    } else if (handleGoogleAuthError(res.status)) {
      return false;
    } else if (res.status === 403) {
      updateDriveUIStatus('Erro 403: Acesso ao Drive Negado', true);
      showToast('Erro 403: Certifique-se de que a Google Drive API está ATIVADA no Google Cloud Console.', 'error');
    }
  } catch (err) {
    console.error('Falha ao baixar dados do Drive:', err);
    updateDriveUIStatus('Erro ao baixar dados do Drive', true);
  }
  return false;
}

/**
 * Salva os dados atuais no Google Drive
 */
async function saveToDrive(appData) {
  if (!accessToken) {
    updateDriveUIStatus('Salvo localmente (Offline)');
    return false;
  }

  try {
    updateDriveUIStatus('Enviando para o Google Drive...');
    const fileId = driveFileId || await findDriveFile();
    const fileContent = JSON.stringify(appData, null, 2);

    if (fileId) {
      // Atualiza arquivo existente
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const res = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: fileContent
      });

      if (res.ok) {
        updateDriveUIStatus('Salvo no Google Drive!', false, true);
        return true;
      } else if (handleGoogleAuthError(res.status)) {
        return false;
      } else if (res.status === 403) {
        updateDriveUIStatus('Erro 403 no Drive', true);
        showToast('Erro 403: Ative a Google Drive API no Cloud Console.', 'error');
      }
    } else {
      // Tentar criar novo arquivo na pasta appDataFolder primeiro, com fallback para o Drive principal
      let metadata = {
        name: DRIVE_CONFIG.FILE_NAME,
        parents: ['appDataFolder']
      };

      let form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([fileContent], { type: 'application/json' }));

      let res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
      });

      // Se appDataFolder der 403 Forbidden, tentar salvar na raiz do Drive do usuário
      if (res.status === 403) {
        console.warn('Criar em appDataFolder deu 403. Tentando criar na pasta raiz do Google Drive...');
        metadata = { name: DRIVE_CONFIG.FILE_NAME };
        form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form
        });
      }

      if (res.ok) {
        const createdFile = await res.json();
        driveFileId = createdFile.id;
        localStorage.setItem('wingene_drive_file_id', driveFileId);
        updateDriveUIStatus('Salvo no Google Drive!', false, true);
        return true;
      } else if (handleGoogleAuthError(res.status)) {
        return false;
      } else if (res.status === 403) {
        updateDriveUIStatus('Erro 403 (Permissão do Drive)', true);
        showToast('Erro 403: Acesse o Google Cloud Console e ative a "Google Drive API" no projeto.', 'error');
      }
    }
  } catch (err) {
    console.error('Erro ao salvar no Google Drive:', err);
    updateDriveUIStatus('Erro ao enviar para o Drive', true);
  }
  return false;
}

/**
 *Trata erro 401 (Token Expirado) limpando a sessão e avisando o usuário
 */
function handleGoogleAuthError(status) {
  if (status === 401) {
    console.warn('Token de acesso Google expirou (401). Limpando sessão...');
    accessToken = null;
    googleUser = null;
    localStorage.removeItem('wingene_drive_access_token');
    localStorage.removeItem('wingene_drive_user');
    renderUserProfileUI();
    updateDriveUIStatus('Sessão expirada (Offline)', true);
    showToast('Sua sessão do Google Drive expirou. Clique em "Conectar Drive" para renovar o acesso.', 'warning');
    return true;
  }
  return false;
}

/**
 * Lista o histórico de revisões/versões do arquivo no Google Drive
 */
async function listDriveRevisions() {
  if (!accessToken) {
    showToast('Conecte a conta do Google primeiro.', 'error');
    return null;
  }
  const fileId = driveFileId || await findDriveFile();
  if (!fileId) {
    showToast('Nenhum arquivo encontrado no Google Drive.', 'error');
    return null;
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions?fields=revisions(id,modifiedTime,size)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data.revisions || [];
    } else if (handleGoogleAuthError(res.status)) {
      return null;
    }
  } catch (err) {
    console.error('Erro ao listar revisões no Google Drive:', err);
  }
  return null;
}

/**
 * Restaura uma versão histórica do arquivo no Google Drive pelo ID da revisão
 */
async function restoreDriveRevision(revisionId) {
  if (!accessToken || !revisionId) return false;
  const fileId = driveFileId || await findDriveFile();
  if (!fileId) return false;

  try {
    updateDriveUIStatus('Restaurando versão histórica...');
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/revisions/${revisionId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const previousData = await res.json();
      if (previousData && (Array.isArray(previousData.rendaFixa) || Array.isArray(previousData.acoes))) {
        if (window.onDriveDataLoaded && typeof window.onDriveDataLoaded === 'function') {
          window.onDriveDataLoaded(previousData);
        }
        showToast('Versão anterior do Google Drive restaurada com sucesso!', 'success');
        return true;
      }
    } else if (handleGoogleAuthError(res.status)) {
      return false;
    }
  } catch (err) {
    console.error('Erro ao restaurar revisão:', err);
    showToast('Erro ao restaurar versão do Drive.', 'error');
  }
  return false;
}

/**
 * Desconecta a conta do Google Drive
 */
function logoutGoogleDrive() {
  if (accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Acesso do Google revogado');
    });
  }
  accessToken = null;
  googleUser = null;
  driveFileId = null;
  localStorage.removeItem('wingene_drive_access_token');
  localStorage.removeItem('wingene_drive_user');
  localStorage.removeItem('wingene_drive_file_id');
  renderUserProfileUI();
  updateDriveUIStatus('Desconectado do Google Drive');
}

// Fallback do helper escapeHtml caso drive-sync carregue antes do app.js
if (typeof escapeHtml !== 'function') {
  window.escapeHtml = function(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

let currentSyncStatus = { message: 'Conectado ao Drive', isError: false, isSuccess: true, isSyncing: false };

/**
 * Atualiza o status visual da integração no badge do avatar e no menu dropdown
 */
function updateDriveUIStatus(message, isError = false, isSuccess = false) {
  const msgLower = (message || '').toLowerCase();
  const isSyncing = msgLower.includes('sincronizando') || msgLower.includes('enviando');
  currentSyncStatus = { message, isError, isSuccess, isSyncing };

  // Atualiza mensagem no menu dropdown do usuário
  const statusEl = document.getElementById('driveSyncStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'user-dropdown-status ' + (isError ? 'error' : isSuccess ? 'success' : isSyncing ? 'syncing' : 'info');
  }

  // Atualiza estado do badge circular no avatar
  const avatarBadge = document.getElementById('avatarStatusBadge');
  if (avatarBadge) {
    avatarBadge.className = 'avatar-status-badge ' + (isSyncing ? 'is-syncing' : isError ? 'is-error' : 'is-success');
    avatarBadge.title = message;
  }
}

/**
 * Alterna a visibilidade do menu dropdown do perfil
 */
function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('userDropdownMenu');
  const btn = document.getElementById('btnUserAvatar');
  if (dropdown) {
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    if (btn) btn.setAttribute('aria-expanded', !isVisible);
  }
}

/**
 * Fecha o menu dropdown do perfil
 */
function closeUserDropdown() {
  const dropdown = document.getElementById('userDropdownMenu');
  const btn = document.getElementById('btnUserAvatar');
  if (dropdown) {
    dropdown.style.display = 'none';
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Navega para a aba de configurações
 */
function switchToConfigTab() {
  const configBtn = document.querySelector('.tab-btn[data-tab="config"]');
  if (configBtn) configBtn.click();
}

/**
 * Renderiza informações do perfil do usuário logado (Avatar Circular + Dropdown)
 */
function renderUserProfileUI() {
  const userContainer = document.getElementById('googleUserContainer');
  const loginBtn = document.getElementById('btnGoogleLogin');
  const loginBtnConfig = document.getElementById('btnGoogleLoginConfig');

  if (accessToken) {
    if (userContainer) {
      const userName = googleUser ? (googleUser.name || 'Conta Google') : 'Conta Google';
      const userEmail = googleUser ? (googleUser.email || '') : '';
      const userPicture = googleUser ? googleUser.picture : null;
      const initialLetter = (userName ? userName[0] : 'G').toUpperCase();

      const badgeClass = currentSyncStatus.isSyncing ? 'is-syncing' : currentSyncStatus.isError ? 'is-error' : 'is-success';
      const statusClass = currentSyncStatus.isError ? 'error' : currentSyncStatus.isSuccess ? 'success' : currentSyncStatus.isSyncing ? 'syncing' : 'info';

      userContainer.innerHTML = `
        <div class="user-profile-wrapper" id="userProfileWrapper">
          <button type="button" class="user-avatar-btn" id="btnUserAvatar" onclick="toggleUserDropdown(event)" aria-label="Perfil de ${escapeHtml(userName)}" aria-expanded="false">
            ${userPicture ? `
              <img src="${escapeHtml(userPicture)}" alt="${escapeHtml(userName)}" class="user-avatar-img" />
            ` : `
              <div class="user-avatar-fallback">${escapeHtml(initialLetter)}</div>
            `}
            <span class="avatar-status-badge ${badgeClass}" id="avatarStatusBadge" title="${escapeHtml(currentSyncStatus.message)}">
              <svg class="sync-spin-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6c0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6c0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4l-4-4v3z"/></svg>
            </span>
          </button>

          <div class="user-dropdown-menu" id="userDropdownMenu" style="display: none;" onclick="event.stopPropagation()">
            <div class="user-dropdown-header">
              <div class="user-dropdown-name">${escapeHtml(userName)}</div>
              ${userEmail ? `<div class="user-dropdown-email">${escapeHtml(userEmail)}</div>` : ''}
              <div class="user-dropdown-status ${statusClass}" id="driveSyncStatus">
                ${escapeHtml(currentSyncStatus.message)}
              </div>
            </div>
            <div class="user-dropdown-divider"></div>
            <button type="button" class="user-dropdown-item" onclick="syncFromDrive(); closeUserDropdown();">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6c0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6c0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4l-4-4v3z"/></svg>
              Sincronizar Agora
            </button>
            <button type="button" class="user-dropdown-item" onclick="switchToConfigTab(); closeUserDropdown();">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94c0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6s3.6 1.62 3.6 3.6s-1.62 3.6-3.6 3.6z"/></svg>
              Configurações
            </button>
            <div class="user-dropdown-divider"></div>
            <button type="button" class="user-dropdown-item danger" onclick="logoutGoogleDrive(); closeUserDropdown();">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
              Sair
            </button>
          </div>
        </div>
      `;
    }
    if (loginBtn) loginBtn.style.display = 'none';
    if (loginBtnConfig) loginBtnConfig.style.display = 'none';
  } else {
    if (userContainer) userContainer.innerHTML = '';
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (loginBtnConfig) loginBtnConfig.style.display = 'inline-flex';
  }
}

// Fechar menu dropdown ao clicar fora ou ao pressionar ESC
document.addEventListener('click', (e) => {
  const profileWrapper = document.getElementById('userProfileWrapper');
  if (profileWrapper && !profileWrapper.contains(e.target)) {
    closeUserDropdown();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeUserDropdown();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  renderUserProfileUI();
});

// Inicializa quando a API do Google carregar no navegador
window.addEventListener('load', () => {
  renderUserProfileUI();
  if (typeof google !== 'undefined' && google.accounts) {
    initGoogleAuth();
  } else {
    // Retry se a tag de script carregar um pouco depois
    setTimeout(initGoogleAuth, 1200);
  }
});
