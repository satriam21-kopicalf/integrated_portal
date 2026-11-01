// Calf On The Road (COTR) prototype (2026-11-01): sample data of the Monitoring COTR pages, kept in the browser until
// the backend exists. Drivers sell from a fleet (motor / gerobak) loaded at a pool / HUB; the HUB holds the storage of
// menus and raw materials and produces the premix / batches the drivers carry. Nothing here is read from ESB.

export type DriverStatus = 'active' | 'leave' | 'inactive';
export type Driver = {
  id: string; code: string; name: string; phone: string; pool: string; fleet: string | null; status: DriverStatus;
  joined: string; account: string | null;
};
export type FleetType = 'motor' | 'gerobak' | 'sepeda';
export type Fleet = {
  id: string; code: string; type: FleetType; plate: string | null; pool: string; capacity: number; condition: 'good' | 'service';
  lastService: string;
};
export type PoolKind = 'main' | 'parent' | 'storage';
export type Pool = {
  id: string; code: string; name: string; kind: PoolKind; parent: string | null; city: string; address: string;
  storage: string[]; // what is kept there (menus, raw materials, packaging)
};
export type Menu = { id: string; code: string; name: string; category: string; price: number; active: boolean; bom: string | null };
export type BomLine = { item: string; qty: number; unit: string };
export type Bom = { id: string; code: string; name: string; output: string; yieldQty: number; yieldUnit: string; lines: BomLine[] };
export type CheckIn = {
  id: string; driver: string; pool: string; fleet: string; at: string; kind: 'start' | 'reload' | 'end';
  location: string; photo: boolean; stock: number; note: string | null;
};
export type SalesDay = { day: string; menu: string; qty: number };
export type Waste = { id: string; day: string; pool: string; item: string; qty: number; unit: string; reason: string };

export const POOLS: Pool[] = [
  { id: 'p1', code: 'HUB-BDG', name: 'HUB COTR Bandung', kind: 'main', parent: null, city: 'Bandung', address: 'Jl. Supratman 12',
    storage: ['Menu jadi', 'Bahan baku', 'Kemasan'] },
  { id: 'p2', code: 'POOL-DAGO', name: 'Pool Dago', kind: 'parent', parent: 'HUB-BDG', city: 'Bandung', address: 'Jl. Ir. H. Juanda 88',
    storage: ['Menu jadi', 'Es batu'] },
  { id: 'p3', code: 'POOL-BUAH', name: 'Pool Buah Batu', kind: 'parent', parent: 'HUB-BDG', city: 'Bandung', address: 'Jl. Buah Batu 201',
    storage: ['Menu jadi', 'Es batu'] },
  { id: 'p4', code: 'STR-BDG-01', name: 'Cold storage HUB Bandung', kind: 'storage', parent: 'HUB-BDG', city: 'Bandung', address: 'HUB COTR Bandung',
    storage: ['Fresh milk', 'Espresso', 'Premix'] },
];

export const FLEET: Fleet[] = [
  { id: 'f1', code: 'COTR-M01', type: 'motor', plate: 'D 4521 ABC', pool: 'POOL-DAGO', capacity: 120, condition: 'good', lastService: '2026-10-12' },
  { id: 'f2', code: 'COTR-M02', type: 'motor', plate: 'D 3310 KCF', pool: 'POOL-DAGO', capacity: 120, condition: 'good', lastService: '2026-10-20' },
  { id: 'f3', code: 'COTR-M03', type: 'motor', plate: 'D 6677 CTR', pool: 'POOL-BUAH', capacity: 120, condition: 'service', lastService: '2026-09-02' },
  { id: 'f4', code: 'COTR-G01', type: 'gerobak', plate: null, pool: 'POOL-BUAH', capacity: 200, condition: 'good', lastService: '2026-10-01' },
  { id: 'f5', code: 'COTR-S01', type: 'sepeda', plate: null, pool: 'HUB-BDG', capacity: 60, condition: 'good', lastService: '2026-10-25' },
];

export const DRIVERS: Driver[] = [
  { id: 'd1', code: 'DRV-001', name: 'Rizki Pratama', phone: '0812-2201-1001', pool: 'POOL-DAGO', fleet: 'COTR-M01', status: 'active', joined: '2026-08-01', account: 'drv.rizki' },
  { id: 'd2', code: 'DRV-002', name: 'Dimas Saputra', phone: '0812-2201-1002', pool: 'POOL-DAGO', fleet: 'COTR-M02', status: 'active', joined: '2026-08-01', account: 'drv.dimas' },
  { id: 'd3', code: 'DRV-003', name: 'Agus Hidayat', phone: '0812-2201-1003', pool: 'POOL-BUAH', fleet: 'COTR-G01', status: 'active', joined: '2026-09-15', account: 'drv.agus' },
  { id: 'd4', code: 'DRV-004', name: 'Fajar Nugraha', phone: '0812-2201-1004', pool: 'POOL-BUAH', fleet: null, status: 'leave', joined: '2026-09-15', account: 'drv.fajar' },
  { id: 'd5', code: 'DRV-005', name: 'Yoga Permana', phone: '0812-2201-1005', pool: 'HUB-BDG', fleet: 'COTR-S01', status: 'active', joined: '2026-10-10', account: null },
];

export const BOMS: Bom[] = [
  { id: 'b1', code: 'BOM-EKC', name: 'Es Kopi Calf (cup)', output: 'Es Kopi Calf', yieldQty: 1, yieldUnit: 'cup',
    lines: [{ item: 'Premix Es Kopi Calf', qty: 150, unit: 'g' }, { item: 'Es batu', qty: 120, unit: 'g' }, { item: 'Cup 16oz + lid', qty: 1, unit: 'pcs' }] },
  { id: 'b2', code: 'BOM-PRM-EKC', name: 'Premix Es Kopi Calf (batch)', output: 'Premix Es Kopi Calf', yieldQty: 5000, yieldUnit: 'g',
    lines: [{ item: 'Fresh milk', qty: 2800, unit: 'g' }, { item: 'Espresso premium', qty: 1300, unit: 'g' }, { item: 'Creamer', qty: 520, unit: 'g' }, { item: 'Gula aren', qty: 380, unit: 'g' }] },
  { id: 'b3', code: 'BOM-ECH', name: 'Es Coklat (cup)', output: 'Es Coklat', yieldQty: 1, yieldUnit: 'cup',
    lines: [{ item: 'Premix coklat', qty: 160, unit: 'g' }, { item: 'Es batu', qty: 120, unit: 'g' }, { item: 'Cup 16oz + lid', qty: 1, unit: 'pcs' }] },
  { id: 'b4', code: 'BOM-AMR', name: 'Americano (cup)', output: 'Americano', yieldQty: 1, yieldUnit: 'cup',
    lines: [{ item: 'Espresso premium', qty: 36, unit: 'g' }, { item: 'Air mineral', qty: 180, unit: 'g' }, { item: 'Es batu', qty: 120, unit: 'g' }, { item: 'Cup 16oz + lid', qty: 1, unit: 'pcs' }] },
];

export const MENUS: Menu[] = [
  { id: 'm1', code: 'COTR-EKC', name: 'Es Kopi Calf', category: 'Kopi susu', price: 15000, active: true, bom: 'BOM-EKC' },
  { id: 'm2', code: 'COTR-AMR', name: 'Americano', category: 'Kopi hitam', price: 12000, active: true, bom: 'BOM-AMR' },
  { id: 'm3', code: 'COTR-ECH', name: 'Es Coklat', category: 'Non kopi', price: 14000, active: true, bom: 'BOM-ECH' },
  { id: 'm4', code: 'COTR-MTC', name: 'Es Matcha', category: 'Non kopi', price: 16000, active: false, bom: null },
];

// the last 7 days of sales per menu (cups), the base of the production plan
const DAYS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
const PER_DAY: Record<string, number[]> = {
  'Es Kopi Calf': [182, 165, 171, 176, 190, 238, 226],
  Americano: [41, 38, 36, 44, 47, 55, 52],
  'Es Coklat': [58, 49, 52, 55, 61, 77, 70],
};
export const SALES: SalesDay[] = DAYS.flatMap((day, i) => Object.entries(PER_DAY).map(([menu, q]) => ({ day, menu, qty: q[i] })));

export const WASTE: Waste[] = [
  { id: 'w1', day: '2026-10-31', pool: 'POOL-DAGO', item: 'Premix Es Kopi Calf', qty: 600, unit: 'g', reason: 'Melewati jam simpan' },
  { id: 'w2', day: '2026-10-31', pool: 'POOL-BUAH', item: 'Cup 16oz + lid', qty: 12, unit: 'pcs', reason: 'Rusak di perjalanan' },
  { id: 'w3', day: '2026-11-01', pool: 'HUB-BDG', item: 'Fresh milk', qty: 946, unit: 'g', reason: 'Kemasan bocor' },
];

export const CHECK_INS: CheckIn[] = [
  { id: 'c1', driver: 'DRV-001', pool: 'POOL-DAGO', fleet: 'COTR-M01', at: '2026-11-01T06:42:00+07:00', kind: 'start', location: 'Pool Dago', photo: true, stock: 110, note: null },
  { id: 'c2', driver: 'DRV-002', pool: 'POOL-DAGO', fleet: 'COTR-M02', at: '2026-11-01T06:55:00+07:00', kind: 'start', location: 'Pool Dago', photo: true, stock: 115, note: null },
  { id: 'c3', driver: 'DRV-003', pool: 'POOL-BUAH', fleet: 'COTR-G01', at: '2026-11-01T07:10:00+07:00', kind: 'start', location: 'Pool Buah Batu', photo: true, stock: 180, note: 'Es batu kurang 2 kg' },
  { id: 'c4', driver: 'DRV-001', pool: 'POOL-DAGO', fleet: 'COTR-M01', at: '2026-11-01T11:35:00+07:00', kind: 'reload', location: 'Pool Dago', photo: true, stock: 80, note: null },
  { id: 'c5', driver: 'DRV-005', pool: 'HUB-BDG', fleet: 'COTR-S01', at: '2026-11-01T08:02:00+07:00', kind: 'start', location: 'Jl. Riau (2,1 km dari HUB)', photo: false, stock: 55, note: 'Foto gagal diunggah' },
  { id: 'c6', driver: 'DRV-002', pool: 'POOL-DAGO', fleet: 'COTR-M02', at: '2026-11-01T17:48:00+07:00', kind: 'end', location: 'Pool Dago', photo: true, stock: 9, note: null },
];

export const driverName = (code: string) => DRIVERS.find((d) => d.code === code)?.name ?? code;
export const poolName = (code: string) => POOLS.find((p) => p.code === code)?.name ?? code;
export const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
