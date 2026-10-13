'use client';

// Panduan in Indonesian: stock opname for the PIC / crew, Cost Control, super admin.

import { Calculator, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { Go, Menu, Note, Part, Steps, Table } from './ui';

export const PAGE = {
  title: 'Panduan',
  subtitle: 'Cara melakukan stock opname dan cost control di portal',
  toc: 'Daftar isi',
};

export const SO: Part = {
  key: 'so', label: 'Stock opname (PIC & kru)', icon: <ClipboardCheck size={16} />,
  intro: 'Untuk PIC dan kru outlet, HUB WH dan HUB CK yang menghitung stok. Cabang yang muncul adalah cabang yang ditugaskan di akun Anda.',
  sections: [
    {
      id: 'so-jadwal', title: 'Kapan stock opname dilakukan',
      body: (
        <>
          <p className="text-sm text-slate-700">Jadwal dibuat oleh tim Cost Control. Yang umum dipakai:</p>
          <Table head={['Jenis SO', 'Jadwal', 'Isi yang dihitung']} rows={[
            ['SO harian (packaging)', 'Setiap hari', 'Packaging & kitchen supplies: cup, lid, sedotan, kantong, dll.'],
            ['SO mingguan (bahan baku)', 'Setiap Senin', 'Bahan baku, beans, WIP/premix'],
            ['SO bulanan (bahan baku)', 'Hari terakhir bulan', 'Bahan baku lengkap, WIP/premix'],
            ['SO insidental', 'Saat diperlukan', 'Audit / serah terima, dibuat atas permintaan'],
          ]} />
          <p className="text-sm text-slate-700">Jam hitung standar <b>07:00–08:00 WIB</b> (sebelum outlet buka). <b>Semua jadwal SO memakai WIB</b> untuk semua outlet, HUB dan dapur, termasuk di Bali; jam di portal selalu ditampilkan dalam WIB walau jam HP berbeda. SO yang dikirim lewat jam itu tetap diterima tetapi ditandai <b>Terlambat</b>. Nama dan jadwal persisnya terlihat di halaman <Go href="/stock-opname">Stock Opname</Go>.</p>
        </>
      ),
    },
    {
      id: 'so-mulai', title: 'Memulai stock opname',
      body: (
        <Steps items={[
          <>Buka menu <Menu>Stock Opname</Menu>. Di bagian <b>Hari ini</b> tampil SO yang jatuh tempo untuk setiap cabang Anda, lengkap dengan jam hitung, jumlah item dan area.</>,
          <>Pastikan Anda berada di lokasi. Tekan <Menu>Mulai SO</Menu> dan izinkan akses lokasi (GPS) di browser. Lokasi dicatat sebagai bukti; di luar radius cabang SO tetap bisa jalan tetapi diberi tanda.</>,
          <>Form SO terbuka. Bila SO sudah dimulai dari HP lain, form yang sama dibuka lagi (tidak membuat SO ganda).</>,
        ]} />
      ),
    },
    {
      id: 'so-isi', title: 'Mengisi hitungan',
      body: (
        <>
          <Steps items={[
            <>Item dikelompokkan per <b>area</b> (Bar, Chiller, Kitchen, Packaging, dst.). Pilih area di atas atau cari nama item.</>,
            <>Untuk item yang punya kemasan, isi <b>jumlah kemasan</b> (mis. 3 pack) dan <b>sisa</b> dalam satuan dasar (mis. 120 gr). Sistem menjumlahkan sendiri (3 × 500 + 120 = 1.620 gr).</>,
            <>Item yang tidak ada di tempat <b>wajib diisi 0</b>. Baris kosong membuat SO belum bisa dikirim.</>,
            <>Setiap baris tersimpan otomatis saat Anda pindah ke isian berikutnya (tanda <b>Tersimpan</b> di kanan atas). Tombol <Menu>Tugas</Menu> menampilkan item yang belum diisi.</>,
          ]} />
          <Note>Hitung buta: angka stok sistem sengaja tidak ditampilkan. Isi sesuai yang benar-benar ada.</Note>
          <Note tone="warn">Bila angka lebih dari 3 kali atau kurang dari sepertiga hitungan sebelumnya, baris diberi tanda <b>Cek</b> dan wajib difoto. Periksa ulang sebelum mengirim.</Note>
        </>
      ),
    },
    {
      id: 'so-wip', title: 'WIP / premix (SO mingguan & bulanan)',
      body: (
        <>
          <Steps items={[
            <>Buka bagian <Menu>WIP / premix</Menu> di atas daftar item.</>,
            <><b>Timbang</b> setiap premix, cream atau saus yang ada lalu isi beratnya dalam <b>gram</b> (bukan pail/teko). Contoh: Premix Premium 2.350 g.</>,
            <>Bagian <b>Bahan dari WIP</b> langsung menunjukkan gram setiap bahan (fresh milk, espresso, creamer, …) sesuai resep yang berlaku.</>,
            <>Tekan <Menu>Simpan WIP</Menu>. Gram bahan ditambahkan ke baris bahan yang sama (tertulis “+ … dari WIP”). Bahan yang tidak ada di daftar muncul di area <b>WIP</b>.</>,
          ]} />
          <Note>Jangan menghitung bahan yang sudah tercampur di premix pada baris bahannya; cukup isi gram premix di bagian WIP. Hasil SO berisi bahan baku dalam satuannya (mis. GR) seperti Stock Opname Report. Resep diatur tim Cost Control.</Note>
        </>
      ),
    },
    {
      id: 'so-foto', title: 'Foto bukti',
      body: (
        <>
          <Table head={['Foto', 'Kapan wajib']} rows={[
            ['Foto area', '1 foto untuk setiap area (tombol kamera di judul area)'],
            ['Foto item', 'Item bertanda wajib foto, item bertanda Cek (lonjakan), dan 3 item sampel acak (tanda Sampel)'],
          ]} />
          <Note tone="warn">Foto <b>wajib langsung dari kamera</b> (HP maupun laptop); foto dari galeri atau file tidak bisa dipakai. Izinkan akses kamera saat diminta browser. Setiap foto otomatis diberi cap <b>nama cabang, nomor SO, area/item, tanggal & jam (WIB) dan lokasi</b>.</Note>
        </>
      ),
    },
    {
      id: 'so-kirim', title: 'Mengirim, hitung ulang & selesai',
      body: (
        <>
          <Steps items={[
            <>Bila semua baris terisi, foto lengkap dan WIP tersimpan, tekan <Menu>Kirim</Menu> lalu konfirmasi. Lokasi dicatat lagi.</>,
            <>Setelah dikirim, SO <b>terkunci</b> dan masuk ke review tim Cost Control.</>,
            <>Bila reviewer meminta <b>hitung ulang</b>, SO terbuka lagi dengan pesan dari reviewer. Hanya baris bertanda <b>Hitung ulang</b> yang bisa diubah; angka lama tetap tersimpan untuk audit. Kirim kembali setelah selesai.</>,
          ]} />
          <Table head={['Status', 'Arti']} rows={[
            ['Berjalan', 'Sedang diisi'], ['Terkirim', 'Menunggu review Cost Control'], ['Hitung ulang', 'Reviewer meminta cek ulang baris tertentu'],
            ['Disetujui', 'Sudah benar, siap diekspor ke ESB'], ['Diekspor', 'Sudah masuk file impor ESB'],
          ]} />
        </>
      ),
    },
    {
      id: 'so-masalah', title: 'Masalah yang sering terjadi',
      body: (
        <Table head={['Masalah', 'Solusi']} rows={[
          ['SO hari ini tidak muncul', 'Jadwal belum jatuh tempo atau cabang belum ditugaskan ke akun Anda: hubungi tim Cost Control / admin'],
          ['Tombol Kirim tidak aktif', 'Masih ada baris kosong (isi 0), foto yang kurang, atau WIP belum disimpan (lihat keterangan di bawah tombol)'],
          ['Lokasi tidak terbaca', 'Izinkan akses lokasi di browser; SO tetap bisa dikirim tetapi diberi tanda'],
          ['Kamera tidak terbuka', 'Izinkan kamera untuk situs ini di pengaturan browser (ikon gembok di alamat), lalu tekan Coba lagi. Gunakan Chrome/Safari'],
          ['Item tidak ada di daftar', 'Laporkan ke tim Cost Control agar ditambahkan ke daftar hitung atau grup item'],
        ]} />
      ),
    },
  ],
};

export const CC: Part = {
  key: 'cc', label: 'Cost Control', icon: <Calculator size={16} />,
  intro: 'Untuk tim Cost Control: menyiapkan pengaturan SO, memantau dan me-review hasil hitung, mengirim ke ESB, serta membaca rasio outlet. Semua halaman ada di sidebar → Kontrol Biaya.',
  sections: [
    {
      id: 'cc-alur', title: 'Alur kerja ringkas',
      body: (
        <Table head={['Kapan', 'Yang dilakukan', 'Halaman']} rows={[
          ['Sekali / saat ada perubahan', 'Atur jenis SO & jadwal, daftar hitung, grup item, resep WIP', 'Jenis SO, Daftar hitung, Grup item, Kalkulator Premix'],
          ['Setiap pagi (setelah 08:00)', 'Cek cabang yang belum/terlambat SO', 'Monitor'],
          ['Setelah SO dikirim', 'Setujui atau minta hitung ulang', 'Tinjau'],
          ['Bila perlu (opsional)', 'Isi atau impor SO untuk cabang (hasil masuk Tinjau)', 'Input / impor SO'],
          ['Setelah disetujui', 'Unduh laporan SO (xlsx) yang rapi', 'Laporan SO (xlsx)'],
          ['Setelah disetujui', 'Buat file impor SO ESB, unggah ke ESB', 'Ekspor ESB'],
          ['Setelah ESB memproses', 'Bandingkan hitungan dengan dokumen SO ESB', 'Pembanding ESB'],
          ['Mingguan / bulanan', 'Baca rasio COGS, BB, espresso & usage per outlet', 'Rasio Outlet, COGS & pemakaian'],
        ]} />
      ),
    },
    {
      id: 'cc-jenis', title: 'Jenis SO (nama, jadwal, kalender)',
      body: (
        <>
          <Steps items={[
            <>Buka <Go href="/cost-control/types">Jenis SO</Go>. Kalender bulanan menunjukkan setiap SO pada tanggal & jamnya, dihitung dengan aturan yang sama dengan jadwal sebenarnya.</>,
            <>Semua jam yang diatur adalah <b>WIB</b> dan berlaku sama untuk semua cabang. Klik kartu jenis SO untuk mengubah <b>nama</b> (nama ini yang dilihat kru), <b>jadwal</b> (Harian: pilih hari; Mingguan: pilih hari; Bulanan: tanggal 1–31 atau hari terakhir; <b>Tanggal tertentu</b>: ketuk tanggal-tanggal di kalender), <b>jam buka/tutup</b>, <b>masa berlaku</b>, <b>purpose ESB</b> dan saklar <b>Form WIP</b>.</>,
            <><b>Atur cepat</b>: satu ketukan untuk jadwal yang sering dipakai (Setiap hari, Senin–Sabtu, Setiap Senin, Hari terakhir bulan, Pilih tanggal) dan pilihan jendela jam (mis. 07:00–09:00, 21:00–23:00).</>,
            <>Pratinjau kalender di editor berubah sebelum disimpan. Tekan Simpan.</>,
            <>Jenis SO baru: tombol <Menu>Jenis SO baru</Menu> (kode dibuat dari nama). Jenis SO baru perlu daftar hitung agar muncul di cabang.</>,
          ]} />
          <Note>Purpose ESB harus sama persis dengan purpose di ESB (mis. STOCK OPNAME MINGGUAN (OUTLET)) karena dipakai di file impor.</Note>
        </>
      ),
    },
    {
      id: 'cc-daftar', title: 'Daftar hitung (Count lists)',
      body: (
        <>
          <p className="text-sm text-slate-700">Setiap cabang punya daftar sendiri per jenis SO. Cabang tanpa daftar sendiri memakai <b>daftar default</b> tipenya (OUTLET, HUB_WH, …). Daftar <b>Mingguan</b> outlet & HUB WH mengikuti <i>Stock Opname Report 07 Okt 2026</i> (item & satuan, termasuk item yang qty-nya 0); daftar lain dari dokumen stock opname terakhir di ESB.</p>
          <Steps items={[
            <>Buka <Go href="/cost-control/lists">Daftar hitung</Go>, pilih cabang atau default, lalu jenis SO.</>,
            <>Tambah item (cari nama/kode atau satu kategori sekaligus), atur <b>area</b>, <b>satuan kemasan</b> (kru menghitung pack + sisa), <b>satuan ESB</b> (satuan di file impor) dan <b>wajib foto</b>. Simpan.</>,
            <>Item untuk banyak cabang sekaligus lebih mudah dikelola lewat <b>Grup item</b>.</>,
          ]} />
          <Note>Perubahan daftar langsung berlaku: SO yang sedang berjalan ikut menambah item baru; item yang dihapus hilang dari SO berjalan selama belum dihitung.</Note>
        </>
      ),
    },
    {
      id: 'cc-grup', title: 'Grup item',
      body: (
        <>
          <p className="text-sm text-slate-700">Grup = kumpulan item yang dibuat sekali lalu dipasang ke banyak cabang (mis. “Bar espresso”, “Packaging to go”). Mengubah grup langsung mengubah semua cabang pemakainya.</p>
          <Steps items={[
            <>Buka <Go href="/cost-control/groups">Grup item</Go> → <Menu>Grup baru</Menu>. Langkah 1 <b>Detail</b>: nama & keterangan.</>,
            <>Langkah 2 <b>Item</b>: tambah satu kategori sekaligus atau cari item satu per satu; atur area, kemasan, satuan ESB, foto.</>,
            <>Langkah 3 <b>Cabang</b>: pilih jenis SO (boleh lebih dari satu), saring tipe & kota, centang cabang atau <b>pilih semua</b>. Buat & pasang.</>,
            <>Grup yang ada: tab <b>Item</b>, <b>Cabang</b> (tambah/hapus pemasangan; tanda centang = sudah terpasang) dan <b>Detail</b> (nama, nonaktif).</>,
          ]} />
          <p className="text-sm font-semibold text-slate-900">Dari template Cost Control</p>
          <Steps items={[
            <><Menu>Impor template</Menu> → pilih file <i>TEMPLATE SO PER CATEGORY</i> → <Menu>Periksa</Menu> (belum menyimpan) → <Menu>Impor</Menu>. Setiap sheet menjadi grup “Template SO …”, belum dipasang ke cabang. Impor ulang mengganti item grup itu; pemasangan cabang tetap.</>,
            <>Produk yang belum ada di master item muncul di grup sebagai <b>Belum ada di master item</b>. Klik <Menu>Buat item</Menu> (kode, nama, kategori & satuan sudah terisi dari template), periksa lalu simpan: item langsung masuk ke grup itu dan grup lain yang mencantumkannya.</>,
            <>Item yang belum punya satuan kemasan dari template: pada kolom kemasan pilih <Menu>+ Tambah satuan…</Menu> (mis. PACK@100PCS = 100 PCS). Di pencarian item juga ada <Menu>Item baru</Menu> untuk produk yang belum ada.</>,
            <>Pasang grup ke cabang lewat tab <b>Cabang</b> di grup tersebut, untuk setiap jenis SO yang dipakai (mis. Mingguan, Bulanan, Harian).</>,
          ]} />
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Begitu sebuah cabang punya grup untuk satu jenis SO, form SO cabang itu <b>hanya menampilkan item dari grup</b> (template cabang). Item sendiri di daftar hitung yang tidak ada di grup tidak ikut dihitung. Jenis SO yang belum dipasangi grup tetap memakai daftar hitungnya sendiri. SO yang sedang berjalan langsung menyesuaikan.</p>
        </>
      ),
    },
    {
      id: 'cc-premix', title: 'Kalkulator Premix & resep WIP',
      body: (
        <>
          <p className="text-sm text-slate-700">Pengganti workbook <i>Kalkulator Premix WIP – SO BAR KITCHEN</i>. Resep yang aktif dipakai kalkulator dan form WIP di SO.</p>
          <Steps items={[
            <><b>Impor awal</b>: <Go href="/cost-control/premix">Kalkulator Premix</Go> → tab <Menu>Impor workbook</Menu> → pilih file → <Menu>Periksa</Menu> (belum menyimpan) → baca hasil (resep baru/berubah, bahan yang belum dipetakan, resep yang total bahannya ≠ 100%) → <Menu>Impor</Menu>.</>,
            <><b>Petakan bahan</b>: tab <Menu>Resep WIP</Menu> → buka resep bertanda “perlu diperbaiki” → pada setiap bahan pilih <b>item stok</b> (kode ESB). Air pilih “Bukan item stok”. Pilihan diingat untuk impor berikutnya.</>,
            <><b>Tambah bahan dari data yang ada</b>: di editor ada panel <b>Item master</b> (per kategori), <b>BOM ESB</b> (ambil satu baris atau semua bahan sebuah BOM) dan <b>Dipakai di resep</b>. Setelah ditambahkan, isi <b>gram per batch</b>.</>,
            <><b>Batch & satuan</b>: batch = gram satu pail untuk resep pail. Satuan: Pail = 1 per batch, Teko = 3 per batch, Gram = 1 g. Persentase per bahan & total terlihat langsung.</>,
            <><b>Versi</b>: perubahan dibuat sebagai draft → <Menu>Simpan & aktifkan</Menu>. Versi lama pensiun tetapi SO lama tetap memakai versi saat SO dihitung.</>,
            <><b>Kalkulator</b>: tab <Menu>Kalkulator</Menu> → isi jumlah per satuan → gram setiap bahan (dibulatkan ke atas seperti workbook) → unduh CSV.</>,
          ]} />
          <Note tone="warn">Resep dengan bahan stok yang belum dipetakan tidak bisa diaktifkan. Resep yang tidak aktif tidak muncul di kalkulator dan form WIP.</Note>
        </>
      ),
    },
    {
      id: 'cc-monitor', title: 'Monitor & Tinjau (review)',
      body: (
        <>
          <Steps items={[
            <><Go href="/cost-control/monitor">Monitor</Go>: status setiap cabang hari ini (belum mulai, berjalan, terkirim, terlambat, terlewat).</>,
            <><Go href="/cost-control/reviews">Tinjau</Go>: buka SO terkirim. Periksa baris bertanda (lonjakan, sampel), foto, lokasi & keterlambatan, serta gram dari WIP.</>,
            <>Pilih <Menu>Setujui</Menu>, <Menu>Minta hitung ulang</Menu> (pilih baris & tulis alasan; kru menghitung ulang baris itu saja) atau <Menu>Batalkan SO</Menu> (SO bisa dimulai lagi).</>,
          ]} />
          <Note>Penyetuju tidak boleh orang yang menghitung SO tersebut.</Note>
        </>
      ),
    },
    {
      id: 'cc-input', title: 'Input / impor SO untuk cabang (opsional)',
      body: (
        <>
          <p className="text-sm text-slate-700">Bila diperlukan, Cost Control dapat mengisi hasil SO sebuah cabang atau mengimpor hasil SO banyak cabang dari file. Ini <b>opsional</b>: cabang tetap bisa melakukan SO sendiri.</p>
          <Steps items={[
            <><Go href="/cost-control/entry">Input / impor SO</Go> → <Menu>Isi formulir</Menu>: pilih cabang, jenis SO dan tanggal (hari ini atau sebelumnya) → <Menu>Buka form</Menu>. Form sama dengan form kru (item, satuan, premix dalam gram) tanpa foto & lokasi. Isi semua baris lalu <Menu>Kirim</Menu>.</>,
            <><Menu>Impor file</Menu>: pilih file berformat <i>Stock Opname Report</i> (kolom Branch, Product Code, Unit, Actual Opname Qty), jenis SO dan tanggal → <Menu>Periksa file</Menu> (belum menyimpan; terlihat cabang/item/satuan yang tidak dikenal) → <Menu>Impor</Menu>.</>,
            <>Hasil isi/impor berstatus <b>Terkirim</b> dan masuk <Go href="/cost-control/reviews">Tinjau</Go> dengan tanda “Diisi/Diimpor oleh Cost Control”. Anggota Cost Control <b>lain</b> yang menyetujui.</>,
          ]} />
          <Note>Cabang yang sudah punya SO untuk jenis & tanggal yang sama dilewati saat impor (tidak ditimpa).</Note>
        </>
      ),
    },
    {
      id: 'cc-laporan', title: 'Laporan SO (xlsx)',
      body: (
        <Steps items={[
          <><Go href="/cost-control/reports">Laporan SO (xlsx)</Go>: pilih periode (maks. 93 hari), jenis SO, cabang dan status (Disetujui + diekspor) → <Menu>Unduh .xlsx</Menu>.</>,
          <>Sheet <b>Stock Opname</b> berformat sama dengan Stock Opname Report (Date, Branch, Purpose, Product, Category, Unit, Actual Opname Qty, Price, Total Value) dengan filter & total; sheet <b>Summary</b> berisi satu baris per SO (penghitung, peninjau, jam WIB, jumlah item, nilai).</>,
          <>Mengunduh laporan tidak mengubah status SO (berbeda dengan Ekspor ESB).</>,
        ]} />
      ),
    },
    {
      id: 'cc-esb', title: 'Ekspor ke ESB & pembanding',
      body: (
        <Steps items={[
          <><Go href="/cost-control/esb-export">Ekspor ESB</Go>: pilih tanggal & jenis SO → file template impor SO ESB (sheet Worksheet) berisi SO yang disetujui; qty dalam satuan ESB, termasuk gram dari WIP. SO menjadi “Diekspor”; file bisa diunduh ulang dengan isi sama.</>,
          <>Unggah file ke ESB (modul Stock Opname) seperti biasa.</>,
          <><Go href="/cost-control/esb-compare">Pembanding ESB</Go>: setelah ESB memproses, cek per item qty platform vs aktual ESB (harus sama) dan sistem ESB vs aktual (selisih qty & nilai).</>,
        ]} />
      ),
    },
    {
      id: 'cc-rasio', title: 'Rasio Outlet',
      body: (
        <>
          <p className="text-sm text-slate-700"><Go href="/cost-control/ratio">Rasio Outlet</Go> menyusun kolom workbook <i>CALF – Rasio Outlet</i> dari data ESB. Pilih bulan dan periode (W1 1–7, W2 1–14, W3 1–21, W4 1–28, sebulan); unduh Excel.</p>
          <Table head={['Kolom', 'Sumber / rumus']} rows={[
            ['Gross sales', 'Subtotal transaksi Sales POS (sama dengan workbook)'],
            ['Pendapatan / net', 'Gross × (1 − MDR) bila MDR bulan itu diisi; selain itu Nett Sales ESB'],
            ['Pembelian BB / Espresso / Dimsum', 'Faktur pembelian dari Calf Warehouse / Calf Central Kitchen / Calf Central Kitchen Food'],
            ['COGS value', 'BB + Espresso + Dimsum'],
            ['BB ratio · Espresso ratio', '(BB + Dimsum) ÷ net · Espresso ÷ net'],
            ['COGS ratio gross · net', 'COGS ÷ gross · COGS ÷ net'],
            ['SO awal · SO akhir', 'Nilai dokumen SO ESB H-1 periode & hari terakhir (atau nilai koreksi)'],
            ['Usage · usage ratio', 'COGS + SO awal − SO akhir; ÷ gross & ÷ net'],
            ['Δ COGS − usage', 'COGS ratio net − usage ratio net'],
            ['Non sales · Item journal', 'Bill “other cost” · nilai item journal (waste, QC)'],
          ]} />
          <Steps items={[
            <><b>Koreksi SO</b>: klik nilai SO awal/akhir → isi nilai yang dipakai & alasannya (tercatat dengan nama Anda). “Pakai nilai ESB” mengembalikan.</>,
            <><b>MDR</b>: isi persen MDR per outlet pada kolom MDR (periode dalam satu bulan) agar rasio net sama dengan workbook.</>,
          ]} />
        </>
      ),
    },
  ],
};

export const ADMIN: Part = {
  key: 'admin', label: 'Admin (User Accounts)', icon: <ShieldCheck size={16} />,
  intro: 'Untuk super admin: membuat akun, menugaskan cabang, mengatur halaman yang boleh dibuka.',
  sections: [
    {
      id: 'ad-user', title: 'Membuat akun PIC / Cost Control',
      body: (
        <Steps items={[
          <><Go href="/users">Akun Pengguna</Go> → <Menu>Pengguna baru</Menu>. Isi nama, telepon, <b>jabatan</b> & <b>departemen</b> (pilih dari daftar atau ketik nama baru → “Tambahkan … ke daftar”).</>,
          <>Pilih <b>role</b>: User (data cabang yang ditugaskan), Kontrol Biaya (semua cabang + halaman Kontrol Biaya), Super Admin (semua).</>,
          <><b>Akses halaman</b>: halaman dari role sudah tercentang; centang/hapus centang untuk menambah atau mencabut halaman khusus user ini.</>,
          <><b>Cabang</b> (role User): pilih outlet; untuk HUB WH / HUB CK pilih lokasi tanpa kode ESB. Simpan dan bagikan data login.</>,
        ]} />
      ),
    },
    {
      id: 'ad-role', title: 'Role & halaman, jabatan & departemen',
      body: (
        <Steps items={[
          <><Menu>Role & halaman</Menu>: matriks halaman per role. Perubahan berlaku untuk semua user role itu dalam satu menit.</>,
          <><b>Panduan</b> juga sebuah halaman: hapus centangnya untuk sebuah role (atau satu user) agar tidak tampil di menu.</>,
          <><Menu>Jabatan & departemen</Menu>: tambah, ganti nama (akun ikut berubah) atau sembunyikan nama.</>,
          <>User Accounts dan Activity Logs selalu khusus super admin.</>,
        ]} />
      ),
    },
  ],
};
