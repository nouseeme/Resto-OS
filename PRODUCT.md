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

## Manual description languages
Excel accepts optional Deskripsi [language-code] columns. Deskripsi is the Indonesian default; translations affect descriptions only. Empty/omitted translations preserve existing values. The portal language selector uses the union of stored languages and falls back per menu to Indonesian without filtering menus out. Language count is flexible within file limits.

## Management finance and reporting

Manajemen → Keuangan combines received customer payments and paid expenses in one ledger. Expenses record event time, positive integer amount, category, payment method, recipient, description, optional reference, and recording staff. Submissions have an idempotency key. Defaults are Bahan baku, Peralatan, Gaji, Kemasan, Lain-lain; payment defaults are Tunai and Transfer. Manajemen → Pengaturan → Keuangan supports adding, renaming and archiving both lists, retaining at least one active choice. Existing payment labels remain readable. New orders snapshot the menu category.

Overview includes sales by menu category, receipt totals and counts by payment method, expense total and net cash movement for its selected period. Sales and cash receipts remain distinct. Keuangan has date, type, category, method and text filters, with 50 records per page. Expense records are append-only; corrections/refunds are not implemented.

One unobtrusive Ekspor laporan action appears in the shared management page heading. It downloads an integrated XLSX workbook with raw transactions, portions, payments and expenses, formula-driven ledger, transaction/debt report, cash and expense breakdowns, menu report, category sales and summary. Optional date bounds use the device timezone and become UTC bounds on the server; timestamps in Excel are UTC. Supporting history is included to calculate opening recorded cash and debt as of the period end. Recorded cash is not a bank balance and excludes unrecorded capital. Editing existing raw rows recalculates dependent reports in Excel; adding new rows/categories requires extending ranges/re-exporting. Data is a snapshot, not a live connection. Historical menu categories without snapshots fall back to the current catalogue or an explicit unknown label.

## Garson customer grouping and merge

Daftar pelanggan is one shared table with Order aktif grouped above Piutang lama, using non-interactive section headings and counts. Both groups are visible together, share one column header, customer search and multi-selection. There are no active/debt/all filter tabs. Waiter navigation names are Daftar pelanggan and Pesanan diantar; the existing availability destination remains. Each active customer appears in exactly one group. A customer with any non-cancelled order created within the last five hours stays active, showing the total outstanding balance across all orders including older debt. Without a recent order, any unpaid order older than five hours puts the customer in Piutang lama regardless of kitchen/delivery state. Fully paid unfinished service remains active. The five-hour boundary is strict (more than five hours); cancelled orders do not promote customers. Active sorts by latest order; old debt sorts by oldest outstanding order.

Garson can select 2�50 active customer transactions across both visible groups, review the selections, choose a surviving name and confirm merge. Orders and payment records retain their IDs, amounts, timestamps and unit states; their transaction references move to the survivor. The surviving transaction opening time is the earliest merged opening time. Original transactions remain internal ownership redirects and are excluded from staff lists and reports. Every linked anonymous portal cookie follows redirects to the canonical customer, displays the combined balance, and sends future orders there; renaming follows the same identity. Portal synchronization uses existing refresh/polling (15 seconds while visible). Merge is staff-only and atomic through the existing store transaction. No split/unmerge flow is provided.

## Portal transaction sessions

A portal transaction session ends only when every non-cancelled portion is paid and delivered. Paying before delivery, or delivery before full payment, leaves the session active. Closure from any staff workflow closes every linked portal, including merged transaction owners, on its next state refresh. Closed portal state returns no customer name, orders or bill details; only a closed-session marker. Draft name, cart and request identity are reset on closure or a switch to a different transaction session. Draft persistence is scoped by an ownership key that survives merges; it cannot carry a prior transaction draft into a new session. Browser ownership cookies remain device credentials, separate from transaction session lifecycle and staff sessions.

Every anonymous submission includes sessionTabId (null for a new session). The server validates it inside the order transaction against current ownership, following authorized merge redirects. Stale or closed session submissions and replay of requests from completed sessions return 409; they cannot create a new transaction implicitly or attach to a newer one. A retry of the initial creation request remains idempotent while its transaction is active. A fresh explicit order requires a new name and request identity. Existing visible-tab polling is 15 seconds, with immediate refresh on visibility change or failed submission.
