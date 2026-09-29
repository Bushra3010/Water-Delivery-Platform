/* Domain model for the whole platform. Each interface maps 1:1 to a future
 * Supabase table (see README → "Moving to Supabase"). Map positions use a
 * local grid: 100 units = 1 km. */

export type ID = string;
export interface Pt { x: number; y: number }

/* ── Geography ── */
export interface City { id: ID; name: string; state: string; active: boolean }
export interface Locality { id: ID; cityId: ID; name: string; pin: string; center: Pt }

/** A vendor's coverage. Methods are combined with `rule`: "any" = inside at least one, "all" = inside every configured method. */
export interface ServiceArea {
  rule: "any" | "all";
  radiusKm: number | null;
  pins: string[];
  localities: ID[];
  polygon: Pt[] | null;
}

/* ── Accounts ── */
export type AccountStatus = "Active" | "Inactive" | "Suspended" | "Blocked" | "Pending";
export type KycStatus = "Verified" | "Pending" | "Rejected";

export interface KycDoc { name: string; status: KycStatus | "Missing" }

export interface Vendor {
  id: ID; name: string; owner: string; phone: string; email: string;
  cityId: ID; address: string; location: Pt;
  status: AccountStatus; kyc: KycStatus; docs: KycDoc[];
  gstin: string | null; gstRate: number;
  /** Platform subscription the vendor pays for (vendor monetization). */
  planId: ID | null; planExpiry: number;
  monetization: { mode: "subscription" | "commission" | "both"; commissionPct: number };
  paymentMode: "platform" | "direct";
  area: ServiceArea;
  joinedAt: number;
}

export interface Driver {
  id: ID; vendorId: ID; name: string; phone: string;
  status: AccountStatus; kyc: KycStatus; licence: string; idProof: string;
  online: boolean; loc: Pt; vehicleId: ID | null; joinedAt: number;
}

export interface Vehicle {
  id: ID; vendorId: ID; number: string; type: "E-Rickshaw" | "Tempo" | "Pickup Van" | "Bike";
  capacity: number; status: "Active" | "Inactive" | "Maintenance"; driverId: ID | null;
}

export interface Customer {
  id: ID; name: string; phone: string; lang: string; status: AccountStatus;
  /** Platform cans currently at the customer's home (reusable-can balance). */
  cansHeld: number; joinedAt: number;
}

export interface Address {
  id: ID; customerId: ID; label: "Home" | "Office" | "Other"; line: string; landmark: string;
  localityId: ID; pin: string; pt: Pt; isDefault: boolean;
}

/* ── Catalogue & pricing ── */
export type Art = "can20" | "can10" | "bottle" | "carton" | "jar";
/** Platform catalogue item. Vendors list SKUs with their own price inside the admin range. */
export interface Sku { id: ID; name: string; size: string; art: Art; desc: string; returnable: boolean }
export interface PriceRule { skuId: ID; min: number; max: number }
export interface VendorProduct {
  id: ID; vendorId: ID; skuId: ID; price: number; active: boolean; inStock: boolean; taxable: boolean;
  history: { at: number; price: number; by: string }[];
}

/* ── Orders & dispatch ── */
export type OrderStatus =
  | "Placed" | "Searching" | "Assigned" | "Accepted" | "Pickup" | "Out for Delivery" | "Arrived"
  | "Delivered" | "Payment Confirmed" | "Completed" | "Cancelled" | "Failed Assignment";

export type PayMethod = "COD" | "UPI" | "Wallet" | "Subscription";
export type PayStatus = "Pending" | "Paid" | "Collected" | "Refund Pending" | "Refunded" | "Failed" | "Covered";

export interface OrderItem { skuId: ID; name: string; qty: number; price: number }

export interface DispatchAttempt {
  driverId: ID; vendorId: ID; distKm: number; at: number;
  result: "Offered" | "Accepted" | "Rejected" | "Timeout" | "Withdrawn" | "Manual";
}

export interface Rating { driver: number; vendor: number; product: number; comment: string; tags: string[] }

export interface Order {
  id: ID; customerId: ID; createdAt: number;
  address: { label: string; line: string; pin: string; localityId: ID; pt: Pt };
  items: OrderItem[];
  subtotal: number; tax: number; deliveryFee: number; deposit: number; discount: number; coupon: string | null; total: number;
  payment: { method: PayMethod; status: PayStatus; routing: "platform" | "direct"; ref: string | null };
  type: "Immediate" | "Scheduled";
  slot: { date: number; window: string } | null;
  subscriptionId: ID | null;
  status: OrderStatus;
  vendorId: ID | null; driverId: ID | null;
  attempts: DispatchAttempt[];
  /** Index into `attempts` where the current dispatch round began (a manual retry starts a new round). */
  roundStart?: number;
  offer: { driverId: ID; until: number; at: number } | null;
  timeline: { status: OrderStatus; at: number; by?: string }[];
  track: { from: Pt; outAt: number | null; travelMs: number } | null;
  otp: string;
  proofPhoto: boolean;
  cans: { expected: number; returned: number | null; note: string | null };
  rating: Rating | null;
  cancel: { by: string; reason: string; fee: number } | null;
  invoiceNo: string | null;
}

/* ── Subscriptions ── */
export interface Plan {
  id: ID; owner: "platform" | ID; name: string; desc: string; skuId: ID;
  price: number; validityDays: number; entitlement: number;
  mode: "On-demand" | "Scheduled" | "Both";
  maxPerDay: number | null;
  unused: "Expire" | "Carry forward";
  autoRenew: boolean; active: boolean;
}

export interface CustomerSub {
  id: ID; customerId: ID; planId: ID; start: number; end: number; used: number; carried: number;
  autoRenew: boolean; status: "Active" | "Expired" | "Cancelled";
  schedule: { every: "Daily" | "Alternate days" | "Weekly"; qty: number; window: string } | null;
  ledger: { at: number; delta: number; note: string; orderId?: ID }[];
}

/** What vendors pay the platform. */
export interface VendorPlan { id: ID; name: string; fee: number; days: number; perks: string }

/* ── Money ── */
export interface WalletTxn { id: ID; customerId: ID; amount: number; title: string; at: number; ref?: string }

export interface Coupon {
  code: string; desc: string; kind: "flat" | "pct"; value: number; maxOff: number | null;
  minOrder: number; limit: number; used: number; perUser: number; active: boolean; validTill: number;
}

export interface Settlement {
  id: ID; vendorId: ID; period: string; orders: number; gross: number; commission: number; fee: number; net: number;
  status: "Pending Review" | "Approved" | "Paid"; approvedBy: string | null; at: number; ref: string | null;
}

/* ── Admin & system ── */
export type AdminSection =
  | "dashboard" | "vendors" | "customers" | "drivers" | "orders" | "pricing" | "monetization" | "plans"
  | "payments" | "settlements" | "coupons" | "ads" | "cities" | "reports" | "rbac" | "audit" | "settings";

export interface Role { id: ID; name: string; sections: AdminSection[]; readOnly: boolean; desc: string }
export interface Staff { id: ID; name: string; email: string; roleId: ID; active: boolean }
export interface AuditEntry { id: ID; at: number; actor: string; role: string; action: string; target: string; detail: string }

export interface Notice { id: ID; to: string; title: string; body: string; at: number; read: boolean; orderId?: ID }

export interface Settings {
  dispatchTimeoutSec: number;
  maxAttempts: number;
  searchRadiusKm: number;
  freeCancelUntil: "Searching" | "Accepted" | "Out for Delivery";
  cancelFee: number;
  deliveryFee: number;
  canDeposit: number;
  payModes: { cod: boolean; upi: boolean; wallet: boolean };
  defaultRouting: "platform" | "direct";
  vendorExpiry: "Stop new orders" | "Grace period (7 days)" | "Allow orders";
  languages: { code: string; name: string; enabled: boolean }[];
  ads: { enabled: boolean; homeBanner: boolean; ordersNative: boolean; interstitial: boolean; unitId: string };
  notify: { renewalDaysBefore: number; scheduledReminderMins: number };
  support: { phone: string; whatsapp: string };
  slots: string[];
}

export interface DB {
  version: number;
  cities: City[]; localities: Locality[];
  vendors: Vendor[]; drivers: Driver[]; vehicles: Vehicle[];
  customers: Customer[]; addresses: Address[];
  skus: Sku[]; priceRules: PriceRule[]; products: VendorProduct[];
  orders: Order[];
  plans: Plan[]; subs: CustomerSub[]; vendorPlans: VendorPlan[];
  wallet: WalletTxn[]; coupons: Coupon[]; settlements: Settlement[];
  roles: Role[]; staff: Staff[]; audit: AuditEntry[];
  notices: Notice[];
  settings: Settings;
  seq: number;
}
