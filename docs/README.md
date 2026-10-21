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
| `/stock-opname`, `/stock-opname/[id]` | **Stock Opname** (semua role): SO hari ini di cabang user (outlet, HUB WH, HUB CK) sesuai jadwal Cost Control, isi hitungan, foto bukti, submit. Data lewat `/api/so/*` → gateway kopicalf-platform (D-51); komponen di `src/so/` (diport dari aplikasi WMS/Outlet kopicalf) |
| `/cost-control/{monitor,reviews,esb-export,esb-compare,lists,groups,types}` | **Cost Control · Stock opname** (role `cost_control` & superadmin): monitor semua cabang, review (setujui / hitung ulang), ekspor & pembanding ESB, daftar hitung per cabang, grup item, jenis SO & jadwal |
| `/cost-control` | **Cost Control · COGS** (role `cost_control` & superadmin): COGS ratio, usage ratio, selisih stok, waste, estimasi belanja 1/2/4 minggu per outlet |
| `/users` | **User Accounts** (khusus superadmin): CRUD akun login, role, **akses cabang**, status, foto profil, profil user |
| `/activity` | **Activity Logs** (khusus superadmin): timeline per hari (jam · ikon jenis · "siapa melakukan apa" · detail · halaman/perangkat/IP), **update otomatis** tiap 10 detik & saat tab aktif kembali (entri baru muncul di atas dengan tanda *New*, indikator *Live · updated*), tab jenis + pencarian, filter (user, hasil, role) dalam drawer, *Load older activity*, panel user paling aktif & distribusi jenis; `?user=<id>` dari User Accounts |

Semua halaman selain `/login` wajib login. Role **user** hanya membuka **Overview** & **Sales Transactions** (`canAccess` di `src/lib/auth.tsx`; halaman lain dialihkan ke Overview, menu Cost Control, User Accounts, Activity Logs dan *Platforms* disembunyikan, API-nya juga ditolak backend) dan hanya melihat **data cabang yang ditugaskan** ke akunnya (filter cabang hanya berisi cabang tersebut; backend yang menegakkan). **Superadmin** akses penuh.

**Export berjalan terus saat pindah halaman** (`src/lib/exports.tsx` + `components/ExportToasts.tsx`): export dijalankan di server; `ExportsProvider` berada di atas semua halaman sehingga polling & kartu progres tetap ada di halaman mana pun, job yang diikuti disimpan per user di localStorage (reload/tab lain melanjutkan, `GET /api/exports`), dan file otomatis terunduh sekali ketika selesai.

**Activity log** (`src/lib/activity.ts`): dashboard melaporkan halaman yang dibuka (`page.view`) dan perubahan filter Overview/Sales (`filter.change`, debounce 1,5 s); aktivitas lain dicatat backend.

### Overview (`src/app/overview/page.tsx`)

- **Filter**: periode (default 30 hari lengkap s/d kemarin), cabang (**bisa beberapa**: centang lalu *Apply*), channel (multi). Tersimpan di URL (`?from=&to=&branch=CCI01,CCI04&channel=`) sehingga tampilan bisa dibagikan. **Semua analitik mengikuti ketiga filter**; *Live sales* & ticker selalu menampilkan **hari ini** dan mengikuti filter cabang & channel.
- Urutan: panel **Today** (paling atas, tidak terpengaruh filter tanggal/komparasi) → periode & **KPI strip** (Sales, Nett sales, Bills, Avg ticket; tanpa card, **angka penuh** tanpa B/M, Δ% vs periode sebelumnya + sparkline) → panel **Today** → Sales trend + Channel mix → **Cost control** → Branch leaderboard → Busy hours + Menus → Payments, Basket, Deductions → Monthly growth.
- **Today** (`components/overview/LiveSalesCard.tsx`): penjualan hari ini (angka beranimasi) vs kemarin di jam yang sama, progres terhadap total kemarin, Bills/Avg ticket/Nett dengan Δ%, penjualan per jam hari ini vs kemarin, komposisi channel hari ini, dan daftar transaksi terbaru (transaksi baru masuk satu per satu dengan animasi + label *New*).
- **Logo channel** (`components/ChannelLogo.tsx`, file di `public/assets/`): GoFood, GrabFood, ShopeeFood memakai wordmark (menggantikan teks); Dine In & Takeaway memakai ikon + nama. Dipakai di Channel mix (termasuk label sumbu chart), Basket, panel Today, strip Latest sales dan filter channel.
- Setiap widget memuat datanya sendiri (skeleton saat pertama; data lama tetap tampil saat memuat ulang; *Try again* bila gagal).
- **Definisi metrik**: *Sales* = subtotal transaksi berstatus Finished dengan nomor bill (sama dengan laporan Sales Recapitulation); *Nett sales* = setelah diskon item & bill; *Bills* = jumlah transaksi; *Avg ticket* = Sales ÷ Bills. Periode pembanding = jumlah hari yang sama tepat sebelum periode; sebelum 1 Agu 2025 (roll-out belum lengkap) tidak dibandingkan. Hanya field yang selalu terisi yang dipakai; baris menu yang dibatalkan (*Print Cancelled*) tidak dihitung.
- **Monthly growth** menampilkan bulan-bulan di dalam periode terpilih (hanya hari terpilih yang dihitung); MoM/YoY/same-store membandingkan rata-rata per hari kalender.
- **Sales trend** (`components/overview/TrendChart.tsx`): pilihan chart **Line** (dengan high/low/rata-rata), **Area**, **Bars** (berdampingan dengan periode sebelumnya), **Cumulative** (total berjalan: unggul/tertinggal dari periode sebelumnya), **Moving average** (rata-rata 7 bucket) dan **By channel** (bertumpuk per channel; Avg ticket = satu garis per channel); metric Sales/Bills/Avg ticket, granularity Day/Week/Month, tampilan Table. Klik titik → profil hari/minggu/bulan tersebut.
- **Tanpa duplikasi** (audit 6 Okt 2026): *By channel* dihapus dari Sales trend (sudah ada di Channel mix › Over time); kartu *Monthly growth* digabung ke **Sales growth › Monthly** (MoM, YoY, same-store); *Compare periods* dihapus dari kartu Busy hours (per jam vs pembanding = Sales growth › By hour; Busy hours tetap Pattern & Compare branches); strip berjalan *Latest sales* dihapus (daftar transaksi terbaru ada di panel Today). Drawer tetap berisi detail lengkap.
- **ⓘ Info di setiap analitik** (`components/ui/InfoTip.tsx`, isi terpusat di `src/lib/metricInfo.ts`): di samping judul setiap kartu, panel Today dan drawer — **Formula**, **What is counted** (definisi & aturan data) dan **Source** (tabel/sumber ESB & jadwal sinkron). Tile KPI menampilkan formula & sumber pada hover.
- **Month to date / Year to date**: periode berjalan — *Month to date* = tgl 1 s/d **hari ini**, *Year to date* = 1 Jan s/d hari ini — di Overview, Sales Transactions dan pemilih tanggal lainnya. Data hari ini masih berjalan (sinkron tiap jam). Dengan filter komparasi *Same dates last month* → MTD vs last month to date (mis. 1–6 Okt vs 1–6 Sep; tanggal 6 Sep dihitung penuh).
- **Filter komparasi** (`components/overview/CompareFilter.tsx`, tombol di header): *Previous period* (otomatis, jumlah hari sama tepat sebelum periode), *Same dates last month* (mis. 1–10 Sep vs 1–10 Agu), *Same dates last year*, atau *Custom period* (rentang bebas, boleh beda panjang — muncul peringatan karena total tidak sebanding). Tersimpan di URL (`cmp`, `cmpFrom`, `cmpTo`) dan dikirim sebagai `compareFrom`/`compareTo` ke **semua** endpoint Overview, jadi semua angka "vs" (KPI, Sales trend, Sales growth *Comparison period*, channel, cabang, basket, jam sibuk, deductions, drawer) memakai periode pembanding tersebut.
- **Deductions offline vs online**: kartu Deductions menampilkan void rate offline (Dine In, Takeaway) vs online (GoFood, GrabFood, ShopeeFood, Online Order) beserta perubahan (pp) vs periode pembanding, jumlah & nilai void, porsi dari seluruh void, other cost dan open bill. Drawer: void rate per hari per grup, tabel per channel dan per cabang (void rate offline vs online).
- **Sales growth** (`components/overview/SalesGrowth.tsx`, di bawah Sales trend): pertumbuhan **subtotal (gross sales)** dibanding **periode sebelumnya** (panjang sama), **tahun lalu** (hari yang sama 52 minggu sebelumnya) atau **sequential** (tiap hari/minggu/bulan vs sebelumnya, per hari kalender sehingga minggu/bulan terpotong tetap adil). *Over time*: bar divergen pertumbuhan % per bucket (biru = tumbuh, merah = turun), klik bar → profil periode itu. *By hour*: pertumbuhan penjualan per hari untuk setiap jam (jam outlet) + jam yang paling tumbuh/turun. Ringkasan: growth %, selisih Rp, periode ini vs pembanding, growth bills & avg ticket, jumlah bucket naik/turun. **Details**: tabel per bucket, growth per jam, heatmap hari×jam (merah–abu–biru), **cabang & channel penyebab pertumbuhan** (kontribusi dalam poin persen yang dijumlahkan = total growth; status New/Growing/Declining/No sales now). Mengikuti filter tanggal, cabang & channel. Endpoint `GET /api/overview/growth`.
- **Busy hours** (`components/overview/HoursCompare.tsx`): *Pattern* (rata-rata bills per jam & heatmap hari×jam), **Compare periods** (vs periode sebelumnya, periode sama tahun lalu — mundur 52 minggu agar hari sama — atau rentang bebas; chart per jam, ringkasan bills/hari & jam puncak, jam dengan perubahan terbesar) dan **Compare branches** (cabang terpilih, atau 5 tersibuk; maks. 8; garis per cabang); ukuran *Bills / day* atau *Share of day* (bentuk hari tanpa terpengaruh besar-kecilnya cabang). Selalu mengikuti filter tanggal, cabang & channel. Endpoint `GET /api/overview/hourly-compare`.
- **Detail (drill-down)** (`components/overview/drill/`): setiap analitik punya tombol **Details** (juga klik judul atau KPI) yang membuka drawer lebar berisi seluruh data terkait: angka ringkas, chart lebih besar, dan tabel lengkap yang bisa diurutkan, dicari dan diunduh **CSV**. Di dalam drawer (dan langsung dari card), klik **cabang, channel, hari/minggu/bulan, menu atau metode pembayaran** membuka drawer entitas tersebut — profil cabang/channel/periode berisi KPI, trend, channel, cabang, jam sibuk, top menu, pembayaran, basket & deductions; menu berisi qty/sales per hari, cabang & channel; metode pembayaran per hari, cabang & channel (`/api/overview/breakdown`, `/api/overview/menu-detail`). Drill-down **mewarisi filter asalnya** (mis. channel GoFood yang dibuka dari profil cabang = GoFood di cabang itu); tombol **Back** + breadcrumb menelusuri riwayat. Role user tetap hanya melihat cabangnya (dibatasi backend).

### Sales Transactions (`src/app/sales/page.tsx`)

- **Default periode: kemarin** (hari lengkap terakhir). *Clear* pada filter tanggal kembali ke kemarin. Rentang berapa pun (> 65 hari, 1 tahun, …) bisa dipilih: daftar memakai *cursor pagination*, ringkasan dihitung backend dari agregat harian (1 tahun < 1 detik).
- **Ringkasan tanpa card**: Sales subtotal, Nett sales (diskon & %), Gross subtotal (bar komposisi Sales / Void / Other cost / Open), Deductions (rincian Void & cancelled, Other cost, Open bills).
- Export **Sales Recapitulation per Menu** (18 Okt 2026): satu sheet saja, header di baris 1 (siap pivot/filter). Satu baris per tanggal × cabang × channel × metode bayar × menu (paket tetap baris sendiri, *Item Type* = Package); kolom: Sales Date, Day, Branch, City, Channel, Channel Group, Payment Method, Menu Category (+Detail), Menu, Item Type, Bills, Qty, Subtotal, Discount, Tax, Total, Bill Discount, Total After Bill Discount, Nett Sales. Nominal = jumlah report Detail (Sep 2026 semua cabang: 414.722 baris, 33,8 MB, subtotal sama dengan Daily Sales Recapitulation). Maksimal 62 hari ke Excel, 31 hari ke Google Sheets (backend `app/menu_report.py`).
- Tab tipe: Sales, Void & Cancelled, Other Cost, All. Pencarian nomor sales/bill/cabang, filter cabang (**bisa beberapa**, chip per cabang), export Excel (detail / daily recap) untuk cabang terpilih.

### PIC Check In (19 Okt 2026)

- **Form → PIC Check In** (`/forms/pic-check-in`, halaman akses `form.pic-check-in`, dibuka untuk role User oleh migrasi backend 019): nama PIC dari akun; pilih outlet bila PIC punya lebih dari satu cabang (Super Admin / Kontrol Biaya: semua cabang); lokasi GPS segar (`locate()`) dibandingkan dengan koordinat outlet di Lokasi Outlet (aturan radius sama dengan SO: jarak − min(akurasi, 100 m) > radius); foto wajah **kamera depan saja** (`so/features/checkin/SelfieCamera.tsx`, distempel PIC, outlet, tanggal & jam WIB, koordinat); wajah diperiksa **di server** (OpenCV, `app/face.py`) saat foto diambil dan lagi saat dikirim — tanpa wajah ditolak. Waktu kunjungan = waktu server saat dikirim (jam HP ikut disimpan).
- **Monitoring → PIC Check In** (`/monitoring/pic-check-in`, `mon.pic-check-in`, default hanya Super Admin): ringkasan periode (check in, PIC, outlet dikunjungi, di luar radius), lokasi check in, kunjungan per PIC, filter (periode, outlet, PIC, lokasi), tabel dengan foto, drawer detail (foto besar, posisi PIC & outlet di Google Maps, selisih jam HP).
- Backend: `app/pic_checkin.py`, `app/routes/pic_checkin.py`, tabel `integration_portal.pic_checkin` (foto di DB); Activity Logs kategori *Form*.

### Lokasi stock opname (19 Okt 2026, kopicalf 06.9 §12.15)

- **Mulai SO wajib lokasi**: `so/features/count/LocateDialog.tsx` mengambil posisi GPS segar (`locate()` di `so/lib/counts.ts`: `watchPosition`, `maximumAge: 0`, sampai ±30 m atau 20 detik) dan menampilkan akurasi; izin diblokir → panduan Android/iPhone; akurasi > 100 m → peringatan (coba lagi / tetap mulai, ditandai "akurasi GPS rendah"). Posisi, akurasi & waktu perangkat dikirim saat mulai dan kirim SO.
- **Pantauan Cost Control**: badge `so/features/count/LocationBadges.tsx` (Di luar radius, Akurasi GPS rendah, Outlet belum punya koordinat, jarak ±akurasi) di Monitor (plus filter *Lokasi* dan jumlah fasilitas tanpa koordinat) dan Review; detail Review menampilkan lokasi saat mulai & kirim (jarak, ±akurasi, jam, tautan Google Maps) dan lokasi outlet.
- **Lokasi Outlet** (`/cost-control/locations`, halaman akses `cc.locations`): koordinat & radius setiap outlet/hub — tempel dari Google Maps (angka atau link), pakai posisi awal SO terakhir (setelah dicek di peta) atau posisi perangkat di lokasi; radius standar 100 m. Tersimpan di core kopicalf (diaudit).

### Waste (kerangka, 18 Okt 2026)

- Outlet menginput waste cabangnya (menu **Waste** di bawah Stock Opname, `/waste`, halaman akses `waste`); Cost Control memantau dan mereview (pop-up Cost Control → **Waste**: *Monitor waste* `/cost-control/waste/monitor` = `cc.waste-monitor`, *Review waste* `/cost-control/waste/reviews` = `cc.waste-review`).
- Saat ini baru **RBAC + kerangka**: ketiga halaman ada di katalog (`src/lib/pages.ts` = backend `app/access.py`) sehingga bisa diatur per role / per user di User Accounts → *Role & halaman*; migrasi backend 017 memberi role `cost_control` ketiganya, role `user` belum (dicentang saat input siap). API `/api/waste/entries|monitor|reviews` dijaga halaman masing-masing (role user hanya cabangnya); layar menampilkan alur yang direncanakan (`so/features/waste/WasteSkeleton.tsx`).
- Sidebar: grup *Platforms* (Roastery, CK, WMS, Operational, Finance, HRMS) dihapus (belum dibutuhkan).

### Form & Monitoring (kerangka, 18 Okt 2026)

- **Form** (pop-up di sidebar, desain sama dengan Cost Control): form yang diisi outlet / PIC — *PIC Check In* `/forms/pic-check-in`, *Monitoring Outlet* `/forms/outlet`, *Monitoring Product* `/forms/product`, *Tools & Heavy Tools* `/forms/tools` (halaman akses `form.*`).
- **Monitoring** (pop-up): hasil isian yang sama untuk tim yang memantau — `/monitoring/pic-check-in|outlet|product|tools` (halaman akses `mon.*`).
- Satu komponen pop-up untuk Form, Cost Control dan Monitoring (`PopupMenu` di `components/layout/Sidebar.tsx`); daftar & alur yang direncanakan di `so/features/monitoring/forms.tsx`, layar kerangka `components/FeatureSkeleton.tsx` (juga dipakai Waste).
- **Akses**: kedelapan halaman ada di *Role & halaman* tetapi **belum dibuka untuk role mana pun** (hanya super admin) sampai dicentang; API `/api/forms/{form}` dan `/api/monitoring/{form}` dijaga halaman masing-masing (role user hanya cabangnya). Isian form & penyimpanan menyusul setelah field disepakati.

### COGS & usage (`src/app/cost-control/page.tsx`)

- Halaman *Segera*: sedang dibangun ulang mengikuti angka **Rasio Outlet** (`/cost-control/ratio`). Mesin COGS lama (komponen `components/cost/`, API `/api/cost-control/{meta,summary,…}`, tabel `agg_cost_*`) dihapus pada audit 2026-10-21 dan tetap ada di riwayat git.

## Login & akun

- `src/proxy.ts` (Next.js 16 *proxy*, pengganti middleware): halaman tanpa cookie sesi langsung diarahkan ke `/login?next=…`.
- `src/lib/auth.tsx` — `AuthProvider`: memeriksa sesi (`GET /api/auth/me`), menyediakan `useAuth()` (user, `logout`, `setUser`), mengarahkan ke `/login` bila ada respons 401 (sesi habis/dicabut), dan memaksa ganti password bila `mustChangePassword`.
- **Login** (`src/app/login/page.tsx`): pilihan *Username* atau *Email*, tampilkan/sembunyikan password, *Keep me signed in for 30 days*, pesan galat (salah, terkunci 15 menit setelah 5 kali salah, nonaktif). Token sesi ada di cookie HttpOnly (tidak terbaca JavaScript).
- **Drawer** (`components/ui/Drawer.tsx`): semua form & detail akun tampil sebagai panel geser dari kanan (layar penuh di ponsel), bukan modal: *New user*, *View*, *Edit*, *Change password* (termasuk ganti password wajib, terkunci), *My profile*. Hanya konfirmasi *Delete* yang tetap modal kecil (`ui/Dialog.tsx`).
- **Profil di sidebar** (`components/layout/Sidebar.tsx`): foto/inisial, nama tampilan (`displayName` = nama lengkap, atau username selama profil belum diisi), role, username & email; menu *My profile* (label *Incomplete* + titik kuning di avatar bila profil belum lengkap), *Change password*, *Sign out*.
- **My profile** (`components/AccountDrawers.tsx` + `components/ProfileFields.tsx`): user mengisi identitasnya sendiri — foto, nama lengkap, jenis kelamin, tanggal lahir, telepon, alamat, kota, nomor karyawan, jabatan, departemen, lokasi kerja (outlet dari `/api/branches`) — disimpan lewat `PATCH /api/auth/me`. Username, email & role hanya dibaca (dikelola superadmin). Profil dianggap **lengkap** bila nama lengkap, telepon, jabatan & departemen terisi; selama belum lengkap muncul pengingat di pojok kanan bawah (*Complete profile* / *Later*, disembunyikan per sesi).
- **User Accounts** (`src/app/users/page.tsx`, superadmin): header seperti Overview/Sales + ringkasan (`GET /api/users/summary`: total, aktif/nonaktif/terkunci, login 7 hari, cabang tercakup, user tanpa cabang); satu tombol **Filters** (drawer: Role, Status, Branch) dengan chip filter aktif; tabel dengan kolom aksi **⋯** (dropdown: View details, Edit, Unlock, Activity log, Delete — `components/ui/ActionMenu.tsx`, tidak terpotong tabel); drawer **View** berisi ringkasan (login terakhir, akses cabang, kelengkapan profil, aktivitas 30 hari), akses cabang, kontak (email, telepon + WhatsApp), pekerjaan, data pribadi, keamanan, aktivitas terakhir & catatan. daftar dengan pencarian (nama, username, email, nomor karyawan), filter role & status (Active/Inactive/Locked), paginasi, badge *Profile incomplete*. *New user*: **identitas opsional** (nama lengkap, telepon, jabatan — saran *PIC Outlet*, *Store Leader*, … — dan departemen; username otomatis `nama.depan` dari nama lengkap, sama seperti akun PIC hasil impor), **username, email, password** (otomatis dibuat, bisa di-generate ulang), role, status, catatan admin dan — untuk role User — **akses cabang** (`components/BranchAssign.tsx`: daftar cabang dengan pencarian, *Select all/shown*, chip yang bisa dihapus; wajib minimal 1) — profil diisi sendiri oleh user. Kolom *Branches* di daftar (badge merah *No branch* bila belum ada cabang). Setelah membuat user atau mengganti password muncul drawer **Login details** (username, email, password, akses cabang) dengan tombol *Copy login details* untuk dibagikan; password tidak disimpan di mana pun. Daftar bisa difilter per **cabang** (user yang ditugaskan + superadmin) dan dicari berdasarkan nama, username, email, telepon atau jabatan. *Edit*: login, akses, reset password, koreksi profil, foto, catatan admin. *View*: profil pribadi & pekerjaan, akun, aktivitas (login terakhir + IP, percobaan gagal, dibuat/diubah oleh). *Unlock*, *Delete* (konfirmasi). Tidak bisa menghapus/menonaktifkan akun sendiri.
- **Foto profil** (`components/UserAvatar.tsx`): unggah JPG/PNG/WebP, dipotong persegi & diperkecil ke 256×256 di browser sebelum dikirim; user mengatur fotonya sendiri di *My profile*, superadmin bisa mengatur foto user lain di *Edit*.
- **Sapaan login & logout** (`src/lib/greetings.ts`, `components/WelcomeNotice.tsx`): setelah login muncul notifikasi kanan atas (sekali per login) — salam sesuai waktu (*Up early / Good morning / Good afternoon / Good evening / Working late*), nama depan, dan kalimat motivasi yang menyesuaikan waktu & hari (Senin, Jumat, akhir pekan); pertanyaan *How are you feeling today?* (Great / Good / Okay / Tired / Stressed) langsung mengganti kalimat sesuai mood dan diingat untuk hari itu. Kalimat yang baru tampil tidak diulang (rotasi 12 terakhir). Tertutup sendiri (12–20 detik, berhenti saat di-hover). Setelah logout, halaman login menampilkan salam perpisahan sesuai waktu/mood + lama sesi. Semua disimpan di browser (localStorage/sessionStorage), tidak dikirim ke server.
- Akun pertama dibuat di backend dengan CLI (`python -m app.accounts create …`, lihat dokumentasi backend).

## Aplikasi terpasang (PWA)

Portal dapat dipasang sebagai aplikasi di **iPhone/iPad dan Android** (serta Chrome/Edge desktop), terbuka layar penuh dari layar utama.

- `src/app/manifest.ts` → `/manifest.webmanifest` (nama *Kopi Calf*, `display: standalone`, `start_url: /`); ikon di `public/icons/` (192, 512, maskable 512, `apple-touch-icon` 180) dirender dari `src/app/icon.svg`.
- `src/app/layout.tsx`: metadata `appleWebApp` (judul, status bar), `apple-mobile-web-app-capable` untuk iOS lama, `apple-touch-icon`, `theme-color` terang/gelap. iOS tidak punya prompt instal; Safari (dan Chrome/Edge/Firefox iOS ≥ 16.4) memakai **Bagikan → Tambah ke Layar Utama**.
- `public/sw.js` (didaftarkan di semua halaman lewat `useServiceWorker`): hanya menyimpan `public/offline.html`; navigasi tetap ke jaringan dan menampilkan halaman *Tidak ada koneksi* saat offline. Data, `/api` dan aset Next.js tidak di-cache (data selalu live, deploy baru langsung terpakai).
- `components/InstallApp.tsx` (sekali per login, tepat setelah masuk — tidak muncul lagi saat pindah halaman atau reload; flag `portal.install.pending` di sessionStorage dari `markSignedIn`): iPhone/iPad → kartu langkah *Bagikan → Tambah ke Layar Utama*; Android/desktop → tombol **Pasang** yang memanggil prompt browser (`beforeinstallprompt`). Tidak tampil bila sudah berjalan sebagai aplikasi; *Nanti*/tutup menyembunyikannya 14 hari (`portal.install.later`); menunggu pengingat profil (`[data-bottom-notice]`) ditutup agar tidak bertumpuk.
- **Update otomatis** (`components/AppUpdate.tsx`, `src/app/version.json/route.ts`): tidak perlu uninstall/install ulang. Backend selalu live (semua data lewat `/api`); kode halaman dicocokkan dengan build yang ter-deploy (`/version.json`, ID = commit Vercel, `NEXT_PUBLIC_BUILD_ID` di `next.config.ts`). Saat aplikasi dibuka kembali dari latar belakang dan ada build baru → langsung dimuat ulang (service worker juga diperbarui); saat sedang dipakai, dicek tiap 10 menit dan muncul kartu *Versi baru portal sudah tersedia · Muat ulang* (tidak memuat ulang paksa agar isian SO tidak hilang).
- Catatan iOS: aplikasi di layar utama punya penyimpanan cookie sendiri, jadi user login sekali lagi di dalam aplikasi (pilih *Keep me signed in* agar 30 hari).

## Realtime (WebSocket)

> Data hari ini (panel Today, KPI, MTD) tertinggal **maksimal ~15 menit** pada jam operasional 06:00–24:00 WIB: sinkron ESB di menit :05 (hari ini + kemarin) dan :20/:35/:50 (hari ini), aggregate Overview dibangun ulang di :20/:25/:40/:55; malam hari tetap per jam.


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
│   ├── users/page.tsx          # User Accounts (superadmin)
│   └── activity/page.tsx       # Activity Logs (superadmin)
├── proxy.ts                    # redirect ke /login bila belum ada sesi
├── components/
│   ├── StatStrip.tsx           # ringkasan angka tanpa card (Overview & Sales)
│   ├── ChannelLogo.tsx         # logo channel (JSX & label rich ECharts)
│   ├── UserAvatar.tsx          # foto profil / inisial + AvatarEditor (unggah)
│   ├── AccountDrawers.tsx      # My profile, Change password (+ wajib), pengingat profil
│   ├── WelcomeNotice.tsx       # sapaan setelah login (+ mood)
│   ├── ProfileFields.tsx       # field identitas (My profile & Edit user)
│   ├── ChangePasswordDrawer.tsx
│   ├── ui/Drawer.tsx           # panel geser kanan (form & detail)
│   ├── ui/Dialog.tsx           # modal konfirmasi, field & gaya tombol
│   ├── DateRangePicker.tsx     # preset + kalender (preset & label default per halaman)
│   ├── BranchFilter.tsx, ExportButton.tsx, TransactionDetail.tsx
│   ├── charts/                 # EChart (wrapper ECharts), HBarChart, Sparkline, Legend
│   ├── overview/               # widget Overview (KpiTiles, LiveSalesCard, TrendCard, …)
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
| `POST /api/exports`, `GET /api/exports`, `GET /api/exports/{id}`, `/api/exports/{id}/download` | Export Excel (global, lintas halaman) |
| `GET /api/activity`, `GET /api/activity/summary`, `POST /api/activity/events` | Activity Logs, pencatatan halaman & filter |
| `wss://…/ws`, `GET /api/realtime/version` | Realtime |
| `/api/auth/*` (login, logout, me, password, me/avatar) | Login, profil sidebar |
| `/api/users/*`, `/api/avatars/{id}` | User Accounts, foto profil |

Parameter `branch` di semua endpoint menerima satu kode atau beberapa dipisah koma (`CCI01,CCI04`).

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
