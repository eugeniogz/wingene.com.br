/**
 * Wingene — Aviso de Compatibilidade para Dispositivos Móveis
 * Exibe um alerta amigável quando atividades projetadas para Desktop/PC
 * são acessadas a partir de celulares ou telas pequenas.
 */
(function() {
    function checkIsMobile() {
        const ua = navigator.userAgent || '';
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 500;
        return isMobileUA || (isTouch && isSmallScreen);
    }

    if (!checkIsMobile()) return;

    const currentScript = document.currentScript;
    const appName = (currentScript && currentScript.getAttribute('data-app')) || document.title.split('—')[0].trim() || 'Esta atividade';
    const storageKey = 'dismissed_mobile_warn_' + encodeURIComponent(appName);

    // Não exibe novamente se o usuário optou por continuar nesta sessão
    if (sessionStorage.getItem(storageKey)) return;

    const style = document.createElement('style');
    style.textContent = `
        .mobile-warning-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
            user-select: none;
            -webkit-user-select: none;
            animation: mobWarnFadeIn 0.25s ease-out;
        }
        @keyframes mobWarnFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .mobile-warning-card {
            background: #ffffff;
            color: #0f172a;
            border-radius: 20px;
            max-width: 390px;
            width: 100%;
            padding: 26px 22px;
            box-sizing: border-box;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            animation: mobWarnSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes mobWarnSlideUp {
            from { opacity: 0; transform: translateY(16px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mobile-warning-icon {
            width: 54px;
            height: 54px;
            border-radius: 16px;
            background: #fef3c7;
            color: #d97706;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 14px;
        }
        .mobile-warning-title {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: -0.01em;
        }
        .mobile-warning-text {
            margin: 0 0 18px 0;
            font-size: 14px;
            line-height: 1.55;
            color: #475569;
        }
        .mobile-warning-app-badge {
            display: inline-block;
            background: #f1f5f9;
            color: #1e293b;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 6px;
            font-size: 13px;
        }
        .mobile-warning-actions {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .btn-mob-warning-back {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            background: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.15s ease;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        }
        .btn-mob-warning-back:hover {
            background: #1d4ed8;
        }
        .btn-mob-warning-continue {
            background: transparent;
            color: #64748b;
            border: 1px solid #e2e8f0;
            padding: 10px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .btn-mob-warning-continue:hover {
            background: #f8fafc;
            color: #0f172a;
            border-color: #cbd5e1;
        }
    `;
    document.head.appendChild(style);

    function buildModal() {
        const overlay = document.createElement('div');
        overlay.id = 'mobile-warning-modal';
        overlay.className = 'mobile-warning-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'mobile-warning-title');

        overlay.innerHTML = `
            <div class="mobile-warning-card">
                <div class="mobile-warning-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="2" y="3" width="20" height="14" rx="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                </div>
                <h2 id="mobile-warning-title" class="mobile-warning-title">Melhor no Computador</h2>
                <p class="mobile-warning-text">
                    O recurso <span class="mobile-warning-app-badge">${appName}</span> não funciona bem em dispositivos móveis (celular). Ele foi projetado para tela ampla com uso de mouse e teclado em computadores (PC ou notebook).
                </p>
                <div class="mobile-warning-actions">
                    <a href="../educacao/index.html" class="btn-mob-warning-back">
                        ← Voltar ao Menu de Educação
                    </a>
                    <button type="button" class="btn-mob-warning-continue" id="btn-dismiss-mob-warn">
                        Continuar no celular mesmo assim
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const dismissBtn = overlay.querySelector('#btn-dismiss-mob-warn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                sessionStorage.setItem(storageKey, 'true');
                overlay.remove();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildModal);
    } else {
        buildModal();
    }
})();
