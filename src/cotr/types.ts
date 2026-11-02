// Rows of the COTR API (integrated_portal_be app/cotr.py): masters as the tables hold them (snake_case), monitoring as
// the API shapes it (camelCase).

export type Pool = { code: string; name: string; kind: 'main' | 'parent' | 'storage'; parent_code: string | null; city: string; address: string; storage: string[]; is_active: boolean };
export type Fleet = { code: string; type: 'motor' | 'gerobak' | 'sepeda'; plate: string | null; pool_code: string; capacity: number; condition: 'good' | 'service'; last_service: string | null; is_active: boolean };
export type BomLine = { item: string; qty: number; unit: string };
export type Bom = { code: string; name: string; output: string; yield_qty: number; yield_unit: string; lines: BomLine[] };
export type Menu = { code: string; name: string; category: string; price: number; bom_code: string | null; is_active: boolean; sort: number };
export type Driver = { code: string; name: string; phone: string; pool_code: string; fleet_code: string | null; status: 'active' | 'leave' | 'inactive'; joined_on: string | null; user_id: string | null; account: string | null };
export type DriverAccount = { id: string; username: string; name: string; driver: string | null };

export type Stock = Record<string, number>;
export type Recap = { cups: number; total: number; cash: number; qris: number; voided: number; perMenu: { code: string; name: string; qty: number; total: number }[]; reloaded: number; requested: number; difference: Record<string, number> | null;
  waste: number; cupping: number; cashSpent: number; cashActual: number | null; cashExpected: number; balance: number | null };
export type ShiftCheckIn = { id: string; kind: 'start' | 'end'; at: string; lat: number | null; lng: number | null; stock: Stock; note: string | null; hasPhoto: boolean; hasSignature: boolean };
export type Shift = {
  id: string; driver: string; driverName: string | null; pool: string | null; poolName: string | null; fleet: string | null; status: 'open' | 'closed';
  startedAt: string; endedAt: string | null; startStock: Stock; stock: Stock; endNote: string | null; checkIns: ShiftCheckIn[]; recap: Recap;
};
export type Reload = { id: string; at: string; lines: Stock; note: string | null; status: 'requested' | 'approved' | 'rejected' | 'disputed' | 'received'; decisionNote: string | null; receivedAt: string | null; driver: string | null };
export type Request = { id: string; at: string; kind: string; amount: number; note: string; status: 'sent' | 'approved' | 'rejected'; decisionNote: string | null; driverCode: string; driverName: string | null };
export type Monitor = { day: string; shifts: Shift[]; notStarted: { code: string; name: string; pool: string }[]; reloads: Reload[]; requests: Request[] };
