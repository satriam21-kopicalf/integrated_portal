# Integrated Portal

Dashboard transaksi penjualan Kopi Calf (Next.js 16). Data diambil dari backend
[integrated_portal_be](https://github.com/satriam21-kopicalf/integrated_portal_be) melalui proxy `/api/*`.

```bash
npm install
cp .env.example .env.local   # BACKEND_URL, NEXT_PUBLIC_ASSETS_URL (opsional)
npm run dev                  # http://localhost:3002
```

Dokumentasi lengkap: [docs/README.md](docs/README.md). Deploy: Vercel (otomatis dari branch `main`).
