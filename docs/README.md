# Integrated Portal — Frontend

Dashboard penjualan Kopi Calf (Next.js 16, TypeScript, Tailwind CSS, Apache ECharts).
Semua data berasal dari backend **[integrated_portal_be](https://github.com/satriam21-kopicalf/integrated_portal_be)** (FastAPI di VPS); frontend tidak mengakses database dan tidak menyimpan kredensial.

## Arsitektur

```
                       ┌──────── /api/* (REST, proxy Next.js rewrite) ───────┐
Browser ── portal.kopicalf.co.id (Vercel) ──────────────────────────────────── integrated_portal_be :8002 ── Supabase PostgreSQL
   │                                                                          ▲
   └──────── wss://api.kopicalf.co.id/ws (WebSocket, Cloudflare → Traefik) ───┘
```

- **REST**: browser memanggil `/api/*` (same-origin). `next.config.ts` mem-proxy ke `BACKEND_URL` di sisi server → tanpa CORS / mixed content.
- **WebSocket**: proxy Vercel tidak bisa meneruskan WebSocket, jadi browser terhubung langsung ke `wss://api.kopicalf.co.id/ws` (Cloudflare → Traefik di VPS → backend). Lihat [Realtime](#realtime-websocket).
- Unduhan export Excel memakai URL dari backend (`downloadUrl`).

## Halaman

| Route | Isi |
|---|---|
| `/login` | Halaman login (username **atau** email) |
| `/` | Redirect ke `/overview` |
| `/overview` | Dashboard analitik: strip *Latest sales*, ringkasan KPI, panel *Today*, tren, channel, cabang, jam sibuk, menu, pembayaran, basket, pengurangan, pertumbuhan bulanan |
| `/sales` | Daftar transaksi (detail per item), ringkasan Sales/Nett/Gross/Deductions, filter, export Excel |
| `/users` | **User Accounts** (khusus superadmin): CRUD akun login, role, status, foto profil |

Semua halaman selain `/login` wajib login. Role **user** hanya melihat Overview & Sales Transactions (menu *Platforms* dan *User Accounts* disembunyikan, API `/api/users` ditolak); **superadmin** akses penuh.

### Overview (`src/app/overview/page.tsx`)

- **Filter**: periode (default 30 hari lengkap s/d kemarin), cabang, channel (multi). Tersimpan di URL (`?from=&to=&branch=&channel=`) sehingga tampilan bisa dibagikan. **Semua analitik mengikuti ketiga filter**; *Live sales* & ticker selalu menampilkan **hari ini** dan mengikuti filter cabang & channel.
- Urutan: strip *Latest sales* → periode & **KPI strip** (Sales, Nett sales, Bills, Avg ticket; tanpa card, **angka penuh** tanpa B/M, Δ% vs periode sebelumnya + sparkline) → panel **Today** → Sales trend + Channel mix → Branch leaderboard → Busy hours + Menus → Payments, Basket, Deductions → Monthly growth.
- **Today** (`components/overview/LiveSalesCard.tsx`): penjualan hari ini (angka beranimasi) vs kemarin di jam yang sama, progres terhadap total kemarin, Bills/Avg ticket/Nett dengan Δ%, penjualan per jam hari ini vs kemarin, komposisi channel hari ini, dan daftar transaksi terbaru (transaksi baru masuk satu per satu dengan animasi + label *New*).
- **Strip Latest sales** (`components/overview/LiveTicker.tsx`): hanya data transaksi terbaru yang bergerak (jam, outlet, logo channel, jumlah item, nilai), warna biru dengan aksen merah; berhenti saat disorot. Status *Live* hanya ditampilkan di header halaman.
- **Logo channel** (`components/ChannelLogo.tsx`, file di `public/assets/`): GoFood, GrabFood, ShopeeFood memakai wordmark (menggantikan teks); Dine In & Takeaway memakai ikon + nama. Dipakai di Channel mix (termasuk label sumbu chart), Basket, panel Today, strip Latest sales dan filter channel.
- Setiap widget memuat datanya sendiri (skeleton saat pertama; data lama tetap tampil saat memuat ulang; *Try again* bila gagal).
- **Definisi metrik**: *Sales* = subtotal transaksi berstatus Finished dengan nomor bill (sama dengan laporan Sales Recapitulation); *Nett sales* = setelah diskon item & bill; *Bills* = jumlah transaksi; *Avg ticket* = Sales ÷ Bills. Periode pembanding = jumlah hari yang sama tepat sebelum periode; sebelum 1 Agu 2025 (roll-out belum lengkap) tidak dibandingkan. Hanya field yang selalu terisi yang dipakai; baris menu yang dibatalkan (*Print Cancelled*) tidak dihitung.
- **Monthly growth** menampilkan bulan-bulan di dalam periode terpilih (hanya hari terpilih yang dihitung); MoM/YoY/same-store membandingkan rata-rata per hari kalender.

### Sales Transactions (`src/app/sales/page.tsx`)

- **Default periode: kemarin** (hari lengkap terakhir). *Clear* pada filter tanggal kembali ke kemarin. Rentang berapa pun (> 65 hari, 1 tahun, …) bisa dipilih: daftar memakai *cursor pagination*, ringkasan dihitung backend dari agregat harian (1 tahun < 1 detik).
- **Ringkasan tanpa card**: Sales subtotal, Nett sales (diskon & %), Gross subtotal (bar komposisi Sales / Void / Other cost / Open), Deductions (rincian Void & cancelled, Other cost, Open bills).
- Tab tipe: Sales, Void & Cancelled, Other Cost, All. Pencarian nomor sales/bill/cabang, filter cabang, export Excel (detail / daily recap).

## Login & akun

- `src/proxy.ts` (Next.js 16 *proxy*, pengganti middleware): halaman tanpa cookie sesi langsung diarahkan ke `/login?next=…`.
- `src/lib/auth.tsx` — `AuthProvider`: memeriksa sesi (`GET /api/auth/me`), menyediakan `useAuth()` (user, `logout`, `setUser`), mengarahkan ke `/login` bila ada respons 401 (sesi habis/dicabut), dan memaksa ganti password bila `mustChangePassword`.
- **Login** (`src/app/login/page.tsx`): pilihan *Username* atau *Email*, tampilkan/sembunyikan password, *Keep me signed in for 30 days*, pesan galat (salah, terkunci 15 menit setelah 5 kali salah, nonaktif). Token sesi ada di cookie HttpOnly (tidak terbaca JavaScript).
- **Profil di sidebar** (`components/layout/Sidebar.tsx`): foto/inisial, nama lengkap, role, username & email; menu *Profile photo*, *Change password*, *Sign out*.
- **User Accounts** (`src/app/users/page.tsx`, superadmin): daftar dengan pencarian, filter role & status (Active/Inactive/Locked), paginasi; *New user* / *Edit* (nama, username, email, role, status, telepon, jabatan, departemen, catatan, password + generator, wajib ganti password), *View* (detail & audit: login terakhir + IP, percobaan gagal, dibuat/diubah oleh), *Unlock*, *Delete* (konfirmasi). Tidak bisa menghapus/menonaktifkan akun sendiri.
- **Foto profil** (`components/UserAvatar.tsx`): unggah JPG/PNG/WebP, dipotong persegi & diperkecil ke 256×256 di browser sebelum dikirim; user mengatur fotonya sendiri lewat sidebar, superadmin bisa mengatur foto user lain di form user.
- Akun pertama dibuat di backend dengan CLI (`python -m app.accounts create …`, lihat dokumentasi backend).

## Realtime (WebSocket)

`src/lib/realtime.tsx` — `RealtimeProvider` dipasang sekali di `src/app/providers.tsx` (root layout) **setelah login**, sehingga satu koneksi dipakai di semua halaman.

- Server hanya mengirim **versi data**, bukan datanya:
  `{"type":"hello"|"update","salesSyncedAt","aggregatesRefreshedAt","version"}` dan `{"type":"ping"}` tiap 25 detik.
  - `salesSyncedAt` berubah setiap sinkron POS (tiap jam menit :05) → *Live sales*, ticker, halaman Sales.
  - `aggregatesRefreshedAt` berubah setiap agregat Overview diperbarui (tiap jam menit :20, malam 02:50 WIB) → semua widget Overview.
- Saat versi berubah, setiap halaman mengambil ulang datanya sendiri lewat REST **tanpa loading/skeleton** (data lama tetap tampil). Versi dikirim sebagai parameter `v` agar cache backend tidak mengembalikan data sebelum update.
- Halaman Sales: ringkasan & halaman pertama daftar diperbarui otomatis; bila pengguna sudah memuat lebih dari satu halaman, muncul pemberitahuan *New transactions were synced → Show latest* (posisi baca tidak hilang).
- Koneksi putus → indikator *Reconnecting*, reconnect otomatis (1 s, 2 s, 5 s, 10 s, 30 s), sementara itu fallback polling `GET /api/realtime/version` tiap 60 detik. Reconnect langsung saat tab aktif lagi / jaringan kembali.
- **Tidak ada tombol refresh**; header menampilkan indikator `RealtimeIndicator` (*Live · synced …*).
- Satu-satunya polling tersisa: progres job export (tiap 2 detik selama export berjalan).

## Struktur

```
src/
├── app/
│   ├── layout.tsx              # root layout + <Providers>
│   ├── providers.tsx           # AuthProvider + (setelah login) RealtimeProvider
│   ├── icon.svg                # ikon tab browser (logo Calf)
│   ├── page.tsx                # redirect → /overview
│   ├── login/page.tsx          # Login
│   ├── overview/page.tsx       # Overview
│   ├── sales/page.tsx          # Sales Transactions
│   └── users/page.tsx          # User Accounts (superadmin)
├── proxy.ts                    # redirect ke /login bila belum ada sesi
├── components/
│   ├── StatStrip.tsx           # ringkasan angka tanpa card (Overview & Sales)
│   ├── ChannelLogo.tsx         # logo channel (JSX & label rich ECharts)
│   ├── UserAvatar.tsx          # foto profil / inisial + AvatarEditor (unggah)
│   ├── ChangePasswordDialog.tsx
│   ├── ui/Dialog.tsx           # modal, field & gaya tombol
│   ├── DateRangePicker.tsx     # preset + kalender (preset & label default per halaman)
│   ├── BranchFilter.tsx, ExportButton.tsx, TransactionDetail.tsx
│   ├── charts/                 # EChart (wrapper ECharts), HBarChart, Sparkline, Legend
│   ├── overview/               # widget Overview (KpiTiles, LiveSalesCard, LiveTicker, TrendCard, …)
│   └── layout/                 # DashboardLayout, Sidebar
└── lib/
    ├── auth.tsx                # AuthProvider, useAuth, tipe AuthUser, role
    ├── realtime.tsx            # RealtimeProvider, useRealtime, RealtimeIndicator
    ├── overview.ts             # tipe & hook data Overview (useOverview), palet channel
    ├── live.ts                 # tipe & hook /api/live (useLive), useCountUp
    ├── chartTheme.ts           # gaya ECharts (axis, tooltip, warna)
    ├── format.ts               # format angka/tanggal
    └── assets.ts               # URL logo/ikon (Supabase Storage)
```

## Endpoint backend yang dipakai

| Endpoint | Dipakai oleh |
|---|---|
| `GET /api/overview/{meta,kpis,trend,channels,branches,hourly,menus,deductions,monthly,payments,basket}` | Overview |
| `GET /api/live` | Live sales, ticker |
| `GET /api/transactions`, `/api/transactions/{sales_num}`, `/api/summary`, `/api/branches` | Sales |
| `POST /api/exports`, `GET /api/exports/{id}`, `/api/exports/{id}/download` | Export Excel |
| `wss://…/ws`, `GET /api/realtime/version` | Realtime |
| `/api/auth/*` (login, logout, me, password, me/avatar) | Login, profil sidebar |
| `/api/users/*`, `/api/avatars/{id}` | User Accounts, foto profil |

Detail parameter & respons: dokumentasi backend (`integrated_portal_be/docs/README.md`) dan Swagger `https://api.kopicalf.co.id/docs`.

## Konfigurasi

| Variable | Default | Keterangan |
|---|---|---|
| `BACKEND_URL` | `http://187.52.114.14:8002` | Tujuan proxy `/api/*` (server-side, `next.config.ts`) |
| `NEXT_PUBLIC_WS_URL` | `wss://api.kopicalf.co.id/ws` | Alamat WebSocket realtime |
| `NEXT_PUBLIC_ASSETS_URL` | Supabase Storage `portal-assets` | Basis URL logo/ikon |

Origin yang boleh membuka WebSocket diatur di backend (`WS_ALLOWED_ORIGINS`: `portal.kopicalf.co.id`, preview `integrated-portal*.vercel.app`, `localhost:3002`).

## Development

```bash
npm install
npm run dev        # http://localhost:3002 (buka lewat "localhost", bukan 127.0.0.1)
npm run lint
npm run build && npm run start   # cek build produksi
```

## Deploy

Vercel (project `integrated-portal`, domain `portal.kopicalf.co.id`) otomatis deploy setiap push ke `main`.
