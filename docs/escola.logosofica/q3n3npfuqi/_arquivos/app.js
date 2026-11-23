(() => {
  const data = window.SCRATCH_SHOWCASE || { studentName: 'Aluno', projects: [] };
  const studentName = data.studentName || 'Aluno';
  const isWebsite = data.mode === 'website';
  const rawProjects = data.projects || [];
  const selectedIds = Array.isArray(window.SCRATCH_SELECAO)
    ? new Set(window.SCRATCH_SELECAO)
    : null;
  const allProjects = selectedIds
    ? rawProjects.filter((project) => selectedIds.has(project.id))
    : rawProjects;

  const pageTitleEl = document.getElementById('page-title');
  const summaryEl = document.getElementById('summary-text');
  const footerTextEl = document.getElementById('footer-text');
  const searchInput = document.getElementById('search-input');
  const resultsStatus = document.getElementById('results-status');
  const gridEl = document.getElementById('projects-grid');
  const emptyStateEl = document.getElementById('empty-state');

  const dialog = document.getElementById('player-dialog');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogStudent = document.getElementById('dialog-student');
  const playerScratchBtn = document.getElementById('player-scratch-btn');
  const projectFrame = document.getElementById('project-frame');
  const closeDialogBtn = document.getElementById('close-dialog-btn');
  const restartBtn = document.getElementById('restart-btn');
  const prevBtn = document.getElementById('prev-project-btn');
  const nextBtn = document.getElementById('next-project-btn');

  const scratchDialog = document.getElementById('scratch-dialog');
  const scratchDialogFilename = document.getElementById('scratch-dialog-filename');
  const scratchDownloadLink = document.getElementById('scratch-download-link');
  const closeScratchDialogBtn = document.getElementById('close-scratch-dialog-btn');

  let searchQuery = '';
  let filteredProjects = [...allProjects];
  let currentProjectIndex = -1;

  function normalizeText(value) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderHeader() {
    document.title = `Projetos Scratch — ${studentName}`;
    pageTitleEl.textContent = `Projetos de ${studentName}`;
    const count = allProjects.length;
    if (isWebsite) {
      summaryEl.textContent = `${count} ${count === 1 ? 'projeto publicado' : 'projetos publicados'}`;
      if (footerTextEl) {
        footerTextEl.textContent = 'Vitrine de projetos Scratch · Convertido com TurboWarp Packager';
      }
    } else {
      summaryEl.textContent = `${count} ${count === 1 ? 'projeto salvo' : 'projetos salvos'} neste pen-drive`;
    }
  }

  function applyFilters() {
    const query = normalizeText(searchQuery.trim());

    filteredProjects = allProjects.filter((project) => {
      if (!query) return true;
      return normalizeText(project.title).includes(query);
    });

    const count = filteredProjects.length;
    resultsStatus.textContent = `${count} ${count === 1 ? 'projeto encontrado' : 'projetos encontrados'}`;

    renderCards();
  }

  function renderCards() {
    gridEl.textContent = '';

    if (filteredProjects.length === 0) {
      emptyStateEl.hidden = false;
      return;
    }

    emptyStateEl.hidden = true;
    const fragment = document.createDocumentFragment();

    filteredProjects.forEach((project, index) => {
      const card = document.createElement('article');
      card.className = 'card';

      if (project.thumbPath) {
        const thumbBtn = document.createElement('button');
        thumbBtn.type = 'button';
        thumbBtn.className = 'card-thumb-btn';
        thumbBtn.setAttribute('aria-label', `Executar ${project.title}`);
        thumbBtn.addEventListener('click', () => openPlayer(index));

        const thumbImg = document.createElement('img');
        thumbImg.className = 'card-thumb';
        thumbImg.src = project.thumbPath;
        thumbImg.alt = '';
        thumbImg.loading = 'lazy';
        thumbImg.width = 480;
        thumbImg.height = 360;
        thumbImg.addEventListener('error', () => {
          thumbBtn.remove();
        });

        thumbBtn.appendChild(thumbImg);
        card.appendChild(thumbBtn);
      }

      const title = document.createElement('h3');
      title.textContent = project.title;

      const fileInfo = document.createElement('p');
      fileInfo.className = 'card-file';

      const fileBtn = document.createElement('button');
      fileBtn.type = 'button';
      fileBtn.className = 'file-link-btn';
      fileBtn.textContent = `${project.sb3Name} (${formatBytes(project.sizeBytes)})`;
      fileBtn.addEventListener('click', () => openScratchDialog(project));
      fileInfo.appendChild(fileBtn);

      const footer = document.createElement('footer');

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'btn btn-primary';
      playBtn.innerHTML = '▶ Executar <span class="visually-hidden"></span>';
      playBtn.querySelector('.visually-hidden').textContent = project.title;
      playBtn.addEventListener('click', () => openPlayer(index));

      footer.append(playBtn);
      card.append(title, fileInfo, footer);
      fragment.appendChild(card);
    });

    gridEl.appendChild(fragment);
  }

  function openScratchDialog(project) {
    scratchDialogFilename.textContent = project.sb3Name;
    scratchDownloadLink.href = project.sb3Path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    scratchDownloadLink.setAttribute('download', project.sb3Name);
    if (!scratchDialog.open) {
      scratchDialog.showModal();
    }
  }

  function openPlayer(index) {
    if (index < 0 || index >= filteredProjects.length) return;
    currentProjectIndex = index;
    const project = filteredProjects[index];

    dialogStudent.textContent = project.student;
    dialogTitle.textContent = project.title;
    projectFrame.title = `Projeto ${project.title} de ${project.student}`;
    projectFrame.src = project.htmlPath;

    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === filteredProjects.length - 1;

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function stopAndClearFrame() {
    projectFrame.src = 'about:blank';
    currentProjectIndex = -1;
  }

  closeDialogBtn.addEventListener('click', () => {
    dialog.close();
  });

  closeScratchDialogBtn.addEventListener('click', () => {
    scratchDialog.close();
  });

  playerScratchBtn.addEventListener('click', () => {
    if (currentProjectIndex >= 0 && currentProjectIndex < filteredProjects.length) {
      openScratchDialog(filteredProjects[currentProjectIndex]);
    }
  });

  dialog.addEventListener('close', () => {
    stopAndClearFrame();
  });

  restartBtn.addEventListener('click', () => {
    if (currentProjectIndex >= 0 && currentProjectIndex < filteredProjects.length) {
      const project = filteredProjects[currentProjectIndex];
      projectFrame.src = 'about:blank';
      requestAnimationFrame(() => {
        projectFrame.src = project.htmlPath;
      });
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentProjectIndex > 0) {
      openPlayer(currentProjectIndex - 1);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentProjectIndex < filteredProjects.length - 1) {
      openPlayer(currentProjectIndex + 1);
    }
  });

  searchInput.addEventListener('input', (event) => {
    searchQuery = event.target.value;
    applyFilters();
  });

  renderHeader();
  applyFilters();
})();
