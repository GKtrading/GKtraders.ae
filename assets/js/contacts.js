/**
 * GeekTraders — Digital Business Cards
 *
 * Behaviour:
 *   - Shared URL with ?card=<id>           → cards fully unlocked (no form)
 *   - Direct visit to /contacts.html       → lead gate: teaser cards + form
 *   - After form submit, localStorage flag → cards stay unlocked in this browser
 *
 * Important: this is a static site. The gate is UX friction for lead capture,
 * not a real authorisation boundary. Determined visitors can still inspect
 * data/team.json directly.
 *
 * Card actions when unlocked:
 *   - Save Contact (vCard 3.0 .vcf with embedded JPEG photo)
 *   - Direct contact (tel, mailto, wa.me, t.me)
 *   - Share (Web Share API + WhatsApp/Telegram intent + copy link)
 *   - QR code (offline-friendly, generated client-side)
 *
 * Yandex.Metrika goals: card_view, card_locked_view, lead_submit,
 *   lead_submit_success, lead_submit_error, cards_unlocked,
 *   save_contact, share_native, share_whatsapp, share_telegram, share_copy
 */

(function () {
    'use strict';

    const METRIKA_ID = 106603064;
    const TEAM_URL = 'data/team.json';
    const STORAGE_KEY = 'gk_cards_unlocked';

    // Same Telegram bot/chat already exposed by index.html for SCO requests.
    const TELEGRAM_BOT_TOKEN = '8572888070:AAG11DBzBOUeYpq-kIzfGosXrBI-r_QuR2Q';
    const TELEGRAM_CHAT_ID = '-5276039618';

    const cardsContainer = document.getElementById('cardsContainer');
    const cardTemplate = document.getElementById('cardTemplate');
    const toastEl = document.getElementById('toast');
    const leadGateEl = document.getElementById('leadGate');
    const leadFormEl = document.getElementById('leadForm');

    if (!cardsContainer || !cardTemplate) return;

    let members = [];

    /* --------------------------------------------------------------------
     * Helpers
     * ------------------------------------------------------------------ */

    function track(goal, params) {
        if (typeof ym === 'function') {
            try { ym(METRIKA_ID, 'reachGoal', goal, params || {}); } catch (e) { /* noop */ }
        }
    }

    let toastTimer = null;
    function showToast(message) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
    }

    function getQueryParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function absoluteUrlForCard(memberId) {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('card', memberId);
        return url.toString();
    }

    function safeStorage(op) {
        try { return op(); } catch (e) { return null; }
    }

    function isUnlocked() {
        if (getQueryParam('card')) return true;                                 // shared link
        return safeStorage(() => localStorage.getItem(STORAGE_KEY)) === 'true'; // returning visitor
    }

    function persistUnlocked() {
        safeStorage(() => localStorage.setItem(STORAGE_KEY, 'true'));
    }

    /* --------------------------------------------------------------------
     * vCard 3.0 generation
     * ------------------------------------------------------------------ */

    function vEscape(value) {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    }

    function foldLine(line) {
        if (line.length <= 75) return line;
        const out = [line.slice(0, 75)];
        let i = 75;
        while (i < line.length) {
            out.push(' ' + line.slice(i, i + 74));
            i += 74;
        }
        return out.join('\r\n');
    }

    async function fetchAsBase64(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('photo fetch failed');
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => {
                const base64 = (reader.result || '').split(',')[1] || '';
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    }

    async function buildVCard(member) {
        const lines = [];
        lines.push('BEGIN:VCARD');
        lines.push('VERSION:3.0');
        lines.push('N:' + vEscape(member.lastName) + ';' + vEscape(member.firstName) + ';;;');
        lines.push('FN:' + vEscape(member.fullName));
        if (member.role)    lines.push('TITLE:' + vEscape(member.role));
        if (member.company) lines.push('ORG:'   + vEscape(member.company));
        if (member.phone)   lines.push('TEL;TYPE=CELL,VOICE:' + member.phone);
        if (member.email)   lines.push('EMAIL;TYPE=INTERNET,WORK:' + member.email);
        if (member.linkedin) lines.push('URL:' + member.linkedin);
        if (member.address) {
            const a = member.address;
            lines.push('ADR;TYPE=WORK:;;' + vEscape(a.street || '') + ';' + vEscape(a.city || '') + ';;;' + vEscape(a.country || ''));
        }
        const noteParts = [];
        if (member.telegram)  noteParts.push('Telegram: @' + member.telegram);
        if (member.whatsapp)  noteParts.push('WhatsApp: +' + member.whatsapp);
        if (member.languages && member.languages.length) noteParts.push('Languages: ' + member.languages.join(', '));
        if (noteParts.length) lines.push('NOTE:' + vEscape(noteParts.join(' | ')));

        const photoUrl = member.photoEmbed || member.photo;
        if (photoUrl) {
            try {
                const base64 = await fetchAsBase64(photoUrl);
                const ext = (photoUrl.split('.').pop() || 'jpg').toUpperCase();
                const type = ext === 'PNG' ? 'PNG' : 'JPEG';
                lines.push(foldLine('PHOTO;ENCODING=b;TYPE=' + type + ':' + base64));
            } catch (err) {
                console.warn('vCard photo embed skipped:', err);
            }
        }

        lines.push('REV:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''));
        lines.push('END:VCARD');
        return lines.join('\r\n') + '\r\n';
    }

    function downloadVCard(content, filename) {
        const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    /* --------------------------------------------------------------------
     * Card rendering
     * ------------------------------------------------------------------ */

    function renderCard(member, opts) {
        opts = opts || {};
        const locked = !!opts.locked;

        const node = cardTemplate.content.firstElementChild.cloneNode(true);
        node.dataset.cardId = member.id;
        if (locked) node.classList.add('is-locked');
        if (opts.justUnlocked) node.classList.add('just-unlocked');

        // Identity (always rendered — minimum trust signal)
        const photo = node.querySelector('[data-photo]');
        if (photo) { photo.src = member.photo; photo.alt = member.fullName; }
        node.querySelector('[data-name]').textContent = member.fullName;
        node.querySelector('[data-role]').textContent = member.role || '';
        node.querySelector('[data-company]').textContent = member.company || '';
        const langsEl = node.querySelector('[data-langs]');
        if (langsEl && member.languages && member.languages.length) {
            langsEl.innerHTML = member.languages.map(l => '<li>' + l + '</li>').join('');
        }

        if (locked) {
            // Stop here. CSS hides the rest. We deliberately do NOT write phone/
            // email/Telegram/WhatsApp/LinkedIn/address into the DOM.
            return node;
        }

        // Direct contact
        const callEl = node.querySelector('[data-call]');
        if (callEl) {
            callEl.href = 'tel:' + member.phone;
            callEl.querySelector('[data-phone-display]').textContent = member.phoneDisplay || member.phone;
        }

        const waEl = node.querySelector('[data-whatsapp]');
        if (waEl) waEl.href = 'https://wa.me/' + member.whatsapp;

        const tgEl = node.querySelector('[data-telegram]');
        if (tgEl) {
            tgEl.href = 'https://t.me/' + member.telegram;
            tgEl.querySelector('[data-telegram-handle]').textContent = '@' + member.telegram;
        }

        const emailEl = node.querySelector('[data-email]');
        if (emailEl) {
            emailEl.href = 'mailto:' + member.email;
            emailEl.querySelector('[data-email-display]').textContent = member.email;
        }

        // LinkedIn
        const liEl = node.querySelector('[data-linkedin]');
        if (liEl && member.linkedin) {
            liEl.href = member.linkedin;
            liEl.querySelector('[data-linkedin-label]').textContent = 'LinkedIn';
            liEl.hidden = false;
        }

        // Address
        if (member.address) {
            const a = member.address;
            const addressLine = [a.street, a.city, a.country].filter(Boolean).join(', ');
            const addrEl = node.querySelector('[data-address]');
            if (addrEl) addrEl.textContent = addressLine;
        }

        const shareUrl = absoluteUrlForCard(member.id);
        const qrCaption = node.querySelector('[data-qr-url]');
        if (qrCaption) qrCaption.textContent = shareUrl.replace(/^https?:\/\//, '');

        wireSave(node, member);
        wireShare(node, member, shareUrl);
        wireQR(node, shareUrl);

        return node;
    }

    function wireSave(node, member) {
        const btn = node.querySelector('[data-save]');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const span = btn.querySelector('span');
            const original = span.textContent;
            span.textContent = 'Preparing…';
            btn.disabled = true;
            try {
                const vcf = await buildVCard(member);
                downloadVCard(vcf, member.id + '.vcf');
                track('save_contact', { card_id: member.id });
                span.textContent = 'Saved ✓';
                setTimeout(() => { span.textContent = original; btn.disabled = false; }, 2500);
            } catch (err) {
                console.error(err);
                span.textContent = 'Try again';
                setTimeout(() => { span.textContent = original; btn.disabled = false; }, 2500);
            }
        });
    }

    function wireShare(node, member, shareUrl) {
        const shareTitle = member.fullName + ' · ' + (member.company || '');
        const shareText  = 'Contact card — ' + member.fullName + ' (' + (member.company || '') + ')';

        const nativeBtn = node.querySelector('[data-share-native]');
        if (nativeBtn && navigator.share) {
            nativeBtn.hidden = false;
            nativeBtn.addEventListener('click', async () => {
                try {
                    await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                    track('share_native', { card_id: member.id });
                } catch (e) { /* user cancelled */ }
            });
        }

        const waShare = node.querySelector('[data-share-whatsapp]');
        if (waShare) {
            waShare.addEventListener('click', () => {
                const text = encodeURIComponent(shareText + '\n' + shareUrl);
                window.open('https://wa.me/?text=' + text, '_blank', 'noopener');
                track('share_whatsapp', { card_id: member.id });
            });
        }

        const tgShare = node.querySelector('[data-share-telegram]');
        if (tgShare) {
            tgShare.addEventListener('click', () => {
                const url  = encodeURIComponent(shareUrl);
                const text = encodeURIComponent(shareText);
                window.open('https://t.me/share/url?url=' + url + '&text=' + text, '_blank', 'noopener');
                track('share_telegram', { card_id: member.id });
            });
        }

        const copyBtn = node.querySelector('[data-copy]');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    showToast('Link copied');
                    track('share_copy', { card_id: member.id });
                } catch (err) {
                    showToast('Long-press the link below to copy');
                }
            });
        }
    }

    function wireQR(node, shareUrl) {
        const target = node.querySelector('[data-qr]');
        if (!target || typeof QRCode === 'undefined') return;
        new QRCode(target, {
            text: shareUrl,
            width: 320,
            height: 320,
            colorDark: '#0a0e17',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    /* --------------------------------------------------------------------
     * Page-level rendering
     * ------------------------------------------------------------------ */

    function renderAllCards(opts) {
        opts = opts || {};
        cardsContainer.innerHTML = '';
        if (!members.length) {
            cardsContainer.innerHTML = '<p class="biz-error">Card not found.</p>';
            return;
        }
        members.forEach(m => {
            cardsContainer.appendChild(renderCard(m, opts));
            track(opts.locked ? 'card_locked_view' : 'card_view', { card_id: m.id });
        });
    }

    function showLeadGate() { if (leadGateEl) leadGateEl.hidden = false; }

    function hideLeadGate(animated) {
        if (!leadGateEl) return;
        if (!animated) { leadGateEl.hidden = true; return; }
        leadGateEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease, max-height 0.4s ease';
        leadGateEl.style.opacity = '0';
        leadGateEl.style.transform = 'translateY(-8px)';
        setTimeout(() => { leadGateEl.hidden = true; }, 320);
    }

    /* --------------------------------------------------------------------
     * Lead form
     * ------------------------------------------------------------------ */

    async function postToTelegram(data, cardContext) {
        const lines = [
            '🔓 *Card Unlock Request*',
            '',
            '👤 *Name:* ' + data.name,
            '🏢 *Company:* ' + data.company,
            '📧 *Email:* ' + data.email,
            data.phone   ? '📞 *Phone:* ' + data.phone     : null,
            data.message ? '💬 *Message:* ' + data.message : null,
            '',
            '📇 *Looking at:* ' + cardContext,
            '🔗 *Source:* ' + (document.referrer || window.location.href),
            '',
            '---',
            '_Lead from gktraders.ae/contacts_'
        ].filter(Boolean).join('\n');

        const res = await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: lines,
                parse_mode: 'Markdown'
            })
        });
        if (!res.ok) throw new Error('telegram api ' + res.status);
    }

    function wireLeadForm() {
        if (!leadFormEl) return;
        leadFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = leadFormEl.querySelector('[data-submit]');
            const submitLabel = submitBtn.querySelector('span');
            const originalLabel = submitLabel.textContent;

            const data = Object.fromEntries(new FormData(leadFormEl).entries());
            const required = ['name', 'company', 'email'];
            let valid = true;
            let firstInvalid = null;
            required.forEach(f => {
                const input = leadFormEl.querySelector('[name="' + f + '"]');
                if (!input) return;
                if (!data[f] || !data[f].trim()) {
                    input.setAttribute('aria-invalid', 'true');
                    if (!firstInvalid) firstInvalid = input;
                    valid = false;
                } else {
                    input.removeAttribute('aria-invalid');
                }
            });
            const emailInput = leadFormEl.querySelector('[name="email"]');
            if (valid && emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                emailInput.setAttribute('aria-invalid', 'true');
                firstInvalid = emailInput;
                valid = false;
            }
            if (!valid) {
                showToast('Please complete the required fields');
                if (firstInvalid) firstInvalid.focus();
                return;
            }

            track('lead_submit');
            submitLabel.textContent = 'Sending…';
            submitBtn.disabled = true;

            try {
                const cardContext = members.length === 1
                    ? members[0].fullName + ' (' + members[0].id + ')'
                    : 'Trading Desk directory';
                await postToTelegram(data, cardContext);
                track('lead_submit_success');
                persistUnlocked();
                hideLeadGate(true);
                renderAllCards({ locked: false, justUnlocked: true });
                track('cards_unlocked');
                showToast('Contacts unlocked. Welcome.');
            } catch (err) {
                console.error(err);
                track('lead_submit_error');
                submitLabel.textContent = 'Try again';
                setTimeout(() => {
                    submitLabel.textContent = originalLabel;
                    submitBtn.disabled = false;
                }, 3000);
            }
        });
    }

    /* --------------------------------------------------------------------
     * Boot
     * ------------------------------------------------------------------ */

    async function init() {
        let team;
        try {
            const res = await fetch(TEAM_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error('team.json fetch failed');
            team = await res.json();
        } catch (err) {
            console.error(err);
            cardsContainer.innerHTML = '<p class="biz-error">Couldn’t load contacts. Please refresh the page.</p>';
            return;
        }

        const requestedId = getQueryParam('card');
        members = (team.members || []).filter(m => !requestedId || m.id === requestedId);

        const unlocked = isUnlocked();
        if (!unlocked) showLeadGate();

        renderAllCards({ locked: !unlocked });
        wireLeadForm();

        if (requestedId && members.length === 1) {
            const m = members[0];
            document.title = m.fullName + ' · ' + (m.company || 'GeekTraders');
        }
    }

    init();
})();
