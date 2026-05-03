/**
 * GeekTraders — Digital Business Cards
 *
 * Loads team data, renders one card per member, and wires up:
 *   - Save Contact  (vCard 3.0 .vcf download with embedded photo)
 *   - Direct contact (tel, mailto, wa.me, t.me)
 *   - Share this card (Web Share API + WhatsApp/Telegram intent + copy link)
 *   - QR code (offline-friendly, generated client-side)
 *   - Yandex.Metrika goals for analytics
 */

(function () {
    'use strict';

    const METRIKA_ID = 106603064;
    const TEAM_URL = 'data/team.json';

    const cardsContainer = document.getElementById('cardsContainer');
    const cardTemplate = document.getElementById('cardTemplate');
    const toastEl = document.getElementById('toast');

    if (!cardsContainer || !cardTemplate) return;

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

    /* --------------------------------------------------------------------
     * vCard 3.0 generation
     * RFC 2426 / pragmatic compatibility for iOS, Android, Outlook, Gmail
     * ------------------------------------------------------------------ */

    function vEscape(value) {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    }

    // RFC 6350 §3.2: fold at 75 octets, continuation lines start with a single space
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
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1] || '';
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

        // Embed the photo (small thumbnail) so the contact card has the avatar after import.
        const photoUrl = member.photoEmbed || member.photo;
        if (photoUrl) {
            try {
                const base64 = await fetchAsBase64(photoUrl);
                const ext = (photoUrl.split('.').pop() || 'jpg').toUpperCase();
                const type = ext === 'PNG' ? 'PNG' : 'JPEG';
                lines.push(foldLine('PHOTO;ENCODING=b;TYPE=' + type + ':' + base64));
            } catch (err) {
                // Photo embed failed — vCard still valid without it.
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

    function renderCard(member) {
        const node = cardTemplate.content.firstElementChild.cloneNode(true);
        node.dataset.cardId = member.id;

        const set = (sel, value) => {
            const el = node.querySelector(sel);
            if (el) el.textContent = value || '';
        };
        const setAttr = (sel, attr, value) => {
            const el = node.querySelector(sel);
            if (el) el.setAttribute(attr, value);
        };

        // Identity
        const photo = node.querySelector('[data-photo]');
        if (photo) {
            photo.src = member.photo;
            photo.alt = member.fullName;
        }
        set('[data-name]', member.fullName);
        set('[data-role]', member.role || '');
        set('[data-company]', member.company || '');

        // Languages
        const langsEl = node.querySelector('[data-langs]');
        if (langsEl && member.languages && member.languages.length) {
            langsEl.innerHTML = member.languages.map(l => '<li>' + l + '</li>').join('');
        }

        // Direct contact links
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
            set('[data-address]', addressLine);
        }

        // Share/copy URL
        const shareUrl = absoluteUrlForCard(member.id);
        const qrCaption = node.querySelector('[data-qr-url]');
        if (qrCaption) qrCaption.textContent = shareUrl.replace(/^https?:\/\//, '');

        // Wire actions
        wireSave(node, member);
        wireShare(node, member, shareUrl);
        wireQR(node, shareUrl);

        return node;
    }

    function wireSave(node, member) {
        const btn = node.querySelector('[data-save]');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const original = btn.querySelector('span').textContent;
            btn.querySelector('span').textContent = 'Preparing…';
            btn.disabled = true;
            try {
                const vcf = await buildVCard(member);
                const filename = member.id + '.vcf';
                downloadVCard(vcf, filename);
                track('save_contact', { card_id: member.id });
                btn.querySelector('span').textContent = 'Saved ✓';
                setTimeout(() => {
                    btn.querySelector('span').textContent = original;
                    btn.disabled = false;
                }, 2500);
            } catch (err) {
                console.error(err);
                btn.querySelector('span').textContent = 'Try again';
                setTimeout(() => {
                    btn.querySelector('span').textContent = original;
                    btn.disabled = false;
                }, 2500);
            }
        });
    }

    function wireShare(node, member, shareUrl) {
        const shareTitle = member.fullName + ' · ' + (member.company || '');
        const shareText = 'Contact card — ' + member.fullName + ' (' + (member.company || '') + ')';

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
                const url = encodeURIComponent(shareUrl);
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
        const members = (team.members || []).filter(m => !requestedId || m.id === requestedId);

        cardsContainer.innerHTML = '';
        if (!members.length) {
            cardsContainer.innerHTML = '<p class="biz-error">Card not found.</p>';
            return;
        }

        members.forEach(m => {
            cardsContainer.appendChild(renderCard(m));
            track('card_view', { card_id: m.id });
        });

        // If a single card was requested, update document title for share previews
        if (requestedId && members.length === 1) {
            const m = members[0];
            document.title = m.fullName + ' · ' + (m.company || 'GeekTraders');
        }
    }

    init();
})();
