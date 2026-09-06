/* ==========================================================================
   WINGENE LANDING PAGE (ENGLISH) - INTERACTIVE JAVASCRIPT
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Navigation Bar Scroll Effect
    const navbar = document.getElementById("navbar");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    // 2. Interactive SVG Logo and VIDA Method Cards Cross-Highlighting
    const vidaCards = document.querySelectorAll(".vida-card");
    
    // SVG star path elements
    const stars = {
        "star-valores": document.getElementById("path-valores"),
        "star-imperfeicoes": document.getElementById("path-imperfeicoes"),
        "star-decisoes": document.getElementById("path-decisoes"),
        "star-atencao": document.getElementById("path-atencao"),
        "star-atencao-bg": document.getElementById("path-atencao-bg")
    };

    // A) Hovering on Card -> Highlights corresponding star in SVG
    vidaCards.forEach(card => {
        const starId = card.getAttribute("data-star");
        
        card.addEventListener("mouseenter", () => {
            if (stars[starId]) {
                stars[starId].classList.add(`highlight-${starId.replace("star-", "")}`);
                
                if (starId === "star-atencao" && stars["star-atencao-bg"]) {
                    stars["star-atencao-bg"].classList.add("highlight-atencao");
                }
            }
        });

        card.addEventListener("mouseleave", () => {
            if (stars[starId]) {
                stars[starId].classList.remove(`highlight-${starId.replace("star-", "")}`);
                
                if (starId === "star-atencao" && stars["star-atencao-bg"]) {
                    stars["star-atencao-bg"].classList.remove("highlight-atencao");
                }
            }
        });
    });

    // B) Hovering on SVG star -> Highlights corresponding Card
    Object.keys(stars).forEach(key => {
        const pathElement = stars[key];
        if (!pathElement) return;

        let cardId = "card-valores";
        if (key === "path-imperfeicoes" || key === "star-imperfeicoes") cardId = "card-imperfeicoes";
        else if (key === "path-decisoes" || key === "star-decisoes") cardId = "card-decisoes";
        else if (key === "path-atencao" || key === "path-atencao-bg" || key === "star-atencao") cardId = "card-atencao";

        const matchingCard = document.getElementById(cardId);

        pathElement.addEventListener("mouseenter", () => {
            if (matchingCard) {
                matchingCard.classList.add("active");
            }
        });

        pathElement.addEventListener("mouseleave", () => {
            if (matchingCard) {
                matchingCard.classList.remove("active");
            }
        });
    });

    // 3. Philosophical Quotes Rotator (English)
    const quotes = [
        "Eudaimonia: the cadence of pulse and thought.",
        "Serene euphoria: the mind transcends the mind.",
        "Solitude: a tree that senses the forest.",
        "To live: a present absence.",
        "Distraction: attention to emptiness.",
        "Weave virtues, sow conscious attitudes.",
        "Brief life, eternal routes.",
        "Matter is the instrument; synapse is the music.",
        "To remember: the sap that sweetens joy.",
        "Pillars of flourishing: Create, Love, Remember, and Evolve.",
        "Living weaves indescribable tones.",
        "Patience: when reason takes a conscious breath."
    ];

    let currentQuoteIndex = 0;
    const quoteTextElement = document.getElementById("quote-text");
    const prevQuoteBtn = document.getElementById("prev-quote");
    const nextQuoteBtn = document.getElementById("next-quote");
    let quoteInterval;

    function showQuote(index) {
        if (!quoteTextElement) return;
        quoteTextElement.style.opacity = "0";
        
        setTimeout(() => {
            quoteTextElement.textContent = quotes[index];
            quoteTextElement.style.opacity = "1";
        }, 400);
    }

    function nextQuote() {
        currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
        showQuote(currentQuoteIndex);
    }

    function prevQuote() {
        currentQuoteIndex = (currentQuoteIndex - 1 + quotes.length) % quotes.length;
        showQuote(currentQuoteIndex);
    }

    function startQuoteRotation() {
        clearInterval(quoteInterval);
        quoteInterval = setInterval(nextQuote, 7000);
    }

    if (nextQuoteBtn && prevQuoteBtn) {
        nextQuoteBtn.addEventListener("click", () => {
            nextQuote();
            startQuoteRotation();
        });

        prevQuoteBtn.addEventListener("click", () => {
            prevQuote();
            startQuoteRotation();
        });

        startQuoteRotation();
    }

    // 4. Language Switcher Click Event
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang') || (btn.textContent.trim().toLowerCase() === 'pt' ? 'pt' : 'en');
            try {
                localStorage.setItem('wingene_lang', lang);
            } catch (e) {}
        });
    });
});
