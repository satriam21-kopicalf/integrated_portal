# Integrated Portal - Sales Transactions Dashboard

Dokumentasi lengkap untuk project Integrated Portal - Frontend Dashboard.

## 📋 Overview

Integrated Portal adalah aplikasi dashboard untuk menampilkan dan mengelola data transaksi penjualan dari sistem ESB (Enterprise Service Bus). Aplikasi ini dibangun dengan Next.js 16 dan menggunakan database PostgreSQL dari Supabase.

## 🛠️ Tech Stack

| Teknologi | Deskripsi |
|-----------|-----------|
| **Next.js 16** | React framework dengan Turbopack |
| **TypeScript** | Type-safe JavaScript |
| **Tailwind CSS** | Utility-first CSS framework |
| **PostgreSQL** | Database (Supabase) |
| **pg (node-postgres)** | PostgreSQL client untuk Node.js |

## 📁 Struktur Project

```
integrated_portal/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── branches/          # API untuk daftar branch
│   │   │   │   └── route.ts
│   │   │   ├── transactions/      # API transaksi
│   │   │   │   ├── [id]/         # Detail transaksi
│   │   │   │   ├── export/       # Export Excel
│   │   │   │   └── route.ts      # List transaksi
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
│   │   └── database.ts           # Database configuration
│   └── types/
│       └── transactions.ts        # TypeScript types
├── docs/
│   └── README.md                 # Dokumentasi ini
├── public/
│   └── assets/                  # Static assets (logos, icons)
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.ts
```

## 🔌 API Endpoints

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
| sales_date | DATE | Tanggal transaksi |
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

Buat file `.env.local` di root project:

```env
# Supabase Session Pooler (Direct PostgreSQL)
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.awcoxytlmjiyfmpzinam
DB_PASSWORD=Kopicalf2019@@

# Supabase Project
NEXT_PUBLIC_SUPABASE_URL=https://awcoxytlmjiyfmpzinam.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Database Connection

Aplikasi menggunakan **Session Pooler** dari Supabase untuk koneksi langsung ke PostgreSQL. Ini lebih cepat dari direct connection karena menggunakan connection pooling.

```
Host: aws-0-ap-southeast-1.pooler.supabase.com
Port: 5432
Database: postgres
User: postgres.awcoxytlmjiyfmpzinam
Password: [password]
```

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

- Progress bar saat export
- Download file Excel dengan format ESB Report
- Include summary sheet dan data sheet

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
2. **Database Credentials**: Menggunakan Session Pooler untuk akses langsung ke PostgreSQL
3. **SSL Connection**: Koneksi menggunakan SSL dengan `rejectUnauthorized: false`

## 📊 Performa

- **Default Limit**: 100 rows per page
- **Cache**: Simple in-memory cache untuk query default (60 detik)
- **Connection Pooling**: Max 5 connections, idle timeout 20 detik
- **Query Optimization**: Menggunakan `TO_CHAR()` untuk perbandingan tanggal string

## 🐛 Troubleshooting

### Error: Connection Timeout
- Pastikan koneksi internet stabil
- Coba gunakan Session Pooler (aws-0-ap-southeast-1.pooler.supabase.com)

### Error: ETIMEDOUT
- Firewall atau network issue
- Coba lagi beberapa saat kemudian

### Data tidak muncul
- Cek apakah date filter benar
- Pastikan ada data di database untuk periode yang dipilih

### Export gagal
- Cek apakah ada data untuk filter yang dipilih
- Pastikan browser mengizinkan download file

## 📝 Changelog

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
