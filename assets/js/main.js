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
    // Contact Form Handling
    // --------------------------------------------------------------------------
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
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

            // Simulate form submission (replace with actual endpoint)
            setTimeout(() => {
                // Reset form
                this.reset();
                submitBtn.textContent = 'Request Sent!';

                setTimeout(() => {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }, 2000);

                // In production, send data to server:
                // fetch('/api/contact', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify(data)
                // });
            }, 1000);
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
    });

})();
