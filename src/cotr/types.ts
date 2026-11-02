// Rows of the COTR API (integrated_portal_be app/cotr.py): masters as the tables hold them (snake_case), monitoring as
// the API shapes it (camelCase).

export type Pool = { code: string; name: string; kind: 'main' | 'parent' | 'storage'; parent_code: string | null; city: string; address: string; storage: string[]; is_active: boolean;
  /** migration 062: the batches are produced here */ is_production?: boolean;
  latitude: number | null; longitude: number | null; radius_m: number; pic_name: string | null; phone: string | null; open_time: string | null; close_time: string | null; note: string | null };
export type Fleet = { code: string; name: string | null; type: string; plate: string | null; pool_code: string; capacity: number; condition: 'good' | 'service'; last_service: string | null; is_active: boolean;
  brand: string | null; model: string | null; frame_no: string | null; acquired_on: string | null; qris_bank: string | null; qris_nmid: string | null; qris_merchant: string | null; note: string | null;
  has_photo: boolean; has_qris: boolean; updated_at: string };
export type FleetType = { code: string; name: string; sort: number };
export type BomLine = { item: string; qty: number; unit: string };
export type BomUnit = { name: string; grams: number };
// a premix batch (output = a premix item, units = its containers) or the recipe card of one cup / can of a menu
export type Bom = { code: string; name: string; output: string; yield_qty: number; yield_unit: string; lines: BomLine[]; kind: 'premix' | 'menu'; units: BomUnit[]; note: string | null };
export type ItemCategory = 'raw' | 'premix' | 'packaging' | 'supply' | 'tools' | 'other';
export type Item = { code: string; name: string; category: ItemCategory; unit: string; pack_unit: string | null; pack_qty: number | null; cost: number | null; is_stock: boolean; is_active: boolean; note: string | null };
export type Menu = { code: string; name: string; category: string; price: number; bom_code: string | null; is_active: boolean; sort: number;
  /** migration 062: days a batch keeps (its default expiry) */ shelf_life_days?: number | null };
export type Driver = { code: string; name: string; phone: string; pool_code: string; fleet_code: string | null; status: 'active' | 'leave' | 'inactive'; joined_on: string | null; user_id: string | null; account: string | null;
  nik?: string | null; birth_place: string | null; birth_date: string | null; gender: 'male' | 'female' | null; address: string | null; emergency_name: string | null; emergency_phone: string | null;
  employment_status: 'permanent' | 'contract' | 'daily' | 'intern' | null; position: string | null; contract_end: string | null;
  salary_monthly?: number | null; allowance_monthly?: number | null; bank_name?: string | null; bank_account?: string | null; bank_holder?: string | null; note: string | null;
  has_photo: boolean; updated_at: string;
  /** the sample DATA COTR (migration 060): employee id, nickname, department, bike */
  employee_id?: string | null; nickname?: string | null; department?: string | null; bike_code?: string | null };
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
