# Integrated Portal

Dashboard transaksi penjualan Kopi Calf (Next.js 16). Data diambil dari backend
[integrated_portal_be](https://github.com/satriam21-kopicalf/integrated_portal_be) melalui proxy `/api/*`.

```bash
npm install
cp .env.example .env.local   # BACKEND_URL, NEXT_PUBLIC_ASSETS_URL (opsional)
npm run dev                  # http://localhost:3002
```

Dokumentasi lengkap: [docs/README.md](docs/README.md).

Tampilan HP / tablet (PWA) sama dengan Kopi Calf Operations (fe-operations): app bar di atas (PORTAL, Panduan, akun),
bottom nav mengambang (menu terpilih naik sebagai gelembung biru: Dashboard, Sales, Opname, Form, Menu), sheet Form,
kartu membulat, field 16px. Palet: putih, biru logo `#0E46C7` (`blue-600`) dan merah tua `maroon-700` sebagai aksen
(`scripts/gen-theme.mjs`, lalu `node scripts/gen-theme.mjs`). Login: header biru dengan watermark logo Calf.

## Deploy (Vercel, project `integrated-portal`)

Production (portal.kopicalf.co.id) dibangun dari branch **`dev-portal`**; push ke `main` atau branch lain hanya
membuat *preview URL* di Vercel (tidak mengubah situs live).

```bash
git checkout main            # kerja & commit seperti biasa, push → preview
git checkout dev-portal
git merge main               # bawa perubahan yang siap rilis
git push origin dev-portal   # → deploy production
git checkout main
```
