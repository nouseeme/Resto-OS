# restoOS — UI/UX & Product Design

## Gambaran proyek

restoOS adalah aplikasi web untuk menghubungkan pemesanan pelanggan, pekerjaan dapur, layanan garson, dan pengelolaan restoran. Fokus perancangannya adalah membuat satu rangkaian layanan terasa konsisten, meskipun setiap pengguna memiliki kebutuhan dan cara kerja yang berbeda.

Pekerjaan desain mencakup penyusunan flow layanan, pembentukan tiga ruang kerja staf, desain portal pelanggan, sistem visual bersama, dan penyempurnaan interaksi. Pendekatannya menggabungkan karakter hospitality yang hangat dengan antarmuka operasional yang mudah dipindai.

## 1. Pendekatan desain: satu sistem, empat konteks

Keputusan mendasar proyek ini adalah memberi pelanggan, dapur, garson, dan manajemen pengalaman yang mengikuti pekerjaan masing-masing.

| Pengguna | Fokus utama | Pendekatan antarmuka |
|---|---|---|
| Pelanggan | Memilih makanan dan memesan | Menu fotografis, informasi ringkas, keranjang yang mudah diakses |
| Dapur | Mengetahui apa yang perlu dimasak | Antrean tiket, catatan per item, dan ringkasan kebutuhan masakan |
| Garson | Melayani pelanggan sampai selesai | Daftar pelanggan, detail tagihan, dan antrean pengantaran |
| Manajemen | Memahami bisnis dan mengelola data | Sidebar, ringkasan angka, tabel, filter, dan pengaturan |

Ketiga ruang staf dirancang sebagai workspace dengan komposisi dan navigasi sendiri. Staf memilih ruang ketika login dan dapat berpindah melalui kontrol di dekat logout. Pendekatan ini mendukung situasi ketika satu orang membantu beberapa pekerjaan tanpa membuat satu halaman menampung seluruh kompleksitas restoran.

## 2. Arah visual: The Ivory Menu Book

Identitas visual restoOS mengambil inspirasi dari buku menu restoran: permukaan ivory, tinta gelap, judul serif, garis hangat yang tipis, dan aksen merah bata. Karakter ini menjadi penghubung antara pengalaman pelanggan dan ruang operasional staf.

### Warna yang hangat dan terarah

Ivory (`#f5f1e7`) menjadi kanvas utama, dengan permukaan lebih terang (`#faf7f0`) untuk bidang input dan panel. Teks charcoal (`#2b2923`) menjaga informasi utama tetap kuat. Merah bata (`#a43c2d`) digunakan untuk tindakan utama dan seleksi, sementara hijau herbal (`#405644`) mendukung indikator positif.

Warna aksen dipakai secara hemat agar tombol dan status penting mudah ditemukan. Status juga memiliki label tertulis, sehingga arti informasi tetap jelas tanpa harus mengandalkan warna.

### Dua karakter tipografi

**Newsreader** memberi karakter editorial pada judul, nama hidangan, dan penekanan angka tertentu. **Manrope** digunakan pada kontrol, isi, metadata, dan judul produksi dapur.

Pasangan ini memberi ruang bagi dua kebutuhan: menu terasa seperti bagian dari pengalaman makan, sementara informasi kerja tetap langsung dan mudah dipindai. Angka yang sejajar membantu pembacaan harga, jumlah, dan sisa tagihan.

### Struktur yang tenang

Hierarki dibentuk melalui ukuran teks, jarak, garis pemisah, dan perbedaan tone permukaan. Sudut kontrol dibuat hampir persegi, dan bayangan dibatasi pada elemen yang memang mengambang.

Pendekatan ini menjaga daftar pelanggan, tiket dapur, dan laporan tetap padat tanpa membuat setiap informasi bersaing sebagai kartu yang menonjol. Foto makanan menjadi elemen visual utama pada portal; ruang staf memberi prioritas lebih besar pada informasi dan tindakan.

## 3. Flow umum: dari memilih menu sampai layanan selesai

```text
Pelanggan memilih menu / garson membantu membuat order
                         ↓
             Pesanan masuk ke transaksi
                         ↓
                Dapur menyiapkan porsi
                         ↓
              Porsi ditandai siap diantar
                         ↓
                Garson mengantar makanan
                         ↓
              Pembayaran dicatat oleh garson
                         ↓
     Transaksi ditutup saat layanan dan tagihan selesai
```

Pembayaran dapat terjadi sebelum atau sesudah pengantaran. Karena itu, status makanan dan pembayaran dipisahkan. Makanan yang sudah dibayar tetap muncul sebagai pekerjaan jika belum diantar; makanan yang sudah diantar tetap memiliki tagihan jika belum dibayar.

Model ini diterjemahkan menjadi tiga tingkat informasi: **transaksi** sebagai kumpulan layanan pelanggan, **pesanan** sebagai satu kiriman bertimestamp, dan **porsi** sebagai unit yang diproses. Pesanan tambahan tetap berada dalam transaksi yang sama, sementara setiap kiriman mempertahankan identitasnya.

## 4. Pengalaman pelanggan: eksplorasi dulu, identitas saat memesan

```text
Buka menu → pilih kategori/cari hidangan → lihat detail
→ tambah ke keranjang → atur jumlah dan catatan
→ isi nama → review total → kirim pesanan
```

Portal dapat digunakan tanpa akun. Pelanggan langsung melihat menu; nama baru dibutuhkan ketika hendak memesan. Ini menghindari langkah awal yang tidak membantu pelanggan memilih makanan.

Kartu hidangan menggabungkan foto, nama, deskripsi singkat, harga, dan tombol tambah. Posisi foto serta area harga/tombol diselaraskan agar menu mudah dibandingkan. Detail lengkap dibuka melalui dialog, sehingga pelanggan dapat membaca lebih jauh tanpa kehilangan konteks daftar.

Pada desktop, keranjang ditempatkan di samping menu dan tetap terlihat saat menggulir. Pada mobile, tombol tetap di bawah menampilkan jumlah porsi dan total, lalu membuka keranjang untuk review. Keduanya menjaga hubungan antara aktivitas memilih dan hasil pilihan.

Pesanan tambahan menggunakan flow yang sama dan mengikuti transaksi aktif. Label **Total pesanan baru** dibedakan dari **Sisa tagihan**, supaya pelanggan tidak mencampur item yang masih di keranjang dengan pesanan yang sudah tercatat.

Kondisi seperti menu habis, harga berubah, atau pemesanan dijeda diberikan penjelasan yang langsung berkaitan dengan tindakan pelanggan. Draft portal dipertahankan saat jeda, sementara sesi yang sudah selesai direset untuk memulai transaksi berikutnya dengan jelas.

## 5. Pengalaman staf: tampilan mengikuti objek pekerjaan

### Garson — pelanggan sebagai titik masuk

```text
Daftar pelanggan → buka transaksi → tambah order / lihat tagihan
→ antar porsi siap → catat pembayaran → kewajiban selesai
```

Daftar pelanggan menjadi pusat layanan karena garson perlu menjawab dua pertanyaan: siapa yang masih dilayani, dan apa yang masih perlu diselesaikan?

**Order aktif** dan **Piutang lama** ditampilkan sebagai kelompok vertikal dalam satu daftar. Keduanya dapat dipindai dan dicari bersama. Total sisa tagihan terlihat pada baris pelanggan; rincian tiap pesanan tersedia setelah transaksi dibuka.

Satu tombol **Buat order** membawa staf ke pencarian transaksi aktif atau pembuatan transaksi baru. Ini mengurangi percabangan awal dan membantu mencegah order tambahan masuk ke transaksi yang salah.

Pembayaran tersedia per porsi atau seluruh sisa satu pesanan. Untuk transaksi ganda, penggabungan menggunakan tahap review, pemilihan nama utama, dan konfirmasi konsekuensi. Tingkat kehati-hatian interaksi mengikuti besarnya dampak tindakan.

### Dapur — porsi sebagai unit pekerjaan

```text
Order masuk → terima → baca item dan catatan
→ siapkan porsi → tandai selesai → tunggu pengantaran
```

Dapur menggunakan kanvas lebar dengan tiket pesanan. Nama pelanggan, identitas order, waktu, item, dan catatan ditempatkan dekat dengan tindakan produksi.

Antrean dibagi menjadi **Dimasak** dan **Menunggu Diantar**. Pemisahan ini membedakan pekerjaan yang masih perlu diproduksi dari makanan yang sudah siap tetapi belum diambil garson.

Porsi dapat diselesaikan satu per satu agar minuman atau hidangan yang lebih cepat siap tidak harus menunggu seluruh order. Ringkasan kebutuhan per menu memberi pandangan agregat lintas tiket, sementara tindakan tetap berada pada tiket agar konteks pelanggan dan catatan tidak hilang.

### Manajemen — ringkasan menuju detail

```text
Ringkasan bisnis → pilih periode → baca kondisi restoran
→ telusuri transaksi / keuangan → kelola katalog dan pengaturan
```

Sidebar menjaga lokasi modul tetap konsisten saat pengguna berpindah antara laporan, arsip, keuangan, katalog, dan pengaturan. Ringkasan dimulai dari angka utama, lalu menyediakan detail untuk menjelaskan angka tersebut.

Nilai pesanan, pembayaran diterima, dan sisa piutang dipisahkan karena masing-masing menjawab pertanyaan berbeda. Arsip bersifat baca-saja untuk menjaga kegiatan penelusuran terpisah dari tindakan layanan.

Katalog menggunakan tabel editable karena pekerjaan utamanya adalah membandingkan dan mengubah banyak data. Impor Excel dilengkapi preview perubahan serta masalah per baris, sehingga perubahan massal dapat dipahami sebelum disimpan.

## 6. Interaksi: ekspresif untuk pelanggan, ringkas untuk staf

Motion portal disempurnakan melalui beberapa iterasi. Arah akhirnya menekankan easing yang lebih halus, gerak kecil, dan feedback yang terasa elegan. Hover foto dibuat lembut, pergantian kategori diberi transisi, dan penambahan item menghubungkan tindakan dengan keranjang.

Nilai keranjang diperbarui segera; gerak berfungsi sebagai pengakuan visual. Feedback **Ditambah**, perubahan jumlah, dan total membantu pelanggan memahami hasil kliknya.

Ruang staf menggunakan gerak yang lebih minimal karena tindakan dilakukan berulang. Kejelasan status dan kesiapan tindakan lebih diutamakan daripada ekspresi visual. Penyesuaian reduced motion tersedia untuk mengurangi gerakan sesuai preferensi perangkat.

## 7. Adaptasi layar dan konsistensi pengalaman

Responsive design mempertahankan prioritas tugas sambil mengubah komposisinya:

- **Portal:** keranjang samping menjadi akses tetap di bawah pada mobile.
- **Dapur:** ringkasan samping menjadi bagian yang dapat dibuka di atas antrean.
- **Manajemen:** sidebar menjadi drawer, sementara tabel lebar memiliki area gulir sendiri.
- **Detail transaksi:** informasi nominal dan rincian disusun ulang agar tetap terbaca pada layar kecil.

Pola bersama—tombol, input, dialog, fokus keyboard, label status, dan feedback—menjaga rasa satu produk meskipun ruang kerjanya berbeda. Target aksi utama dibuat cukup besar untuk interaksi sentuh, sementara teks dan ikon saling melengkapi dalam menjelaskan tindakan.

## 8. Modul dan fitur yang dirancang

Daftar ini memetakan bagian produk yang bisa diangkat menjadi materi portofolio. Beberapa fitur merupakan bagian dari halaman atau dialog yang sama, sehingga tidak semuanya perlu dijadikan screenshot terpisah.

| Area | Modul | Fitur utama |
|---|---|---|
| Pelanggan | Menu publik | Foto hidangan, kategori, pencarian, harga, ketersediaan, dan pilihan bahasa deskripsi |
| Pelanggan | Detail hidangan | Foto dan deskripsi lengkap dalam dialog, harga, serta tambah ke pesanan |
| Pelanggan | Keranjang | Jumlah porsi, catatan untuk dapur, nama pelanggan, review total, dan pengiriman pesanan |
| Pelanggan | Tagihan dan sesi | Sisa tagihan, pesanan tambahan pada transaksi aktif, serta penutupan sesi setelah layanan selesai |
| Staf | Login dan pemilih workspace | Masuk akun, memilih Dapur/Garson/Manajemen, berpindah ruang kerja, dan logout |
| Garson | Daftar pelanggan | Pencarian, kelompok Order aktif dan Piutang lama, total tagihan, seleksi, dan penggabungan pelanggan |
| Garson | Buat order | Cari transaksi aktif atau buat transaksi baru, pilih menu, atur porsi dan catatan, kirim ke dapur |
| Garson | Detail transaksi | Rincian tiap pesanan dan porsi, status layanan, sisa tagihan, edit nama, dan tambah pesanan |
| Garson | Pembayaran dan pembatalan | Catat pembayaran per porsi atau sisa pesanan, pilih metode, serta batalkan porsi yang memenuhi aturan |
| Garson | Pesanan diantar | Daftar porsi siap, identitas pelanggan, waktu siap, dan konfirmasi sudah diantar |
| Dapur | Antrean dapur | Tiket pesanan, penerimaan order, catatan masakan, penyelesaian per porsi, dan tab Menunggu Diantar |
| Dapur | Ringkasan masakan | Kebutuhan per menu dengan pemisahan Belum mulai dan Dimasak |
| Dapur | Kontrol penerimaan | Pemberitahuan suara dan jeda/buka pemesanan baru |
| Dapur & Garson | Ketersediaan | Pencarian menu dan perubahan Tersedia/Habis untuk pemesanan berikutnya |
| Manajemen | Ringkasan bisnis | Filter periode, nilai pesanan, pembayaran, piutang, transaksi belum selesai, menu populer, dan rincian keuangan |
| Manajemen | Arsip transaksi | Pencarian, filter status transaksi, serta detail pesanan dan pembayaran dalam tampilan baca-saja |
| Manajemen | Keuangan | Ledger penerimaan/pengeluaran, pencatatan pengeluaran, filter, dan ringkasan arus kas |
| Manajemen | Katalog menu | Edit langsung dalam tabel, tambah/hapus menu, foto, harga, kategori, deskripsi, dan bahasa tambahan |
| Manajemen | Impor dan ekspor Excel | Template dan preview impor katalog, validasi per baris, serta ekspor laporan terintegrasi |
| Manajemen | Pengaturan | Identitas restoran, logo dan warna, mata uang, akun staf, kategori pengeluaran, metode pembayaran, dan jejak aktivitas |

## 9. Materi yang bisa diangkat dalam portofolio

Kekuatan proyek ini bisa ditunjukkan melalui beberapa jenis artefak, sehingga presentasi tidak hanya berisi kumpulan layar.

| Materi | Yang diambil dari proyek | Cerita desain yang ditunjukkan |
|---|---|---|
| Peta produk | Portal dan tiga workspace staf | Cara menyusun produk untuk pengguna dengan pekerjaan berbeda |
| User flow utama | Pesan → masak → antar → bayar → selesai | Kesinambungan layanan dan handoff antarpengguna |
| Perbandingan workspace | Dapur, Garson, dan Manajemen | Konsistensi identitas dengan layout yang mengikuti tugas |
| Visual system | Palet, pasangan font, tombol, field, status, dan tiket | Cara identitas hospitality diterjemahkan menjadi UI operasional |
| Responsive pair | Portal desktop/mobile atau dapur desktop/mobile | Cara prioritas informasi dipertahankan ketika komposisi berubah |
| Interaction sequence | Tambah menu, review keranjang, dan feedback terkirim | Hubungan antara aksi pengguna dan respons sistem |
| Complex flow | Pembayaran bertahap atau penggabungan pelanggan | Cara menyederhanakan tindakan yang memiliki konsekuensi besar |
| Data-heavy interface | Katalog editable dan preview impor | Perancangan untuk pekerjaan administratif berulang |

Motion lebih tepat ditunjukkan lewat rekaman pendek daripada screenshot: pilih satu rangkaian tambah menu ke keranjang dan satu pergantian kategori. Screenshot tetap digunakan untuk menjelaskan hierarki dan layout.

## 10. Rekomendasi screenshot showcase

### Screenshot utama

Delapan pilihan berikut cukup untuk membangun cerita dari identitas visual sampai kompleksitas produk. Satu pilihan dapat berupa pasangan layar atau potongan flow.

| Prioritas | Layar yang diambil | Kondisi saat diambil | Fokus anotasi / cerita |
|---|---|---|---|
| 1 | Portal pelanggan — desktop | Menu berisi foto yang konsisten; keranjang berisi beberapa item | Karakter ivory dan tipografi editorial; hubungan eksplorasi menu dengan review pesanan |
| 2 | Portal pelanggan — mobile | Pasangkan daftar menu dengan dialog keranjang yang sudah terisi | Adaptasi keranjang samping menjadi tombol tetap dan review dalam dialog |
| 3 | Pemilih workspace | Tiga pilihan Dapur, Garson, dan Manajemen terlihat bersama | Titik masuk berdasarkan pekerjaan; pintu menuju tiga komposisi antarmuka |
| 4 | Daftar pelanggan | Ada Order aktif dan Piutang lama, dengan nominal serta penanda layanan | Pengelompokan dalam satu daftar dan hierarki pelanggan–tagihan |
| 5 | Detail transaksi + dialog pembayaran | Satu transaksi memiliki dua pesanan; sebagian porsi sudah dibayar | Pemisahan transaksi, pesanan, porsi, dan pembayaran; review nominal sebelum konfirmasi |
| 6 | Antrean dapur | Beberapa tiket, catatan makanan, porsi berbeda, dan ringkasan masakan | Pemindaian operasional; detail per pelanggan berdampingan dengan kebutuhan agregat |
| 7 | Pesanan diantar | Beberapa porsi siap dari pesanan yang berbeda | Handoff dapur–garson dan tindakan pengantaran per porsi |
| 8 | Ringkasan bisnis | Metrik serta daftar/rincian memiliki data yang saling sesuai | Hierarki dari gambaran bisnis menuju detail; perbedaan pesanan, penerimaan, dan piutang |

### Screenshot pendukung

Pilih sesuai bagian cerita yang ingin diperdalam. Layar ini dapat ditampilkan sebagai crop detail agar panjang studi kasus tetap terkendali.

| Layar | Bagian yang ditonjolkan | Kegunaan dalam cerita |
|---|---|---|
| Detail hidangan | Foto, deskripsi lengkap, harga, dan CTA | Progressive disclosure: informasi ringkas di daftar, lengkap ketika dibutuhkan |
| Buat order oleh garson | Pemilih pelanggan dan identitas transaksi tujuan | Satu titik masuk untuk pelanggan baru maupun pesanan tambahan |
| Review penggabungan | Pelanggan terpilih, nama utama, dan penjelasan konsekuensi | Review sebelum tindakan yang memengaruhi identitas dan tagihan |
| Katalog menu | Beberapa baris dan field yang sedang diedit | Efisiensi pengeditan langsung serta perbandingan data |
| Preview impor Excel | Jumlah tambah/perbarui dan contoh masalah baris | Pencegahan kesalahan sebelum perubahan massal |
| Keuangan | Filter, ledger, dan ringkasan kas | Penyusunan informasi finansial yang padat |
| Pengaturan identitas | Logo, warna, dan identitas restoran | Fleksibilitas branding dalam sistem visual bersama |
| Empty/error state | Satu contoh, misalnya pencarian kosong atau harga berubah | Arahan tindakan berikutnya ketika alur ideal terhenti |

### Cara menyusun showcase

Mulai dari **portal pelanggan** sebagai pembuka visual, lalu tampilkan **flow layanan** sebelum masuk ke tiga workspace. Gunakan **detail transaksi dan pembayaran** untuk menjelaskan kompleksitas UX. Akhiri dengan **visual system dan pasangan responsive** untuk menunjukkan konsistensi hasil desain.

Setiap screenshot cukup ditemani satu kalimat keputusan dan dua atau tiga anotasi yang menunjuk langsung ke bagian UI. Contohnya:

> Keranjang tetap terlihat saat pelanggan menjelajahi menu, sehingga pilihan dan total dapat ditinjau tanpa meninggalkan konteks pemesanan.

Untuk menampilkan flow, gunakan nama pelanggan dan pesanan contoh yang sama dari portal, dapur, pengantaran, sampai pembayaran. Gunakan data demo dengan nominal dan status yang konsisten. Screenshot belum disertakan dalam dokumen ini; daftar di atas menjadi panduan pengambilan dan penyusunannya.

## Hasil perancangan

restoOS menghasilkan pengalaman restoran yang terhubung melalui satu model layanan, dengan antarmuka yang disesuaikan untuk pelanggan, dapur, garson, dan manajemen.

Kontribusi desain utamanya terletak pada hubungan antara **karakter visual yang hangat**, **workspace berbasis tugas**, dan **flow yang mempertahankan konteks dari order sampai penyelesaian**. Detail seperti pesanan tambahan, kesiapan per porsi, pembayaran bertahap, dan pemisahan tagihan dari keranjang membuat desain mengikuti kondisi layanan yang tidak selalu berjalan dalam satu urutan lurus.

Dokumentasi ini merangkum hasil perancangan dan implementasi bersama; dampak terhadap efisiensi atau kepuasan pengguna belum dinyatakan sebagai hasil terukur.
