# restoOS
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Pelanggan dine in tanpa akun, garson, satu dapur, dan manajemen restoran.

## Product Purpose
Satu catatan bersama dari kiriman pesanan sampai masakan diantar dan tagihan diselesaikan. Transaksi adalah kumpulan pesanan pelanggan yang masih aktif, bukan profil pelanggan permanen. Pesanan adalah satu kiriman dengan tanggal dan waktu sendiri.

## Operating Context
Setiap login staf diikuti pemilihan ruang kerja Dapur, Garson, atau Manajemen. Role adalah konteks sesi yang bisa diganti melalui tombol di samping logout, bukan tipe akun permanen. Setiap staf yang sudah login dapat memilih ketiganya. Refresh mempertahankan pilihan sesi, sedangkan login baru selalu meminta pilihan lagi. Sesi lama tanpa pilihan juga diarahkan ke pemilih role.

Dapur menggunakan KDS layar penuh dengan antrean produksi, suara, pause, dan ketersediaan menu. Garson menggunakan ruang layanan dengan pelanggan, order, pengantaran, pembayaran, serta ketersediaan. Manajemen menggunakan dashboard laporan, arsip baca-saja, katalog dan pengaturan; tindakan operasional memerlukan pindah ke ruang Garson atau Dapur. Ketiganya memiliki komposisi navigasi dan tampilan masing-masing.

Satu restoran, satu dapur. Nama unik selama transaksi aktif; token browser anonim membuktikan kepemilikan. Pesanan langsung menjadi bagian transaksi, tanpa pengelompokan sesi atau pemisahan berdasarkan jeda waktu. Transaksi menutup otomatis hanya saat kewajiban keuangan dan operasional seluruh unit selesai.

Garson membuka satu tombol Buat order, mencari nama transaksi aktif, atau menambah pelanggan saat tidak ada kecocokan. Detail menampilkan sisa tagihan total dan per pesanan, beserta edit nama di samping nama pelanggan. Dapur menampilkan kebutuhan masak per menu dalam panel samping sticky di desktop/tablet dan ringkasan yang dapat dibuka di atas antrean pada ponsel. Manajemen menghitung transaksi belum selesai; pilihan pelanggan menghitung porsi dipesan dikurangi pembatalan tanpa bergantung pada pembayaran.

Katalog mendukung template dan impor Excel dengan pratinjau. Nama menu yang sama memperbarui katalog, nama baru menambah menu. Validasi dilakukan untuk seluruh file sebelum penyimpanan atomik; harga pesanan lama tetap. Foto menu mendukung PNG/JPG/WebP maksimal 2 MB saat Storage dikonfigurasi; unggah saat simpan, konversi WebP maksimal 1280px, ganti/hapus hanya dari Manajemen. Impor Excel mempertahankan foto.

## Confirmed configuration
Mata uang dasar dipilih di Manajemen → Pengaturan saat inisialisasi (default IDR). Seluruh harga dan laporan mengikuti pilihan ini tanpa konversi nominal. Harga berupa angka bulat, final tanpa pajak tambahan. Semua pencatatan dan pekerjaan non-UI memakai UTC; UI mengikuti zona waktu lokal perangkat. Auto-accept 15 detik, dengan suara yang diaktifkan pengguna di browser dapur.

## Capabilities and Constraints
Halaman utama (`/`) mengarahkan langsung ke menu publik (`/portal`). Portal tidak menampilkan tautan login atau menu staf. Login dan ruang staf hanya tersedia lewat alamat unlisted `/ruang-staf`, dengan autentikasi dan pemeriksaan peran pada server tetap berlaku.

Portal, Pelanggan & Order, Siap Diantar, KDS, menu, branding, laporan dan akses staf. Pembayaran manual per unit atau sisa order. Pembatalan berbayar ditahan sampai kebijakan koreksi ditetapkan. Batas spam adalah konfigurasi pilot tentatif. Tidak ada akun pelanggan, payment gateway, inventory, atau mode offline.

## Brand Commitments
Bahasa Indonesia alami. Kanvas ivory, judul serif editorial, teks gelap, garis tipis, aksen vermilion hemat. Ikuti token dan pola antarmuka dalam DESIGN.md.

## Implementation assumptions
Node 24, React, SQLite dipilih sebagai implementasi lokal yang mudah dijalankan. Pembatalan unit yang sudah dibayar atau diantar ditolak; refund belum tersedia. Nama 2–60 karakter; identitas pesanan stabil memakai ID transaksi dan urutan pesanan. Sesi autentikasi staf tetap terpisah dari model pesanan. Batas awal: kiriman kelima dalam 60 detik memicu ban 15, 30, lalu 60 menit. Limiter restoran 20/menit tidak diaktifkan.

Deployment memakai Vercel dengan Node 24 dan Supabase untuk PostgreSQL, Storage, serta Cron auto-accept. SQLite tetap tersedia melalui RESTO_DB eksplisit untuk QA. Sesi staf, idempotensi dan pembatasan login disimpan persisten. Polling staf 5 detik setelah respons dan portal 15 detik; tab tersembunyi berhenti polling. Lihat docs/PRODUCTION.md untuk konfigurasi, bukti verifikasi dan batas operasional.

## Accessibility & Inclusion
Target sentuh 44px, fokus keyboard, label status eksplisit, reduced motion, layout 360px hingga desktop.

## Initial state
Instalasi baru dimulai dengan katalog, transaksi, dan akun kosong. Identitas awal adalah Restoran Anda dengan mata uang IDR. Data sintetis hanya berada pada fixture tes.
