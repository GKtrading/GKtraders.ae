/**
 * Geektraders Global - Main JavaScript
 * Handles animations, navigation, and form interactions
 */

(function() {
    'use strict';

    // --------------------------------------------------------------------------
    // DOM Elements
    // --------------------------------------------------------------------------
    const header = document.querySelector('.header');
    const nav = document.querySelector('.nav');
    const navToggle = document.querySelector('#navToggle');
    const navLinks = document.querySelectorAll('.nav a');
    const fadeElements = document.querySelectorAll('.fade-in');
    const contactForm = document.querySelector('#contactForm');

    // --------------------------------------------------------------------------
    // Header Scroll Effect
    // --------------------------------------------------------------------------
    function handleScroll() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    // --------------------------------------------------------------------------
    // Mobile Navigation
    // --------------------------------------------------------------------------
    function toggleNav() {
        nav.classList.toggle('active');
        navToggle.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    }

    function closeNav() {
        nav.classList.remove('active');
        navToggle.classList.remove('active');
        document.body.style.overflow = '';
    }

    navToggle.addEventListener('click', toggleNav);

    navLinks.forEach(link => {
        link.addEventListener('click', closeNav);
    });

    // Close nav on outside click
    document.addEventListener('click', (e) => {
        if (nav.classList.contains('active') &&
            !nav.contains(e.target) &&
            !navToggle.contains(e.target)) {
            closeNav();
        }
    });

    // --------------------------------------------------------------------------
    // Smooth Scroll for Anchor Links
    // --------------------------------------------------------------------------
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const headerHeight = header.offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // --------------------------------------------------------------------------
    // Fade In Animation on Scroll
    // --------------------------------------------------------------------------
    function handleFadeIn() {
        const triggerBottom = window.innerHeight * 0.85;

        fadeElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;

            if (elementTop < triggerBottom) {
                element.classList.add('visible');
            }
        });
    }

    // Initial check
    handleFadeIn();

    // Check on scroll with throttle
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleFadeIn();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    // --------------------------------------------------------------------------
    // Contact Form Handling - Telegram Integration
    // --------------------------------------------------------------------------
    const TELEGRAM_BOT_TOKEN = '8572888070:AAG11DBzBOUeYpq-kIzfGosXrBI-r_QuR2Q';
    const TELEGRAM_CHAT_ID = '-5276039618';

    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const data = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });

            // Show loading state
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            // Format message for Telegram
            const message = `
🔔 *New SCO Request*

👤 *Name:* ${data.name}
🏢 *Company:* ${data.company}
📧 *Email:* ${data.email}
📦 *Volume:* ${data.volume} MT

💬 *Details:*
${data.message || 'No additional details'}

---
_Sent from GKtraders.ae_
            `.trim();

            try {
                const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                });

                if (response.ok) {
                    this.reset();
                    submitBtn.textContent = 'Request Sent!';
                } else {
                    submitBtn.textContent = 'Error. Try again.';
                }
            } catch (error) {
                submitBtn.textContent = 'Error. Try again.';
            }

            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }, 3000);
        });
    }

    // --------------------------------------------------------------------------
    // Video Background Optimization
    // --------------------------------------------------------------------------
    const heroVideo = document.querySelector('#heroVideo');

    if (heroVideo) {
        // Pause video when not in viewport
        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    heroVideo.play();
                } else {
                    heroVideo.pause();
                }
            });
        }, { threshold: 0.1 });

        videoObserver.observe(heroVideo);

        // Reduce quality on low bandwidth
        if ('connection' in navigator) {
            const connection = navigator.connection;
            if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                heroVideo.pause();
                heroVideo.style.display = 'none';
            }
        }
    }

    // --------------------------------------------------------------------------
    // Keyboard Navigation
    // --------------------------------------------------------------------------
    document.addEventListener('keydown', (e) => {
        // Close mobile nav on Escape
        if (e.key === 'Escape' && nav.classList.contains('active')) {
            closeNav();
        }
        // Close modal on Escape
        if (e.key === 'Escape' && procedureModal && procedureModal.classList.contains('active')) {
            closeModal();
        }
    });

    // --------------------------------------------------------------------------
    // Procedure Modal
    // --------------------------------------------------------------------------
    const procedureModal = document.querySelector('#procedureModal');
    const openProcedureBtn = document.querySelector('#openProcedure');
    const openProcedureWorkflowBtn = document.querySelector('#openProcedureWorkflow');
    const procedureLink = document.querySelector('#procedureLink');
    const closeModalBtn = document.querySelector('#closeModal');

    function openModal() {
        if (procedureModal) {
            procedureModal.classList.add('active');
            document.body.classList.add('modal-open');
        }
    }

    function closeModal() {
        if (procedureModal) {
            procedureModal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }

    if (openProcedureBtn) {
        openProcedureBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    }

    if (openProcedureWorkflowBtn) {
        openProcedureWorkflowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    }

    if (procedureLink) {
        procedureLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeNav();
            openModal();
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    // Close modal on overlay click
    if (procedureModal) {
        procedureModal.addEventListener('click', (e) => {
            if (e.target === procedureModal) {
                closeModal();
            }
        });
    }

})();
