'use client';

// Panduan per modul (2026-11-13): satu tab untuk setiap modul di sidebar — Dashboard, Sales Transactions, Form, Cost
// Control, Operations, Calf On The Road, Aggregator, Management — dan di dalamnya setiap menu: untuk apa, isi halaman,
// cara memakainya dan catatan penting. Bagian yang sudah rinci sebelumnya (stock opname kru, Cost Control, penilaian
// PIC, COTR, admin) dipakai ulang di tab modulnya.

import { Bike, Calculator, ClipboardList, Gauge, LayoutDashboard, Receipt, Settings, Star } from 'lucide-react';
import { CC, MON, SO, ADMIN } from './content-id';
import { COTR_ID } from './content-cotr';
import { tr } from '@/lib/i18n';
import { Go, Menu, Note, Part, Section, Steps, Table } from './ui';

const pick = (sections: Section[], ids: string[]) => sections.filter(s => ids.includes(s.id));

// ------------------------------------------------------------------------------------------------- Dashboard

export const DASH: Part = {
  key: 'dash', get label() { return tr('Dashboard'); }, icon: <LayoutDashboard size={16} />,
  intro: 'Dashboard adalah ringkasan penjualan semua outlet dari POS ESB: angka hari ini yang terus bergerak, tren, menu, jam ramai, channel, pembayaran, potongan dan pajak. Semua angka mengikuti brand yang dipilih (Kopi Calf atau Wasgee Tea) dan filter di atas halaman.',
  sections: [
    {
      id: 'dash-filter', title: 'Filter: periode, pembanding, cabang, channel',
      body: <>
        <Steps items={[
          <>Pilih <b>brand</b> di bagian atas (Kopi Calf / Wasgee Tea). Setiap angka di halaman hanya untuk brand itu; cabang yang dipilih pada brand lain tidak terbawa.</>,
          <>Buka <Menu>Filter</Menu> untuk memilih <b>periode</b> (hari ini, 7 / 30 / 90 hari, bulan berjalan, bulan lalu, atau tanggal sendiri), <b>cabang</b> dan <b>channel</b> (Dine In, Takeaway, GrabFood, GoFood, ShopeeFood …).</>,
          <><b>Periode pembanding</b>: bawaan = hari yang sama di minggu sebelumnya (Jumat dibanding Jumat), atau pilih sendiri (bulan lalu, tahun lalu, tanggal tertentu). Semua angka &quot;vs sebelumnya&quot; mengikuti pilihan ini.</>,
          <>Filter tersimpan di alamat halaman: salin link untuk membagikan tampilan yang sama ke rekan.</>,
        ]} />
        <Note>Data dari sebelum Agustus 2025 tidak punya pembanding. Bila jumlah hari periode dan pembandingnya berbeda, bandingkan angka per hari, bukan totalnya.</Note>
      </>,
    },
    {
      id: 'dash-isi', title: 'Isi Dashboard',
      body: <Table head={['Bagian', 'Isinya', 'Gunanya']} rows={[
        ['Ringkasan (KPI)', 'Sales, Nett Sales, jumlah bill, rata-rata per bill (AOV), masing-masing dengan perubahan vs pembanding', 'Melihat kondisi periode dalam sekali lihat'],
        ['Live sales', 'Bill yang baru masuk hari ini, mengalir dari atas, dibanding jam yang sama minggu lalu', 'Memantau hari berjalan (data ESB sinkron tiap ±15 menit)'],
        ['Tren & pertumbuhan', 'Penjualan per hari / jam / bulan, pertumbuhan per bucket (biru naik, merah turun), kumulatif', 'Melihat arah penjualan dan hari / jam yang turun'],
        ['Harian & bulanan', 'Penjualan per hari (akhir pekan warna lebih gelap); per bulan dengan MoM, YoY dan same-store growth', 'Membandingkan bulan secara adil'],
        ['Jam ramai', 'Peta jam ramai dan pertumbuhan per jam', 'Mengatur jadwal kru dan stok jam sibuk'],
        ['Menu', 'Menu dan kategori terlaris, kontribusi, harga rata-rata, add-on', 'Melihat menu yang naik / turun'],
        ['Channel & pembayaran', 'Porsi tiap channel (offline vs aplikasi), metode bayar, cashless', 'Melihat cara pelanggan membeli'],
        ['Basket & potongan', 'Isi keranjang, diskon / promo, potongan offline vs online', 'Mengontrol potongan harga'],
        ['Pajak / PB1', 'Pajak bill dine-in & takeaway, tarif per hari, per channel, per cabang (cabang tanpa pajak dipisah)', 'Rekonsiliasi pajak'],
        ['Leaderboard cabang', '10 cabang teratas periode ini vs pembanding, cabang yang perlu dicek', 'Membandingkan outlet'],
      ]} />,
    },
    {
      id: 'dash-detail', title: 'Melihat detail',
      body: <Steps items={[
        <>Klik <Menu>Details</Menu> pada sebuah kartu untuk membuka rinciannya (drawer) dengan tabel lengkap dan tab tampilan.</>,
        <>Arahkan kursor (atau ketuk di HP) ke grafik untuk melihat angka tiap titik.</>,
        <>Tab <b>Calf On The Road</b> menampilkan penjualan COTR bila datanya sudah ada.</>,
      ]} />,
    },
  ],
};

// ------------------------------------------------------------------------------------------------- Sales Transactions

export const SALES: Part = {
  key: 'sales', get label() { return tr('Sales Transactions'); }, icon: <Receipt size={16} />,
  intro: 'Sales Transactions berisi setiap transaksi POS ESB per bill dan per menu, dengan ringkasan Gross → Potongan → Sales yang sama dengan laporan ESB "Sales Recapitulation Detail Report". Halaman terbuka pada hari ini (WIB).',
  sections: [
    {
      id: 'sales-ringkasan', title: 'Ringkasan penjualan',
      body: <Table head={['Angka', 'Arti']} rows={[
        ['Gross sales', 'Total harga menu sebelum potongan'],
        ['Deductions (potongan)', 'Diskon, promo dan potongan lain'],
        ['Sales / Nett Sales', 'Setelah potongan; sama dengan laporan ESB'],
        ['Other cost', 'Bill non-penjualan (cupping, waste, compliment, QC) — dipisah dari penjualan'],
        ['Open Bills', 'Bill yang belum ditutup kasir'],
      ]} />,
    },
    {
      id: 'sales-cari', title: 'Mencari & memfilter transaksi',
      body: <Steps items={[
        <>Pilih periode cepat (<Menu>Today</Menu>, 7 / 30 / 90 hari, <Menu>Month to Date</Menu>, <Menu>Last Month</Menu>) atau tanggal sendiri.</>,
        <>Pilih cabang dan jenis transaksi (<Menu>All Transactions</Menu>, penjualan, other cost …).</>,
        <>Ketik di kolom cari: nomor sales, nomor bill atau nama cabang.</>,
        <>Setiap baris menampilkan bill, cabang & pembayaran, menu, harga, total item dan status. Klik <Menu>Load more</Menu> untuk halaman berikutnya.</>,
        <>Saat data baru tersinkron, halaman pertama diperbarui otomatis; bila Anda sedang membaca halaman lanjutan muncul pemberitahuan <Menu>Show latest</Menu>.</>,
        <>Gunakan tombol Excel untuk mengunduh transaksi sesuai filter.</>,
      ]} />,
    },
  ],
};

// ------------------------------------------------------------------------------------------------- Form

export const FORM: Part = {
  key: 'form', get label() { return tr('Form'); }, icon: <ClipboardList size={16} />,
  intro: 'Form adalah semua isian dari outlet, HUB, PIC dan tim lapangan: stock opname, waste, transfer stok, check in, checklist produk & outlet, audit WW-WR, perbaikan alat dan pengajuan dana. Semua bisa dipakai di HP (PWA) dan waktu selalu WIB.',
  sections: [
    ...SO.sections,
    {
      id: 'form-waste', title: 'Waste: mencatat barang terbuang',
      body: <>
        <Steps items={[
          <>Buka <Go href="/waste">Waste</Go>, pilih cabang dan hari (hari ini, atau kemarin bila terlambat).</>,
          <>Pilih jenisnya: <b>Waste</b> (bahan / produk terbuang), <b>Usage Management</b> (pemakaian harian yang dilaporkan) atau <b>Premix</b> (resep WIP dalam gram; bahan-bahannya dihitung otomatis dari resep).</>,
          <>Isi jumlah dalam satuannya, <b>kategori waste</b>, catatan / alasan, tanggal produksi & expired bila diminta, dan <b>foto dari kamera</b> (dicap waktu, cabang dan item).</>,
          <>Item tersimpan langsung dan muncul di bawah form. Selama belum ditinjau Cost Control, pembuatnya masih bisa menghapus.</>,
          <>Bila hari itu tidak ada waste, tandai <b>Tidak ada waste</b> agar laporan harian lengkap.</>,
        ]} />
        <Note>Nilai Rupiah waste dihitung dari Pricelist Items (atau HPP ESB). Cost Control dapat menyetujui, menolak, menginvestigasi dan mengubah kategori.</Note>
      </>,
    },
    {
      id: 'form-tito', title: 'Transfer Stock (TITO) antar outlet',
      body: <>
        <Table head={['Tab', 'Fungsi']} rows={[
          ['Request', 'Outlet saya meminta bahan dari outlet lain: hanya bahan yang tersedia di outlet sumber (SO terakhir dikurangi transfer keluar), jumlah maksimal sebanyak yang ada, foto dan tanda tangan sebelum dikirim'],
          ['My requests', 'Status permintaan saya. Setelah Cost Control menyetujui, tekan Receive dengan foto barang yang jelas — baru saat itu stok kedua outlet bergerak. Permintaan yang belum dijawab bisa dibatalkan'],
          ['Incoming', 'Permintaan ke outlet saya: terima (stok belum bergerak) atau tolak dengan catatan'],
        ]} />
        <Note>Alur: diminta → diterima outlet sumber → disetujui Cost Control → diterima (foto) → stok berpindah. Transfer tercatat di Stock List kedua outlet.</Note>
      </>,
    },
    {
      id: 'form-checkin', title: 'PIC Check In & Cost Control Clock In',
      body: <>
        <Steps items={[
          <>Buka <Go href="/forms/pic-check-in">PIC Check In</Go> (PIC) atau <Go href="/forms/surveyor-check-in">Cost Control Clock In</Go> (tim Cost Control) saat tiba di outlet.</>,
          <>Pilih cabang (bila punya lebih dari satu); outlet diurutkan dari yang terdekat.</>,
          <>Ambil <b>foto wajah</b> dengan kamera depan (server menolak foto tanpa wajah).</>,
          <>Lokasi GPS dibandingkan dengan koordinat outlet (Cost Control → Outlet Locations). Di luar radius: muncul peringatan merah dan <b>alasan wajib diisi</b>.</>,
          <>Kirim. Satu check in per cabang per hari. Riwayat ada di <Menu>My latest check-ins</Menu>.</>,
        ]} />
        <Note tone="warn">Posisi palsu (fake GPS) terdeteksi dari sinyal perangkat dan ditandai di monitoring untuk ditinjau manajer.</Note>
      </>,
    },
    {
      id: 'form-visit', title: 'Product & Outlet (checklist kunjungan)',
      body: <Steps items={[
        <>Buka <Go href="/forms/product">Product</Go> atau <Go href="/forms/outlet">Outlet</Go>, pilih outlet yang dikunjungi.</>,
        <>Setiap butir dinilai <b>UNDER / MEET / EXCEED</b>, dengan catatan dan sampai 3 foto kamera (dicap waktu, cabang, posisi). Butir wajib harus dinilai beserta catatan / foto yang diminta; butir opsional boleh dilewati. Butir bisa berbeda per grup outlet (CCI, CTG, CTGP).</>,
        <>Stock Preparation, Espresso dan Beans juga meminta stok dalam gram (berat bersih).</>,
        <>Isian tersimpan sebagai draft selama diisi — bisa dilanjutkan nanti. Kirim di bagian bawah; posisi ikut terkirim.</>,
        <>Satu kunjungan per outlet per hari. PIC tidak melihat skor; skor untuk manajemen di Operations.</>,
      ]} />,
    },
    {
      id: 'form-wwwr', title: 'WW-WR (audit tim SWAT)',
      body: <Steps items={[
        <>Buka <Go href="/forms/wwwr">WW-WR</Go>: daftar audit yang dijadwalkan untuk Anda (dijadwalkan manajemen di Operations → WW-WR).</>,
        <>Pada harinya, buka audit: satu kunjungan bersama tim berisi semua butir Product dan Outlet; setiap jawaban tercatat siapa pengisinya. Ketua menambah anggota tim.</>,
        <>Sebelum ketua mengirim, tim menulis <b>evaluasi umum</b>, <b>action plan</b> (penanggung jawab & tenggat) dan <b>tanggal revisit</b>.</>,
        <>Setelah terkirim: action plan ditandai selesai, ketua menutup revisit (audit lengkap). Hasil dibagikan ke PIC lewat link (cetak / PDF).</>,
      ]} />,
    },
    {
      id: 'form-de', title: 'Damaged Equipment (perbaikan & pengadaan)',
      body: <Steps items={[
        <>Buka <Go href="/forms/damaged-equipment">Damaged Equipment</Go>, pilih cabang dan jenis: <b>perbaikan</b> (bangunan & alat) atau <b>pengadaan</b> (dekorasi & alat).</>,
        <>Permintaan terbuka di cabang yang sama ditampilkan agar tidak dobel. Lampirkan foto kamera dan satu video ≤ 10 MB.</>,
        <>Pratinjau, tanda tangan PIC, kirim. PDF dan link berbagi tersedia; <Menu>My requests</Menu> menampilkan progres dan catatan tim.</>,
        <>Saat tim meminta serah terima (link dari WhatsApp), PIC mengonfirmasi di outlet: 1–5 foto, tanda tangan, dan tanda tangan vendor bila vendor.</>,
        <>Setelah Done, dokumen akhir (laporan kerja / berita acara vendor) bisa diunduh.</>,
      ]} />,
    },
    {
      id: 'form-pengajuan', title: 'Fund Request (pengajuan dana)',
      body: <>
        <Table head={['Jenis', 'Isinya']} rows={[
          ['Petty cash mingguan', 'Barista, periode, saldo awal (disarankan dari saldo akhir sebelumnya), uang masuk dengan bukti, setiap pengeluaran dengan struk, saldo akhir dan top-up sampai plafon'],
          ['Pengajuan anggaran', 'Pembelian darurat, marketing, event, tagihan: tujuan, tanggal dibutuhkan, baris dengan estimasi atau struk'],
        ]} />
        <Steps items={[
          <>Isi siapa yang mengajukan (barista / PIC, nomor HP) dan rekening tujuan.</>,
          <>Draft tersimpan otomatis. Yang masih kurang ditampilkan di atas tombol Kirim.</>,
          <>Pengajuan yang dikembalikan untuk revisi terbuka lagi di sini beserta catatannya.</>,
        ]} />
      </>,
    },
  ],
};

// ------------------------------------------------------------------------------------------------- Cost Control

export const CCX: Part = {
  key: 'cc', get label() { return tr('Cost Control'); }, icon: <Calculator size={16} />,
  intro: 'Cost Control mengelola stock opname semua cabang, resep & harga, waste, stok berjalan, transfer antar outlet, penerimaan barang (GR) dan rasio biaya. Menu dikelompokkan: Stock Opname, Pengaturan SO, Produksi & Costing, Waste, Monitoring Stock, Clock In dan Analytics.',
  sections: [
    ...pick(CC.sections, ['cc-alur']),
    {
      id: 'ccx-peta', title: 'Peta menu Cost Control',
      body: <Table head={['Grup', 'Menu', 'Fungsi singkat']} rows={[
        ['Stock Opname', <Go key="m" href="/cost-control/monitor">Stock Opname Monitor</Go>, 'Progres setiap cabang per hari & jenis SO, status, lokasi'],
        ['', <Go key="r" href="/cost-control/reviews">Stock Opname Review</Go>, 'Menyetujui, minta hitung ulang, koreksi langsung'],
        ['', <Go key="p" href="/cost-control/reports">Stock Opname Report</Go>, 'Unduh SO yang sudah ditinjau (Excel)'],
        ['Pengaturan SO', <Go key="l" href="/cost-control/lists">Count Lists</Go>, 'Item yang dihitung per cabang & jenis SO'],
        ['', <Go key="g" href="/cost-control/groups">Items Groups</Go>, 'Template item yang dipasang ke banyak cabang'],
        ['', <Go key="t" href="/cost-control/types">Count Types</Go>, 'Nama, jadwal, jam & kalender SO'],
        ['', <Go key="o" href="/cost-control/locations">Outlet Locations</Go>, 'Koordinat & radius check in'],
        ['Produksi & Costing', <Go key="pm" href="/cost-control/premix">Production Calculator</Go>, 'Resep WIP / premix & kalkulator gram'],
        ['', <Go key="sc" href="/cost-control/sales-calculator">Sales Calculator by Menu</Go>, 'Kartu resep menu, MRP, usage & COGS'],
        ['', <Go key="pl" href="/cost-control/pricelist">List & Pricelist Items</Go>, 'Item aktif / nonaktif & harga'],
        ['Waste', <Go key="wm" href="/cost-control/waste/monitor">Waste Monitor</Go>, 'Analisis waste semua cabang'],
        ['', <Go key="wr" href="/cost-control/waste/reviews">Waste Review</Go>, 'Menyetujui / menolak / investigasi'],
        ['Monitoring Stock', <Go key="sl" href="/cost-control/stock-list">Stock List</Go>, 'Stok per cabang dari SO terakhir + estimasi sekarang'],
        ['', <Go key="st" href="/cost-control/stock-transfer">Transfer Stock</Go>, 'Persetujuan transfer, label ESB & export'],
        ['Clock In', <Go key="ci" href="/cost-control/check-in">Cost Control Clock In</Go>, 'Kunjungan tim Cost Control'],
        ['Analytics', <Go key="ra" href="/cost-control/ratio">Outlet Ratio</Go>, 'COGS, BB & usage ratio per outlet'],
        ['', <Go key="gr" href="/cost-control/goods-receipt">Good Receipt</Go>, 'GR ESB & koreksi tanggal / qty dengan bukti'],
        ['', <Go key="cg" href="/cost-control">COGS & Usage</Go>, 'COGS sistem vs aktual per outlet antar dua SO'],
      ]} />,
    },
    ...pick(CC.sections, ['cc-monitor']),
    {
      id: 'ccx-review', title: 'Stock Opname Review: satu hitungan',
      body: <Steps items={[
        <>Tab teratas menampilkan yang menunggu keputusan Cost Control lebih dulu; status lain bisa dibuka. Export Excel tersedia per periode & jenis SO.</>,
        <>Buka satu hitungan: setiap baris dengan tanda (selisih, foto, tanggal), riwayat, lokasi & log (start / submit, jarak ke outlet).</>,
        <><b>Approve</b>, <b>minta hitung ulang</b> baris tertentu (premix hanya gramnya yang dihitung ulang), atau <b>batalkan</b>.</>,
        <>Koreksi langsung jumlah / tanggal dengan alasan tanpa hitung ulang — angka cabang tetap di riwayat. Koreksi masih bisa setelah approve, selama belum diekspor ke ESB.</>,
        <>Peninjau tidak boleh salah satu penghitung (sistem menolak dan menjelaskan).</>,
      ]} />,
    },
    ...pick(CC.sections, ['cc-laporan']),
    {
      id: 'ccx-esb', title: 'Enter / import SO, ESB export & perbandingan ESB',
      body: <Table head={['Halaman', 'Fungsi']} rows={[
        ['Enter / import SO', 'Cost Control mengisi SO atas nama cabang di form, atau mengimpor jumlah aktual banyak cabang dari file berformat Stock Opname Report. Hasilnya masuk Review dan harus disetujui orang lain'],
        ['ESB export', 'SO yang disetujui untuk satu hari & jenis SO menjadi satu file "Stock Opname Template" ESB. File disimpan: unduh ulang memberi file yang persis sama'],
        ['ESB comparison', 'SO yang diekspor dibanding dokumen SO di ESB: sudah ada atau belum, jumlah sama atau tidak, dan selisih jumlah sistem ESB vs hitungan (nilai)'],
      ]} />,
    },
    ...pick(CC.sections, ['cc-jenis', 'cc-daftar', 'cc-grup']),
    {
      id: 'ccx-lokasi', title: 'Outlet Locations',
      body: <Steps items={[
        <>Setiap outlet & HUB punya koordinat dan radius check in, dipakai untuk memeriksa lokasi mulai SO dan check in PIC.</>,
        <>Isi koordinat dengan menempel dari Google Maps (&quot;-6.26, 106.81&quot; atau link maps), mengambil posisi awal SO terakhir fasilitas (cek di peta dulu), atau dari HP anggota Cost Control di lokasi.</>,
        <>Setiap perubahan tercatat (audit).</>,
      ]} />,
    },
    ...pick(CC.sections, ['cc-premix']),
    {
      id: 'ccx-salescalc', title: 'Sales Calculator by Menu (4 langkah)',
      body: <>
        <Steps items={[
          <><b>Recipe Cards</b>: isi satu porsi menu — bahan & kemasan dari master item, WIP / premix dalam gram, atau item ketik manual. Kartu boleh berisi kartu lain (bundling) dan menampilkan harga jual menu per channel dengan % HPP (≤30% sehat, ≤35% perlu dipantau, di atasnya terlalu tinggi).</>,
          <><b>Assign Menus</b>: menu POS ESB yang terjual dan kartu resep yang dipakai masing-masing.</>,
          <><b>Additional Items</b>: perlengkapan yang tidak tercatat di menu (cable ties, plastik …) per bill, per porsi atau per hari outlet.</>,
          <><b>Calculator</b>: dari transaksi POS — Material Required Planning, Usage Aktual vs Sistem (SO awal + pembelian − SO akhir) dan COGS bahan (Pricelist), sistem dan aktual.</>,
        ]} />
        <Note>Dibuka dari COGS & Usage (klik nama outlet), kalkulator langsung terisi outlet dan periodenya.</Note>
      </>,
    },
    {
      id: 'ccx-pricelist', title: 'List & Pricelist Items',
      body: <>
        <Steps items={[
          <>Setiap item stok: aktif / nonaktif (item nonaktif hilang dari form SO dan pemilih item) dan harga per satuan dasar mulai tanggal tertentu.</>,
          <>Referensi: rata-rata harga beli 90 hari dan HPP ESB. <Menu>Use Purchase Average</Menu> mengisi item tanpa harga dengan rata-rata beli (atau HPP ESB).</>,
          <>Isi kolom harga baru, pilih <b>Valid from</b>, lalu <Menu>Save prices</Menu>. Riwayat harga ada di ikon jam.</>,
          <>Panel <b>Dipakai tapi belum ada harga</b> di atas tabel: item yang dipakai kartu resep, WIP atau waste 60 hari tanpa harga — HPP menunya dan nilai waste-nya kosong sampai harga diisi. Klik <Menu>Isi harga</Menu> untuk langsung ke barisnya.</>,
        ]} />
        <Note>Harga yang baru dibuat juga dipakai untuk hari-hari sebelum tanggal berlakunya bila item itu belum pernah punya harga.</Note>
      </>,
    },
    ...pick(CC.sections, ['cc-waste']),
    {
      id: 'ccx-waste2', title: 'Waste Monitor & Review: fitur lengkap',
      body: <Table head={['Fitur', 'Keterangan']} rows={[
        ['Analysis', 'Total per item, cabang dan kategori dengan porsi nilai (Rp)'],
        ['Entries', 'Setiap entri dengan foto, catatan, pembuat, nilai Rp; tabel di desktop, kartu di HP'],
        ['Filter', 'Cabang, jenis, beberapa kategori sekaligus, status'],
        ['Review', 'Centang entri lalu Approve / Reject (dengan catatan) / Investigate, satu-satu atau banyak sekaligus'],
        ['Ubah kategori', 'Centang beberapa entri → Ubah kategori: pilih kategori baru dan alasan; setiap perubahan tercatat'],
        ['Investigasi', 'Form FM-QAQC-03 "Investigasi Komplain & Waste" yang bisa dicetak / PDF'],
        ['Laporan harian', 'Cabang yang sudah / belum melapor waste setiap hari; Usage Management harian'],
        ['Export', 'Excel: entri, per item, laporan harian, Usage Management'],
      ]} />,
    },
    {
      id: 'ccx-stock', title: 'Stock List & Transfer Stock',
      body: <>
        <Table head={['Halaman', 'Isinya']} rows={[
          ['Stock List', 'Stok setiap cabang dari SO terakhir di portal + transfer masuk / keluar, transfer dalam perjalanan dan yang tersedia untuk ditransfer, dinilai dengan Pricelist. Dua tampilan: per cabang dan per bahan. Estimasi sekarang = SO + barang masuk & pergerakan lain − waste disetujui − pemakaian kartu resep sejak SO (estimasi di bawah nol = kartu resep atau pergerakan tidak cocok)'],
          ['Transfer Stock', 'Setiap transfer antar outlet dengan langkahnya. Approver (Settings) menyetujui / menolak transfer yang sudah diterima outlet sumber; Cost Control memberi label apakah masuk ESB; export transfer, baris, per outlet dan per bahan'],
        ]} />
        <Note>Stock List ikut berubah segera setelah koreksi GR ditandai Selesai, koreksi dokumen ESB disimpan, waste disetujui atau transfer diterima.</Note>
      </>,
    },
    ...pick(CC.sections, ['cc-rasio']),
    {
      id: 'ccx-gr', title: 'Good Receipt: koreksi penerimaan barang',
      body: <Steps items={[
        <>Daftar GR dari ESB per outlet & periode (cari nomor GR / PO / outlet / supplier). Data ESB tidak pernah diubah; angka koreksi tampil di sebelahnya.</>,
        <>Buka GR → koreksi <b>tanggal terima</b> (barang datang di hari lain) atau <b>jumlah per baris</b> (dalam satuan barisnya) dengan alasan dan bukti (foto surat jalan / PDF).</>,
        <>Tandai GR <b>Selesai</b>: baru saat itu koreksinya dihitung di COGS & Usage, Sales Calculator dan Stock List. Koreksi setelahnya mengembalikan GR ke draft.</>,
        <>Setiap koreksi tersimpan (diganti / dibatalkan) sebagai riwayat.</>,
      ]} />,
    },
    {
      id: 'ccx-cogs', title: 'COGS & Usage per outlet',
      body: <>
        <Table head={['Kolom', 'Arti']} rows={[
          ['COGS Sistem', 'Pemakaian menurut kartu resep (menu terjual, pilihan, bundling, menu non-penjualan, item tambahan) × harga'],
          ['COGS Aktual', 'SO awal + barang masuk − barang keluar − SO akhir × harga'],
          ['Usage Ratio', 'Aktual ÷ sistem pada bahan yang sama: ±5% hijau, ±15% kuning, selebihnya merah'],
          ['Waste', 'Waste yang disetujui di periode: bagian selisih yang terjelaskan'],
          ['Tak terjelaskan', 'Selisih aktual − sistem − waste'],
          ['Data', 'Cakupan SO, anomali SO, bahan tanpa harga, SO sudah disetujui atau belum'],
        ]} />
        <Steps items={[
          <>Pilih periode yang <b>mulai pada hari SO</b> dan berakhir sehari sebelum SO berikutnya.</>,
          <>Klik nama outlet untuk membuka Sales Calculator outlet & periode itu.</>,
          <>Panel <b>Dokumen ESB tidak wajar</b> di bawah tabel: baris dokumen ESB (produksi, pembelian outlet, pengiriman, retur, GR) yang jumlahnya ≥20× kebiasaan atau jauh lebih kecil — biasanya salah satuan (KG untuk GR). Tekan <Menu>Koreksi</Menu>, isi jumlah yang benar dan alasan. Portal memakai jumlah itu mulai sekarang, juga bila ESB diperbaiki belakangan; GR dikoreksi di halaman Good Receipt.</>,
        ]} />
      </>,
    },
    {
      id: 'ccx-notif', title: 'Notifikasi untuk Cost Control',
      body: <>
        <p className="text-sm text-neutral-700">Buka foto profil di kiri bawah (di HP: foto profil kanan atas) → <Menu>Notifikasi</Menu>. Angka merah = belum dibaca. Pemeriksaan berjalan otomatis setiap 30 menit.</p>
        <Table head={['Notifikasi', 'Kapan muncul']} rows={[
          ['Dokumen / GR tidak wajar', 'Jumlah jauh dari kebiasaan dan belum dikoreksi (per baris dokumen)'],
          ['GR jauh di bawah PO', 'Diterima kurang dari 50% dari PO-nya'],
          ['GR masih New', 'Harian: GR berstatus New lebih dari 2 hari (belum masuk Stock List sampai di-authorize di ESB)'],
          ['GR terkoreksi belum Selesai', 'Harian: koreksi belum dihitung karena GR belum ditandai Selesai'],
          ['Ringkasan GR', 'Harian mulai 06:00 WIB: jumlah GR kemarin dan yang perlu dicek'],
        ]} />
        <Note>Klik notifikasi untuk langsung membuka dokumennya. <Menu>Tandai semua dibaca</Menu> ada di bawah daftar.</Note>
      </>,
    },
  ],
};

// ------------------------------------------------------------------------------------------------- Operations

export const OPS: Part = {
  key: 'ops', get label() { return tr('Operations'); }, icon: <Gauge size={16} />,
  intro: 'Operations (Monitoring) adalah tempat manajemen memantau semua isian Form: penilaian PIC, check in, checklist produk & outlet, audit WW-WR, perbaikan alat dan pengajuan dana, serta pengelompokan outlet.',
  sections: [
    {
      id: 'ops-overview', title: 'Overview: penilaian PIC',
      body: <Steps items={[
        <>Skor setiap PIC dari form hariannya: hari check in, rata-rata skor kunjungan Product dan Outlet miliknya.</>,
        <>Dibandingkan dengan audit SWAT (WW-WR): seberapa sesuai penilaian PIC dengan tim, butir yang PIC beri lulus tetapi tim temukan UNDER, dan action plan yang masih terbuka.</>,
        <>Lalu hal yang sama per outlet, plus Net Sales outlet dibanding bulan sebelumnya sendiri.</>,
        <>Klik ⓘ untuk melihat bagian skor, bobot dan nilainya.</>,
      ]} />,
    },
    ...MON.sections,
    {
      id: 'ops-checkin', title: 'PIC Check In (monitoring)',
      body: <Steps items={[
        <>Setiap check in pada periode: siapa, outlet, jam, foto wajah dan posisi dibanding outlet. Diperbarui tiap menit bila periode mencakup hari ini.</>,
        <>Tiga pemeriksaan lokasi per check in: posisi (di outlet / di luar radius dengan jarak / outlet tanpa koordinat), akurasi GPS, dan tanda posisi palsu.</>,
        <>Check in di luar radius atau dengan tanda fake GPS ditonjolkan (banner, badge); manajer meninjaunya (valid / tidak valid).</>,
        <>Detail berisi foto dan link peta; ada angka kunjungan per PIC.</>,
      ]} />,
    },
    {
      id: 'ops-visit', title: 'Product & Outlet (monitoring)',
      body: <Table head={['Tab', 'Isinya']} rows={[
        ['Visits', 'Daftar kunjungan; satu kunjungan lengkap di drawer: skor, PIC, waktu, posisi, setiap butir dengan nilai, catatan dan foto'],
        ['Analysis', 'Skor per bagian vs target (terburuk dulu), temuan UNDER terbanyak, outlet dengan skor terendah, bintang per platform'],
        ['Attendance', 'Per bulan: hari setiap PIC berkunjung dan hari tanpa kunjungan'],
      ]} />,
    },
    {
      id: 'ops-wwwr', title: 'WW-WR (monitoring audit SWAT)',
      body: <Table head={['Tab', 'Isinya']} rows={[
        ['Audits & Analysis', 'Audit yang terkirim dan analisisnya'],
        ['Schedule', 'Jadwal audit: outlet, hari, ketua dan anggota tim SWAT; buat / ubah / batalkan'],
        ['Comparison', 'Setiap audit vs kunjungan Product & Outlet PIC outlet itu 7 hari sebelumnya: kesesuaian, butir yang PIC luluskan tapi tim temukan UNDER'],
        ['Tindak lanjut', 'Status, evaluasi, action plan dan link hasil untuk PIC'],
      ]} />,
    },
    {
      id: 'ops-de', title: 'Damaged Equipment (monitoring)',
      body: <Table head={['Tab', 'Isinya']} rows={[
        ['Requests', 'Tab status & filter, dikelompokkan per cabang / PIC. Satu permintaan: estimasi selesai, langkah, Handling (langkah berikutnya & yang masih kurang, teknisi internal atau vendor, foto kerja lewat link teknisi, serah terima PIC, biaya & invoice, duplikat), isi permintaan dan riwayat'],
        ['Overview', 'Analisis semua permintaan dan penanganannya'],
        ['Technicians', 'Daftar teknisi'],
        ['Categories', 'Kategori permintaan'],
      ]} />,
    },
    {
      id: 'ops-pengajuan', title: 'Fund Request (persetujuan pengajuan)',
      body: <Steps items={[
        <>Tab status (terbuka dulu); <Menu>My turn</Menu> = menunggu di langkah Anda. Filter: periode, grup, outlet, jenis, akun, kategori.</>,
        <>Buka pengajuan: langkah-langkah jenisnya, setiap baris dengan struk, dan riwayat.</>,
        <>Approver langkah yang menunggu: setujui (persetujuan terakhir menetapkan jumlah), tolak baris tertentu, kembalikan untuk revisi, atau tolak (dengan catatan).</>,
        <>Langkah pembayaran mencatat transfer beserta buktinya. Export CSV semua baris untuk rekonsiliasi.</>,
        <>Settings (superadmin): langkah persetujuan per jenis dan penggunanya; plafon petty cash (superadmin, Finance).</>,
      ]} />,
    },
    {
      id: 'ops-grup', title: 'Branch Groups',
      body: <p className="text-sm text-neutral-700">Kelas outlet (CCI, CTG, CTGP …) yang menentukan butir form dan penilaian. Satu grup per cabang; cabang yang dipilih untuk grup baru keluar dari grup lamanya. Dipakai Overview dan filter grup di halaman monitoring.</p>,
    },
  ],
};

// ------------------------------------------------------------------------------------------------- Calf On The Road

export const COTR: Part = {
  key: 'cotr', get label() { return tr('Calf On The Road'); }, icon: <Bike size={16} />,
  intro: COTR_ID.intro,
  sections: [
    {
      id: 'cotrx-peta', title: 'Peta menu Calf On The Road',
      body: <Table head={['Grup', 'Menu', 'Fungsi']} rows={[
        ['Harian', <Go key="d" href="/cotr/dashboard">Dashboard</Go>, 'Satu hari semua pool: cup terjual & nilainya, waste & cupping, sisa vs hitungan, 14 hari cup terjual, driver hari itu dan yang menunggu tim'],
        ['', <Go key="s" href="/cotr/storage">Storage & Assignment</Go>, 'Penugasan pagi per driver, reload, selisih, penutupan malam, FIFO'],
        ['', <Go key="c" href="/cotr/check-in">Monitoring Armada - Driver</Go>, 'Shift, penjualan, stok, cupping & waste, reload & pengajuan untuk disetujui, posisi driver di peta'],
        ['Produksi & Stok', <Go key="p" href="/cotr/production">Storage & Production</Go>, 'Stok pool, produksi HUB, laporan & rekonsiliasi ESB, gudang storage, resep & item'],
        ['Bulanan & Setup', <Go key="i" href="/cotr/incentive">Incentive Calculator</Go>, 'Insentif bulanan driver: tier per cup, bonus, potongan kehadiran, simulator'],
        ['', <Go key="m" href="/cotr/master">Master</Go>, 'Pool / HUB, Area, Menu, Fleet & aksesori, Karyawan, Jadwal, Jenis pengajuan'],
      ]} />,
    },
    ...COTR_ID.sections,
    {
      id: 'cotrx-dashboard', title: 'Dashboard COTR',
      body: <Steps items={[
        <>Terbuka pada hari terakhir yang sudah ada angkanya (workbook sering datang terlambat).</>,
        <>Bar 14 hari: ketuk satu hari untuk membukanya. Garis kecil per pool menunjukkan tren cup terjual.</>,
        <>Bagian &quot;menunggu tim&quot; berisi reload, pengajuan dan hal lain yang perlu diputuskan.</>,
      ]} />,
    },
    {
      id: 'cotrx-produksi', title: 'Storage & Production: urutan kerja',
      body: <Table head={['Langkah', 'Tab', 'Isinya']} rows={[
        ['1', 'Stok pool', 'Stok pool hari itu, kode batch, waste pool, penutupan hari'],
        ['2', 'Produksi HUB', 'Rencana produksi dari penjualan driver (rata-rata + buffer, diturunkan lewat BOM sampai bahan baku), pengiriman, kalkulator premix, batch (termasuk dari ESB)'],
        ['3', 'Laporan & pencocokan', 'Report Armada, rekonsiliasi dengan ESB, kas, nama driver di workbook, produk ESB'],
        ['4', 'Gudang storage', 'Stok, penerimaan, stock opname, pemakaian'],
        ['5', 'Resep & item', 'Kartu resep dan item COTR (diatur sekali)'],
      ]} />,
    },
    {
      id: 'cotrx-insentif', title: 'Incentive Calculator',
      body: <Steps items={[
        <>Insentif bulanan setiap driver: cup terjual per segmen tier, bonus produk, potongan terlambat / absen dari Master Schedule, minimal kehadiran.</>,
        <>Skema diatur tim COTR dan berversi per bulan mulai berlaku.</>,
        <>Simulator untuk mencoba skema sebelum dipakai.</>,
      ]} />,
    },
    {
      id: 'cotrx-master', title: 'Master (urutan pengisian)',
      body: <Table head={['Tab', 'Isinya']} rows={[
        ['Pool / HUB', 'HUB utama, pool di bawahnya tempat driver mulai & reload, dan storage-nya'],
        ['Area', 'Tempat jualan / standby'],
        ['Menu', 'Menu yang dijual driver (urutan tampil di aplikasi), harga, resep (BOM), kategori, alias ESB'],
        ['Fleet & aksesori', 'Armada: jenis, merek, rangka, pool, kapasitas, kondisi, foto, QRIS, surat & servis (peringatan jatuh tempo), cetak label QR'],
        ['Karyawan', 'Foto, penugasan (pool, armada, akun aplikasi driver), kepegawaian; gaji, tunjangan, NIK & rekening untuk superadmin / manajemen COTR'],
        ['Jadwal', 'Template shift dan roster mingguan (shift / off / cuti / sakit), kehadiran vs check in aplikasi, rekap per driver'],
        ['Pengajuan', 'Jenis pengajuan driver'],
      ]} />,
    },
  ],
};

// ------------------------------------------------------------------------------------------------- Aggregator

export const AGG: Part = {
  key: 'agg', get label() { return tr('Aggregator'); }, icon: <Star size={16} />,
  intro: 'Aggregator mengumpulkan rating dan ulasan pelanggan untuk setiap outlet dari Google Maps dan aplikasi delivery.',
  sections: [
    {
      id: 'agg-gmaps', title: 'Google Maps',
      body: <Steps items={[
        <>Setiap outlet Kopi Calf di Google Maps (lewat Places API resmi, sinkron harian 06:10 WIB): rating, jumlah ulasan, buka / tutup sekarang, jam hari ini, ulasan terbaru dari Google (maks. 5 per outlet).</>,
        <>Superadmin & Cost Control dapat menautkan outlet ke tempatnya di Google Maps bila pencocokan otomatis perlu dicek: cari di sekitar outlet, pilih.</>,
        <>Saat sinkron berjalan halaman memuat ulang sendiri sampai selesai.</>,
      ]} />,
    },
    {
      id: 'agg-delivery', title: 'GrabFood, GoFood, ShopeeFood',
      body: <>
        <p className="text-sm text-neutral-700">Rating dan ulasan per outlet di setiap platform delivery. GrabFood juga memantau status buka / tutup / jeda outlet setiap 5 menit dan ketersediaan menu.</p>
        <Note>GoFood dan ShopeeFood sedang dibangun: menu dan aksesnya sudah tersedia, datanya menyusul.</Note>
      </>,
    },
  ],
};

// ------------------------------------------------------------------------------------------------- Management

export const MGMT: Part = {
  key: 'mgmt', get label() { return tr('Management'); }, icon: <Settings size={16} />,
  intro: 'Management untuk superadmin: akun pengguna dan hak aksesnya, serta log aktivitas semua yang dilakukan di portal.',
  sections: [
    ...ADMIN.sections,
    {
      id: 'mg-akun', title: 'User Accounts: fitur lengkap',
      body: <Table head={['Fitur', 'Keterangan']} rows={[
        ['Lini bisnis', 'Akun dan cabang dipisah per lini (Kopi Calf, Wasgee Tea, Calf On The Road)'],
        ['Buat akun', 'Username otomatis dari nama (mis. "okta.fajri"); kredensial akun baru / reset password hanya tampil sekali'],
        ['Role & halaman', 'Role (superadmin, user/PIC, outlet, driver …) menentukan halaman bawaan; bisa ditambah / dikurangi per akun'],
        ['Cabang', 'Cabang ESB setiap brand + lokasi tanpa cabang ESB (HUB WH / CK)'],
        ['Aplikasi', 'Akun role user / outlet memakai aplikasi Operations; driver memakai aplikasi COTR — portal menolak akun yang hanya punya form'],
        ['Aktivitas', 'Buka log aktivitas satu akun langsung dari daftarnya'],
      ]} />,
    },
    {
      id: 'mg-log', title: 'Activity Logs',
      body: <Steps items={[
        <>Siapa melakukan apa dan kapan: login, perubahan data, persetujuan, export.</>,
        <>Daftar terbaru masuk sendiri di atas (diperbarui beberapa detik sekali) dan disorot.</>,
        <>Klik satu entri untuk detail: perangkat & browser, data yang berubah.</>,
        <>Filter per pengguna (juga dari User Accounts) dan per kategori.</>,
      ]} />,
    },
    {
      id: 'mg-profil', title: 'Menu profil: notifikasi, panduan, akun',
      body: <Table head={['Item', 'Fungsi']} rows={[
        ['Notifikasi', 'Peringatan untuk akun dengan akses Good Receipt / COGS (lihat Cost Control → Notifikasi); angka merah = belum dibaca'],
        ['Panduan', 'Halaman ini'],
        ['My profile', 'Nama lengkap, nomor HP, jabatan & departemen, foto'],
        ['Change Password', 'Mengganti kata sandi'],
        ['Appearance & Language', 'Terang / gelap / ikuti sistem; Bahasa Indonesia / English'],
        ['Sign Out', 'Keluar'],
      ]} />,
    },
  ],
};

