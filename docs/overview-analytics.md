# Overview Analytics — Analisis & Rencana Implementasi

> Halaman: `/overview` (menu **Dashboard**) · Status: **rencana** (halaman saat ini masih placeholder)
> Disusun: 2 Oktober 2026 · Data acuan: `integration_esb.transactions_pos_sales` (7,17 juta transaksi Sales, 9 Jun 2025 – 2 Okt 2026)

**Cakupan: khusus data transaksi penjualan POS** — header transaksi (`transactions_pos_sales`, termasuk payload ESB `raw_data`) dan baris menunya (`raw_data.salesMenus`, setara `transactions_pos_sales_items`). Master data (`master_branches`, `master_pos_menu`) hanya dipakai sebagai **referensi** untuk nama cabang terkini dan kategori add-on, bukan sebagai sumber analitik. Data non-transaksi penjualan (purchase order, produk/BOM, customer B2B) berada di luar cakupan.

Dokumen ini menjawab tiga pertanyaan:

1. **Data apa yang layak dipakai?** Hanya field yang **selalu terisi penuh** (hasil audit, §2).
2. **Analytics apa yang bernilai untuk dibuat?** Rekomendasi berprioritas beserta definisi metrik (§4).
3. **Bagaimana membangunnya?** Desain halaman, arsitektur data, API, dan kriteria uji (§5–§8).

---

## 1. Prinsip

| Prinsip | Konsekuensi |
|---|---|
| **Hanya field yang 100% terisi** di seluruh riwayat | Field yang sebagian kosong (member, kasir, promo, city, dll.) **tidak dipakai** sampai sumbernya lengkap (§2.3). |
| **Angka sama dengan ESB** | Semua metrik "Sales" memakai aturan laporan ESB: `status = 'Finished'` dan `bill_num` terisi. Total Overview harus sama dengan `/api/summary` dan ERP ESB (Sep 2026: 30/30 hari identik). |
| **Tanggal = `sales_date`** (tanggal bisnis ESB, WIB) | Jam pakai `salesDateIn` (jam WIB lokal outlet). |
| **Nilai uang default = Subtotal** | Konsisten dengan angka yang dicocokkan dengan ERP. Nett Sales ditampilkan berdampingan. |
| **Perbandingan selalu sebanding** | Δ vs periode sebelumnya dengan panjang hari yang sama; pertumbuhan jangka panjang memakai *same-store* (cabang yang aktif di kedua periode) karena jumlah cabang bertambah (85 → 105). |

---

## 2. Audit kelengkapan data

Audit dijalankan pada 2 Okt 2026 terhadap **7.171.727** transaksi Sales (seluruh riwayat, dihitung per bulan) dan **3.474.493** baris menu (90 hari terakhir). "Terisi" = tidak null, tidak kosong, bukan `-`.

### 2.1 Field header (per transaksi) — dipakai

| Field (raw_data ESB) | Kolom DB | Terisi | Bulan terendah | Dipakai untuk |
|---|---|---|---|---|
| `salesDate` | `sales_date` | 100% | 100% | Semua tren & filter periode |
| `salesDateIn` | (raw) | 100% | 100% | Jam & hari-jam (heatmap) |
| `branchCode`, `branchName` | `branch_code` | 100% | 100% | Analitik per cabang (nama terkini dari `master_branches`) |
| `visitPurposeName` | `visit_purpose` | 100% | 100% | **Channel**: Dine In, Takeaway, ShopeeFood, GrabFood, GoFood |
| `salesPayments[].paymentMethodName` / `…TypeName` | `payment_method` | 100% | 100% | Mix pembayaran |
| `subtotal`, `grandTotal` | `subtotal`, `total_amount` | 100% | 100% | Nilai penjualan |
| `discountTotal`, `menuDiscountTotal`, `promotionDiscount`, `voucherDiscountTotal` | `nett_sales` (turunan) | 100% | 100% | Nett Sales & diskon |
| `salesMenus` (≥1 baris) | — | 100% | 100% | Analitik menu |
| `statusName` + `billNum` | `status`, `bill_num` | 100% | 100% | Klasifikasi Sales / Void / Other Cost |

### 2.2 Field baris menu — dipakai

| Field | Terisi | Dipakai untuk |
|---|---|---|
| `menuID`, `menuName` | 100% | Menu terlaris (gunakan `menuID` sebagai kunci; nama dari master menu terkini) |
| `menuCategoryName`, `menuCategoryDetailName` | 100% | Mix kategori (BEVERAGE / FOOD / OTHER) dan sub-kategori |
| `qty`, `price`, `total`, `discountValue` | 100% | Volume, nilai, diskon item |
| `salesType` (order mode) | 100% | Order mode (POS Lite, SHOPEEFOOD, GRAB, GOFOOD) |
| `createdDate` | 100% | Jam order per item |
| `packages[]` + `master_pos_menu.categoryDetail` | 100% (semua menu ID ada di master) | Add-on: level gula, add-on minuman, kemasan |

### 2.3 Field yang **tidak** dipakai

| Field | Terisi | Alasan |
|---|---|---|
| `memberCode`, `externalMemberCode`, `visitorTypeName`, `phoneNumber`, `email` | 0% | Tidak ada data member/pelanggan → **analitik pelanggan, retensi, CLV tidak bisa dibuat**. |
| `fullName` (nama pelanggan) | 18% (9–36% per bulan) | Hanya terisi untuk sebagian order delivery. |
| `createdBy` (kasir/waiter) | 46% (38–79%) | Kosong untuk order delivery → performa kasir bias. |
| `promotionName` | 30% | Hanya berisi nama promo platform (`SHOPEEFOOD_INT`, dll.). Gunakan **nominal diskon** (100% terisi). |
| `additionalInfo` | 80% | Teks bebas. |
| `menuCode` / `notes` | 0% / 12% | — |
| City / area cabang (`master_branch_attributes`) | 104/114 cabang | Diisi manual; ditunda (keputusan: City belum dipakai). |
| **Terisi tapi tidak informatif:** `paxTotal` (selalu 1), `tableName` ("Quick Service"), durasi `salesDateIn→Out` (median 0,15 menit), `vatTotal` (56% transaksi harga *inclusive* → pajak tidak sebanding antar transaksi), `otherTaxTotal`/`deliveryCost`/`roundingTotal` (selalu 0) | 100% | Tidak menghasilkan insight; jangan dijadikan metrik. |

> Di luar cakupan (bukan data transaksi penjualan): purchase order (7.600 baris), master produk/BOM, customer B2B.

---

## 3. Gambaran data (30 hari: 2 Sep – 1 Okt 2026)

Angka ini dipakai untuk mengkalibrasi desain (skala axis, jumlah seri, ambang).

| Topik | Temuan |
|---|---|
| Volume | 24.285 bill/hari (20,7 rb – 30,2 rb), Subtotal Rp1,53 M/hari (1,32 – 1,88 M), Nett Sales Rp1,40 M/hari, rata-rata ticket Rp62.985 |
| Hari | Sabtu tertinggi (28,1 rb bill, Rp1,78 M), Senin terendah (22,0 rb, Rp1,38 M) |
| Jam (WIB) | Puncak 09:00–14:00 (8–9,5% bill per jam), puncak kedua 19:00; tutup ±22:00 |
| Channel | ShopeeFood 36% bill / 32% nilai · Dine In 25% / 19% · Takeaway 16% / 13% · GrabFood 12% / 17% · GoFood 11% / 18% |
| Ticket per channel | GoFood Rp103.740 · GrabFood Rp92.460 · ShopeeFood Rp55.645 · Takeaway Rp51.497 · Dine In Rp49.134 |
| Diskon | 8,4% dari subtotal; GoFood 15,3%, ShopeeFood 13,4%, GrabFood 7,8%, walk-in 0% |
| Pembayaran | QRIS 37%, platform delivery 59% (ShopeeFood/Grab/Go), Cash 2,5%, kartu 1,7%; bill multi-pembayaran 0,01% |
| Cabang | 105 aktif; Rp4,3 jt – 41,3 jt/hari per cabang (median Rp12,7 jt); teratas Renon Bali, Jatiwarna, Gor Satria Purwokerto |
| Menu | 164 menu terjual/minggu; BEVERAGE 92,6% nilai, FOOD 7,0%; Es Kopi Calf Premium ±26% nilai menu |
| Basket | 1,63 baris menu & 2,06 qty per bill; 39% bill >1 menu; FOOD hanya ada di 14,7% bill (attach rate ke minuman 13,2%) |
| Add-on | Level gula: Normal 103 rb · Less 78 rb · No 12,5 rb · Extra 6,2 rb (7 hari); add-on espresso, cup frosted, dll. |
| Pengurangan | Other Cost 8.253 bill (Rp392 jt) · Void 3.973 (Rp382 jt) · Cancelled 3.117 (Rp184 jt); void rate per cabang rata-rata 0,95%, P90 1,7%, maks 3,3% |
| Riwayat | Jun 2025 parsial (4 cabang), Jul 2025 ramp-up; data penuh sejak **Agu 2025** → YoY valid mulai **Agu 2026** |

---

## 4. Rekomendasi analytics

Prioritas: **P1** = rilis pertama (menjawab "bagaimana kinerja hari/periode ini"), **P2** = pendalaman, **P3** = opsional. Setiap item hanya memakai field §2.1–2.2.

### P1 — Rilis pertama

| # | Analytics | Pertanyaan bisnis | Definisi metrik | Bentuk visual |
|---|---|---|---|---|
| 1 | **KPI utama** | Berapa penjualan periode ini, naik atau turun? | Sales Subtotal = Σ`subtotal`; Nett Sales = Σ`nett_sales`; Bills = jumlah transaksi; Avg Ticket = Subtotal ÷ Bills. Δ% vs periode sebelumnya (panjang sama). | KPI row 4 stat tile: nilai + Δ% (ikon ▲/▼ + teks, bukan warna saja) + sparkline harian |
| 2 | **Tren penjualan harian** | Bagaimana pola harian, ada anomali? | Subtotal per `sales_date`; garis pembanding = periode sebelumnya (digeser). | Line chart 1 seri utama + seri pembanding abu-abu (emphasis); tooltip crosshair |
| 3 | **Channel mix** | Channel mana yang mendorong penjualan & seberapa mahal diskonnya? | Per `visitPurposeName`: bills, subtotal, % share, avg ticket, diskon % = (subtotal − nett) ÷ subtotal | Stacked bar 100% per hari/minggu (5 seri) **+** tabel channel |
| 4 | **Leaderboard cabang** | Cabang mana yang tumbuh/tertinggal? | Per `branch_code`: subtotal, bills, avg ticket, Δ% vs periode sebelumnya, subtotal per hari aktif | Tabel sortable (top/bottom), sparkline 30 hari per baris; bar horizontal top 10 |
| 5 | **Peta jam sibuk** | Kapan outlet paling ramai (staffing, promo jam sepi)? | Bills per (hari-dalam-minggu × jam `salesDateIn`), rata-rata per hari | Heatmap 7 × 17 (07:00–23:00), skala sekuensial satu warna |

### P2 — Pendalaman

| # | Analytics | Definisi | Bentuk |
|---|---|---|---|
| 6 | **Menu terlaris & kategori** | Per `menuID` (nama terkini): qty, subtotal, % nilai; per kategori/sub-kategori | Bar horizontal top 10 + tabel; stacked bar kategori (3 seri) |
| 7 | **Diskon & promo platform** | Diskon total & % per channel/cabang dari nominal (`discountTotal`, `menuDiscountTotal`, …) — bukan dari `promotionName` | Bar diskon % per channel; tren diskon % harian |
| 8 | **Pengurangan (Void, Cancelled, Other Cost)** | Per cabang/hari: jumlah & nilai; *void rate* = void+cancelled ÷ semua transaksi; Other Cost per metode (CUPPING, WASTE) | Tabel cabang dengan status (normal / perlu cek > P90 1,7%) + tren; status pakai ikon + label |
| 9 | **Tren bulanan & pertumbuhan** | Subtotal per bulan; MoM; **same-store growth** (hanya cabang aktif penuh di kedua bulan); YoY mulai Agu 2026 | Column chart bulanan + tabel growth |
| 10 | **Mix pembayaran** | Per `paymentMethodTypeName` (CARD/CASH/…) dan nama metode | Stacked bar atau tabel (QRIS vs Cash vs platform) |

### P3 — Opsional

| # | Analytics | Definisi | Catatan |
|---|---|---|---|
| 11 | **Basket & cross-sell** | Baris menu per bill, qty per bill, attach rate FOOD pada bill BEVERAGE | Peluang: FOOD baru 13% → pantau dampak bundling |
| 12 | **Preferensi add-on** | Distribusi level gula & add-on dari `packages[]` × master menu | Input R&D/produk (mis. tren Less/No Sugar) |
| 13 | **Order mode × channel** | `salesType` per item vs channel header | Validasi konsistensi data channel |
| 14 | **Matriks cabang × channel** | Share channel per cabang | Identifikasi cabang yang bergantung delivery |

### Tidak direkomendasikan (data tidak memadai)

Segmentasi & retensi pelanggan, member/loyalty, performa kasir/waiter, durasi kunjungan, pax/occupancy, analitik pajak, efektivitas promo per nama promo, analitik regional/city (ditunda sampai City diisi untuk semua cabang).

---

## 5. Desain halaman

### 5.1 Tata letak

Desktop (≥1280 px):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Overview                                   [Period ▾] [Branch ▾] [Channel ▾]│
│ 1 Sep – 30 Sep 2026 · All branches · vs 2 Aug – 31 Aug 2026               │
├──────────────┬──────────────┬──────────────┬──────────────────────────────┤
│ Sales        │ Nett Sales   │ Bills        │ Avg Ticket                    │
│ Rp45,80 M    │ Rp41,93 M    │ 725.354      │ Rp63.135                      │
│ ▲ 0,7%  ~~~  │ ▲ 0,2%  ~~~  │ ▲ 1,8%  ~~~  │ ▼ 1,1%  ~~~                    │
├──────────────────────────────────────────────┬───────────────────────────┤
│ Daily sales (line, vs previous period)       │ Channel mix (100% stacked) │
├──────────────────────────────────────────────┼───────────────────────────┤
│ Branch leaderboard (table + sparkline)       │ Busy hours (heatmap)       │
├──────────────────────────────────────────────┴───────────────────────────┤
│ P2: Top menus · Discounts · Deductions · Monthly growth                   │
└──────────────────────────────────────────────────────────────────────────┘
```

Mobile (<768 px): satu kolom — KPI 2×2 → tren → channel → heatmap (scroll horizontal) → leaderboard sebagai daftar kartu. Filter dalam bottom sheet.

### 5.2 Filter

- **Period**: Today, Yesterday, Last 7 days, Last 30 days (default), This month, Last month, Custom — pola sama dengan `DateRangePicker` di halaman Sales.
- **Branch**: `BranchFilter` yang sudah ada (berdasarkan `branch_code`).
- **Channel**: multi-select 5 channel.
- Semua filter berlaku ke seluruh widget; status filter tersimpan di URL query (`?from=&to=&branch=&channel=`) agar bisa dibagikan.

### 5.3 Aturan visual (mengikuti panduan data-viz)

- **Satu axis per chart** — tidak ada dual-axis (mis. subtotal & bills dipisah ke dua chart).
- **Warna channel tetap per entitas** (tidak berubah walau filter mengurangi seri), urutan palet kategorikal tervalidasi:

  | Channel | Slot | Light | Dark |
  |---|---|---|---|
  | Dine In | 1 | `#2a78d6` | `#3987e5` |
  | ShopeeFood | 2 | `#eb6834` | `#d95926` |
  | GrabFood | 3 | `#1baf7a` | `#199e70` |
  | GoFood | 4 | `#eda100` | `#c98500` |
  | Takeaway | 5 | `#e87ba4` | `#d55181` |

  5 seri → legend wajib + label langsung pada segmen besar. Channel baru dari ESB masuk "Other" (abu-abu), bukan warna baru.
  Palet ini lolos validator (`validate_palette.js`): CVD ΔE adjacent terburuk 9,1 (light) / 8,4 (dark), normal-vision ≥ 19,3. Di mode light tiga slot (GrabFood, GoFood, Takeaway) kontrasnya < 3:1 terhadap surface → **label langsung atau tabel alternatif wajib**, jangan andalkan warna saja.
- **Sekuensial** (heatmap, magnitude): satu hue biru `#cde2fb` → `#0d366b`.
- **Emphasis** untuk pembanding periode: seri utama berwarna, pembanding abu-abu.
- **Status** (void rate) memakai ikon + label, tidak warna saja.
- Setiap chart punya tooltip hover dan alternatif **tabel** (aksesibilitas & export).
- Angka: Rupiah `Rp45,80 M` di tile (ringkas), angka penuh di tooltip/tabel; tanggal `en-GB` seperti halaman Sales; seluruh teks UI bahasa Inggris.

---

## 6. Arsitektur data

### 6.1 Masalah

Agregasi langsung dari `raw_data` (JSONB) mahal: 1 bulan ≈ 40–90 detik, seluruh riwayat > 10 menit. Overview harus < 1 detik.

### 6.2 Solusi: tabel agregat harian di `integration_esb`

Diperbarui oleh engine sinkron (`integrated-esbapi`) **untuk tanggal yang baru disinkron** (setiap jam: hari ini + kemarin; malam: 7 hari), plus backfill sekali untuk seluruh riwayat. Semua sumber field terisi 100% (§2).

| Tabel | Grain (primary key) | Kolom utama | Perkiraan ukuran |
|---|---|---|---|
| `agg_sales_daily` | `sales_date, branch_code, channel, tx_type` | bills, subtotal, nett_sales, grand_total, discount_total, menu_discount, item_qty, menu_lines | ±18,7 rb baris/bulan (±300 rb total) |
| `agg_sales_hourly` | `sales_date, branch_code, channel, hour` | bills, subtotal (hanya `tx_type = sales`) | ≤8 rb baris/hari (105 cabang × 5 channel × ±16 jam) |
| `agg_menu_daily` | `sales_date, branch_code, menu_id, kind` (`menu`/`package`/`extra`) | menu_name, category, category_detail, qty, subtotal, discount | ±10 rb baris/hari |

- `tx_type` ∈ `sales | void | other_cost | open` dengan aturan yang sama seperti backend (`app/esb_report.py` → `TYPE_CONDITIONS`).
- `channel` = `raw_data->>'visitPurposeName'`; `hour` = jam dari `raw_data->>'salesDateIn'`.
- Refresh per tanggal: `DELETE … WHERE sales_date = $d` lalu `INSERT … SELECT … GROUP BY` dalam satu transaksi (idempoten).
- Rekonsiliasi otomatis setelah refresh: Σ`subtotal` (`tx_type = sales`) per hari harus sama dengan agregasi langsung dari `transactions_pos_sales`; selisih dicatat ke log engine.

### 6.3 API backend (`integrated_portal_be`)

Semua menerima `dateFrom`, `dateTo`, `branch` (kode), `channel` (bisa lebih dari satu), dan `compare=previous` (default). Cache 5 menit.

| Endpoint | Isi |
|---|---|
| `GET /api/overview/kpis` | 4 KPI + nilai periode pembanding + seri harian (sparkline) |
| `GET /api/overview/trend?granularity=day\|week\|month` | Seri subtotal/nett/bills + pembanding |
| `GET /api/overview/channels` | Per channel: bills, subtotal, share, avg ticket, diskon %; seri per hari |
| `GET /api/overview/branches` | Leaderboard: per cabang metrik + Δ% + sparkline 30 hari + void rate |
| `GET /api/overview/hourly` | Matriks hari-dalam-minggu × jam (rata-rata bills & subtotal per hari) |
| `GET /api/overview/menus?limit=10` | Top menu, mix kategori, add-on (P2/P3) |
| `GET /api/overview/deductions` | Void/Cancelled/Other Cost per cabang & metode (P2) |

### 6.4 Frontend (`integrated_portal`)

- Halaman `src/app/overview/page.tsx` memakai `DashboardLayout`, `DateRangePicker`, `BranchFilter`, dan util `src/lib/format.ts` yang sudah ada.
- Library chart: **Recharts** (React, SVG, tooltip & responsif bawaan); heatmap cukup grid CSS/SVG sederhana.
- Setiap widget memuat datanya sendiri (skeleton saat loading, state error dengan tombol *Try again*), sehingga satu endpoint lambat tidak memblokir halaman.

---

## 7. Rencana implementasi

| Fase | Pekerjaan | Repo | Estimasi |
|---|---|---|---|
| 0 | Migration `006_overview_aggregates.sql` (3 tabel + index), fungsi refresh per tanggal, backfill Agu 2025 – sekarang, rekonsiliasi | integrated-esbapi | 1–1,5 hari |
| 1 | Hook refresh agregat di `engine2_current.js` (tanggal yang disinkron) + cek di cron 7 hari | integrated-esbapi | 0,5 hari |
| 2 | Endpoint P1 (`kpis`, `trend`, `channels`, `branches`, `hourly`) + test | integrated_portal_be | 1,5 hari |
| 3 | Halaman Overview P1 (filter, KPI, tren, channel, leaderboard, heatmap) desktop & mobile | integrated_portal | 2 hari |
| 4 | P2 (menu, diskon, pengurangan, bulanan/MoM/same-store, pembayaran) | be + fe | 2–3 hari |
| 5 | P3 sesuai kebutuhan bisnis | be + fe | opsional |

---

## 8. Kriteria penerimaan

1. **Akurasi**: Sales Subtotal Overview untuk 1–30 Sep 2026 = **Rp45.795.791.100** dan per hari sama dengan ERP ESB (30/30 hari); sama dengan `/api/summary` untuk periode & cabang apa pun.
2. **Konsistensi**: Σ channel = Σ cabang = KPI total; Σ jam = total bills periode.
3. **Kelengkapan**: tidak ada widget yang memakai field di §2.3.
4. **Kinerja**: setiap endpoint < 500 ms untuk rentang ≤ 1 tahun (dari tabel agregat); halaman interaktif < 2 detik.
5. **Kesegaran data**: agregat ter-update ≤ 15 menit setelah sinkron per jam; label "Last updated" menampilkan `synced_at` terakhir.
6. **Tampilan**: lolos cek desktop 1440 px dan mobile 390 px tanpa overflow horizontal; semua chart punya tooltip & tabel alternatif; teks bahasa Inggris.

---

## 9. Keputusan yang perlu dari bisnis

1. **Metrik utama** di KPI pertama: Sales Subtotal (sama dengan ERP, rekomendasi) atau Nett Sales?
2. **Periode default**: Last 30 days (rekomendasi) atau This month?
3. **Target/budget** per cabang atau per bulan — jika ada, KPI dapat menampilkan pencapaian vs target (meter).
4. **Definisi same-store**: cabang yang aktif penuh di kedua periode (rekomendasi) atau cabang dengan umur ≥ 3 bulan?
5. Kapan data **City** akan dilengkapi — membuka analitik regional (P3).
