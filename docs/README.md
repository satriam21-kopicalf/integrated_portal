# Integrated Portal - Sales Transactions Dashboard

Dokumentasi lengkap untuk project Integrated Portal - Frontend Dashboard.

## 📋 Overview

Integrated Portal adalah aplikasi dashboard untuk menampilkan dan mengelola data transaksi penjualan dari sistem ESB (Enterprise Service Bus). Aplikasi ini dibangun dengan Next.js 16. Data diambil dari backend Python terpisah, [integrated_portal_be](https://github.com/satriam21-kopicalf/integrated_portal_be), yang berjalan di VPS dan terhubung ke PostgreSQL (Supabase).

## 🏗️ Arsitektur

```
Browser ──> Next.js (Vercel) ──/api/* rewrite──> integrated_portal_be (FastAPI, VPS :8002) ──> Supabase PostgreSQL
```

- Frontend **tidak** lagi mengakses database secara langsung dan tidak menyimpan kredensial database.
- Browser tetap memanggil `/api/*` (same-origin). `next.config.ts` mem-proxy request tersebut ke `BACKEND_URL` di sisi server, sehingga tidak ada masalah CORS maupun mixed content (HTTPS → HTTP).

## 🛠️ Tech Stack

| Teknologi | Deskripsi |
|-----------|-----------|
| **Next.js 16** | React framework dengan Turbopack |
| **TypeScript** | Type-safe JavaScript |
| **Tailwind CSS** | Utility-first CSS framework |
| **integrated_portal_be** | Backend API (Python FastAPI) |

## 📁 Struktur Project

```
integrated_portal/
├── src/
│   ├── app/
│   │   │   ├── page.tsx          # Home page
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── sales/            # Sales transactions page
│   │   │   └── overview/         # Overview page
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── DateRangePicker.tsx   # Date range picker component
│   │   ├── ExportButton.tsx       # Export to Excel button
│   │   ├── TransactionDetail.tsx  # Transaction drawer/modal
│   │   └── layout/
│   │       ├── DashboardLayout.tsx # Main layout wrapper
│   │       └── Sidebar.tsx        # Sidebar navigation
│   ├── lib/
│   │   └── db_optimizations.sql  # Index/optimasi database
│   └── types/
│       └── transactions.ts        # TypeScript types
├── docs/
│   └── README.md                 # Dokumentasi ini
├── public/
│   └── assets/                  # Static assets (logos, icons)
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.ts                # Proxy /api/* -> BACKEND_URL
```

## 🔌 API Endpoints

Semua endpoint di bawah disediakan oleh **integrated_portal_be** (dokumentasi interaktif: `http://187.52.114.14:8002/docs`) dan diakses frontend melalui proxy `/api/*`.

### 1. GET /api/transactions

Mengambil daftar transaksi dengan pagination dan filter.

**Query Parameters:**
| Parameter | Type | Default | Deskripsi |
|-----------|------|---------|-----------|
| `limit` | number | 100 | Jumlah data per page |
| `cursor` | string | null | Cursor untuk pagination |
| `search` | string | - | Filter search (sales_num, bill_num, branch_name) |
| `dateFrom` | string | 65 hari lalu | Tanggal mulai (YYYY-MM-DD) |
| `dateTo` | string | hari ini | Tanggal akhir (YYYY-MM-DD) |
| `branch` | string | - | Filter berdasarkan branch |

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "cursor": "2026-10-01|||STGP3029086679686",
    "hasMore": true,
    "limit": 100
  },
  "dateRange": {
    "from": "2026-08-02",
    "to": "2026-10-01"
  }
}
```

### 2. GET /api/transactions/[id]

Mengambil detail satu transaksi berdasarkan sales_num.

### 3. GET /api/branches

Mengambil daftar branch dengan jumlah transaksi.

**Response:**
```json
[
  { "branch_name": "Kopi Calf Renon Bali", "count": 42159 },
  { "branch_name": "Kopi Calf Gor Satria Purwokerto", "count": 37811 }
]
```

### 4. POST /api/transactions/export

Export data transaksi ke format Excel.

**Request Body:**
```json
{
  "dateFrom": "2026-09-01",
  "dateTo": "2026-09-30",
  "branch": "Kopi Calf Renon Bali"
}
```

**Response:**
```json
{
  "data": [[...row data...]],
  "headers": ["Sales Number", "Bill Number", ...],
  "totalRows": 1500,
  "totalHeaders": 1200,
  "totalItems": 3200,
  "dateRange": { "from": "2026-09-01", "to": "2026-09-30" }
}
```

## 🗄️ Database Schema

### Table: transactions_pos_sales

| Column | Type | Description |
|--------|------|-------------|
| sales_num | VARCHAR | Primary key, nomor transaksi |
| bill_num | VARCHAR | Nomor bill/faktur |
| sales_date | TIMESTAMPTZ | Tanggal transaksi (00:00 UTC) |
| sales_date_in | TIMESTAMP | Waktu masuk |
| sales_date_out | TIMESTAMP | Waktu keluar |
| branch_name | VARCHAR | Nama branch/outlet |
| brand | VARCHAR | Brand |
| city | VARCHAR | Kota |
| area | VARCHAR | Area |
| payment_method | VARCHAR | Metode pembayaran |
| subtotal | DECIMAL | Subtotal |
| discount_amount | DECIMAL | Total diskon |
| service_charge | DECIMAL | Service charge |
| tax_amount | DECIMAL | PPN |
| total_amount | DECIMAL | Total keseluruhan |
| cash_received | DECIMAL | Tunai diterima |
| change_given | DECIMAL | Kembalian |
| cashier_id | VARCHAR | ID kasir |
| status | VARCHAR | Status (Finished, Void) |
| pax_total | INTEGER | Jumlah pelanggan |

### Table: transactions_pos_sales_items

| Column | Type | Description |
|--------|------|-------------|
| sales_num | VARCHAR | Foreign key ke transactions_pos_sales |
| line_number | INTEGER | Nomor urut item |
| menu_category | VARCHAR | Kategori menu |
| menu_name | VARCHAR | Nama menu |
| menu_code | VARCHAR | Kode menu |
| quantity | DECIMAL | Jumlah |
| unit_price | DECIMAL | Harga satuan |
| subtotal | DECIMAL | Subtotal item |
| discount_amount | DECIMAL | Diskon item |
| total | DECIMAL | Total item |

## 🔧 Konfigurasi

### Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `BACKEND_URL` | `http://187.52.114.14:8002` | URL backend integrated_portal_be (tujuan proxy `/api/*`) |
| `NEXT_PUBLIC_ASSETS_URL` | bucket Supabase `portal-assets` | Basis URL logo & ikon (`src/lib/assets.ts`) |

Untuk development lokal (backend dijalankan di mesin sendiri), buat `.env.local`:

```env
BACKEND_URL=http://localhost:8002
```

Di Vercel, `BACKEND_URL` bersifat opsional (default ke backend VPS). Jika diubah, lakukan redeploy karena rewrite dibaca saat build. Kredensial database hanya ada di backend (`/opt/integrated-portal-be/.env` di VPS).

## 🚀 Cara Menjalankan

### Development
```bash
cd integrated_portal
npm install
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3002`

### Production Build
```bash
npm run build
npm start
```

## 📱 Fitur Utama

### 1. Halaman Sales Transactions

- **Tabel Data**: Menampilkan transaksi dengan kolom Sales #, Bill #, Date, Branch, Payment, Total, Status, Menu, dll
- **Search**: Filter real-time saat mengetik
- **Date Range Picker**: Pilih rentang tanggal dengan kalender interaktif
- **Branch Filter**: Filter berdasarkan outlet/branch
- **Pagination**: Load more untuk data yang banyak
- **Export**: Download data ke Excel

### 2. Date Range Picker

- Pilih tanggal mulai dan akhir dengan kalender
- Quick select: 7 hari, 30 hari, 65 hari
- Tampilan range tanggal yang dipilih

### 3. Transaction Detail Drawer

- Slide-in drawer dari kanan
- Informasi lengkap transaksi
- Timeline (Time In, Order, Time Out, Duration)
- Detail pembayaran
- Detail item pesanan

### 4. Export to Excel

- Diproses di backend sebagai job (`POST /api/exports`), tanpa batas rentang tanggal
- Progress per hari + jumlah baris, lalu file `.xlsx` otomatis terunduh
- Format ESB Report: sheet Summary + Transactions (otomatis dipecah ke `Transactions (2)` dst. jika > 1.048.575 baris)
- Konfirmasi jika rentang > 31 hari (1 bulan ≈ 2 juta baris ≈ 250 MB, ±5 menit)

## 🎨 Komponen UI

### DashboardLayout
Wrapper utama yang menampilkan sidebar dan konten.

### Sidebar
- Navigasi utama
- Collapsible di desktop
- Fixed di mobile

### TransactionDetail (Drawer)
Drawer yang menampilkan detail transaksi dengan:
- Status banner
- Info grid
- Timeline visual
- Order items table
- Payment summary

### DateRangePicker
Komponen kalender untuk memilih rentang tanggal:
- Week start Monday
- Highlight range tanggal
- Quick select buttons
- Label bahasa Indonesia

### ExportButton
Tombol export dengan progress indicator:
- Loading spinner
- Progress bar
- Success/error toast

## 🔒 Security Notes

1. **Environment Variables**: Jangan commit `.env.local` ke Git
2. **Database Credentials**: Tidak ada kredensial database di frontend; semuanya di backend
3. **Akses data**: Hanya melalui backend API (read-only)

## 📊 Performa

- **Default Limit**: 100 rows per page (cursor pagination)
- **Cache**: In-memory cache di backend (transaksi 60 detik, branches 5 menit)
- **Kolom**: Backend tidak mengambil kolom `raw_data` sehingga payload jauh lebih kecil
- **Export**: Maksimal 50.000 transaksi per export, response dikompresi gzip

## 🐛 Troubleshooting

### Data tidak muncul / error 500 / 502
- Cek status backend: `curl http://187.52.114.14:8002/health`
- Di VPS: `docker logs --tail 50 integrated-portal-be`

### Data tidak muncul
- Cek apakah date filter benar
- Pastikan ada data di database untuk periode yang dipilih

### Export gagal
- Cek apakah ada data untuk filter yang dipilih
- Pastikan browser mengizinkan download file

## 📝 Changelog

### v1.3.0
- Angka dashboard & export identik dengan ESB ERP (validasi Sep 2026: Subtotal Sales 30/30 hari sama)
- Filter Tipe: Sales (sesuai ESB) / Void & Cancelled / Other Cost (CUPPING, WASTE) / Semua
- Kartu ringkasan: Gross − Void & Cancelled − Other Cost − Open Bill = Sales Subtotal, Nett Sales
- Export pilihan: Sales Recapitulation Detail (46 kolom) atau Daily Sales Recapitulation (per tanggal & cabang), layout sama dengan file ESB
- Filter cabang memakai kode cabang & nama terkini dari master ESB
- Jam transaksi tampil sesuai WIB

### v1.2.0
- Export Excel diproses di backend (job + progress), tanpa batas rentang; sebelumnya data terpotong di 50.000 transaksi
- Logo & ikon dimuat dari Supabase Storage (bucket `portal-assets`, lihat `scripts/upload-assets.sh`)

### v1.1.0
- Data diambil dari backend Python (integrated_portal_be) via proxy `/api/*`
- Menghapus Next.js API routes, Supabase client, dan dependency `pg` (frontend tanpa kredensial database)
- Fix: filter (tanggal, branch, search) sebelumnya terkirim dengan nilai lama sehingga hasilnya telat satu langkah
- Fix: "Load More" sekarang benar-benar memuat halaman berikutnya (cursor sebelumnya diabaikan)

### v1.0.0
- Initial release
- Sales Transactions page dengan tabel data
- Date Range Picker
- Branch Filter
- Transaction Detail Drawer
- Export to Excel
- PostgreSQL integration dengan Session Pooler

---

**Last Updated**: October 2026
**Version**: 1.0.0
