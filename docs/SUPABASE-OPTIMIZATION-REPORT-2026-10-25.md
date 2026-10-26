# RestoOS — laporan optimisasi Supabase
Tanggal: 25 Oktober 2026 · Zona waktu: Europe/Istanbul (UTC+3)

## TL;DR

- **Sumber pemborosan utama sudah ditangani:** pengecekan auto-accept tiap detik, pengambilan seluruh data restoran berulang, dan tiga pengambilan data untuk satu refresh manajemen.
- **Pesanan valid langsung masuk antrean dapur.** Pembayaran, pengantaran, penggabungan pelanggan, dan pencatatan manajemen tetap mengikuti aturan bisnisnya.
- **Portal hanya untuk memesan.** Riwayat order dan sisa tagihan tidak dikirim ke pelanggan. Dapur dan garson mengambil data sesuai pekerjaannya.
- **Ukuran respons sekali ambil turun sekitar 91–98% untuk portal, dapur, garson, dan ringkasan hari ini.** Pembaruan utama memakai pemberitahuan perubahan; pemeriksaan cadangan cukup membandingkan versi.
- **Cron auto-accept dahulu menghasilkan sekitar 94,5 MB log mentah yang direkonstruksi per 24 jam.** Menghapus komponen itu saja secara aritmetika menurunkan baseline log dari sekitar 130,1 menjadi 35,7 MB/hari, sebelum memperhitungkan perubahan trafik dan log Realtime.
- **Simulasi pemutaran ulang jumlah request lama menghasilkan sekitar 155–365 MB data mentah/hari, dibanding model lama 2.564 MB/hari.** Ini ilustrasi dengan asumsi tertulis, bukan egress tertagih dan bukan hasil pengukuran sehari setelah optimisasi.
- **32 pengujian lulus pada verifikasi implementasi.** Data bisnis lama dibandingkan sebelum–sesudah dan identik. Nilai laporan manajemen serta riwayat pembayaran arsip diverifikasi.
- **Belum ada data 24 jam penuh setelah optimisasi.** Efek terhadap kuota/billing bulanan belum dapat dinyatakan sebagai hasil aktual.

## 1. Dasar perbandingan

Ada tiga jenis angka dalam dokumen ini:

| Jenis | Arti |
| --- | --- |
| Terukur | Hasil audit log, ukuran respons, pemeriksaan data, atau pengujian nyata. |
| Model/simulasi | Perhitungan memakai data audit dan asumsi yang disebutkan. |
| Belum tersedia | Pengukuran yang belum bisa diperoleh secara sebanding. |

**Baseline sebelum optimisasi:** 24 Oktober pukul 13.10 sampai 25 Oktober pukul 13.10 waktu Istanbul, yaitu tepat 24 jam.

**Sampel setelah optimisasi:** 25 Oktober pukul 14.15–14.45 waktu Istanbul, yaitu 30 menit. Ukuran respons dan status live dicek kembali sekitar pukul 14.50.

Sampel 30 menit tersebut berguna untuk melihat apakah cron lama berhenti. Sampel itu tidak setara dengan satu hari operasional restoran dan tidak dipakai untuk mengklaim penurunan biaya harian.

Angka dashboard awal — sekitar **0,535 GB egress dan 0,136 GB log ingestion** — merupakan akumulasi satu siklus billing **organisasi**, bukan bukti meter harian RestoOS saja. Organisasi juga memiliki finance tracker. Angka itu tidak dibagi langsung dengan jumlah order atau dianggap seluruhnya berasal dari RestoOS.

## 2. Apa yang ditemukan dalam 24 jam baseline

| Temuan | Hasil audit RestoOS |
| --- | ---: |
| Panggilan pengambilan snapshot penuh | 8.517 |
| Panggilan penyimpanan perubahan | 553 |
| Pengecekan akun staf melalui Auth Admin | 5.977 |
| Log API gateway | 15.394 |
| Log Postgres | 171.103 |
| Log mulai/selesai cron auto-accept | 170.107 |
| Ukuran satu snapshot penuh pada saat audit | 301.051 byte, sekitar 301 KB |
| Pengambilan snapshot per refresh manajemen saat antrean cleanup kosong | 3 kali |

Satu snapshot penuh memuat sekitar 112,3 KB audit dan 59,8 KB logo yang ditanam sebagai teks gambar. Keduanya mencapai sekitar 57% isi snapshot, walaupun layar hanya ingin memeriksa perubahan pesanan.

Cron berjalan saat tidak ada aktivitas aplikasi. Sebagai contoh, pada 25 Oktober pukul 03.00–04.00 waktu Istanbul, tidak tercatat panggilan API gateway, tetapi ada sekitar 7.130 log Postgres.

Untuk konteks perbandingan, finance tracker menghasilkan sekitar **3,24 MB** pesan dan metadata log yang direkonstruksi dalam jendela audit yang sama, dibanding **130,14 MB** pada RestoOS. Ini perbandingan aktivitas saat itu; bukan pengujian kedua aplikasi dengan beban pengguna yang identik.

## 3. Perubahan yang sudah diterapkan

| Area | Sebelumnya | Sesudah optimisasi |
| --- | --- | --- |
| Penerimaan pesanan | Menunggu maksimal 15 detik; dicek setiap detik | Pesanan valid diterima dalam proses penyimpanan yang sama |
| Pembaruan layar | Staf mengambil data sekitar tiap 5 detik; portal tiap 15 detik | Pemberitahuan perubahan, pemulihan saat tersambung kembali, dan pengecekan versi ringan |
| Dapur | Backend mengambil seluruh snapshot termasuk pembayaran dan audit | Antrean yang masih perlu dilayani, menu dan pengaturan yang relevan; tanpa nilai pembayaran item |
| Garson | Seluruh snapshot restoran | Transaksi aktif, order, pengantaran dan pembayaran yang diperlukan, termasuk piutang lama |
| Portal pelanggan | Menu, order pelanggan, dan sisa tagihan | Menu, pengiriman order, konfirmasi, dan identitas kunjungan minimum |
| Manajemen | Snapshot penuh berulang; cleanup gambar ikut setiap refresh | Data sesuai halaman; cleanup gambar terlepas dari refresh rutin |
| Ringkasan manajemen | Perhitungan bergantung pada seluruh snapshot | Data periode yang dipilih ditambah seluruh transaksi aktif yang dibutuhkan untuk piutang |
| Logo | Isi gambar ikut di dalam data pengaturan | URL file pada Storage yang bisa digunakan ulang |
| Audit | Seluruh riwayat diambil sebelum ditampilkan sebagian | Maksimal 200 kejadian pada pembacaan halaman pengaturan |
| Arsip pembayaran | Memerlukan daftar pembayaran untuk menjelaskan rincian transaksi | Riwayat pembayaran tetap disertakan pada halaman arsip agar informasi tidak salah |

**Pengecekan cadangan tetap ada.** Saat koneksi Realtime sehat, layar yang terlihat membandingkan versi sekitar setiap 60 detik. Saat Realtime tidak tersedia, intervalnya sekitar 15 detik. Respons “belum berubah” tidak mengambil seluruh isi data lagi. Layar tersembunyi atau offline tidak melakukan pengambilan berkala.

Sesi staf yang dibuat sebelum peluncuran tetap valid dengan pengecekan cadangan. Keluar lalu masuk sekali mengaktifkan kredensial pembaruan langsung untuk sesi tersebut.

## 4. Penghematan per pengambilan: angka terukur

Berikut ukuran JSON dari Supabase sebelum kompresi, bukan jumlah byte yang pasti ditagihkan. Perbandingan menggunakan snapshot penuh lama sebesar 301.051 byte. Ini tepat menggambarkan pengambilan backend lama, walaupun browser dahulu menerima hasil yang sudah disaring.

| Data yang dibutuhkan layar | Lama | Baru, terukur | Pengurangan ukuran |
| --- | ---: | ---: | ---: |
| Portal pelanggan | 301.051 byte | 6.765 byte | 97,8% |
| Dapur | 301.051 byte | 6.702 byte | 97,8% |
| Garson | 301.051 byte | 28.101 byte | 90,7% |
| Ringkasan manajemen hari ini | 301.051 byte | 27.195 byte | 91,0% |
| Keuangan | 301.051 byte | 56.896 byte | 81,1% |
| Arsip, termasuk seluruh pembayaran yang ada | 301.051 byte | 113.994 byte | 62,1% |
| Pengaturan | 301.051 byte | 47.464 byte | 84,2% |

Respons database ketika versi tidak berubah adalah sekitar **54 byte**, ditambah identitas/waktu pada respons HTTP serta overhead jaringan. Validasi sesi dan koneksi Realtime juga tetap memiliki biaya jaringan.

Ukuran respons akan berubah seiring data restoran. Snapshot penuh untuk proses tulis masih sekitar **242.505 byte** pada pemeriksaan terakhir; 301.051 byte adalah baseline sebelum logo dipindahkan dan sebelum perubahan data audit berikutnya.

## 5. Perkiraan data harian dengan jumlah request baseline

### Mengapa perlu simulasi

Log API tidak menyediakan rincian yang cukup untuk merekonstruksi setiap layar dan setiap byte egress tertagih. Kita mengetahui ada 8.517 panggilan snapshot, tetapi tidak mengetahui berapa tepatnya berasal dari portal, tiap ruang kerja, cleanup, validasi tulis, dan percobaan ulang.

Karena itu, angka berikut menjawab: **“Jika jumlah request baseline diputar ulang dengan respons baru, berapa kira-kira volume JSON-nya?”**

### Asumsi model

1. Ukuran snapshot lama dianggap tetap 301.051 byte sepanjang hari. Kenyataannya ukuran data berkembang; hasil lama di bawah adalah model, bukan total transfer historis terukur.
2. Di antara pengambilan untuk layar, campuran ilustratifnya 50% portal, 20% dapur, 20% garson, dan 10% ringkasan manajemen hari ini. Campuran ini belum terukur.
3. Dari 553 commit, dicadangkan satu atau dua snapshot penuh baru per commit. Rentang ini adalah asumsi skenario, bukan batas terburuk; konflik, validasi gagal, dan login dapat menambah pembacaan.
4. Pengambilan isi layar diasumsikan berkurang 0%, 50%, atau 80% setelah pemberitahuan perubahan. Angka pengurangan tersebut belum diukur selama satu hari.
5. Model tidak memasukkan seluruh header, trafik Auth, file/gambar, heartbeat koneksi, pemberitahuan Realtime, ekspor, dan backup. Pengecekan versi kecil juga bukan nol biaya.
6. Kunjungan yang banyak membuka Keuangan atau Arsip dapat menghasilkan respons lebih besar daripada campuran contoh.

### Hasil simulasi

Model lama:

`8.517 × 301.051 byte = 2.564.051.367 byte ≈ 2.564 MB JSON mentah/hari.`

Rata-rata respons layar pada campuran contoh adalah 13.062,6 byte. Model baru:

`snapshot tulis × 242.505 + pengambilan isi layar yang tersisa × 13.062,6.`

| Asumsi snapshot penuh per commit | Pengurangan pengambilan isi layar | Model baru per hari | Penurunan terhadap model lama |
| --- | ---: | ---: | ---: |
| 1 | 0% | 238.1 MB | 90.7% |
| 1 | 50% | 186.1 MB | 92.7% |
| 1 | 80% | 154.9 MB | 94.0% |
| 2 | 0% | 365.0 MB | 85.8% |
| 2 | 50% | 316.6 MB | 87.7% |
| 2 | 80% | 287.6 MB | 88.8% |

**Rentang ilustratifnya sekitar 155–365 MB/hari, dibanding 2.564 MB/hari pada model lama.** Peningkatan ukuran respons memberi manfaat bahkan pada skenario yang belum mengurangi jumlah pengambilan layar. Jumlah sebenarnya tetap bergantung pada aktivitas dan jumlah layar yang sedang terbuka.

**Jangan membaca 155–365 MB sebagai perkiraan egress tertagih.** Kita tidak mengalikan angka dashboard 0,535 GB dengan persentase tabel ini: cakupan organisasi berbeda, ukuran snapshot lama tidak konstan, dan tingkat kompresi berubah ketika logo/audit dikeluarkan.

## 6. Perkiraan efek pada log ingestion

Volume berikut direkonstruksi dengan menjumlahkan panjang pesan dan metadata log yang diubah menjadi JSON. Cara ini berguna untuk membandingkan sumber pemborosan, tetapi tidak persis sama dengan meter ingestion Supabase.

| Sumber pada 24 jam baseline | Volume direkonstruksi |
| --- | ---: |
| Cron auto-accept | 94,484 MB |
| API gateway | 25,860 MB |
| Auth | 5,423 MB |
| Connection pooler | 3,324 MB |
| Postgres lainnya | 0,802 MB |
| Storage, audit Auth, Realtime dan PostgREST lainnya | 0,251 MB |
| **Total hasil penjumlahan ulang** | **130,144 MB** |

Catatan koreksi: ringkasan chat sebelumnya menyebut sekitar 132,1 MB. Penjumlahan ulang angka sumber menghasilkan **130,144 MB**; angka yang dikoreksi dipakai dalam dokumen ini.

Jika seluruh komponen lain dianggap tetap:

`130,144 − 94,484 = 35,660 MB/hari.`

Artinya penghapusan cron saja menghilangkan sekitar **72,6% baseline volume log yang direkonstruksi**. Pengurangan request Auth dan pembacaan berulang dapat menurunkannya lebih lanjut. Log baru dari Realtime dan aktivitas pengguna dapat menambahnya.

| Skenario log | Harian | Ekstrapolasi 30 hari |
| --- | ---: | ---: |
| Baseline lama, direkonstruksi | 130,14 MB | 3,90 GB |
| Hanya menghapus komponen cron; lainnya dianggap tetap | 35,66 MB | 1,07 GB |

Jadi, penghapusan cron saja **belum membuktikan** penggunaan log akan berada di bawah kuota 1 GB/bulan. Kuota berlaku sesuai cakupan organisasi, sementara tabel ini hanya memodelkan RestoOS. Volume sesudah satu hari penuh tetap perlu dicatat.

### Bukti awal setelah optimisasi

Pada 25 Oktober pukul 14.15–14.45 waktu Istanbul:

- Log cron auto-accept lama: **0 kejadian**.
- Total pesan dan metadata log yang direkonstruksi: sekitar **0,250 MB**.
- API gateway: 90 kejadian; Postgres: 17; Realtime: 18; pooler: 243; PostgREST: 17.

Ini mendukung bahwa sumber log setiap detik telah berhenti. **Sampel 30 menit ini tidak dikalikan menjadi janji pemakaian sehari**, karena beban operasionalnya belum sebanding.

## 7. Keakuratan data dan perilaku aplikasi

Optimisasi mengubah pembacaan dan pemberitahuan, dengan perlindungan berikut:

- Pesanan, item, pelanggan, pembayaran dan pengeluaran lama dibandingkan sebelum–sesudah; hasil pemeriksaan identik.
- Pesanan baru tetap divalidasi terhadap ketersediaan, harga, pembatasan pengiriman, identitas kunjungan dan kiriman ulang.
- **Lunas menyelesaikan tagihan. Penutupan transaksi tetap membutuhkan lunas sekaligus selesai diantar.**
- Piutang lama dan transaksi yang sudah dibayar tetapi belum diantar tetap tersedia bagi garson.
- Penjualan mengikuti tanggal order; penerimaan uang mengikuti tanggal pembayaran. Piutang aktif dan transaksi belum selesai tetap mencakup seluruh waktu.
- Data laporan pada Supabase dibandingkan dengan model yang diuji; hasilnya cocok.
- Riwayat pembayaran tetap dibawa pada halaman arsip. Pembacaan awal yang tidak menyertakannya diperbaiki dan mendapat pengujian tambahan.
- Pemberitahuan hanya membawa nomor versi, bukan rincian pesanan atau keuangan. Pengunjung publik ditolak dari kanal staf dan fungsi database khusus server.
- Pemberitahuan yang gagal tidak membatalkan penyimpanan pembayaran/order yang valid. Saat koneksi kembali, aplikasi mencocokkan kondisi terbaru.
- Pada verifikasi peluncuran: 32 pengujian otomatis lulus, build berhasil, pemeriksaan API produksi berhasil, dan pengiriman pemberitahuan nyata diuji.

Pemeriksaan tersebut mendukung keakuratan alur yang diuji; bukan jaminan bahwa seluruh kemungkinan gangguan operasional telah diuji.

## 8. Optimisasi yang sengaja ditunda

Dua ide berikut dibahas tetapi **belum diterapkan**:

1. Mengambil rincian pembayaran satu transaksi hanya ketika rincian itu dibuka. Saat ini halaman arsip masih membawa daftar pembayaran yang dibutuhkannya.
2. Menambah salinan angka total dibayar/sisa tagihan langsung pada transaksi. Status bayar per item sudah tersimpan; menambah ringkasan tersimpan membutuhkan penjagaan konsistensi tambahan.

Keputusannya adalah mengamati hasil optimisasi terbesar terlebih dahulu. Snapshot penuh tetap digunakan untuk proses tulis, ekspor eksplisit dan backup agar perilaku transaksi serta penanganan perubahan bersamaan yang sudah ada tetap terjaga.

Tidak dilakukan penghapusan riwayat finansial, perubahan tanggal transaksi lama, atau penutupan transaksi hanya karena sudah dibayar.

## 9. Cara mengevaluasi hasil berikutnya

Gunakan satu hari penuh yang representatif, misalnya **25 Oktober pukul 14.15 sampai 26 Oktober pukul 14.15 waktu Istanbul**:

1. Catat selisih meter Egress dan Log Ingestion untuk RestoOS pada awal–akhir jendela, dengan memperhitungkan keterlambatan pembaruan dashboard.
2. Gunakan filter project RestoOS, bukan total organisasi.
3. Catat jumlah order, perubahan pembayaran, staf aktif, lama layar terbuka, dan aktivitas pengujian/development. Hari development dan hari restoran beroperasi tidak otomatis sebanding.
4. Bandingkan ukuran data, frekuensi request dan sumber log. Jangan hanya membandingkan jumlah pengguna unik.
5. Nilai kebutuhan optimisasi lanjutan dari pengukuran tersebut. Dokumen ini tidak membuat pemantauan otomatis.

## 10. Jejak implementasi dan sumber

- Implementasi tersimpan pada branch `codex/optimize-supabase-usage`, commit yang diperiksa: `c49477e`.
- Saat dokumen dibuat, checkout lokal berada pada `main`; dokumentasi ditambahkan tanpa mengganti branch. Perbedaan source antarcabang tidak berarti perubahan Supabase yang sudah diterapkan dibatalkan.
- Fungsi pembacaan baru, penghapusan cron auto-accept dan respons API live diverifikasi kembali saat dokumentasi dibuat.
- Catatan pengujian awal berada pada branch implementasi: `docs/OPTIMIZATION-VERIFICATION.md`.
- Backup sebelum perubahan: `data/backups/2026-10-25T10-32-01-644Z`; berisi data privat dan tidak untuk dipublikasikan.
- Bukti audit: hasil log teragregasi 24 jam, ukuran JSON respons, pemeriksaan integritas data, dan hasil pengujian dalam pekerjaan ini.
- Rujukan definisi: [Egress Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Log ingestion](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest), [Log query](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query).

Satuan perhitungan: 1 MB = 1.000.000 byte; 1 GB = 1.000.000.000 byte. Angka dibulatkan untuk keterbacaan.

