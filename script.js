/**
 * script.js - Interactive logic for DIREZ STORE PAYMENT
 * Includes: Copy to clipboard, Modal Zoom, and Ripple effects
 */

document.addEventListener('DOMContentLoaded', () => {
    initModal();
    initDownload();
    initRippleEffect();
});

/**
 * Copy text to clipboard using navigator.clipboard API
 * @param {string} text - The text to copy
 * @param {HTMLElement} btn - The button element that was clicked
 */
function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        // Change button state temporarily
        const originalText = btn.innerText;
        btn.innerText = 'TERSALIN!';
        btn.classList.add('copied');

        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Gagal menyalin: ', err);
        alert('Gagal menyalin nomor. Silakan salin secara manual.');
    });
}

/**
 * Logic for QRIS Modal Zoom
 */
function initModal() {
    const modal = document.getElementById('modal-zoom');
    const btnZoom = document.getElementById('btn-zoom');
    const qrisImg = document.getElementById('qris-img');
    const zoomImg = document.getElementById('img-zoom');
    const closeBtn = document.querySelector('.close-btn');
    const overlay = document.querySelector('.modal-overlay');

    if (!modal || !btnZoom) return;

    btnZoom.addEventListener('click', () => {
        modal.style.display = 'flex';
        zoomImg.src = qrisImg.src;
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    });

    const closeModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

/**
 * Logic for QRIS Download
 */
function initDownload() {
    const btnDownload = document.getElementById('btn-download');
    const qrisImg = document.getElementById('qris-img');

    if (!btnDownload || !qrisImg) return;

    btnDownload.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = qrisImg.src;
        link.download = 'QRIS_DIREZ_STORE.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

/**
 * Button Ripple Effect Animation
 */
function initRippleEffect() {
    const buttons = document.querySelectorAll('.ripple');

    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const x = e.clientX - e.target.offsetLeft;
            const y = e.clientY - e.target.offsetTop;

            const ripple = document.createElement('span');
            ripple.classList.add('ripple-effect');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}
