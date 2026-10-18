# Integrated Portal

Dashboard transaksi penjualan Kopi Calf (Next.js 16). Data diambil dari backend
[integrated_portal_be](https://github.com/satriam21-kopicalf/integrated_portal_be) melalui proxy `/api/*`.

```bash
npm install
cp .env.example .env.local   # BACKEND_URL, NEXT_PUBLIC_ASSETS_URL (opsional)
npm run dev                  # http://localhost:3002
```

Dokumentasi lengkap: [docs/README.md](docs/README.md).

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
