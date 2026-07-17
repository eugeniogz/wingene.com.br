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
        return;
      }
      accessToken = tokenResponse.access_token;
      localStorage.setItem('wingene_drive_access_token', accessToken);
      
      // Obter dados do usuário
      await fetchGoogleUserInfo();
      updateDriveUIStatus(`Conectado como ${googleUser ? googleUser.name : 'Google Drive'}`);
      
      // Tentar carregar dados salvos no Drive automaticamente
      await syncFromDrive();
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
    tokenClient.requestAccessToken({ prompt: 'consent' });
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

/**
 * Atualiza o status visual da integração no cabeçalho/sidebar
 */
function updateDriveUIStatus(message, isError = false, isSuccess = false) {
  const statusEl = document.getElementById('driveSyncStatus');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'drive-status-badge ' + (isError ? 'error' : isSuccess ? 'success' : 'info');
  }
}

/**
 * Renderiza informações do perfil do usuário logado
 */
function renderUserProfileUI() {
  const userContainer = document.getElementById('googleUserContainer');
  const loginBtn = document.getElementById('btnGoogleLogin');
  const loginBtnConfig = document.getElementById('btnGoogleLoginConfig');
  const logoutBtn = document.getElementById('btnGoogleLogout');

  if (accessToken) {
    if (userContainer) {
      if (googleUser && googleUser.name) {
        userContainer.innerHTML = `
          <div class="user-profile-badge">
            <img src="${googleUser.picture || './icon.svg'}" alt="${googleUser.name}" class="user-avatar" />
            <div class="user-info">
              <span class="user-name">${escapeHtml(googleUser.name)}</span>
              <span class="user-email">${escapeHtml(googleUser.email)}</span>
            </div>
          </div>
        `;
      } else {
        userContainer.innerHTML = '<span class="text-success text-small">☁️ Drive Conectado</span>';
      }
    }
    if (loginBtn) loginBtn.style.display = 'none';
    if (loginBtnConfig) loginBtnConfig.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  } else {
    if (userContainer) userContainer.innerHTML = '<span class="text-muted text-small">Modo Local</span>';
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (loginBtnConfig) loginBtnConfig.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

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
