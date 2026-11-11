'use client';

// Panduan → Calf On The Road (2026-11-11), Indonesian and English: the daily flow of the pools / HUBs, the masters and
// accounts, the product stock (as the sheet "Product"), assignment, the driver app, monitoring, reports and ESB COTR.

import { Truck } from 'lucide-react';
import { Go, Menu, Note, Part, Steps, Table } from './ui';

export const COTR_ID: Part = {
  key: 'cotr', label: 'Calf On The Road', icon: <Truck size={16} />,
  intro: 'Untuk tim COTR (management, storage / stockist HUB, pool leader) dan super admin: alur harian pool / HUB, data master, stok produk, penugasan ke driver, aplikasi driver, monitoring, laporan dan data ESB COTR.',
  sections: [
    {
      id: 'cotr-alur', title: 'Alur harian (ringkas)',
      body: (
        <>
          <Table head={['Waktu', 'Siapa', 'Di mana', 'Apa']} rows={[
            ['Pagi', 'Storage Centre - Palmerah', 'ESB COTR (Simple Transfer) atau Storage & Produksi → Batches', 'Kirim produk ke setiap HUB. Simple Transfer yang diinput di ESB otomatis menjadi Product Datang (tersinkron setiap 30 menit).'],
            ['Pagi', 'Storage HUB', <Go key="a" href="/cotr/storage">Storage & Penugasan</Go>, 'Cek panel Stok siap di-assign, terima batch bila ada, lalu assign produk ke setiap driver.'],
            ['Pagi', 'Driver', 'Aplikasi Calf On The Road', 'Cek produk yang di-assign → Check In (foto, lokasi, tanda tangan).'],
            ['Siang', 'Driver / Storage HUB', 'Aplikasi driver / Storage & Penugasan', 'Transaksi, reload, pengajuan biaya, permintaan area, laporan kendala armada; storage menyetujui reload.'],
            ['Sore', 'Driver', 'Aplikasi driver', 'Check Out: sisa produk, waste, cupping, uang tunai aktual, operasional.'],
            ['Malam', 'Storage HUB', 'Storage & Penugasan / Stok Produk Pool', 'Catat waste & cupping pool, lalu isi Sisa Aktual Fisik per kode batch. Sisa ini menjadi Product Awal besok.'],
          ]} />
          <Note>Selama masa transisi, pool yang masih memakai spreadsheet cukup mengimpor workbook-nya setiap malam (lihat <b>Import workbook</b>). Jangan mencampur spreadsheet dan aplikasi untuk pool yang sama di hari yang sama.</Note>
        </>
      ),
    },
    {
      id: 'cotr-master', title: 'Data master',
      body: (
        <>
          <p className="text-sm text-neutral-700">Diatur di menu <Go href="/cotr/master">Master</Go> dan halaman master masing-masing.</p>
          <Table head={['Master', 'Isi penting']} rows={[
            [<Go key="p" href="/cotr/pools">Master Pool / HUB</Go>, 'Storage Centre (main hub, produksi) dan HUB (parent pool) beserta alamat, koordinat & radius check in. Kolom Kode branch ESB menghubungkan pool dengan branch di ESB COTR (COTR5 Cipete, KTG Kwitang, PAL Palmerah, PASMI Pasar Minggu, TBT Tebet, HOF Storage Centre).'],
            [<Go key="d" href="/cotr/drivers">Master Driver</Go>, 'Karyawan per pool & departemen, akun aplikasi, dan armada yang dipakai. Data gaji, rekening & NIK hanya untuk Manajemen COTR.'],
            [<Go key="f" href="/cotr/fleet">Master Armada</Go>, 'Armada (BNI / BRI + nomor), pool, plat, QRIS (gambar QR untuk pembayaran), surat & servis, aksesoris, label QR, serta Laporan Kendala dari driver.'],
            [<Go key="m" href="/cotr/menu">Master Menu</Go>, <>Menu, harga, kartu resep dan <b>masa simpan (hari)</b>. Masa simpan menentukan tanggal expired setiap kode batch.</>],
            [<Go key="s" href="/cotr/schedule">Master Jadwal</Go>, 'Roster driver per hari (shift, libur, cuti, sakit), slot area & jam, template shift, dan Permintaan Area dari driver.'],
            ['Area · Jenis pengajuan', 'Tempat jualan driver (alamat & koordinat) dan jenis biaya yang boleh diajukan driver (batas nominal, wajib foto).'],
          ]} />
        </>
      ),
    },
    {
      id: 'cotr-akun', title: 'Akun driver & tim storage',
      body: (
        <Steps items={[
          <><b>Driver</b> memakai akun role <b>driver</b> (username <code>drv.&lt;nama panggilan&gt;</code>) yang terhubung ke Master Driver, dan login di aplikasi Calf On The Road.</>,
          <><b>Tim storage / stockist HUB</b> memakai akun portal (username <code>cotr.&lt;nama panggilan&gt;</code>) yang hanya membuka <Menu>Storage & Penugasan</Menu>; pool leader juga membuka <Menu>Check In Driver</Menu>.</>,
          <>Akun dibuat di <Go href="/users">Akun Pengguna</Go>. Pilih halaman COTR yang dibutuhkan di bagian akses menu; password dibagikan langsung ke orangnya.</>,
        ]} />
      ),
    },
    {
      id: 'cotr-stok', title: 'Stok Produk Pool (seperti sheet Product)',
      body: (
        <>
          <p className="text-sm text-neutral-700"><Go href="/cotr/production">Storage & Produksi</Go> → tab <Menu>Stok Produk Pool</Menu>, juga tampil di Storage & Penugasan. Pilih <b>Semua pool</b> (dijumlahkan) atau satu pool.</p>
          <Table head={['Baris', 'Sumber']} rows={[
            ['Product Awal', 'Sisa Aktual Fisik hari sebelumnya, dikurangi lot yang sudah lewat expired'],
            ['Product Transfer', 'Transfer antar HUB di ESB, atau diisi manual (minus = keluar)'],
            ['Product Datang', 'Simple Transfer dari Storage Centre di ESB, batch yang diterima, atau diisi manual'],
            ['Product Terjual', 'Simple Sales HUB di ESB, atau transaksi driver di aplikasi'],
            ['Waste · Cupping', 'Item Journal WASTING / CUPPING di ESB, check out driver, dan catatan pool'],
            ['Sisa Product (Hasil Hitungan)', 'Product Awal + Transfer + Datang − Terjual − Waste − Cupping'],
            ['Sisa Product (Aktual Fisik)', 'Dihitung tim storage di akhir hari, per kode batch'],
            ['Balance', 'Aktual Fisik − Hasil Hitungan (merah = kurang)'],
          ]} />
          <Note>Satu hari satu sumber, tidak pernah dobel: <b>workbook</b> (bila diimpor) → <b>ESB COTR</b> → <b>aplikasi driver</b>. Badge di setiap hari menunjukkan sumbernya.</Note>
          <Steps items={[
            <><Menu>Sisa Aktual Fisik</Menu>: pilih satu pool, isi jumlah per <b>kode batch</b> setiap menu. Hitungan pertama sebuah pool menjadi stock awalnya.</>,
            <><b>Kode batch SSDD</b> = nomor batch hari itu + tanggal produksi. Contoh <code>0808</code> = batch ke-8 tanggal 8, <code>0407</code> = batch ke-4 tanggal 7. Expired = tanggal produksi + masa simpan menu; lot yang lewat expired ditandai merah dan tidak dibawa ke hari berikutnya.</>,
            <><Menu>Datang / Transfer</Menu>: hanya untuk produk yang tidak tercatat di ESB.</>,
            <><Menu>Import workbook</Menu>: pilih file .xlsx spreadsheet pool (boleh beberapa sekaligus; pool terdeteksi dari nama file) → <b>Cek</b> → <b>Simpan semua</b>. Hari mulai tanggal Dari diganti isi workbook (sheet Product & Report Armada).</>,
            <><Menu>Export Excel</Menu> mengunduh angka per hari & menu beserta kode batch.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'cotr-assign', title: 'Storage & Penugasan: assign ke driver',
      body: (
        <>
          <Steps items={[
            <>Buka <Go href="/cotr/storage">Storage & Penugasan</Go>, pilih pool dan hari. Panel <b>Stok siap di-assign</b> per menu = Product Awal + Datang / Transfer − sudah di-assign + kembali dari driver − waste / cupping pool.</>,
            <>Bila ada kiriman batch dari Storage Centre di aplikasi, tekan <Menu>Terima</Menu> pada bagian stok dari main hub.</>,
            <>Isi jumlah per menu untuk setiap driver (untuk dijual dan untuk cupping); saran jumlah dihitung dari penjualan 14 hari terakhir. Assignment yang melebihi stok pool ditolak.</>,
            <>Driver mengecek produk di aplikasinya. Bila jumlahnya berbeda, driver mengirim selisih dan storage menentukan jumlah final.</>,
            <>Reload dari driver: setujui dengan jumlah yang dikirim (boleh kurang) atau tolak; selisih saat diterima diselesaikan di sini.</>,
            <>Catat <Menu>Waste & Cupping</Menu> pool (menu dalam cup, item stok, atau barang lain) beserta alasannya.</>,
          ]} />
          <Note>Assignment hanya bisa diubah selama driver belum menerima. Pool yang belum punya Sisa Aktual Fisik tidak dibatasi stoknya.</Note>
        </>
      ),
    },
    {
      id: 'cotr-driver', title: 'Aplikasi driver',
      body: (
        <Table head={['Menu', 'Fungsi']} rows={[
          ['Beranda · Check In', 'Cek produk yang di-assign, lalu check in dengan foto, lokasi dan tanda tangan. Lokasi dibagikan selama shift.'],
          ['Transaksi', 'Catat setiap penjualan (Tunai / QRIS); salah input bisa dibatalkan dengan alasan.'],
          ['Reload', 'Minta produk tambahan ke pool, lalu cek saat produk datang.'],
          ['Pengajuan', 'Biaya di jalan (BBM, es batu, parkir, …) dengan nominal, keterangan dan foto nota.'],
          ['Area', 'Minta area tujuan dari Master Area atau usulkan tempat baru (nama, alamat, titik GPS) beserta jamnya.'],
          ['Laporan Armada', 'Laporkan kendala armada (rem, baterai, ban, cooler, …) dengan tingkat, foto dan lokasi; ikuti status penanganannya.'],
          ['Check Out', 'Hitung sisa, waste, cupping, uang tunai aktual dan biaya operasional; penjualan yang belum tercatat bisa dijadikan rekap.'],
        ]} />
      ),
    },
    {
      id: 'cotr-monitor', title: 'Monitoring: check in, area, kendala armada',
      body: (
        <Steps items={[
          <><Go href="/cotr/check-in">Check In Driver</Go>: shift setiap driver hari itu, penjualan, potongan, uang tunai, stok, reload, pengajuan dan posisi di peta. Pengajuan biaya disetujui atau ditolak di sini.</>,
          <><Go href="/cotr/schedule">Master Jadwal</Go> → tab <Menu>Permintaan Area</Menu>: setujui permintaan driver (tempat baru otomatis masuk Master Area dan roster hari itu mengikuti jamnya) atau tolak dengan alasan.</>,
          <><Go href="/cotr/fleet">Master Armada</Go> → <Menu>Laporan Kendala</Menu>: tangani laporan driver (nama bengkel / teknisi), selesaikan dengan pekerjaan & biaya, atau tolak dengan alasan. Setiap langkah tercatat dan terlihat oleh driver.</>,
        ]} />
      ),
    },
    {
      id: 'cotr-laporan', title: 'Report Armada & Kode Batch',
      body: (
        <Steps items={[
          <><Menu>Report Armada</Menu>: per driver dan hari, setiap menu <b>B</b> (bawa) · <b>S</b> (sisa) · <b>C</b> (cupping) · <b>W</b> (waste) · <b>T</b> (terjual), total Rp, QRIS, tunai, uang tunai aktual dan operasional. Hari sebelum aplikasi dipakai berasal dari workbook. Bisa Export Excel.</>,
          <><Menu>Kode Batch</Menu>: setiap kode batch yang dihitung di pool beserta tanggal produksi, expired, status (Aktif / Expired) dan sisa per pool. Klik angka pool untuk <b>mengoreksi</b> qty batch di hitungan terakhirnya (wajib alasan, tercatat di Activity Logs).</>,
        ]} />
      ),
    },
    {
      id: 'cotr-produksi', title: 'Produksi, bahan baku & rencana',
      body: (
        <Table head={['Tab Storage & Produksi', 'Fungsi']} rows={[
          ['Stock · Goods In · Stock Opname', 'Stok bahan baku per pool / hub dari stock opname terakhir + barang masuk − pemakaian batch − waste.'],
          ['Items · Recipe Cards · Calculator', 'Item bahan baku, kartu resep menu & premix, kalkulator produksi.'],
          ['Batches', 'Produksi di Storage Centre (tanggal produksi & expired, nomor batch otomatis) dan pengirimannya ke pool.'],
          ['Production Plan', 'Rencana produksi dari rata-rata penjualan nyata (aplikasi, ESB, workbook) ditambah buffer.'],
          ['Usage', 'Pemakaian bahan baku secara teori dari penjualan, waste dan cupping melalui kartu resep.'],
          ['Waste & Cupping', 'Waste (storage, produksi) dan cupping semua pool / HUB.'],
        ]} />
      ),
    },
    {
      id: 'cotr-esb', title: 'ESB COTR',
      body: (
        <>
          <p className="text-sm text-neutral-700">Company ESB <b>Calf COTR (CALF5)</b> tersinkron otomatis: dokumen setiap 30 menit, data master dua kali sehari. Lihat di <Go href="/cotr/production">Storage & Produksi</Go> → tab <Menu>ESB COTR</Menu>.</p>
          <Table head={['Modul ESB', 'Dipakai untuk']} rows={[
            ['Simple Sales', 'Product Terjual setiap HUB'],
            ['Simple Transfer', 'Product Datang (dari Storage Palmerah) dan Product Transfer (antar HUB)'],
            ['Item Journal (CUPPING / WASTING)', 'Cupping dan waste setiap HUB'],
            ['Simple Manufacturing, Stock Opname, Purchase, Goods Receipt / Delivery, Sales Order / Invoice, Receipt, Memorial Journal', 'Ditampilkan apa adanya: daftar, detail baris, Export Excel'],
          ]} />
          <Note>Hanya produk jadi “… - COTR” yang dihitung sebagai menu; premix dan bahan baku tidak. Input di ESB cukup sekali, aplikasi mengikuti dalam 30 menit.</Note>
        </>
      ),
    },
  ],
};

export const COTR_EN: Part = {
  key: 'cotr', label: 'Calf On The Road', icon: <Truck size={16} />,
  intro: 'For the COTR team (management, HUB storage / stockist, pool leaders) and super admins: the daily flow of the pools / HUBs, masters, product stock, assignment to the drivers, the driver app, monitoring, reports and the ESB COTR data.',
  sections: [
    {
      id: 'cotr-alur', title: 'Daily flow (short)',
      body: (
        <>
          <Table head={['When', 'Who', 'Where', 'What']} rows={[
            ['Morning', 'Storage Centre - Palmerah', 'ESB COTR (Simple Transfer) or Storage & Production → Batches', 'Send the products to every HUB. A Simple Transfer entered in ESB becomes Product Arrived by itself (synced every 30 minutes).'],
            ['Morning', 'HUB storage', <Go key="a" href="/cotr/storage">Storage & Assignment</Go>, 'Check Stock ready to assign, receive the batches if any, then assign the products to every driver.'],
            ['Morning', 'Driver', 'Calf On The Road app', 'Check the products assigned → Check In (photo, location, signature).'],
            ['Day', 'Driver / HUB storage', 'Driver app / Storage & Assignment', 'Sales, reloads, cost requests, area requests, fleet issues; the storage approves the reloads.'],
            ['Evening', 'Driver', 'Driver app', 'Check Out: leftover, waste, cupping, actual cash, operational costs.'],
            ['Night', 'HUB storage', 'Storage & Assignment / Pool Product Stock', 'Record the waste & cupping of the pool, then the Physical Leftover per batch code. It is the opening stock of the next day.'],
          ]} />
          <Note>During the transition a pool still on the spreadsheet imports its workbook every night (see <b>Import workbook</b>). Never mix the spreadsheet and the app for one pool on one day.</Note>
        </>
      ),
    },
    {
      id: 'cotr-master', title: 'Masters',
      body: (
        <Table head={['Master', 'What matters']} rows={[
          [<Go key="p" href="/cotr/pools">Master Pool / HUB</Go>, 'The Storage Centre (main hub, production) and the HUBs (parent pools) with address, coordinates & check-in radius. ESB branch code ties a pool to its branch in ESB COTR (COTR5 Cipete, KTG Kwitang, PAL Palmerah, PASMI Pasar Minggu, TBT Tebet, HOF Storage Centre).'],
          [<Go key="d" href="/cotr/drivers">Master Driver</Go>, 'Employees per pool & department, app account and armada. Salary, bank and NIK for COTR Management only.'],
          [<Go key="f" href="/cotr/fleet">Master Fleet</Go>, 'Armada (BNI / BRI + number), pool, plate, QRIS image for payments, papers & service, accessories, QR labels, and the Issues the drivers report.'],
          [<Go key="m" href="/cotr/menu">Master Menu</Go>, <>Menus, prices, recipe cards and the <b>shelf life (days)</b>, which sets the expiry of every batch code.</>],
          [<Go key="s" href="/cotr/schedule">Master Schedule</Go>, 'Roster per day (shift, off, leave, sick), area slots & times, shift templates, and the drivers’ Area Requests.'],
          ['Area · Request kinds', 'Where the drivers sell (address & coordinates) and the costs a driver may ask (limit, photo).'],
        ]} />
      ),
    },
    {
      id: 'cotr-akun', title: 'Driver and storage accounts',
      body: (
        <Steps items={[
          <><b>Drivers</b> use a <b>driver</b> account (username <code>drv.&lt;nickname&gt;</code>) tied to Master Driver and sign in to the Calf On The Road app.</>,
          <><b>HUB storage / stockist</b> use a portal account (username <code>cotr.&lt;nickname&gt;</code>) that opens <Menu>Storage & Assignment</Menu> only; pool leaders also open <Menu>Driver Check In</Menu>.</>,
          <>Accounts are made in <Go href="/users">User Accounts</Go>: tick the COTR pages needed; hand the password to the person.</>,
        ]} />
      ),
    },
    {
      id: 'cotr-stok', title: 'Pool Product Stock (as the sheet Product)',
      body: (
        <>
          <p className="text-sm text-neutral-700"><Go href="/cotr/production">Storage & Production</Go> → <Menu>Pool Product Stock</Menu>, also on Storage & Assignment. Choose <b>All pools</b> (added up) or one pool.</p>
          <Table head={['Row', 'Source']} rows={[
            ['Opening Stock', 'The physical leftover of the day before, less the lots past their expiry'],
            ['Product Transfer', 'Transfers between HUBs in ESB, or entered (minus = out)'],
            ['Product Arrived', 'Simple Transfers from the Storage Centre in ESB, batches received, or entered'],
            ['Product Sold', 'Simple Sales of the HUB in ESB, or the drivers’ sales in the app'],
            ['Waste · Cupping', 'Item Journals WASTING / CUPPING in ESB, the drivers’ check out and the pool'],
            ['Leftover (Calculated)', 'Opening + Transfer + Arrived − Sold − Waste − Cupping'],
            ['Leftover (Physical)', 'Counted by the storage team at the end of the day, per batch code'],
            ['Balance', 'Physical − Calculated (red = short)'],
          ]} />
          <Note>One source a day, never two: the <b>workbook</b> (when imported) → <b>ESB COTR</b> → <b>the driver app</b>. A badge on every day shows which.</Note>
          <Steps items={[
            <><Menu>Physical leftover</Menu>: choose one pool and enter the cups per <b>batch code</b> of every menu. The first count of a pool is its opening stock.</>,
            <><b>Batch code SSDD</b> = the batch of the day + the day it was made: <code>0808</code> = batch 8 of the 8th, <code>0407</code> = batch 4 of the 7th. Expiry = production day + the shelf life of the menu; expired lots are red and not carried to the next day.</>,
            <><Menu>Arrived / Transfer</Menu>: only for products not in ESB.</>,
            <><Menu>Import workbook</Menu>: choose the .xlsx of the pool spreadsheets (several at once; the pool comes from the file name) → <b>Check</b> → <b>Save all</b>. The days from the From date are replaced by the workbook (sheets Product & Report Armada).</>,
            <><Menu>Export Excel</Menu> downloads the figures per day & menu with the batch codes.</>,
          ]} />
        </>
      ),
    },
    {
      id: 'cotr-assign', title: 'Storage & Assignment: assigning the drivers',
      body: (
        <>
          <Steps items={[
            <>Open <Go href="/cotr/storage">Storage & Assignment</Go>, choose the pool and day. <b>Stock ready to assign</b> per menu = opening + arrived / transfer − given to the drivers + back − waste / cupping of the pool.</>,
            <>Batches sent by the Storage Centre in the app: <Menu>Receive</Menu> them in the stock from the main hub.</>,
            <>Enter the cups per menu of every driver (to sell and for cupping); the advice comes from the last 14 days of sales. An assignment above the pool stock is refused.</>,
            <>The driver checks the products in the app; a difference comes back and the storage sets the final cups.</>,
            <>Reloads: approve with the cups sent (fewer when short) or reject; a difference on arrival is settled here.</>,
            <>Record the <Menu>Waste & Cupping</Menu> of the pool (a menu in cups, a stock item, or another thing) with the reason.</>,
          ]} />
          <Note>An assignment changes until the driver accepts it. A pool without a physical leftover yet is not limited.</Note>
        </>
      ),
    },
    {
      id: 'cotr-driver', title: 'The driver app',
      body: (
        <Table head={['Menu', 'What it does']} rows={[
          ['Home · Check In', 'Check the products assigned, then check in with a photo, the location and a signature. The location is shared during the shift.'],
          ['Sales', 'Every sale (Cash / QRIS); a wrong entry is voided with a reason.'],
          ['Reload', 'Ask the pool for more products, then check them on arrival.'],
          ['Requests', 'Costs on the road (fuel, ice, parking, …) with the amount, a note and the receipt photo.'],
          ['Area', 'Ask for an area of Master Area, or a new place (name, address, GPS point), with the times.'],
          ['Fleet Issues', 'Report an issue of the armada (brake, battery, tyre, cooler, …) with severity, photo and location; follow its handling.'],
          ['Check Out', 'Count the leftover, waste, cupping, actual cash and operational costs; sales not tapped in can be booked as a recap.'],
        ]} />
      ),
    },
    {
      id: 'cotr-monitor', title: 'Monitoring: check ins, areas, fleet issues',
      body: (
        <Steps items={[
          <><Go href="/cotr/check-in">Driver Check In</Go>: the shift of every driver of the day, sales, deductions, cash, stock, reloads, requests and the map. Cost requests are approved or rejected here.</>,
          <><Go href="/cotr/schedule">Master Schedule</Go> → <Menu>Area Requests</Menu>: approve (a new place becomes a master area and the roster of the day follows its times) or reject with a reason.</>,
          <><Go href="/cotr/fleet">Master Fleet</Go> → <Menu>Issues</Menu>: handle (workshop / technician), resolve with the work & cost, or reject with a reason. Every step is logged and shown to the driver.</>,
        ]} />
      ),
    },
    {
      id: 'cotr-laporan', title: 'Report Armada & Batch Codes',
      body: (
        <Steps items={[
          <><Menu>Report Armada</Menu>: per driver and day, every menu <b>B</b> (brought) · <b>S</b> (left) · <b>C</b> (cupping) · <b>W</b> (waste) · <b>T</b> (sold), the total, QRIS, cash, actual cash and operational costs. Days before the app come from the workbooks. Export Excel.</>,
          <><Menu>Batch Codes</Menu>: every batch code counted at the pools with its production day, expiry, status (Active / Expired) and the cups per pool. Click a pool figure to <b>adjust</b> the cups of the batch at its last count (a reason is required, logged in Activity Logs).</>,
        ]} />
      ),
    },
    {
      id: 'cotr-produksi', title: 'Production, raw materials & plan',
      body: (
        <Table head={['Tab of Storage & Production', 'What it does']} rows={[
          ['Stock · Goods In · Stock Opname', 'Raw stock per pool / hub from the latest stock opname + goods in − used by the batches − waste.'],
          ['Items · Recipe Cards · Calculator', 'Raw items, recipe cards of the menus & premixes, production calculator.'],
          ['Batches', 'Production at the Storage Centre (produced / expires, automatic batch number) and its parts sent to the pools.'],
          ['Production Plan', 'The plan from the real sales (app, ESB, workbooks) plus a buffer.'],
          ['Usage', 'Theoretical use of the raw materials from sales, waste and cupping through the recipe cards.'],
          ['Waste & Cupping', 'Waste (storage, production) and cupping of every pool / HUB.'],
        ]} />
      ),
    },
    {
      id: 'cotr-esb', title: 'ESB COTR',
      body: (
        <>
          <p className="text-sm text-neutral-700">The ESB company <b>Calf COTR (CALF5)</b> is synced by itself: documents every 30 minutes, masters twice a day. See <Go href="/cotr/production">Storage & Production</Go> → <Menu>ESB COTR</Menu>.</p>
          <Table head={['ESB module', 'Used for']} rows={[
            ['Simple Sales', 'Product Sold of every HUB'],
            ['Simple Transfer', 'Product Arrived (from Storage Palmerah) and Product Transfer (between HUBs)'],
            ['Item Journal (CUPPING / WASTING)', 'Cupping and waste of every HUB'],
            ['Simple Manufacturing, Stock Opname, Purchase, Goods Receipt / Delivery, Sales Order / Invoice, Receipt, Memorial Journal', 'Shown as they are: list, lines, Export Excel'],
          ]} />
          <Note>Only the finished products “… - COTR” count as menus; premixes and raw materials do not. Enter in ESB once: the app follows within 30 minutes.</Note>
        </>
      ),
    },
  ],
};
