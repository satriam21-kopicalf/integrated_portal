'use client';

// Panduan / Guide (2026-11-13): one tab per module of the sidebar — Dashboard, Sales Transactions, Form, Cost Control,
// Operations, Calf On The Road, Aggregator, Management — and in it every menu: what it is for, what the page holds, how
// to use it and what to watch. One source for both languages: the prose is written twice (L / S: Indonesian, English)
// and every button, tab or menu name goes through tr() with the label of the screen, so the guide names what the user
// sees in either language. Checked against the pages on 13 Nov 2026: update it with a page when its screen changes.

import { Bike, Calculator, ClipboardList, Gauge, LayoutDashboard, Receipt, Settings, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { tr } from '@/lib/i18n';
import { Go, Menu, Note, Part, Steps, Table } from './ui';

export type GuideLang = 'id' | 'en';

export const PAGE = {
  id: { title: 'Panduan', subtitle: 'Cara memakai setiap menu portal, dikelompokkan per modul seperti di sidebar', toc: 'Daftar isi' },
  en: { title: 'Guide', subtitle: 'How to use every menu of the portal, grouped per module as in the sidebar', toc: 'Contents' },
};

/** A button, tab or menu as the screen labels it (in the portal language). */
const B = ({ t }: { t: string }) => <Menu>{tr(t)}</Menu>;
/** A page of the portal, named as in the sidebar. */
const P = ({ href, t }: { href: string; t: string }) => <Go href={href}>{tr(t)}</Go>;

export type GuideKey = 'dash' | 'sales' | 'form' | 'cc' | 'ops' | 'cotr' | 'agg' | 'mgmt';

export function guideParts(lang: GuideLang): Record<GuideKey, Part> {
  const L = (id: ReactNode, en: ReactNode) => (lang === 'en' ? en : id);
  const S = (id: string, en: string) => (lang === 'en' ? en : id);

  // ----------------------------------------------------------------------------------------------- Dashboard
  const DASH: Part = {
    key: 'dash', label: tr('Dashboard'), icon: <LayoutDashboard size={16} />,
    intro: S('Ringkasan penjualan semua outlet dari POS ESB: hari ini yang terus bergerak, tren, menu, jam ramai, channel, pembayaran, potongan dan pajak. Semua angka mengikuti brand dan filter yang dipilih.',
      'A summary of the sales of every outlet from the ESB POS: today as it happens, trends, menus, busy hours, channels, payments, deductions and tax. Every figure follows the brand and the filters chosen.'),
    sections: [
      {
        id: 'dash-filter', title: S('Brand dan filter', 'Brand and filters'),
        body: <>
          <Steps items={[
            L(<>Pilih <b>brand</b> di atas halaman (Kopi Calf / Wasgee Tea). Semua angka hanya untuk brand itu. Tab <b>Calf On The Road</b> terisi bila penjualan COTR sudah ada.</>,
              <>Choose the <b>brand</b> at the top (Kopi Calf / Wasgee Tea). Every figure is of that brand only. The <b>Calf On The Road</b> tab fills once COTR sales exist.</>),
            L(<>Buka <B t="Filters" />. <b>Periode</b>: {tr('Today')}, {tr('Yesterday')}, {tr('Last 7 Days')}, {tr('Last 30 Days')}, {tr('Last 90 Days')}, {tr('This Month')}, {tr('Last Month')}, {tr('This Year')} atau {tr('Custom range')}; atau <B t="Compare two days" />.</>,
              <>Open <B t="Filters" />. <b>Period</b>: {tr('Today')}, {tr('Yesterday')}, {tr('Last 7 Days')}, {tr('Last 30 Days')}, {tr('Last 90 Days')}, {tr('This Month')}, {tr('Last Month')}, {tr('This Year')} or {tr('Custom range')}; or <B t="Compare two days" />.</>),
            L(<><b>{tr('Compare with')}</b>: {tr('Same Weekday Last Week')} (bawaan — Jumat dibanding Jumat), {tr('Same Dates Last Month')}, {tr('Same Dates Last Year')} atau {tr('Custom Dates')}. Semua angka &quot;vs&quot; di halaman mengikuti pilihan ini.</>,
              <><b>{tr('Compare with')}</b>: {tr('Same Weekday Last Week')} (the default — Friday against Friday), {tr('Same Dates Last Month')}, {tr('Same Dates Last Year')} or {tr('Custom Dates')}. Every &quot;vs&quot; figure of the page follows it.</>),
            L(<><b>{tr('Branches')}</b> (cari, {tr('Select all')}) dan <b>{tr('Channels')}</b>: tidak ada channel dicentang = semua channel. Filter berlaku untuk semua grafik.</>,
              <><b>{tr('Branches')}</b> (search, {tr('Select all')}) and <b>{tr('Channels')}</b>: no channel ticked = every channel. The filters apply to every chart.</>),
            L(<>Filter tersimpan di alamat halaman: salin link untuk membagikan tampilan yang sama.</>, <>The filters live in the page address: copy the link to share the same view.</>),
          ]} />
          <Note>{L(<>Data sebelum Agustus 2025 tidak punya pembanding. Bila periode dan pembandingnya berbeda jumlah hari, bandingkan angka per hari, bukan totalnya.</>,
            <>There is no comparison before August 2025. When the period and its comparison differ in days, compare the per-day figures, not the totals.</>)}</Note>
        </>,
      },
      {
        id: 'dash-isi', title: S('Isi Dashboard', 'What the Dashboard holds'),
        body: <Table head={[S('Bagian', 'Part'), S('Isinya', 'What it shows'), S('Gunanya', 'Use')]} rows={[
          [S('Ringkasan', 'Summary'), S('Sales, Nett Sales, Bills, Average Order Value, masing-masing dengan perubahan vs pembanding', 'Sales, Nett Sales, Bills, Average Order Value, each with its change against the comparison'), S('Kondisi periode sekali lihat', 'The period at a glance')],
          [S('Live sales', 'Live sales'), S('Bill hari ini yang baru masuk, dibanding saat yang sama di hari yang sama minggu lalu', 'Today\'s bills as they arrive, against the same moment of the same weekday last week'), S('Memantau hari berjalan (ESB tersinkron ±15 menit sekali pada jam operasional)', 'Follow the day (ESB synced about every 15 minutes in trading hours)')],
          [S('Tren & pertumbuhan', 'Trend & growth'), S('Per jam / hari / bulan, kumulatif, pertumbuhan per bucket (biru naik, merah turun)', 'Per hour / day / month, cumulative, growth per bucket (blue up, red down)'), S('Melihat arah penjualan', 'See where sales go')],
          [S('Harian & bulanan', 'Daily & monthly'), S('Per hari (akhir pekan lebih gelap); per bulan dengan MoM, YoY dan same-store growth', 'Per day (weekends darker); per month with MoM, YoY and same-store growth'), S('Membandingkan bulan secara adil', 'Compare months fairly')],
          [S('Jam ramai', 'Busy hours'), S('Peta jam ramai dan pertumbuhan per jam', 'Busy-hour map and growth per hour'), S('Jadwal kru & stok jam sibuk', 'Crew schedules and busy-hour stock')],
          [S('Menu', 'Menus'), S('Menu & kategori terlaris, kontribusi, harga rata-rata, add-on', 'Best menus & categories, contribution, average price, add-ons'), S('Menu yang naik / turun', 'Menus rising / falling')],
          [S('Channel & pembayaran', 'Channels & payments'), S('Porsi channel (offline vs aplikasi delivery), metode bayar, cashless', 'Channel mix (offline vs delivery apps), payment methods, cashless'), S('Cara pelanggan membeli', 'How customers buy')],
          [S('Basket & potongan', 'Basket & deductions'), S('Isi keranjang, potongan offline vs online', 'Basket, deductions offline vs online'), S('Mengontrol potongan', 'Control deductions')],
          [S('Pajak / PB1', 'Tax / PB1'), S('Pajak bill dine-in & takeaway: total & tarif, per hari, per channel, per cabang (cabang tanpa pajak dipisah)', 'Tax of dine-in & takeaway bills: total & rate, per day, channel and branch (branches without tax apart)'), S('Rekonsiliasi pajak', 'Tax reconciliation')],
          [S('Cabang', 'Branches'), S('10 cabang teratas periode ini vs pembanding, cabang yang perlu dicek', 'Top 10 branches this period vs the comparison, branches to review'), S('Membandingkan outlet', 'Compare outlets')],
        ]} />,
      },
      {
        id: 'dash-detail', title: S('Melihat rincian', 'Details'),
        body: <Steps items={[
          L(<>Tekan <B t="Details" /> pada kartu untuk membuka rinciannya (tabel lengkap, tab tampilan).</>, <>Press <B t="Details" /> on a card for its breakdown (full table, view tabs).</>),
          L(<>Arahkan kursor (HP: ketuk) ke grafik untuk angka tiap titik.</>, <>Hover (phone: tap) a chart for the figure of every point.</>),
        ]} />,
      },
    ],
  };

  // ----------------------------------------------------------------------------------------------- Sales Transactions
  const SALES: Part = {
    key: 'sales', label: tr('Sales Transactions'), icon: <Receipt size={16} />,
    intro: S('Setiap transaksi POS ESB per bill dan per menu, dengan ringkasan yang sama dengan laporan ESB "Sales Recapitulation Detail Report". Halaman terbuka pada hari ini (WIB) untuk brand yang dipilih.',
      'Every ESB POS transaction per bill and menu, with a summary equal to ESB\'s "Sales Recapitulation Detail Report". The page opens on today (WIB) for the brand chosen.'),
    sections: [
      {
        id: 'sales-ringkasan', title: tr('Sales Summary'),
        body: <Table head={[S('Angka', 'Figure'), S('Arti', 'Meaning')]} rows={[
          [tr('Gross sales'), S('Subtotal penjualan sebelum potongan, jumlah transaksi dan rata-rata per transaksi', 'Sales subtotal before deductions, transactions and the average per transaction')],
          [tr('Nett Sales'), S('Setelah potongan, sama dengan laporan ESB', 'After deductions, equal to the ESB report')],
          [tr('Deductions'), S('Diskon, promo dan potongan lain', 'Discounts, promotions and other deductions')],
          [tr('Void & Cancelled'), S('Bill yang di-void / dibatalkan', 'Voided / cancelled bills')],
          [tr('Other cost'), S('Bill non-penjualan (cupping, waste, compliment, QC), dipisah dari penjualan', 'Non-sales bills (cupping, waste, compliment, QC), apart from sales')],
          [tr('Open Bills'), S('Bill yang belum ditutup', 'Bills not closed yet')],
        ]} />,
      },
      {
        id: 'sales-cari', title: S('Mencari & mengunduh transaksi', 'Finding & downloading transactions'),
        body: <Steps items={[
          L(<>Pilih periode cepat ({tr('Today')}, {tr('Last 7 Days')}, {tr('Last 30 Days')}, {tr('Last 90 Days')}, {tr('Month to Date')}, {tr('Last Month')}) atau tanggal sendiri, lalu cabang.</>,
            <>Pick a quick period ({tr('Today')}, {tr('Last 7 Days')}, {tr('Last 30 Days')}, {tr('Last 90 Days')}, {tr('Month to Date')}, {tr('Last Month')}) or your own dates, then the branch.</>),
          L(<>Pilih jenis: {tr('Sales')}, {tr('Void & Cancelled')}, {tr('Other Cost')} atau {tr('All Transactions')}.</>, <>Choose the type: {tr('Sales')}, {tr('Void & Cancelled')}, {tr('Other Cost')} or {tr('All Transactions')}.</>),
          L(<>Cari nomor sales, nomor bill atau nama cabang.</>, <>Search a sales number, bill number or branch.</>),
          L(<>Setiap baris: bill & status, cabang & pembayaran, menu, harga dan total item. <B t="Load more" /> untuk halaman berikutnya.</>,
            <>Every row: bill & status, branch & payment, menu, price and item total. <B t="Load more" /> for the next page.</>),
          L(<>Data baru tersinkron: halaman pertama diperbarui sendiri; bila Anda sedang di halaman lanjutan muncul <B t="Show latest" />.</>,
            <>New data synced: the first page refreshes by itself; on a later page <B t="Show latest" /> appears.</>),
          L(<>Tombol unduh mengekspor transaksi sesuai filter.</>, <>The download button exports the transactions of the filters.</>),
        ]} />,
      },
    ],
  };

  // ----------------------------------------------------------------------------------------------- Form
  const FORM: Part = {
    key: 'form', label: tr('Form'), icon: <ClipboardList size={16} />,
    intro: S('Semua isian outlet, HUB, PIC dan tim lapangan. Semua bisa dipakai di HP (PWA); waktu selalu WIB. Akun outlet dan PIC mengisinya di aplikasi Operations dengan layar yang sama.',
      'Everything the outlets, HUBs, PICs and field teams fill in. Every form works on a phone (PWA); times are always WIB. Outlet and PIC accounts fill them in the Operations app on the same screens.'),
    sections: [
      {
        id: 'so-hari', title: S('Stock Opname: hari ini & memulai', 'Stock Opname: today & starting'),
        body: <>
          <Steps items={[
            L(<>Buka <P href="/stock-opname" t="Stock Opname" />. Bagian hari ini menampilkan SO yang dijadwalkan Cost Control untuk setiap cabang Anda: jam hitung (WIB), isi daftar, hitungan terakhir. Bila belum ada SO, tampil SO berikutnya dengan hitung mundur, checklist persiapan (cek kamera & lokasi) dan jadwal dua minggu.</>,
              <>Open <P href="/stock-opname" t="Stock Opname" />. Today shows the counts Cost Control scheduled for each of your branches: the count window (WIB), what the list holds, the last count. With nothing due it shows the next count with a countdown, a preparation checklist (camera & location check) and the next two weeks.</>),
            L(<>Tekan <B t="Start Stock Opname" /> setelah jam hitung dibuka (sebelumnya ditolak). Izinkan lokasi: posisi GPS baru wajib. Bila akurasi lebih buruk dari 100 m, pindah dekat jendela / ke luar lalu coba lagi, atau <B t="Start Anyway" /> (SO ditandai akurasi rendah).</>,
              <>Press <B t="Start Stock Opname" /> once the window opens (refused before). Allow location: a fresh GPS fix is required. When it is worse than 100 m, move near a window / outside and try again, or <B t="Start Anyway" /> (the count is marked low accuracy).</>),
            L(<>Memulai di luar radius outlet tetap bisa, tetapi ditandai untuk Cost Control.</>, <>Starting outside the outlet radius works but is flagged for Cost Control.</>),
          ]} />
          <Note>{L(<>Jadwal, jam dan isi daftar diatur Cost Control (Count Types, Count Lists, Items Groups). SO yang terlambat tetap diterima tetapi ditandai <b>{tr('Late')}</b>. Hitungan ulang yang diminta Cost Control tampil sebagai pemberitahuan kuning di halaman ini.</>,
            <>Schedules, windows and lists are set by Cost Control (Count Types, Count Lists, Items Groups). A late count is accepted but marked <b>{tr('Late')}</b>. Recounts Cost Control asks for show as an amber notice on this page.</>)}</Note>
        </>,
      },
      {
        id: 'so-isi', title: S('Stock Opname: mengisi hitungan', 'Stock Opname: counting'),
        body: <Steps items={[
          L(<>Item dikelompokkan per area. Isi <b>satu angka dalam satuan di kolomnya</b> (GR, PCS, PACK@100PCS, ROLL@1000PCS …). Item yang tidak ada diisi <b>0</b> (HP: tombol 0 cepat; tombol Next pindah ke item berikutnya).</>,
            <>Items are grouped per area. Enter <b>one quantity in the unit of its column</b> (GR, PCS, PACK@100PCS, ROLL@1000PCS …). An item not there gets <b>0</b> (phone: the quick 0; the Next key moves on).</>),
          L(<>Baris tersimpan saat Anda pindah ({tr('Saved')}). Hitung buta: stok sistem tidak ditampilkan.</>, <>A line is saved when you leave it ({tr('Saved')}). Blind count: the system stock is not shown.</>),
          L(<>Item dengan beberapa tanggal roasted / expired: tombol (+) di sebelah tanggal menambah baris; jumlahnya dijumlahkan.</>, <>An item with several roasted / expired dates: (+) beside the date adds rows; they are summed.</>),
          L(<>Tanda <b>{tr('Check')}</b>: lebih dari 3× lebih tinggi atau lebih rendah dari hitungan terakhir yang disetujui. Cek ulang sebelum kirim.</>, <>The <b>{tr('Check')}</b> mark: more than 3× higher or lower than the last approved count. Check it before sending.</>),
          L(<>Excel: selama SO terbuka, unduh format impor, isi, lalu impor (pratinjau perubahan dulu). Setelah dikirim, ekspor isi yang terkirim.</>, <>Excel: while open, download the import format, fill it and import it (a preview of the changes first). After sending, export what was sent.</>),
        ]} />,
      },
      {
        id: 'so-wip', title: S('Stock Opname: WIP / premix', 'Stock Opname: WIP / premix'),
        body: <>
          <Steps items={[
            L(<>Isi setiap WIP dalam satuan yang diatur Cost Control: premix, cream, saus ditimbang dalam gram; WIP porsi dalam porsi (mis. Base Puding); WIP satuan dalam pcs. Satuan lain resep atau gram bisa dipilih.</>,
              <>Enter every WIP in the unit Cost Control set: premixes, creams, sauces weighed in grams; a portioned WIP in portions (e.g. Base Puding); a piece WIP in pieces. Another unit of the recipe or grams can be picked.</>),
            L(<>Gram setiap bahan dihitung dari resep dan terisi ke baris bahannya (tidak perlu diisi manual).</>, <>The grams of every ingredient follow from the recipe and fill its line (no manual entry).</>),
            L(<>Tekan <B t="Save WIP" /> — <b>wajib sekali sebelum kirim</b>, kosong atau 0 bila tidak ada WIP.</>, <>Press <B t="Save WIP" /> — <b>required once before sending</b>, empty or 0 when there is none.</>),
          ]} />
          <Note>{L(<>Jangan hitung bahan yang sudah tercampur di premix pada baris bahannya; stok bahan yang terpisah diisi di barisnya dan gram premix ditambahkan.</>,
            <>Do not count an ingredient mixed into a premix on its own line; a separate stock of it goes on its line and the premix grams are added.</>)}</Note>
        </>,
      },
      {
        id: 'so-kirim', title: S('Stock Opname: bukti, tanda tangan & kirim', 'Stock Opname: evidence, signature & submit'),
        body: <>
          <Steps items={[
            L(<>Di akhir form: sampai <b>15 foto</b> (opsional, langsung dari kamera — bukan galeri; dicap cabang, nomor SO, isi foto, jam WIB dan lokasi) dan sampai <b>15 dokumen</b> (PDF, Excel, Word …, maks. 10 MB).</>,
              <>At the end: up to <b>15 photos</b> (optional, from the camera — not the gallery; stamped with branch, count number, subject, WIB time and position) and up to <b>15 documents</b> (PDF, Excel, Word …, 10 MB at most).</>),
            L(<>Tekan <B t="Submit" />: pratinjau semua yang diisi, lalu <b>tanda tangan</b> dengan nama penanda tangan (wajib, juga saat hitung ulang). Kembali untuk mengubah, atau kirim. Lokasi dicatat.</>,
              <>Press <B t="Submit" />: a preview of everything entered, then the <b>signature</b> with the signer’s name (required, a recount too). Go back to change, or send. The position is recorded.</>),
            L(<>Setelah dikirim SO terkunci. Hitung ulang: hanya baris bertanda {tr('Recount')} yang terbuka (WIP: premix yang dipilih Cost Control); angka lama tetap di riwayat.</>,
              <>Once sent the count is locked. A recount opens only the lines marked {tr('Recount')} (WIP: the premixes Cost Control picked); the old figures stay in the history.</>),
            L(<>Setelah disetujui, bukti bisa diunduh: <B t="Evidence PDF" /> dan <B t="Photos (ZIP)" />.</>, <>Once approved the evidence downloads: <B t="Evidence PDF" /> and <B t="Photos (ZIP)" />.</>),
          ]} />
          <Table head={[S('Status', 'Status'), S('Arti', 'Meaning')]} rows={[
            [tr('Not Started'), S('Belum dimulai', 'Not started')], [tr('In Progress'), S('Sedang dihitung', 'Being counted')],
            [tr('Submitted'), S('Menunggu review Cost Control', 'Waiting for the Cost Control review')], [tr('Recount Requested'), S('Diminta hitung ulang baris tertentu', 'Some lines asked again')],
            [tr('Approved'), S('Disetujui, siap diekspor ke ESB', 'Approved, ready for the ESB export')], [tr('Exported to ESB'), S('Sudah masuk file impor ESB', 'In an ESB import file')],
            [tr('Missed'), S('Tidak dihitung pada harinya', 'Not counted on the day')],
          ]} />
        </>,
      },
      {
        id: 'so-masalah', title: S('Stock Opname: masalah umum', 'Stock Opname: common problems'),
        body: <Table head={[S('Masalah', 'Problem'), S('Solusi', 'Solution')]} rows={[
          [S('SO tidak muncul', 'The count does not show'), S('Belum jadwalnya atau cabang belum ditugaskan ke akun Anda: hubungi Cost Control / admin', 'Not scheduled yet or the branch is not assigned to your account: ask Cost Control / the admin')],
          [S('Tombol mulai belum aktif', 'Start is not active'), S('Jam hitung belum dibuka; tombol aktif sendiri saat jamnya', 'The window has not opened; the button turns on by itself')],
          [S('Tidak bisa kirim', 'Cannot submit'), S('Masih ada baris kosong (isi 0) atau WIP belum disimpan — keterangannya ada di bawah tombol', 'Empty lines left (enter 0) or the WIP not saved — the reason shows under the button')],
          [S('Lokasi / kamera tidak terbaca', 'No location / camera'), S('Izinkan lokasi & kamera untuk situs ini (ikon gembok di alamat), pakai Chrome / Safari, lalu coba lagi', 'Allow location & camera for this site (the lock icon in the address bar), use Chrome / Safari, try again')],
          [S('Item tidak ada di daftar', 'An item is missing'), S('Minta Cost Control menambahkannya ke Count Lists / Items Groups', 'Ask Cost Control to add it to the Count Lists / Items Groups')],
        ]} />,
      },
      {
        id: 'form-waste', title: tr('Waste'),
        body: <Steps items={[
          L(<>Buka <P href="/waste" t="Waste" />, pilih cabang. Waste diisi untuk hari ini, atau kemarin bila terlambat.</>, <>Open <P href="/waste" t="Waste" />, choose the branch. Waste is entered for today, or yesterday when late.</>),
          L(<><b>Waste</b>: daftar SKU seperti sheet Waste (nama, kode, satuan, qty). SKU yang diisi meminta kategori waste, catatan, tanggal produksi & expired, dan <b>foto kamera</b> (dicap jam, cabang, item). Satu SKU bisa lebih dari satu kategori: <B t="Another category" />, masing-masing dengan jumlahnya.</>,
            <><b>Waste</b>: the SKU list as the Waste sheet (name, code, unit, qty). A filled SKU asks for the waste category, note, production & expired date and a <b>camera photo</b> (stamped with time, branch, item). One SKU may hold several categories: <B t="Another category" />, each with its quantity.</>),
          L(<><b>Premix</b>: resep WIP lokasi cabang dalam satuan hitungnya; gram bahan dihitung dari resep.</>, <><b>Premix</b>: the WIP recipes of the branch in their count unit; the ingredient grams follow from the recipe.</>),
          L(<><b>Usage Management</b>: jumlah setiap item pemakaian harian dengan kategori dan foto (alasan opsional); disimpan per SKU dan bisa disimpan ulang untuk mengoreksi.</>,
            <><b>Usage Management</b>: the quantity of every daily usage item with its category and photo (reason optional); saved per SKU, saved again to correct.</>),
          L(<>Tidak ada waste hari itu: tekan <B t="No waste today" /> agar laporan harian lengkap.</>, <>No waste that day: press <B t="No waste today" /> so the daily report is complete.</>),
          L(<>Entri bisa dihapus pembuatnya selama belum ditinjau Cost Control.</>, <>An entry can be deleted by its author until Cost Control reviews it.</>),
        ]} />,
      },
      {
        id: 'form-tito', title: tr('Transfer Stock'),
        body: <>
          <Table head={[S('Tab', 'Tab'), S('Fungsi', 'Use')]} rows={[
            [S('Request', 'Request'), S('Meminta bahan dari outlet lain: hanya yang tersedia di sana (SO terakhir dikurangi transfer keluar), maksimal sebanyak yang ada, dengan foto dan tanda tangan', 'Ask another outlet for materials: only what it has (latest SO less transfers out), at most that much, with a photo and signature')],
            [S('My requests', 'My requests'), S('Langkah permintaan Anda; setelah disetujui tekan Receive dengan foto barang — baru saat itu stok kedua outlet bergerak. Yang belum dijawab bisa dibatalkan', 'Your requests and their steps; once approved press Receive with a photo of the goods — only then both stocks move. Unanswered ones can be cancelled')],
            [S('Incoming', 'Incoming'), S('Permintaan ke outlet Anda: terima (stok belum bergerak) atau tolak dengan catatan', 'Requests to your outlet: accept (no stock moves yet) or decline with a note')],
          ]} />
          <Note>{L(<>Alur: diminta → diterima outlet sumber → disetujui approver → diterima dengan foto → stok berpindah di Stock List.</>,
            <>Flow: requested → accepted by the source → approved by the approver → received with a photo → stock moves in the Stock List.</>)}</Note>
        </>,
      },
      {
        id: 'form-checkin', title: S('PIC Check In & Cost Control Clock In', 'PIC Check In & Cost Control Clock In'),
        body: <>
          <Steps items={[
            L(<>Buka <P href="/forms/pic-check-in" t="PIC Check In" /> (PIC) atau <P href="/forms/surveyor-check-in" t="Cost Control Clock In" /> (Cost Control, semua cabang Kopi Calf).</>,
              <>Open <P href="/forms/pic-check-in" t="PIC Check In" /> (PICs) or <P href="/forms/surveyor-check-in" t="Cost Control Clock In" /> (Cost Control, every Kopi Calf branch).</>),
            L(<>Pilih cabang, ambil <b>foto wajah</b> dengan kamera depan (foto tanpa wajah ditolak). Batas check in tepat waktu outlet ditampilkan sebelum check in pertama hari itu.</>,
              <>Choose the branch, take a <b>face photo</b> with the front camera (a photo without a face is refused). The outlet’s on-time deadline shows before the first check in of the day.</>),
            L(<>Posisi GPS dibanding koordinat outlet. Di luar radius: peringatan merah dan <b>alasan wajib</b> — check in ditandai untuk ditinjau manajemen.</>,
              <>The GPS position is compared with the outlet. Outside the radius: a red warning and a <b>required reason</b> — the check in is flagged for management.</>),
            L(<>Satu check in per cabang per hari. Riwayat terakhir ada di form.</>, <>One check in per branch per day. Your latest ones are listed on the form.</>),
          ]} />
          <Note tone="warn">{L(<>Tanda posisi palsu (fake GPS, lompatan, perangkat dimanipulasi) terdeteksi dan ditandai di monitoring.</>, <>Signs of a faked position (fake GPS, a jump, a mocked device) are detected and flagged in monitoring.</>)}</Note>
        </>,
      },
      {
        id: 'form-visit', title: S('Product & Outlet (checklist kunjungan)', 'Product & Outlet (visit checklists)'),
        body: <Steps items={[
          L(<>Buka <P href="/forms/product" t="Product" /> atau <P href="/forms/outlet" t="Outlet" />; outlet diurutkan dari yang terdekat.</>, <>Open <P href="/forms/product" t="Product" /> or <P href="/forms/outlet" t="Outlet" />; outlets are sorted by distance.</>),
          L(<>Setiap butir dinilai <b>UNDER / MEET / EXCEED</b>, dengan catatan dan sampai 3 foto kamera. Butir wajib harus dinilai dengan catatan / foto yang diminta; opsional boleh dilewati. Butir mengikuti grup outlet (CCI, CTG, CTGP).</>,
            <>Rate every item <b>UNDER / MEET / EXCEED</b>, with a note and up to 3 camera photos. Required items need the rating, note and photo asked; optional ones may be skipped. Items follow the outlet group (CCI, CTG, CTGP).</>),
          L(<>Stock Preparation, Espresso dan Beans juga meminta stok dalam gram (berat bersih).</>, <>Stock Preparation, Espresso and Beans also take the stock in grams (net weight).</>),
          L(<>Tersimpan sebagai draft selama diisi; kirim di bawah (posisi ikut). Satu kunjungan per outlet per hari. PIC tidak melihat skor.</>,
            <>Saved as a draft while filled; send at the bottom (with the position). One visit per outlet per day. The PIC never sees a score.</>),
        ]} />,
      },
      {
        id: 'form-wwwr', title: S('WW-WR (audit tim SWAT)', 'WW-WR (SWAT audit)'),
        body: <Steps items={[
          L(<><P href="/forms/wwwr" t="WW-WR" /> menampilkan audit yang dijadwalkan untuk Anda (dari Operations → WW-WR).</>, <><P href="/forms/wwwr" t="WW-WR" /> lists the audits you are scheduled for (from Operations → WW-WR).</>),
          L(<>Pada harinya buka audit: satu kunjungan bersama berisi semua butir Product & Outlet; setiap jawaban tercatat pengisinya. Ketua menambah anggota.</>, <>On its day open the audit: one shared visit with every Product & Outlet item; each answer records who filled it. The lead adds members.</>),
          L(<>Sebelum ketua mengirim: evaluasi umum, action plan (penanggung jawab & tenggat) dan tanggal revisit.</>, <>Before the lead sends it: the general evaluation, action plans (assignee & due date) and the revisit day.</>),
          L(<>Setelah terkirim: action plan ditandai selesai, ketua menutup revisit. Hasil dibagikan ke PIC lewat link (cetak / PDF). Tim tidak melihat skor.</>, <>After sending: action plans are marked done, the lead closes the revisit. The result goes to the PIC by link (print / PDF). The team never sees a score.</>),
        ]} />,
      },
      {
        id: 'form-de', title: tr('Damaged Equipment'),
        body: <Steps items={[
          L(<><P href="/forms/damaged-equipment" t="Damaged Equipment" />: pilih cabang dan jenis — <b>perbaikan</b> (bangunan & alat) atau <b>pengadaan</b> (dekorasi & alat). Permintaan terbuka cabang itu ditampilkan agar tidak dobel.</>,
            <><P href="/forms/damaged-equipment" t="Damaged Equipment" />: choose the branch and kind — <b>repair</b> (building & tools) or <b>procurement</b> (decoration & tools). Open requests of the branch show so nothing is asked twice.</>),
          L(<>Foto dari kamera (dicap) dan satu video ≤ 10 MB; draft tersimpan otomatis. Pratinjau, tanda tangan PIC, kirim — PDF dan link berbagi tersedia.</>, <>Camera photos (stamped) and one video ≤ 10 MB; the draft saves itself. Preview, PIC signature, send — a PDF and a share link follow.</>),
          L(<>Daftar permintaan saya: progres dan catatan tim; selama dikerjakan PIC bisa menambah foto.</>, <>My requests: progress and the team’s notes; while the work runs the PIC can add photos.</>),
          L(<>Serah terima (link dari tim): 1–5 foto, tanda tangan PIC dan tanda tangan vendor bila vendor. Setelah Done, dokumen akhir bisa diunduh.</>, <>Handover (link from the team): 1–5 photos, the PIC’s signature and the vendor’s for a vendor. Once Done the final document downloads.</>),
        ]} />,
      },
      {
        id: 'form-pengajuan', title: tr('Fund Request'),
        body: <>
          <Table head={[S('Jenis', 'Kind'), S('Isinya', 'What it holds')]} rows={[
            [S('Petty cash mingguan', 'Weekly petty cash'), S('Barista, periode, saldo awal (disarankan dari saldo akhir sebelumnya), uang masuk dengan bukti, pengeluaran dengan struk, saldo akhir dan top-up sampai plafon', 'Baristas, period, opening balance (previous closing suggested), money in with proof, expenses with receipts, closing balance and the top-up up to the plafon')],
            [S('Pengajuan anggaran', 'Budget request'), S('Pembelian darurat, marketing, event, tagihan: tujuan, tanggal dibutuhkan, baris dengan estimasi atau struk', 'Emergency purchase, marketing, event, bills: purpose, date needed, lines with an estimate or receipt')],
          ]} />
          <Steps items={[
            L(<>Isi pengaju (barista / PIC, HP) dan rekening. Draft tersimpan; yang masih kurang tampil di atas tombol kirim.</>, <>Fill in who submits (barista / PIC, phone) and the bank account. The draft saves; what is missing shows above Send.</>),
            L(<>Pengajuan yang dikembalikan untuk revisi terbuka lagi di sini dengan catatannya.</>, <>A request sent back for revision opens here again with its notes.</>),
          ]} />
        </>,
      },
    ],
  };

  // ----------------------------------------------------------------------------------------------- Cost Control
  const CC: Part = {
    key: 'cc', label: tr('Cost Control'), icon: <Calculator size={16} />,
    intro: S('Stock opname semua cabang, resep & harga, waste, stok berjalan, transfer antar outlet, penerimaan barang (GR) dan rasio biaya.',
      'Stock opname of every branch, recipes & prices, waste, running stock, transfers between outlets, goods receipts and cost ratios.'),
    sections: [
      {
        id: 'cc-peta', title: S('Peta menu & alur kerja', 'Menus & workflow'),
        body: <>
          <Table head={[S('Grup', 'Group'), S('Menu', 'Menu'), S('Fungsi', 'Use')]} rows={[
            [tr('Stock Opname'), <P key="1" href="/cost-control/monitor" t="Stock Opname Monitor" />, S('Progres semua cabang per hari & jenis SO', 'Progress of every branch per day & count type')],
            ['', <P key="2" href="/cost-control/reviews" t="Stock Opname Review" />, S('Setujui, minta hitung ulang, koreksi', 'Approve, ask a recount, correct')],
            ['', <P key="3" href="/cost-control/reports" t="Stock Opname Report" />, S('Unduh SO yang sudah ditinjau', 'Download the reviewed counts')],
            [tr('Stock Opname Settings'), <P key="4" href="/cost-control/lists" t="Count Lists" />, S('Item per cabang & jenis SO', 'Items per branch & count type')],
            ['', <P key="5" href="/cost-control/groups" t="Items Groups" />, S('Template item untuk banyak cabang', 'Item templates for many branches')],
            ['', <P key="6" href="/cost-control/types" t="Count Types" />, S('Nama, jadwal, jam & kalender', 'Names, schedules, windows & calendar')],
            ['', <P key="7" href="/cost-control/locations" t="Outlet Locations" />, S('Koordinat & radius', 'Coordinates & radius')],
            [tr('Production & Costing'), <P key="8" href="/cost-control/premix" t="Production Calculator" />, S('Resep WIP & kalkulator', 'WIP recipes & calculator')],
            ['', <P key="9" href="/cost-control/sales-calculator" t="Sales Calculator by Menu" />, S('Kartu resep menu, MRP, usage & COGS', 'Menu recipe cards, MRP, usage & COGS')],
            ['', <P key="10" href="/cost-control/pricelist" t="List & Pricelist Items" />, S('Item aktif / nonaktif & harga', 'Items active / inactive & prices')],
            [tr('Waste'), <P key="11" href="/cost-control/waste/monitor" t="Waste Monitor" />, S('Waste semua cabang', 'Waste of every branch')],
            ['', <P key="12" href="/cost-control/waste/reviews" t="Waste Review" />, S('Setujui / tolak / investigasi', 'Approve / reject / investigate')],
            [tr('Monitoring Stock'), <P key="13" href="/cost-control/stock-list" t="Stock List" />, S('Stok per cabang dari SO terakhir', 'Stock per branch from the latest SO')],
            ['', <P key="14" href="/cost-control/stock-transfer" t="Transfer Stock" />, S('Persetujuan transfer, label ESB, export', 'Approve transfers, ESB label, export')],
            [tr('Clock In'), <P key="15" href="/cost-control/check-in" t="Cost Control Clock In" />, S('Kunjungan tim Cost Control', 'Visits of the Cost Control team')],
            [tr('Analytics'), <P key="16" href="/cost-control/ratio" t="Outlet Ratio" />, S('COGS, BB & usage ratio per outlet', 'COGS, BB & usage ratio per outlet')],
            ['', <P key="17" href="/cost-control/goods-receipt" t="Good Receipt" />, S('GR ESB & koreksinya', 'ESB GRs & their corrections')],
            ['', <P key="18" href="/cost-control" t="COGS & Usage" />, S('COGS sistem vs aktual per outlet', 'System vs actual COGS per outlet')],
            ['', <P key="19" href="/cost-control/purchase-plan" t="Purchase Estimate" />, S('Buffer hari & % per outlet, bahan yang perlu dipesan', 'Buffer days & % per outlet, the materials to order')],
            [tr('Information Center'), <P key="20" href="/cost-control/info" t="Information Center" />, S('Kelengkapan & kesegaran data ESB dan Portal', 'How complete & fresh the ESB and Portal data is')],
          ]} />
          <Table head={[S('Kapan', 'When'), S('Yang dilakukan', 'What')]} rows={[
            [S('Sekali / saat berubah', 'Once / on change'), S('Count Types, Count Lists, Items Groups, Outlet Locations, resep WIP, kartu resep menu, Pricelist', 'Count Types, Count Lists, Items Groups, Outlet Locations, WIP recipes, menu recipe cards, Pricelist')],
            [S('Setiap pagi', 'Every morning'), S('Monitor: cabang yang belum / terlambat SO; Notifikasi GR', 'Monitor: branches late / not counted; GR notifications')],
            [S('Setelah SO dikirim', 'After a count is sent'), S('Review: setujui atau minta hitung ulang', 'Review: approve or ask a recount')],
            [S('Harian', 'Daily'), S('Waste Review, Transfer Stock, Good Receipt', 'Waste Review, Transfer Stock, Good Receipt')],
            [S('Antar dua SO / bulanan', 'Between two counts / monthly'), S('COGS & Usage, Outlet Ratio, laporan SO', 'COGS & Usage, Outlet Ratio, count reports')],
          ]} />
        </>,
      },
      {
        id: 'cc-monitor', title: tr('Stock Opname Monitor'),
        body: <Steps items={[
          L(<>Setiap outlet & HUB yang punya SO jatuh tempo pada hari yang dipilih, dengan statusnya dan bar progres hari itu. SO {tr('Daily')} terpisah dari mingguan / bulanan.</>,
            <>Every outlet & hub with a count due on the day chosen, its status and the progress bar of the day. {tr('Daily')} counts apart from weekly / monthly.</>),
          L(<>Tab status (ketuk lagi untuk melepas): {tr('Approved')}, {tr('Submitted')}, {tr('Recount Requested')}, {tr('In Progress')}, {tr('Not Started')}, {tr('Missed')}; lalu jenis SO.</>,
            <>Status tabs (tap again to clear): {tr('Approved')}, {tr('Submitted')}, {tr('Recount Requested')}, {tr('In Progress')}, {tr('Not Started')}, {tr('Missed')}; then the count types.</>),
          L(<>Peringatan lokasi: {tr('Outside Radius')}, {tr('Low GPS accuracy')}, {tr('Outlet Has No Coordinates')}, dan {tr('Submitted late')}.</>, <>Location alerts: {tr('Outside Radius')}, {tr('Low GPS accuracy')}, {tr('Outlet Has No Coordinates')}, and {tr('Submitted late')}.</>),
        ]} />,
      },
      {
        id: 'cc-review', title: tr('Stock Opname Review'),
        body: <>
          <Steps items={[
            L(<>Tab {tr('Waiting for Review')} lebih dulu; status lain bisa dibuka. Urutkan, cari cabang / nomor SO, filter di satu drawer.</>, <>{tr('Waiting for Review')} first; every status on demand. Sort, search a facility / count number, filters in one drawer.</>),
            L(<>Export Excel periode (satu sheet per cabang): yang dikirim cabang, yang menunggu review, semua termasuk yang masih dihitung, atau yang disetujui saja.</>,
              <>Excel of the period (one sheet per branch): what the branches sent, what waits for review, everything incl. counts in progress, or approved only.</>),
            L(<>Buka satu SO: baris dengan tanda & riwayat, bukti, tanda tangan, <B t="Location & Log" /> (lokasi mulai & kirim, jarak ke outlet, log langkah).</>,
              <>Open a count: lines with their marks & history, evidence, signature, <B t="Location & Log" /> (start & submit position, distance, the log).</>),
            L(<><B t="Approve" />, minta <B t="Recount" /> baris tertentu (premix: hanya gramnya), atau <B t="Cancel Count" />.</>, <><B t="Approve" />, ask a <B t="Recount" /> of chosen lines (premix: its grams only), or <B t="Cancel Count" />.</>),
            L(<><B t="Correct" /> jumlah / tanggal dengan <b>alasan wajib</b>, tanpa hitung ulang — angka cabang tetap di riwayat. Bisa juga setelah approve selama belum diekspor ke ESB.</>,
              <><B t="Correct" /> a quantity / date with a <b>required reason</b>, without a recount — the branch’s figure stays in the history. Also after approval while not exported to ESB.</>),
          ]} />
          <Note>{L(<>Peninjau tidak boleh salah satu penghitung SO itu (sistem menolak dan menjelaskan).</>, <>The reviewer cannot be one of the counters (refused with the reason).</>)}</Note>
        </>,
      },
      {
        id: 'cc-report', title: tr('Stock Opname Report'),
        body: <Steps items={[
          L(<>Pilih periode, jenis SO, cabang dan status ({tr('Approved + exported')}, {tr('Approved')}, {tr('Exported')}); SO {tr('Daily')} terpisah. Angka di layar = isi file.</>,
            <>Choose the period, count type, branch and status ({tr('Approved + exported')}, {tr('Approved')}, {tr('Exported')}); {tr('Daily')} counts apart. The figures show what the file holds.</>),
          L(<><B t="Download Report Stock Opname" />: sheet Stock Opname (format Stock Opname Report: satu baris per cabang × item, satuan ESB, qty aktual, harga, nilai), Summary (satu baris per SO), WIP premix, dan {tr('One Sheet per Branch')} atau {tr('Without Branch Sheets')}.</>,
            <><B t="Download Report Stock Opname" />: sheet Stock Opname (Stock Opname Report layout: a row per branch × item, ESB unit, actual qty, price, value), Summary (a row per count), WIP premix, and {tr('One Sheet per Branch')} or {tr('Without Branch Sheets')}.</>),
        ]} />,
      },
      {
        id: 'cc-esb', title: S('Halaman tambahan: isi SO, ekspor & bandingkan ESB', 'Extra pages: enter SO, ESB export & comparison'),
        body: <>
          <Table head={[S('Halaman', 'Page'), S('Fungsi', 'Use')]} rows={[
            [<Go key="e" href="/cost-control/entry">{tr('Enter / import SO')}</Go>, S('Cost Control mengisi SO atas nama cabang, atau mengimpor qty aktual banyak cabang dari file format Stock Opname Report. Hasilnya masuk Review dan disetujui orang lain', 'Cost Control enters a count for a branch, or imports the actual quantities of many branches from a Stock Opname Report file. It goes to Review and someone else approves it')],
            [<Go key="x" href="/cost-control/esb-export">{tr('ESB export')}</Go>, S('SO disetujui satu hari & jenis SO menjadi file "Stock Opname Template" ESB; unduh ulang memberi file yang persis sama', 'Approved counts of one day & count type become one ESB "Stock Opname Template" file; downloading again gives the same file')],
            [<Go key="c" href="/cost-control/esb-compare">{tr('ESB comparison')}</Go>, S('SO yang diekspor dibanding dokumen SO ESB: sudah ada, qty sama, dan selisih qty sistem ESB vs hitungan (nilai)', 'Exported counts against ESB\'s stock opname: present, same quantities, and the variance of ESB system qty vs counted (value)')],
          ]} />
          <Note>{L(<>Ketiga halaman ini tidak ada di menu; buka lewat link di atas (perlu akses halamannya).</>, <>These three pages are not in the menu; open them from the links above (their page access is needed).</>)}</Note>
        </>,
      },
      {
        id: 'cc-types', title: tr('Count Types'),
        body: <Steps items={[
          L(<>Setiap jenis SO: nama (dilihat kru), kode, <b>frekuensi</b> (harian pada hari tertentu, mingguan pada satu hari, bulanan pada tanggal atau {tr('Last Day')}, atau tanggal yang dipilih di kalender), <b>{tr('Count Window')}</b> (WIB), masa berlaku, <b>{tr('ESB Purpose')}</b>, tanggal per item (roasted / expired) dan aktif / nonaktif.</>,
            <>Every count type: name (seen by the crew), code, <b>frequency</b> (daily on chosen days, weekly on a day, monthly on a date or the {tr('Last Day')}, or dates picked on the calendar), the <b>{tr('Count Window')}</b> (WIB), validity, the <b>{tr('ESB Purpose')}</b>, the date per item (roasted / expired) and active / inactive.</>),
          L(<>Atur cepat: {tr('Every Day')}, {tr('Monday to Saturday')}, {tr('Every Monday')}, {tr('Last day of every month')} … dan jendela jam yang umum.</>, <>Quick setups: {tr('Every Day')}, {tr('Monday to Saturday')}, {tr('Every Monday')}, {tr('Last day of every month')} … and common windows.</>),
          L(<>{tr('Calendar Preview')} menampilkan jadwal sebelum disimpan. Jenis SO baru perlu daftar hitung / grup agar muncul di cabang. {tr('ESB Purpose')} harus sama persis dengan purpose di ESB (dipakai di file impor).</>,
            <>The {tr('Calendar Preview')} shows the schedule before saving. A new type needs a list / group to reach the branches. The {tr('ESB Purpose')} must equal the purpose in ESB (used in the import file).</>),
        ]} />,
      },
      {
        id: 'cc-lists', title: S('Count Lists & Items Groups', 'Count Lists & Items Groups'),
        body: <>
          <Steps items={[
            L(<><P href="/cost-control/lists" t="Count Lists" />: setiap tipe fasilitas punya {tr('Default List')} per jenis SO; cabang bisa punya {tr('Own List')} (dari SO ESB atau diedit) yang menggantikan default. Daftar menghitung itemnya sendiri ditambah item dari grupnya.</>,
              <><P href="/cost-control/lists" t="Count Lists" />: every facility type has a {tr('Default List')} per count type; a branch may have an {tr('Own List')} (from its ESB counts or edited) replacing it. A list counts its own items plus those of its item groups.</>),
            L(<><P href="/cost-control/groups" t="Items Groups" />: buat grup (detail → item → cabang), tambah satu kategori atau item satu-satu, pasang ke daftar banyak cabang per jenis SO. Perubahan grup langsung berlaku di semua cabang pemakai; grup nonaktif diabaikan.</>,
              <><P href="/cost-control/groups" t="Items Groups" />: make a group (details → items → branches), add a whole category or single items, assign it to the lists of many branches per count type. A change reaches every branch using it; an inactive group is ignored.</>),
            L(<><B t="Import Template" />: file TEMPLATE SO PER CATEGORY (.xlsx) → periksa → impor; setiap sheet menjadi grup. Produk yang belum ada di master: <B t="Create Item" />.</>,
              <><B t="Import Template" />: the TEMPLATE SO PER CATEGORY file (.xlsx) → check → import; every sheet becomes a group. Products not in the master: <B t="Create Item" />.</>),
          ]} />
          <Note tone="warn">{L(<>Bila cabang punya grup untuk satu jenis SO, form SO cabang itu hanya berisi item grupnya.</>, <>Once a branch has groups for a count type, its count form holds the items of its groups only.</>)}</Note>
        </>,
      },
      {
        id: 'cc-loc', title: tr('Outlet Locations'),
        body: <Steps items={[
          L(<>Koordinat dan {tr('Check-in Radius')} (10–5000 m) setiap outlet & HUB, dipakai untuk lokasi mulai SO dan check in.</>, <>The coordinates and {tr('Check-in Radius')} (10–5000 m) of every outlet & hub, used for the count start and check ins.</>),
          L(<>Isi dengan menempel dari Google Maps (koordinat atau link), <B t="Use the latest stock opname start" /> (cek di peta dulu), atau <B t="Use my position (on site)" />. Setiap perubahan tercatat.</>,
            <>Fill them by pasting from Google Maps (coordinates or a link), <B t="Use the latest stock opname start" /> (check it on the map), or <B t="Use my position (on site)" />. Every change is audited.</>),
        ]} />,
      },
      {
        id: 'cc-premix', title: tr('Production Calculator'),
        body: <Steps items={[
          L(<>Tab <B t="Calculator" />: isi jumlah per WIP & satuan → bahan yang harus disiapkan (gram, dibulatkan ke atas), porsi tiap bahan dan rincian per WIP; <B t="Export to Excel" /> atau salin.</>,
            <><B t="Calculator" />: enter a quantity per WIP & unit → the ingredients to prepare (grams, rounded up), each ingredient’s share and the breakdown per WIP; <B t="Export to Excel" /> or copy.</>),
          L(<>Tab <B t="Recipes" />: <B t="New Recipe" />; isi nama, tipe, lokasi hitung, batch (gram satu pail untuk resep pail), satuan & satuan untuk stock opname (gram per satuan).</>,
            <><B t="Recipes" />: <B t="New Recipe" />; name, type, where it is counted, the batch (grams of one pail for a pail recipe), the units & the unit for the stock opname (grams per unit).</>),
          L(<>Bahan ditambah dari {tr('Item Master')}, {tr('ESB BOM')} atau {tr('Used in Recipes')}, dengan gram per batch. Air: {tr('Not a stock item (water)')}. Bahan {tr('Not mapped')} harus dipetakan ke item stok.</>,
            <>Add components from the {tr('Item Master')}, an {tr('ESB BOM')} or {tr('Used in Recipes')}, with grams per batch. Water: {tr('Not a stock item (water)')}. {tr('Not mapped')} components need their stock item.</>),
          L(<>Perubahan dibuat sebagai {tr('Draft')} → <B t="Save & activate" />. SO lama tetap memakai versi saat dihitung.</>, <>Changes are a {tr('Draft')} → <B t="Save & activate" />. Older counts keep the version they were counted with.</>),
        ]} />,
      },
      {
        id: 'cc-salescalc', title: tr('Sales Calculator by Menu'),
        body: <>
          <Steps items={[
            L(<><b>Recipe Cards</b>: satu porsi menu — bahan & kemasan dari master item, WIP dalam gram, atau item ketik manual; kartu boleh berisi kartu lain (bundling); harga jual per channel dengan % HPP (≤30% sehat, ≤35% dipantau, di atasnya terlalu tinggi).</>,
              <><b>Recipe Cards</b>: one portion of a menu — materials & packaging of the item master, WIP in grams, or typed items; a card may hold other cards (bundles); the list price per channel with the % HPP (≤30% healthy, ≤35% watch, above too high).</>),
            L(<><b>Assign Menus</b>: menu POS ESB yang terjual dan kartu yang dipakai.</>, <><b>Assign Menus</b>: the ESB POS menus sold and the card each uses.</>),
            L(<><b>Additional Items</b>: perlengkapan di luar menu per bill, porsi atau hari outlet.</>, <><b>Additional Items</b>: supplies outside the menus per bill, portion or outlet-day.</>),
            L(<><b>Calculator</b>: Material Required Planning, Usage aktual vs sistem (SO awal + pembelian − SO akhir) dan COGS bahan dari Pricelist.</>, <><b>Calculator</b>: Material Required Planning, actual vs system usage (SO start + purchases − SO end) and material COGS from the Pricelist.</>),
          ]} />
          <Note>{L(<>Dari COGS & Usage, klik nama outlet untuk membuka kalkulator outlet & periode itu.</>, <>From COGS & Usage, click an outlet to open the calculator of that outlet & period.</>)}</Note>
        </>,
      },
      {
        id: 'cc-pricelist', title: tr('List & Pricelist Items'),
        body: <>
          <Steps items={[
            L(<>Setiap item stok: aktif / nonaktif (nonaktif hilang dari form SO dan pemilih item) dan harga per satuan dasar mulai {tr('Valid from')}.</>, <>Every stock item: active / inactive (inactive leaves the count forms and pickers) and its price per base unit from {tr('Valid from')}.</>),
            L(<>Referensi: rata-rata beli 90 hari dan HPP ESB. <B t="Use Purchase Average" /> mengisi item tanpa harga. Isi harga baru, lalu simpan; riwayat di ikon jam.</>,
              <>References: the 90-day purchase average and the ESB HPP. <B t="Use Purchase Average" /> fills the items without a price. Enter new prices and save; history under the clock icon.</>),
            L(<>Panel <b>{tr('Used without a price')}</b>: item yang dipakai kartu resep, WIP atau waste 60 hari tanpa harga — HPP menu & nilai waste-nya kosong. <B t="Set price" /> langsung ke barisnya.</>,
              <>The <b>{tr('Used without a price')}</b> panel: items recipe cards, WIP or 60 days of waste use without a price — their menus’ HPP and waste value stay empty. <B t="Set price" /> jumps to the row.</>),
          ]} />
          <Note>{L(<>Item yang belum pernah punya harga memakai harga pertamanya juga untuk hari-hari sebelum tanggal berlakunya.</>, <>An item that never had a price uses its first price also for the days before it.</>)}</Note>
        </>,
      },
      {
        id: 'cc-waste', title: S('Waste Monitor & Waste Review', 'Waste Monitor & Waste Review'),
        body: <Table head={[S('Fitur', 'Feature'), S('Keterangan', 'What it does')]} rows={[
          [tr('Analysis'), S('Total per item, cabang dan kategori dengan nilai Rp (Pricelist, selain itu HPP ESB)', 'Totals per item, branch and category with the Rp value (Pricelist, else ESB HPP)')],
          [tr('Entries'), S('Setiap entri dengan foto, catatan, pembuat dan nilai; filter cabang, jenis, beberapa kategori sekaligus, status', 'Every entry with photo, note, author and value; filter branch, type, several categories at once, status')],
          [S('Review', 'Review'), S('Centang entri → Approve / Reject (catatan) / Investigate, satu-satu atau sekaligus', 'Tick entries → Approve / Reject (note) / Investigate, one or many')],
          [tr('Change category'), S('Centang beberapa entri → kategori baru & alasan; setiap perubahan tercatat per entri', 'Tick entries → new category & reason; each change logged per entry')],
          [tr('Correct'), S('Satu entri: jumlah / satuan, item, kategori, tanggal, production / expired date, catatan — alasan wajib, riwayat tampil', 'One entry: quantity / unit, item, category, date, production / expired date, note — reason required, history shown')],
          [tr('Investigations'), S('Form FM-QAQC-03 "Investigasi Komplain & Waste" yang bisa dicetak / PDF', 'Form FM-QAQC-03 "Investigasi Komplain & Waste", printable / PDF')],
          [`${tr('Daily Report')} · ${tr('Usage Management')}`, S('Cabang yang melapor waste setiap hari; daftar pemakaian harian', 'Branches that reported each day; the daily usage lists')],
          [tr('Portal vs ESB'), S('Per outlet: waste portal (disetujui / menunggu), item journal ESB, bill waste POS ESB, dan bahan yang sama di hari yang sama di portal & jurnal ESB (mungkin tercatat dua kali)', 'Per outlet: portal waste (approved / waiting), ESB item journals, ESB POS waste bills, and the same material on the same day in the portal & an ESB journal (maybe recorded twice)')],
          [S('Export', 'Export'), S('Excel: entri, per item, laporan harian, Usage Management', 'Excel: entries, per item, daily report, Usage Management')],
        ]} />,
      },
      {
        id: 'cc-stock', title: S('Stock List & Transfer Stock', 'Stock List & Transfer Stock'),
        body: <>
          <Table head={[S('Halaman', 'Page'), S('Isinya', 'What it holds')]} rows={[
            [tr('Stock List'), S(`${tr('Per Branch')} / ${tr('Per Material')}: stok dari SO terakhir di portal (dan SO sebelumnya), transfer masuk / keluar, ${tr('Available')} untuk transfer, ${tr('Estimate Now')} = SO + pergerakan − waste − pemakaian sejak SO, dinilai dengan Pricelist; estimasi di bawah nol = kartu resep atau pergerakan tidak cocok. ${tr('Export to Excel')}.`,
              `${tr('Per Branch')} / ${tr('Per Material')}: stock from the latest portal count (and the one before), transfers in / out, ${tr('Available')} for a transfer, ${tr('Estimate Now')} = SO + moves − waste − usage since the count, valued with the Pricelist; below zero = the cards or the moves do not match. ${tr('Export to Excel')}.`)],
            [tr('Transfer Stock'), S('Setiap transfer dengan langkahnya; approver (Settings) menyetujui / menolak yang sudah diterima outlet sumber; label masuk ESB atau tidak; export transfer, baris, per outlet, per bahan', 'Every transfer and its steps; the approvers (Settings) approve / reject those the source accepted; label whether it goes to ESB; export transfers, lines, per outlet, per material')],
          ]} />
          <Note>{L(<>Stock List berubah segera setelah GR ditandai Selesai, koreksi dokumen ESB disimpan, waste ditinjau / dikoreksi, atau transfer diterima.</>, <>The Stock List moves at once when a GR is marked Finished, an ESB document is corrected, waste is reviewed / corrected or a transfer is received.</>)}</Note>
        </>,
      },
      {
        id: 'cc-ratio', title: tr('Outlet Ratio'),
        body: <>
          <p className="text-sm text-neutral-700">{L(<>Kolom workbook <i>CALF – Rasio Outlet</i> dari data ESB. Pilih {tr('Month')} dan {tr('Period')} (kumulatif W1 1–7 … W4 1–28, atau sebulan); rasio atas gross atau net; <B t="Download Excel" />.</>,
            <>The columns of the workbook <i>CALF – Rasio Outlet</i> from ESB data. Choose the {tr('Month')} and {tr('Period')} (cumulative W1 1–7 … W4 1–28, or the whole month); ratios on gross or net sales; <B t="Download Excel" />.</>)}</p>
          <Table head={[S('Kolom', 'Column'), S('Sumber / rumus', 'Source / formula')]} rows={[
            ['Gross sales', S('Subtotal penjualan POS', 'POS sales subtotal')],
            ['Pendapatan / net', S('Gross × (1 − MDR) bila MDR bulan itu diisi, selain itu Nett Sales ESB', 'Gross × (1 − MDR) when the month\'s MDR is filled, else ESB nett sales')],
            [S('Pembelian BB / Espresso / Dimsum', 'Purchases BB / Espresso / Dimsum'), S('Faktur pembelian dari Calf Warehouse / Central Kitchen / CK Food (yang batal / ditolak tidak dihitung), ditambah koreksi GR', 'Purchase invoices from Calf Warehouse / Central Kitchen / CK Food (cancelled / rejected left out), plus the GR corrections')],
            ['COGS · BB · Espresso ratio', S('BB + Espresso + Dimsum; (BB + Dimsum) ÷ net; Espresso ÷ net', 'BB + Espresso + Dimsum; (BB + Dimsum) ÷ net; Espresso ÷ net')],
            [S('SO awal · akhir · Usage', 'SO start · end · Usage'), S('Nilai dokumen SO ESB H-1 & hari terakhir (atau koreksinya); Usage = COGS + SO awal − SO akhir', 'Value of the ESB count of the day before & the last day (or its correction); Usage = COGS + SO start − SO end')],
            ['Non sales · Item journal', S('Bill other cost · nilai item journal', 'Other-cost bills · item journal value')],
          ]} />
          <Steps items={[
            L(<>Klik nilai SO → isi {tr('Value Used (Rp)')} & {tr('Reason')} → <B t="Save correction" />; <B t="Use the ESB value" /> mengembalikan.</>, <>Click an SO value → {tr('Value Used (Rp)')} & {tr('Reason')} → <B t="Save correction" />; <B t="Use the ESB value" /> restores it.</>),
            L(<>Isi MDR % per outlet (periode dalam satu bulan). Filter cepat: outlet dengan COGS ratio di atas ambang.</>, <>Enter the MDR % per outlet (a period within one month). Quick filter: outlets with a COGS ratio above a threshold.</>),
            L(<><b>{tr('Invoice')}</b> / <b>{tr('GR actual')}</b>: dasar pembelian. {tr('Invoice')} = workbook (faktur per supplier). {tr('GR actual')} = GR + pembelian outlet per kelompok biaya kategori ESB, dengan kolom General Supplies (di luar COGS) dan Transfer (masuk − keluar, dihitung di usage). <B t="Cost groups" />: atur kelompok setiap kategori ESB; yang belum diatur ikut suppliernya.</>,
              <><b>{tr('Invoice')}</b> / <b>{tr('GR actual')}</b>: the purchases basis. {tr('Invoice')} = the workbook (invoices by supplier). {tr('GR actual')} = GRs + outlet purchases by the cost group of their ESB category, with a General Supplies column (outside the COGS) and Transfer (in − out, counted in the usage). <B t="Cost groups" />: set the group of every ESB category; one not set follows its supplier.</>),
            L(<><b>Usage % sales</b> di halaman ini = (pembelian + SO awal − SO akhir) ÷ penjualan, seperti workbook. Berbeda dengan Usage Ratio di COGS & Usage (aktual ÷ resep).</>,
              <><b>Usage % sales</b> here = (purchases + SO start − SO end) ÷ sales, as the workbook. Not the Usage Ratio of COGS & Usage (actual ÷ recipe).</>),
          ]} />
          <Note>{L(<>Faktur tertinggal dari GR: untuk periode berjalan pembelian bisa terlihat lebih kecil. COGS & Usage memakai GR.</>, <>Invoices lag the goods receipts: in a running period purchases may look low. COGS & Usage uses the GRs.</>)}</Note>
        </>,
      },
      {
        id: 'cc-gr', title: tr('Good Receipt'),
        body: <Steps items={[
          L(<>GR ESB per outlet & periode; cari nomor GR / PO / outlet / supplier. Data ESB tidak diubah; angka koreksi tampil di sebelahnya. Maksimal 1.000 GR terbaru per periode — persempit dengan filter.</>,
            <>ESB GRs per outlet & period; search GR / PO / outlet / supplier. ESB is never changed; corrections show beside it. At most the latest 1,000 GRs a period — narrow with the filters.</>),
          L(<>Buka GR → koreksi <b>tanggal terima</b> atau <b>jumlah per baris</b> (satuan barisnya) dengan alasan dan bukti (foto surat jalan / PDF).</>, <>Open a GR → correct the <b>receipt date</b> or a <b>line quantity</b> (its unit) with a reason and evidence (delivery-note photo / PDF).</>),
          L(<>Tandai <b>Selesai</b>: baru saat itu koreksi dihitung di COGS, Sales Calculator dan Stock List. Koreksi setelahnya mengembalikan GR ke draft. Riwayat koreksi disimpan.</>,
            <>Mark it <b>Finished</b>: only then the corrections count in the COGS, Sales Calculator and Stock List. A later correction puts it back to draft. The history is kept.</>),
        ]} />,
      },
      {
        id: 'cc-cogs', title: tr('COGS & Usage'),
        body: <>
          <Table head={[S('Kolom', 'Column'), S('Arti', 'Meaning')]} rows={[
            [tr('COGS System'), S('Pemakaian menurut kartu resep (menu, pilihan, bundling, menu non-penjualan, item tambahan) × harga', 'Usage by the recipe cards (menus, choices, bundles, non-sales menus, additional items) × price')],
            [tr('COGS Actual'), S('SO awal + barang masuk − keluar − SO akhir, × harga', 'SO start + in − out − SO end, × price')],
            [tr('Usage Ratio'), S('Aktual ÷ sistem pada bahan yang sama: ±5% hijau, ±15% kuning, selebihnya merah', 'Actual ÷ system on the same materials: ±5% green, ±15% amber, else red')],
            [`${tr('Actual − System')} · ${tr('Unexplained')}`, S('Selisih; waste yang disetujui menjelaskan sebagian, sisanya tak terjelaskan', 'The difference; approved waste explains part, the rest is unexplained')],
            [tr('Data'), S('Cakupan SO, anomali SO, bahan tanpa harga, SO sudah disetujui atau belum', 'SO coverage, SO anomalies, materials without a price, counts approved or not')],
          ]} />
          <Steps items={[
            L(<>Pilih periode yang <b>mulai pada hari SO</b> dan berakhir sehari sebelum SO berikutnya. Klik outlet untuk Sales Calculator-nya.</>, <>Choose a period <b>starting on a count day</b> and ending the day before the next count. Click an outlet for its Sales Calculator.</>),
            L(<>Panel <b>{tr('Unusual ESB documents')}</b>: baris dokumen ESB outlet (produksi, pembelian outlet, pengiriman, retur, GR) yang ≥20× kebiasaan atau jauh lebih kecil — biasanya salah satuan (KG untuk GR). <B t="Correct" />: isi jumlah yang benar & alasan. Portal memakai jumlah itu, juga bila ESB diperbaiki belakangan; dokumen yang dibatalkan di ESB tidak dihitung. GR dikoreksi di Good Receipt.</>,
              <>The <b>{tr('Unusual ESB documents')}</b> panel: lines of the outlets’ ESB documents (production, outlet purchases, deliveries, returns, GRs) 20× the usual quantity or more, or far less — usually a wrong unit (KG for GR). <B t="Correct" />: the right quantity & a reason. The portal uses it, also when ESB is fixed later; a document cancelled in ESB no longer counts. GRs are corrected in Good Receipt.</>),
          ]} />
        </>,
      },
      {
        id: 'cc-info', title: tr('Information Center'),
        body: <>
          <Steps items={[
            L(<>Satu kartu per sumber data: penjualan ESB, dokumen ESB, kelengkapan data ESB di portal (jumlah dokumen ESB vs portal, dokumen tanpa baris detail, sinkron gagal), SO Portal, waste Portal, GR, harga bahan, kartu resep, Transfer Stock. Setiap kartu menyebut sumbernya (ESB / Portal), statusnya dan halaman untuk memperbaikinya (<B t="Open" />).</>,
              <>One card per data source: ESB sales, ESB documents, how complete the ESB data in the portal is (ESB vs portal document counts, documents without lines, failed syncs), Portal SO, Portal waste, GRs, material prices, recipe cards, Transfer Stock. Every card names its source (ESB / Portal), its status and the page that fixes it (<B t="Open" />).</>),
            L(<><b>{tr('Figures affected')}</b>: COGS, Usage Ratio atau Estimasi Belanja outlet terkait salah sampai diperbaiki. <b>{tr('Check')}</b>: angka masih benar, ada yang menunggu tim. Diperiksa ulang setiap 5 menit.</>,
              <><b>{tr('Figures affected')}</b>: the COGS, Usage Ratio or Purchase Estimate of the outlets concerned are wrong until fixed. <b>{tr('Check')}</b>: the figures hold, something waits for the team. Checked again every 5 minutes.</>),
            L(<>Baris <b>{tr('Data sources')}</b> di bawah judul Outlet Ratio, COGS & Usage, Sales Calculator, Stock List, Good Receipt, Waste, SO dan Estimasi Belanja menunjukkan kartu yang dipakai halaman itu; ketuk untuk membuka Pusat Informasi. Lonceng notifikasi mengirim yang belum baik sekali sehari mulai 09.00.</>,
              <>The <b>{tr('Data sources')}</b> line under the title of Outlet Ratio, COGS & Usage, Sales Calculator, Stock List, Good Receipt, Waste, SO and Purchase Estimate shows the cards that page uses; tap it for the Information Center. The bell sends the ones not good once a day from 09:00.</>),
          ]} />
        </>,
      },
      {
        id: 'cc-purchase-plan', title: tr('Purchase Estimate'),
        body: <>
          <Table head={[S('Bagian', 'Part'), S('Dari mana', 'Where from')]} rows={[
            [tr('Cover days'), S('Median jarak antar GR dari Calf Warehouse / Central Kitchen / CK Food, 56 hari terakhir (kurang dari 3 GR: 7 hari)', 'The median gap between the GRs from Calf Warehouse / Central Kitchen / CK Food, the last 56 days (fewer than 3 GRs: 7 days)')],
            [tr('Loss %'), S('Waste portal yang disetujui ÷ pemakaian sistem 28 hari (paling tinggi 20%); "Sisa produk tidak terjual" tidak dihitung karena itu pesanan berlebih', 'Approved portal waste ÷ the system usage of 28 days (at most 20%); "Sisa produk tidak terjual" is left out: it was ordered too much')],
            [tr('Safety %'), S('Naik-turun penjualan harian outlet untuk buffer hari itu (paling tinggi 30%)', 'The swing of the outlet’s daily sales over its cover days (at most 30%)')],
            [tr('Buffer %'), S('Susut % + pengaman %', 'Loss % + safety %')],
          ]} />
          <Steps items={[
            L(<>Tab <b>{tr('Buffer per outlet')}</b>: rekomendasi setiap outlet dengan angka asalnya. <B t="Set" />: ubah hari / susut / pengaman dengan alasan; kolom kosong tetap rekomendasi; <B t="Back to the recommendation" /> menghapusnya.</>,
              <>The <b>{tr('Buffer per outlet')}</b> tab: every outlet’s recommendation with the figures behind it. <B t="Set" />: change the days / loss / safety with a reason; an empty field stays recommended; <B t="Back to the recommendation" /> removes it.</>),
            L(<>Tab <b>{tr('Estimate')}</b>: per hari × buffer hari × (1 + buffer %) − stok berjalan outlet itu sendiri (bukan stok gabungan), dibulatkan ke kemasan yang biasa diterima outlet. Tanpa outlet: total per outlet.</>,
              <>The <b>{tr('Estimate')}</b> tab: per day × cover days × (1 + buffer %) − the outlet’s own running stock (never the outlets together), rounded up to the pack the outlet usually receives. Without an outlet: the total of every outlet.</>),
            L(<>Tab <b>{tr('Accuracy')}</b>: estimasi 4 minggu lalu dibanding pemakaian sesudahnya; di atas 20% berarti rata-rata belum cocok untuk outlet itu.</>,
              <>The <b>{tr('Accuracy')}</b> tab: the estimate of 4 weeks ago against what was used after; above 20% the average does not fit that outlet yet.</>),
          ]} />
          <Note>{L(<>Material Required Planning di Sales Calculator menjumlahkan stok cabang yang dipilih; untuk belanja per outlet pakai {tr('Purchase Estimate')}.</>, <>The Material Required Planning of the Sales Calculator adds the stock of the chosen branches together; for the purchases of an outlet use the {tr('Purchase Estimate')}.</>)}</Note>
        </>,
      },
      {
        id: 'cc-notif', title: tr('Notifications'),
        body: <>
          <p className="text-sm text-neutral-700">{L(<>Untuk akun dengan akses Good Receipt atau COGS & Usage. Buka profil Anda di kiri bawah sidebar (HP: foto profil kanan atas → profil di bawah menu) → <B t="Notifications" />. Angka merah = belum dibaca. Diperiksa otomatis setiap 30 menit.</>,
            <>For accounts opening Good Receipt or COGS & Usage. Open your profile at the bottom of the sidebar (phone: the avatar top right → your profile at the bottom of the menu) → <B t="Notifications" />. A red number = unread. Checked by itself every 30 minutes.</>)}</p>
          <Table head={[S('Notifikasi', 'Notification'), S('Kapan', 'When')]} rows={[
            [S('Dokumen / GR tidak wajar', 'Unusual document / GR'), S('Jumlah jauh dari kebiasaan dan belum dikoreksi (per baris)', 'A quantity far from usual, not corrected yet (per line)')],
            [S('GR jauh di bawah PO', 'GR far below its PO'), S('Diterima kurang dari 50% PO', 'Received below 50% of the PO')],
            [S('GR masih New', 'GRs still New'), S('Harian: New lebih dari 2 hari (belum masuk Stock List sampai di-authorize di ESB)', 'Daily: New for more than 2 days (outside the Stock List until authorized in ESB)')],
            [S('GR terkoreksi belum Selesai', 'Corrected GRs not finished'), S('Harian: koreksinya belum dihitung', 'Daily: their corrections do not count yet')],
            [S('Ringkasan GR', 'GR summary'), S('Harian mulai 06:00 WIB: GR kemarin dan yang perlu dicek', 'Daily from 06:00 WIB: yesterday\'s GRs and how many need a look')],
          ]} />
          <Note>{L(<>Klik notifikasi untuk membuka dokumennya; <B t="Mark all as read" /> di bawah daftar.</>, <>Click a notification to open its document; <B t="Mark all as read" /> under the list.</>)}</Note>
        </>,
      },
    ],
  };

  // ----------------------------------------------------------------------------------------------- Operations
  const OPS: Part = {
    key: 'ops', label: tr('Operations'), icon: <Gauge size={16} />,
    intro: S('Monitoring semua isian Form untuk manajemen: penilaian PIC, check in, checklist produk & outlet, audit WW-WR, perbaikan alat, pengajuan dana dan grup outlet.',
      'The monitoring of every Form for management: PIC assessment, check ins, product & outlet checklists, WW-WR audits, repairs, fund requests and outlet groups.'),
    sections: [
      {
        id: 'ops-overview', title: S('Overview: skor PIC', 'Overview: PIC score'),
        body: <>
          <p className="text-sm text-neutral-700">{L(<><P href="/monitoring/overview" t="Overview" />: setiap bagian 0–100%; skor = rata-rata berbobot dari bagian yang ada datanya (<B t="How the PIC score is made" />). Lalu hal yang sama per outlet.</>,
            <><P href="/monitoring/overview" t="Overview" />: every part 0–100%; the score = the weighted average of the parts with data (<B t="How the PIC score is made" />). Then the same per outlet.</>)}</p>
          <Table head={[S('Bagian', 'Part'), S('Bobot', 'Weight'), S('Cara hitung', 'How')]} rows={[
            [tr('PIC Check-In'), '15%', S('Check in dalam radius terhadap target harian grup × hari kerja', 'Check ins within the radius against the group\'s daily target × working days')],
            [tr('On Time'), '15%', S('Hari dengan check in pertama sebelum batas outlet (jam outlet); sebelum 05:00 tidak dihitung', 'Days whose first check in is before the outlet deadline (outlet clock); before 05:00 does not count')],
            [tr('Product'), '15%', S('Kunjungan Product sendiri terhadap target dan skornya', 'Own Product visits against the target and their score')],
            [tr('Outlet'), '15%', S('Sama, untuk Outlet', 'The same for Outlet')],
            [S('Kesesuaian SWAT', 'SWAT agreement'), '15%', S('Kesamaan penilaian PIC dengan audit WW-WR', 'How far the PIC\'s ratings agree with the WW-WR audits')],
            [tr('Net Sales'), '25%', S('Rata-rata per hari bulan ini ÷ bulan sebelumnya (maks. 100), dari outlet PIC', 'Average per day this month ÷ the month before (max 100), over the PIC\'s outlets')],
          ]} />
          <Note>{L(<>Hari kerja = pola 6 masuk 1 libur: jumlah hari − (jumlah hari ÷ 7, dibulatkan ke bawah). Aturan lama (sebelum 11:00 WIB) tetap ditampilkan sebagai pembanding.</>,
            <>Working days = a 6-on 1-off pattern: days − (days ÷ 7, rounded down). The old rule (before 11:00 WIB) still shows to compare.</>)}</Note>
        </>,
      },
      {
        id: 'ops-groups', title: tr('Branch Groups'),
        body: <Table head={[S('Tab', 'Tab'), S('Fungsi', 'Use')]} rows={[
          [tr('Groups'), S('Kelas outlet (CCI, CTG, CTGP …); satu outlet satu grup (memilihnya di grup lain memindahkannya); check in PIC per outlet per hari (target bagian PIC Check-In)', 'Outlet classes (CCI, CTG, CTGP …); one group per outlet (picking it elsewhere moves it); PIC check ins per outlet per day (the PIC Check-In target)')],
          [tr('Check-In Deadlines'), S('Batas grup (bawaan CCI 10:00, CTGP 10:15, CTG 10:30; kosong = 11:00), batas khusus per outlet (05:00–14:00) dan zona waktu outlet (WIB / WITA / WIT)', 'Group deadline (CCI 10:00, CTGP 10:15, CTG 10:30 by default; empty = 11:00), an outlet\'s own deadline (05:00–14:00) and its time zone (WIB / WITA / WIT)')],
          [tr('Form Items'), S('Butir Form Product / Outlet yang ditanyakan per grup (juga di WW-WR); butir tak dicentang tidak muncul dan tidak dinilai', 'The Product / Outlet items asked per group (WW-WR too); unticked items do not show and are not scored')],
          [tr('Net Sales'), S('Per outlet: net sales bulan ini, rata-rata per hari berjualan, rata-rata bulan sebelumnya, perbandingan (≥100% hijau, 85–99% kuning, <85% merah)', 'Per outlet: net sales this month, average per selling day, the month before, the comparison (≥100% green, 85–99% amber, <85% red)')],
        ]} />,
      },
      {
        id: 'ops-checkin', title: tr('PIC Check In'),
        body: <Steps items={[
          L(<>Setiap check in periode: siapa, outlet, jam, foto wajah, posisi; diperbarui tiap menit bila periode mencakup hari ini.</>, <>Every check in of the period: who, outlet, time, face photo, position; refreshed every minute when the period includes today.</>),
          L(<>Tiga pemeriksaan: posisi (di outlet / di luar radius dengan jarak / outlet tanpa koordinat), akurasi GPS (rendah bila &gt; 100 m), dan lokasi mencurigakan (fake GPS, lompatan, perangkat dimanipulasi).</>,
            <>Three checks: position (at the outlet / outside the radius with the distance / outlet without coordinates), GPS accuracy (low above 100 m) and suspicious location (fake GPS, a jump, a mocked device).</>),
          L(<>Yang di luar radius / mencurigakan ditonjolkan; manajer menandainya valid atau tidak valid.</>, <>Outside the radius / suspicious ones stand out; a manager marks them valid or not valid.</>),
        ]} />,
      },
      {
        id: 'ops-visit', title: S('Product & Outlet', 'Product & Outlet'),
        body: <Table head={[S('Tab', 'Tab'), S('Isinya', 'What it holds')]} rows={[
          ['Visits', S('Daftar kunjungan; satu kunjungan lengkap: skor, PIC, waktu, posisi, setiap butir dengan nilai, catatan, foto', 'The visits; one in full: score, PIC, time, position, every item with rating, note, photos')],
          [tr('Analysis'), S('Skor per bagian vs target, temuan UNDER terbanyak, outlet skor terendah, bintang per platform', 'Score per section vs target, most frequent UNDER findings, lowest outlets, stars per platform')],
          ['Attendance', S('Per bulan: hari setiap PIC berkunjung dan hari tanpa kunjungan', 'Per month: the days each PIC visited and the days off')],
        ]} />,
      },
      {
        id: 'ops-wwwr', title: 'WW-WR',
        body: <Table head={[S('Tab', 'Tab'), S('Isinya', 'What it holds')]} rows={[
          ['Audits · Analysis', S('Audit terkirim dan analisisnya; tindak lanjut, evaluasi, action plan dan link hasil', 'Audits sent and their analysis; follow-up, evaluation, action plans and the share link')],
          ['Schedule', S('Jadwal audit: outlet, hari, ketua & anggota tim SWAT; buat / ubah / batal', 'Planned audits: outlet, day, lead & members of the SWAT team; new / change / cancel')],
          ['Comparison', S('Setiap audit vs kunjungan Product & Outlet PIC outlet itu 7 hari sebelumnya: kesesuaian, butir yang PIC luluskan tetapi tim temukan UNDER', 'Every audit against the PIC\'s Product & Outlet visits of the 7 days before: agreement, items the PIC passed and the team found UNDER')],
        ]} />,
      },
      {
        id: 'ops-de', title: tr('Damaged Equipment'),
        body: <Table head={[S('Tab', 'Tab'), S('Isinya', 'What it holds')]} rows={[
          ['Requests', S('Tab status & filter, per cabang / PIC. Satu permintaan: estimasi selesai, langkah, Handling (langkah berikutnya & yang kurang, teknisi internal atau vendor, foto kerja lewat link teknisi, serah terima PIC, biaya & invoice, duplikat), isi permintaan, riwayat', 'Status tabs & filters, per branch / PIC. One request: estimated finish, steps, Handling (next step & what is missing, internal technician or vendor, work photos via the technician link, the PIC\'s handover, cost & invoices, duplicates), the request, history')],
          ['Overview · Technicians · Categories', S('Analisis semua permintaan; teknisi; kategori', 'Analysis of every request; technicians; categories')],
        ]} />,
      },
      {
        id: 'ops-pengajuan', title: tr('Fund Request'),
        body: <Steps items={[
          L(<>Tab status (terbuka dulu); <B t="My Turn" /> = menunggu di langkah Anda. Filter periode, grup, outlet, jenis, akun, kategori; export CSV setiap baris.</>, <>Status tabs (open first); <B t="My Turn" /> = waiting at your step. Filters: period, group, outlet, kind, account, category; CSV export of every line.</>),
          L(<>Approver langkah yang menunggu: setujui (persetujuan terakhir menetapkan jumlah), tolak baris tertentu, kembalikan untuk revisi, atau tolak (dengan catatan). Langkah pembayaran mencatat transfer dan buktinya.</>,
            <>The approver of the waiting step: approve (the last approval sets the amount), reject single lines, send back for revision, or reject (with a note). The payment step records the transfer and its proof.</>),
          L(<>Settings: langkah persetujuan per jenis & penggunanya (superadmin), plafon petty cash (superadmin, Finance).</>, <>Settings: the approval steps per kind & their users (superadmin), the petty cash plafon (superadmin, Finance).</>),
        ]} />,
      },
    ],
  };

  // ----------------------------------------------------------------------------------------------- Calf On The Road
  const COTR: Part = {
    key: 'cotr', label: tr('Calf On The Road'), icon: <Bike size={16} />,
    intro: S('Untuk tim COTR (manajemen, storage / stockist HUB, pool leader) dan super admin: alur harian pool / HUB, penugasan driver, produksi, laporan, insentif dan master. Driver memakai aplikasi Calf On The Road (cotr.kopicalf.co.id). Di setiap halaman COTR semua filter ada di satu tombol Filters (baris di bawahnya menunjukkan pilihan) dan daftar panjang tampil 10 baris per halaman.',
      'For the COTR team (management, HUB storage / stockists, pool leaders) and super admins: the daily flow of the pools / HUBs, driver assignment, production, reports, incentives and masters. Drivers use the Calf On The Road app (cotr.kopicalf.co.id). On every COTR page the filters are in one Filters button (the line under it shows what is chosen) and long lists show 10 rows a page.'),
    sections: [
      {
        id: 'cotr-peta', title: S('Peta menu & alur harian', 'Menus & daily flow'),
        body: <>
          <Table head={[S('Grup', 'Group'), S('Menu', 'Menu'), S('Fungsi', 'Use')]} rows={[
            [tr('Daily'), <P key="d" href="/cotr/dashboard" t="Dashboard" />, S('Periode semua pool seperti Dashboard Kopi Calf / Wasgee (cup & nilai, pool, menu, kas vs QRIS, driver terbaik), lalu satu hari: yang menunggu tim, setiap pool dengan sisa vs hitungan dan 14 hari terakhirnya, driver hari itu. Periode dan hari dipilih di Filters (hari terbuka pada hari terakhir yang ada angkanya)', 'The period of every pool as the Kopi Calf / Wasgee Dashboard (cups & value, pools, menus, cash vs QRIS, top drivers), then one day: what waits for the team, every pool with leftover vs calculation and its last 14 days, the drivers of the day. Period and day are chosen in Filters (the day opens on the latest day with figures)')],
            ['', <P key="s" href="/cotr/storage" t="Storage & Assignment" />, S('Penugasan pagi, reload, FIFO, tutup hari', 'Morning assignment, reloads, FIFO, night closing')],
            ['', <P key="c" href="/cotr/check-in" t="Monitoring Armada - Driver" />, S('Shift, lokasi, reload & pengajuan driver', 'Shifts, location, reloads & requests of the drivers')],
            [tr('Production & Stock'), <P key="p" href="/cotr/production" t="Storage & Production" />, S('Stok pool, produksi HUB, laporan & pencocokan, gudang, resep', 'Pool stock, HUB production, reports & matching, warehouse, recipes')],
            [tr('Monthly & Setup'), <P key="i" href="/cotr/incentive" t="Incentive Calculator" />, S('Insentif bulanan & slip gaji', 'Monthly incentives & payslips')],
            ['', <P key="m" href="/cotr/master" t="Master" />, S('Pool / HUB, Area, Menu, Fleet & Accessories, Employees, Schedule, Requests', 'Pool / HUB, Area, Menu, Fleet & Accessories, Employees, Schedule, Requests')],
          ]} />
          <Table head={[S('Waktu', 'When'), S('Siapa', 'Who'), S('Apa', 'What')]} rows={[
            [S('Pagi', 'Morning'), 'Storage Centre', S('Rencana kirim & produksi (Storage & Production → HUB production), batch dikirim ke pool; Simple Transfer ESB terbaca otomatis', 'Shipment & production plan (Storage & Production → HUB production), batches sent to the pools; ESB Simple Transfers are read by themselves')],
            [S('Pagi', 'Morning'), 'Storage HUB', S('Terima batch, assign cup per menu ke setiap driver (Storage & Assignment)', 'Receive batches, assign the cups per menu to every driver (Storage & Assignment)')],
            [S('Pagi', 'Morning'), 'Driver', S('Cek produk yang di-assign, Check In (foto, lokasi, tanda tangan)', 'Check the products assigned, Check In (photo, location, signature)')],
            [S('Siang', 'Day'), S('Driver / storage', 'Driver / storage'), S('Transaksi, reload, pengajuan biaya, permintaan area, laporan armada; storage memutuskan reload', 'Sales, reloads, cost requests, area requests, fleet issues; storage decides the reloads')],
            [S('Sore', 'Evening'), 'Driver', S('Check Out: sisa, waste, cupping, uang tunai, biaya operasional', 'Check Out: leftover, waste, cupping, cash, operational costs')],
            [S('Malam', 'Night'), 'Storage HUB', S('Tutup hari: waste & cupping pool, sisa fisik per kode batch, balance per menu', 'Night closing: pool waste & cupping, physical leftover per batch code, balance per menu')],
          ]} />
        </>,
      },
      {
        id: 'cotr-storage', title: tr('Storage & Assignment'),
        body: <Steps items={[
          L(<>Pilih pool dan hari (akun storage / pool leader hanya pool-nya sendiri). Panel stok siap di-assign dan kiriman batch dari main hub (<b>terima</b> saat datang).</>,
            <>Choose the pool and day (a storage / pool-leader account works on its own pool only). The stock ready to assign and the batches on their way from the main hub (<b>receive</b> them on arrival).</>),
          L(<>Isi cup per menu untuk setiap driver: untuk dijual dan untuk cupping. Saran dari 14 hari kerja driver atau rata-rata pool: <B t="Use advice" />, <B t="Use the advice for all" />, atau <B t="Fill from the last day" />. Assignment melebihi stok pool ditolak; bisa diubah selama driver belum menerima.</>,
            <>Enter the cups per menu for every driver: to sell and for cupping. Advice from the driver’s 14 days worked or the pool average: <B t="Use advice" />, <B t="Use the advice for all" />, or <B t="Fill from the last day" />. More than the pool stock is refused; changeable until the driver accepts.</>),
          L(<>FIFO: kode batch yang diberikan lebih dulu (expired hari ini merah, besok kuning, yang lewat expired dipisah) dan per driver kode batch & jumlahnya.</>,
            <>FIFO: the batch codes to give first (expiring today red, tomorrow amber, expired apart) and per driver which codes and how many cups.</>),
          L(<>Selisih yang dilaporkan driver diselesaikan di sini (jumlah final = stok awal shift). <B t="Reloads to Decide" />: setujui dengan jumlah dikirim (boleh kurang) atau tolak dengan alasan; selisih saat diterima diselesaikan juga di sini.</>,
            <>Differences a driver reports are settled here (the final cups = the start stock of the shift). <B t="Reloads to Decide" />: approve with the cups sent (fewer when short) or reject with a reason; a difference on arrival is settled here too.</>),
          L(<>Malam — <b>tutup hari</b>: setelah semua driver check out dan reload diputuskan: 1) waste & cupping pool, 2) sisa fisik per kode batch, 3) balance per menu (catatan bila tidak 0), lalu hari ditutup. Dibuka lagi dari Storage & Production.</>,
            <>Night — <b>closing</b>: once every driver checked out and the reloads are decided: 1) pool waste & cupping, 2) the physical leftover per batch code, 3) the balance per menu (a note when not 0), then the day closes. Reopened from Storage & Production.</>),
        ]} />,
      },
      {
        id: 'cotr-monitor', title: tr('Monitoring Armada - Driver'),
        body: <Table head={[S('Tab', 'Tab'), S('Isinya', 'What it holds')]} rows={[
          [tr('Shifts'), S('Setiap shift: check in / out dengan foto, lokasi & tanda tangan, stok di armada, penjualan, potongan (cupping, waste), uang tunai yang disetor, selisih stok; karyawan aktif tanpa shift per pool', 'Every shift: check in / out with photo, location & signature, stock on the fleet, sales, deductions (cupping, waste), cash to hand in, stock difference; active employees without a shift per pool')],
          [tr('Location'), S('Posisi GPS driver selama shift terbuka, di peta', 'The drivers\' GPS while the shift is open, on a map')],
          [tr('Reloads'), S('Reload yang menunggu persetujuan', 'Reloads waiting for a decision')],
          [tr('Requests'), S('Pengajuan biaya driver: setujui / tolak', 'Drivers\' cost requests: approve / reject')],
        ]} />,
      },
      {
        id: 'cotr-produksi', title: tr('Storage & Production'),
        body: <>
          <Table head={[S('Grup', 'Group'), S('Tab', 'Tabs'), S('Isinya', 'What it holds')]} rows={[
            [`1 · ${tr('Pool stock')}`, [tr('Pool Product Stock'), tr('Batch Codes'), tr('Waste & Cupping')].join(' · '), S('Stok produk per pool per hari (seperti sheet Product), kode batch dengan expired & sisa per pool (koreksi dengan alasan), waste & cupping pool dan jurnal storage ESB', 'Product stock per pool per day (as the sheet Product), batch codes with expiry & leftover per pool (corrected with a reason), pool waste & cupping and the ESB storage journals')],
            [`2 · ${tr('HUB production')}`, [tr('Production Plan'), tr('Shipment Plan'), tr('Calculator'), tr('Batches')].join(' · '), S('Rencana produksi dari penjualan driver (rata-rata + buffer, turun lewat BOM sampai bahan baku), cup yang dikirim ke tiap pool, kalkulator premix, batch produksi (juga dari Simple Manufacturing ESB) dan pengirimannya', 'Production plan from the drivers\' sales (average + buffer, down the BOMs to raw materials), cups to send each pool, premix calculator, production batches (also from ESB Simple Manufacturing) and their shipments')],
            [`3 · ${tr('Reports & matching')}`, [tr('Report Armada'), tr('Reconciliation'), tr('Cash'), tr('Driver Names'), tr('ESB COTR')].join(' · '), S('Report Armada (B bawa · S sisa · C cupping · W waste · T terjual per driver per menu), workbook vs ESB vs aplikasi per pool-hari-menu, kas per driver per hari, nama driver di workbook yang belum terhubung, dokumen ESB COTR', 'Report Armada (B brought · S left · C cupping · W waste · T sold per driver per menu), workbook vs ESB vs app per pool-day-menu, cash per driver per day, workbook driver names not tied yet, ESB COTR documents')],
            [`4 · ${tr('Storage warehouse')}`, [tr('Stock'), tr('Goods In'), tr('Stock Opname'), tr('Usage')].join(' · '), S('Stok berjalan bahan per pool / hub, barang masuk, stock opname, pemakaian teori', 'Running material stock per pool / hub, goods in, stock opname, theoretical usage')],
            [`5 · ${tr('Recipes & items')}`, [tr('Recipe Cards'), tr('Items')].join(' · '), S('Kartu resep & item COTR (diatur sekali, sama dengan ESB)', 'COTR recipe cards & items (set once, as in ESB)')],
          ]} />
          <Table head={[S('Baris stok pool', 'Pool stock row'), S('Sumber', 'Source')]} rows={[
            [S('Product Awal', 'Opening'), S('Sisa fisik hari sebelumnya, dikurangi lot yang lewat expired', 'The physical leftover of the day before, less the expired lots')],
            [S('Transfer · Datang', 'Transfer · Arrived'), S('Transfer antar HUB / Simple Transfer ESB, batch yang diterima, atau diisi manual', 'Transfers between HUBs / ESB Simple Transfer, batches received, or entered by hand')],
            [S('Terjual', 'Sold'), S('Transaksi driver di aplikasi atau Simple Sales ESB', 'The drivers\' app sales or ESB Simple Sales')],
            [S('Waste · Cupping', 'Waste · Cupping'), S('Check out driver, catatan pool, item journal ESB', 'Driver check outs, pool entries, ESB item journals')],
            [S('Hitungan · Fisik · Balance', 'Calculated · Physical · Balance'), S('Awal + Transfer + Datang − Terjual − Waste − Cupping; sisa fisik per kode batch; Balance = fisik − hitungan', 'Opening + Transfer + Arrived − Sold − Waste − Cupping; physical leftover per batch code; Balance = physical − calculated')],
          ]} />
          <Note>{L(<>Kode batch <b>SSDD</b> = batch ke-SS pada tanggal DD (0808 = batch 8 tanggal 8). Expired = tanggal produksi + masa simpan menu. Panel kesegaran data menunjukkan hari terbaru tiap sumber; <B t="Sync now" /> meminta sinkron ESB COTR (mulai dalam 1 menit, maks. sekali per 10 menit). Export bulanan berisi semua sheet untuk finance.</>,
            <>Batch code <b>SSDD</b> = batch SS of day DD (0808 = batch 8 of the 8th). Expiry = production date + the menu’s shelf life. The freshness panel shows the newest day of every source; <B t="Sync now" /> asks an ESB COTR sync (starts within a minute, at most once per 10 minutes). The monthly export holds every sheet for finance.</>)}</Note>
        </>,
      },
      {
        id: 'cotr-insentif', title: tr('Incentive Calculator'),
        body: <Steps items={[
          L(<>Insentif bulanan setiap driver: cup terjual per tier, bonus produk, potongan terlambat / absen dari jadwal, minimal kehadiran. Skema berversi per bulan mulai berlaku; ada simulator.</>,
            <>Every driver’s monthly incentive: cups sold per tier, product bonus, late / absent deductions from the schedule, minimum attendance. Schemes are versioned by their start month; a simulator tries them.</>),
          L(<>Bonus & potongan (kasbon, minus, peringatan, lain-lain) dengan catatan, lalu slip gaji (gaji pokok + tunjangan + insentif + bonus − potongan = take home pay), cetak / PDF. Setelah bulan dipublikasikan, karyawan melihat slipnya di aplikasi COTR.</>,
            <>Bonus & deductions (kasbon, minus, warning, other) with notes, then the payslip (salary + allowance + incentive + bonus − deductions = take home pay), print / PDF. Once the month is published the employees see their payslips in the COTR app.</>),
        ]} />,
      },
      {
        id: 'cotr-master', title: tr('Master'),
        body: <Table head={[S('Tab', 'Tab'), S('Isinya', 'What it holds')]} rows={[
          [tr('Pool / HUB'), S('HUB utama, pool di bawahnya, storage-nya, alamat, koordinat & radius, kode branch ESB', 'The main HUB, its pools, their storages, address, coordinates & radius, ESB branch code')],
          [tr('Area'), S('Tempat jualan / standby driver', 'Selling / standby places')],
          [tr('Menu'), S('Menu yang dijual (urutan di aplikasi), harga, resep, kategori, masa simpan; produk ESB "… - COTR" dan menu yang dihitungnya', 'Menus sold (app order), price, recipe, category, shelf life; ESB "… - COTR" products and the menu each counts as')],
          [tr('Fleet & Accessories'), S('Armada: jenis, merek, rangka, pool, kapasitas, kondisi, foto, QRIS, surat & servis (peringatan jatuh tempo), label QR; aksesori; laporan kendala dari driver (tangani, selesaikan dengan biaya, atau tolak)', 'Fleet: type, make, frame, pool, capacity, condition, photo, QRIS, papers & service (due warnings), QR labels; accessories; issues from the drivers (handle, resolve with cost, or reject)')],
          [tr('Employees'), S('Foto, penugasan (pool, armada, akun aplikasi), kepegawaian; gaji, tunjangan, NIK & rekening untuk superadmin / manajemen COTR', 'Photo, assignment (pool, fleet, app account), employment; salary, allowance, NIK & bank for superadmins / COTR management')],
          [tr('Schedule'), S('Template shift, roster mingguan (shift / off / cuti / sakit), kehadiran vs check in aplikasi, permintaan area driver (setujui → masuk Master Area & roster, atau tolak)', 'Shift templates, weekly roster (shift / off / leave / sick), attendance vs app check ins, drivers\' area requests (approve → Master Area & roster, or reject)')],
          [tr('Requests'), S('Jenis pengajuan biaya driver (batas nominal, wajib foto)', 'The kinds of driver cost requests (limit, photo required)')],
        ]} />,
      },
      {
        id: 'cotr-app', title: S('Aplikasi driver', 'The driver app'),
        body: <Table head={[S('Menu', 'Menu'), S('Fungsi', 'Use')]} rows={[
          [S('Beranda', 'Home'), S('Shift hari ini, target bulan (cup, insentif, tier berikutnya), stok di armada, lonceng notifikasi (reload, pengajuan, area, kendala diputuskan)', 'Today\'s shift, the month target (cups, incentive, next tier), stock on the fleet, the notification bell (reloads, requests, areas, issues decided)')],
          [S('Cek produk · Check In / Out', 'Check products · Check In / Out'), S('Cek produk dari storage (laporkan selisih), check in dengan foto, lokasi, tanda tangan; check out: sisa, waste, cupping, uang tunai, biaya', 'Check the products from storage (report a difference), check in with photo, location, signature; check out: leftover, waste, cupping, cash, costs')],
          [S('Transaksi', 'Sales'), S('Ketuk menu (+1 / −1 / +5), tunai (kembalian dihitung) atau QRIS; rekap per jam; tanpa sinyal tetap tersimpan dan terkirim saat online', 'Tap menus (+1 / −1 / +5), cash (change computed) or QRIS; recap per hour; without signal saved and sent once online')],
          [S('Reload · Pengajuan · Area · Laporan Armada', 'Reload · Requests · Area · Fleet issues'), S('Minta produk tambahan; biaya di jalan dengan foto nota; minta area / tempat baru; laporkan kendala armada dengan foto & lokasi', 'Ask for more products; road costs with a receipt photo; ask an area / a new place; report a fleet issue with photo & location')],
          [S('Rekap · Slip Gaji', 'Recap · Payslip'), S('Rekap shift dan slip gaji yang sudah dipublikasikan', 'Shift recap and the published payslips')],
        ]} />,
      },
    ],
  };

  // ----------------------------------------------------------------------------------------------- Aggregator
  const AGG: Part = {
    key: 'agg', label: tr('Aggregator'), icon: <Star size={16} />,
    intro: S('Rating, ulasan dan status outlet di Google Maps dan aplikasi delivery.', 'Ratings, reviews and outlet status on Google Maps and the delivery apps.'),
    sections: [
      {
        id: 'agg-gmaps', title: tr('Google Maps'),
        body: <Steps items={[
          L(<>Setiap outlet di Google Maps (Places API resmi, sinkron harian 06:10 WIB): rating, jumlah ulasan, buka / tutup sekarang, jam hari ini, ulasan terbaru (maks. 5 per outlet dari Google).</>,
            <>Every outlet on Google Maps (official Places API, synced daily 06:10 WIB): rating, number of reviews, open / closed now, today’s hours, the latest reviews (at most 5 per outlet from Google).</>),
          L(<>Super admin & Cost Control menautkan outlet ke tempatnya bila pencocokan otomatis perlu dicek (cari di sekitar outlet, pilih).</>, <>Super admins & Cost Control link an outlet to its place when the automatic match needs a check (search near the outlet, pick).</>),
        ]} />,
      },
      {
        id: 'agg-grab', title: tr('GrabFood'),
        body: <>
          <Table head={[S('Tab', 'Tab'), S('Isinya', 'What it holds')]} rows={[
            ['Outlets', S('Status buka / jeda / tutup (dicek tiap 5 menit), rating resmi, foto merchant, ketersediaan menu; detail per outlet', 'Open / paused / closed (checked every 5 minutes), official rating, merchant photo, menu availability; a drawer per outlet')],
            ['Reviews', S('Setiap ulasan; filter outlet, bintang, foto, balasan, periode', 'Every review; filter outlet, stars, photo, reply, period')],
            ['Menu', S('Item & add-on yang habis hari ini atau dimatikan, per outlet (dibaca tiap 30 menit)', 'Items & add-ons out of stock today or switched off, per outlet (read every 30 minutes)')],
          ]} />
          <Note>{L(<>Sesi merchant Grab dan pemetaan outlet ke cabang ESB hanya untuk super admin. GoFood dan ShopeeFood sedang dibangun.</>, <>The Grab merchant session and the outlet-to-branch mapping are for super admins only. GoFood and ShopeeFood are being built.</>)}</Note>
        </>,
      },
    ],
  };

  // ----------------------------------------------------------------------------------------------- Management
  const MGMT: Part = {
    key: 'mgmt', label: tr('Management'), icon: <Settings size={16} />,
    intro: S('Khusus super admin: akun pengguna & aksesnya, dan log aktivitas portal.', 'Super admins only: user accounts & their access, and the activity log of the portal.'),
    sections: [
      {
        id: 'mg-akun', title: tr('User Accounts'),
        body: <>
          <Steps items={[
            L(<><B t="New User" />: nama (username dibuat dari nama), HP, jabatan & departemen, role, cabang, akses halaman, password (<B t="Generate a Strong Password" />; bisa wajib ganti saat login berikutnya). Kredensial baru hanya tampil sekali.</>,
              <><B t="New User" />: name (the username follows from it), phone, job title & department, role, branches, page access, password (<B t="Generate a Strong Password" />; may be required to change at the next sign-in). New credentials show once.</>),
            L(<>Akun dikelompokkan per lini bisnis (Kopi Calf, Wasgee Tea, Calf On The Road). Akun nonaktif tidak bisa login; akun terkunci menampilkan batas waktunya.</>,
              <>Accounts are grouped per business line (Kopi Calf, Wasgee Tea, Calf On The Road). Inactive users cannot sign in; a locked account shows until when.</>),
            L(<><B t="Roles & Pages" />: halaman bawaan setiap role; per akun bisa ditambah / dicabut. Panduan juga halaman yang bisa disembunyikan. <B t="Job Titles & Departments" />: tambah, ganti nama, sembunyikan.</>,
              <><B t="Roles & Pages" />: the default pages of every role; per account they can be added / removed. The Guide is a page too and can be hidden. <B t="Job Titles & Departments" />: add, rename, hide.</>),
          ]} />
          <Table head={[S('Role', 'Role'), S('Untuk', 'For')]} rows={[
            [tr('Super Admin'), S('Semua halaman, termasuk User Accounts & Activity Logs', 'Every page, incl. User Accounts & Activity Logs')],
            [tr('Cost Control'), S('Semua cabang + halaman Cost Control dari role', 'Every branch + the Cost Control pages of the role')],
            [tr('User'), S('PIC: cabang yang ditugaskan; form diisi di aplikasi Operations', 'PICs: assigned branches; forms in the Operations app')],
            [tr('Outlet / Hub'), S('Akun outlet / HUB: SO dan Waste di aplikasi Operations', 'Outlet / HUB accounts: counts and Waste in the Operations app')],
            [tr('Driver (COTR)'), S('Aplikasi Calf On The Road saja', 'The Calf On The Road app only')],
          ]} />
          <Note>{L(<>Portal menolak akun yang hanya punya halaman form (diarahkan ke operations.kopicalf.co.id) dan akun driver (ke cotr.kopicalf.co.id). Setelah akses diubah, pengguna perlu login ulang.</>,
            <>The portal refuses accounts with form pages only (sent to operations.kopicalf.co.id) and driver accounts (sent to cotr.kopicalf.co.id). After access changes the user signs in again.</>)}</Note>
        </>,
      },
      {
        id: 'mg-log', title: tr('Activity Logs'),
        body: <Steps items={[
          L(<>Siapa melakukan apa dan kapan: login (juga yang gagal), perubahan data, persetujuan, export. Aktivitas baru muncul sendiri di atas.</>, <>Who did what and when: sign-ins (failed ones too), data changes, approvals, exports. New activity appears at the top by itself.</>),
          L(<><B t="Filters" />: pengguna, role, cabang, kategori. Ringkasan pengguna paling aktif, login gagal dan export.</>, <><B t="Filters" />: user, role, branch, category. Summary of the most active users, failed sign-ins and exports.</>),
          L(<>Klik entri untuk detail: perangkat & IP, data yang berubah. Dari User Accounts bisa langsung membuka aktivitas satu akun.</>, <>Click an entry for its details: device & IP, what changed. User Accounts opens one account’s activity directly.</>),
        ]} />,
      },
      {
        id: 'mg-profil', title: S('Menu profil', 'Profile menu'),
        body: <Table head={[S('Item', 'Item'), S('Fungsi', 'Use')]} rows={[
          [tr('Notifications'), S('Peringatan GR / dokumen ESB (akses Good Receipt / COGS); angka merah = belum dibaca', 'GR / ESB document alerts (Good Receipt / COGS access); red number = unread')],
          [tr('Guide'), S('Halaman ini', 'This page')],
          [tr('My profile'), S('Foto profil; data pribadi (nama lengkap, jenis kelamin, tanggal lahir, HP, alamat, kota) dan pekerjaan (nomor karyawan, jabatan, departemen, lokasi kerja). Wajib: nama, HP, jabatan, departemen', 'Profile photo; personal (full name, gender, date of birth, phone, address, city) and work (employee number, job title, department, work location). Required: name, phone, job title, department')],
          [tr('Change Password'), S('Mengganti kata sandi', 'Change the password')],
          [`${tr('Appearance')} · ${tr('Language')}`, S('Terang / gelap / sistem; English / Indonesia', 'Light / dark / system; English / Indonesia')],
          [tr('Sign Out'), S('Keluar', 'Sign out')],
        ]} />,
      },
    ],
  };

  return { dash: DASH, sales: SALES, form: FORM, cc: CC, ops: OPS, cotr: COTR, agg: AGG, mgmt: MGMT };
}
