# DJI Pocket Savings Tracker

Website tracker pemasukan, pengeluaran, dan progress tabungan DJI Pocket.

## Fitur
- Pemasukan dan pengeluaran dipisah.
- Kategori: Uang Bulanan, Tabungan DJI, Makan & Jajan, Transportasi, Skincare, Hiburan, Topup e-Money, Tarik Tunai, Lainnya.
- Nominal otomatis format Rupiah, contoh `1000000` jadi `Rp1.000.000`.
- Progress menuju target `Rp8.100.000`.
- Estimasi selesai jika nabung `Rp500.000/bulan`.
- Export/import JSON.
- Mode cloud tanpa login email memakai Supabase RPC + vaultKey.

## Cara pakai cloud tanpa login

1. Buka Supabase > SQL Editor.
2. Copy isi `database.sql`, lalu Run.
3. Buka `script.js`.
4. Isi bagian ini:

```js
const CONFIG = {
  targetAmount: 8100000,
  monthlySaving: 500000,
  supabaseUrl: "https://PROJECT_KAMU.supabase.co",
  supabaseAnonKey: "sb_publishable_...",
  vaultKey: "kode-rahasia-panjang-kamu"
};
```

5. Upload ke GitHub Pages.

Pakai `vaultKey` yang sama di semua device supaya datanya sama.

## Catatan keamanan
Mode ini sengaja dibuat tanpa login biar gampang. Tapi karena GitHub Pages adalah frontend/static, `vaultKey` di `script.js` bisa dilihat orang kalau repo/site publik. Jangan pakai untuk data yang sangat sensitif. Untuk keamanan paling bagus, pakai versi login Supabase Auth.
