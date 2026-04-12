/* script.js - Logika Interaktif untuk DIREZ PAYMENT */

/**
 * Fungsi untuk menyalin teks ke clipboard
 * Menggunakan API navigator.clipboard sesuai instruksi
 * @param {string} text - Teks yang akan disalin (nomor HP)
 * @param {string} method - Nama metode pembayaran untuk alert
 */
function copyToClipboard(text, method) {
    navigator.clipboard.writeText(text).then(() => {
        // Beri feedback ke user
        alert(`Nomor ${method} (${text}) berhasil disalin!`);
    }).catch(err => {
        console.error('Gagal menyalin: ', err);
        // Fallback jika browser tidak mendukung navigator.clipboard
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert(`Nomor ${method} (${text}) berhasil disalin!`);
        } catch (err) {
            alert('Gagal menyalin nomor.');
        }
        document.body.removeChild(textArea);
    });
}

/**
 * Logika Modal untuk Zoom QRIS
 */
const modal = document.getElementById("qris-modal");
const btnZoom = document.getElementById("btn-zoom");
const qrisImg = document.getElementById("qris-image");
const modalImg = document.getElementById("img-zoomed");
const closeModal = document.getElementsByClassName("close-modal")[0];

// Saat tombol Zoom diklik
btnZoom.onclick = function() {
    modal.style.display = "block";
    modalImg.src = qrisImg.src;
}

// Saat tombol close (X) diklik
closeModal.onclick = function() {
    modal.style.display = "none";
}

// Saat user klik di luar area gambar pada modal
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

/**
 * Logika Download (Opsional: Memastikan link download bekerja dengan benar)
 */
const btnDownload = document.getElementById("btn-download");
btnDownload.addEventListener('click', function(e) {
    // Note: Link download di HTML sudah mengarah ke file QRIS.
    // Jika perlu modifikasi logika download secara dinamis, bisa di sini.
    console.log("Mendownload QRIS...");
});

// Menambahkan event listener ke tombol konfirmasi WhatsApp (opsional, karena sudah ada di href)
document.querySelector('.btn-whatsapp').addEventListener('click', function() {
    console.log("Mengarahkan ke WhatsApp...");
});
