export type PermissionKey =
  | 'dashboard_view'
  | 'stock_view'
  | 'stock_create'
  | 'stock_edit'
  | 'stock_delete'
  | 'batch_view'
  | 'batch_create'
  | 'batch_edit'
  | 'batch_review'
  | 'batch_delete'
  | 'weight_view'
  | 'weight_record'
  | 'weight_delete'
  | 'health_view'
  | 'health_record'
  | 'health_delete'
  | 'sales_view'
  | 'sales_record'
  | 'sales_delete'
  | 'costs_view'
  | 'costs_record'
  | 'costs_delete'
  | 'analytics_view'
  | 'settings_manage'
  | 'farms_manage'
  | 'feed_view'
  | 'feed_record'
  | 'feed_own_products'
  | 'feed_manage';

export interface PermissionCategory {
  id: string;
  label: string;
  items: { key: PermissionKey; label: string; description: string }[];
}

export const PERMISSION_MODULES: PermissionCategory[] = [
  {
    id: 'dashboard',
    label: '📊 Dashboard Overview',
    items: [
      { key: 'dashboard_view', label: 'View Dashboard', description: 'Access main KPI overview and metrics.' }
    ]
  },
  {
    id: 'stock',
    label: '🐄 Livestock Inventory',
    items: [
      { key: 'stock_view', label: 'View Cattle Inventory', description: 'Access list of active and archived stock.' },
      { key: 'stock_create', label: 'Register New Cattle', description: 'Add new cattle profiles to herd list.' },
      { key: 'stock_edit', label: 'Modify Cattle Details', description: 'Update age, breed, weight, and stats.' },
      { key: 'stock_delete', label: 'Delete Cattle Records', description: 'Permanently remove cattle logs from database.' }
    ]
  },
  {
    id: 'batch',
    label: '🌾 Fattening Programs',
    items: [
      { key: 'batch_view', label: 'View Fattening Batches', description: 'Access list of active feeding batches.' },
      { key: 'batch_create', label: 'Create Fattening Groups', description: 'Define new feeding programs and rations.' },
      { key: 'batch_edit', label: 'Modify Feeding Groups', description: 'Assign/remove cattle and update feed targets.' },
      { key: 'batch_review', label: 'Review batches for sale', description: 'Decide, when a batch nears its selling date, to sell it or keep feeding with a new date. Changes no cattle records.' },
      { key: 'batch_delete', label: 'Delete Fattening Groups', description: 'Close and delete feed batch configurations.' }
    ]
  },
  {
    id: 'weight',
    label: '⚖️ Growth & Weight Tracker',
    items: [
      { key: 'weight_view', label: 'View Weight Logs', description: 'Access ADG growth progress histories.' },
      { key: 'weight_record', label: 'Record Weight Events', description: 'Log new weight check metrics for cattle.' },
      { key: 'weight_delete', label: 'Delete Weight Logs', description: 'Void or remove past weight tracking records.' }
    ]
  },
  {
    id: 'health',
    label: '🩺 Health & Treatment Logs',
    items: [
      { key: 'health_view', label: 'View Medical Ledger', description: 'Access vaccine and clinical log charts.' },
      { key: 'health_record', label: 'Log Treatment/Vaccines', description: 'Record medical injections and medications.' },
      { key: 'health_delete', label: 'Delete Treatment Records', description: 'Remove historical clinical records.' }
    ]
  },
  {
    id: 'sales',
    label: '💰 Sales Revenue Tracking',
    items: [
      { key: 'sales_view', label: 'View Sales Revenue', description: 'Access records of sold cattle and values.' },
      { key: 'sales_record', label: 'Record Sales Events', description: 'Log cattle checkout parameters and income.' },
      { key: 'sales_delete', label: 'Void Sales Records', description: 'Rollback checkout transactions.' }
    ]
  },
  {
    id: 'costs',
    label: '🧾 Farm Running Costs',
    items: [
      { key: 'costs_view', label: 'View running costs', description: 'See wages, power and water, fuel, repairs and other farm costs.' },
      { key: 'costs_record', label: 'Record running costs', description: 'Write down a cost paid; a farm account only for its own farm.' },
      { key: 'costs_delete', label: 'Delete running costs', description: 'Remove a cost that was written down by mistake.' }
    ]
  },
  {
    id: 'analytics',
    label: '📈 Business Intelligence Reports',
    items: [
      { key: 'analytics_view', label: 'View Analytics', description: 'Access profit, loss, and cost breakdown charts.' }
    ]
  },
  {
    id: 'feed',
    label: '📦 Cattle Feed Stock Management',
    items: [
      { key: 'feed_view', label: 'View Cattle Feed Inventory', description: 'Access feed balances, product catalog, and transaction logs.' },
      { key: 'feed_record', label: 'Record daily feed use', description: 'Write down what each batch ate today (bags, grass); a farm account only for its own farm.' },
      { key: 'feed_own_products', label: 'Add and edit own feed products', description: 'Make feed products for your own farm and change them. The default products set by the office cannot be changed.' },
      { key: 'feed_manage', label: 'Manage Cattle Feed Stock', description: 'Add/edit/delete feed products, log procurement stock-in, and manage categories.' }
    ]
  },
  {
    id: 'settings',
    label: '⚙️ Settings & Farms',
    items: [
      { key: 'settings_manage', label: 'Manage settings and office people', description: 'Add and change office accounts and roles, and the choices in forms such as breeds and vaccines.' },
      { key: 'farms_manage', label: 'Manage farms and their people', description: 'Add, rename and remove farms, and add, change or remove each farm\'s owner, staff and vets.' }
    ]
  }
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_MODULES.flatMap(m => m.items.map(i => i.key));

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  'Super Admin': ALL_PERMISSIONS,
  'Admin': ALL_PERMISSIONS,
  'Company': [...ALL_PERMISSIONS.filter(p => p !== 'settings_manage'), 'settings_manage'],
  'Farm Owner': ALL_PERMISSIONS.filter(p => p !== 'settings_manage' && p !== 'farms_manage' && p !== 'feed_manage'),
  'Farm Staff': ['dashboard_view', 'stock_view', 'batch_view', 'weight_view', 'weight_record', 'health_view', 'health_record', 'feed_view', 'feed_record', 'costs_view', 'costs_record'],
  'Veterinarian': ['dashboard_view', 'stock_view', 'stock_edit', 'weight_view', 'weight_record', 'health_view', 'health_record', 'health_delete', 'feed_view'],
  // Read-only oversight: sees every report, changes nothing. This is the
  // role intended for PIN sign-in on the mobile app, so it deliberately
  // holds no create/edit/delete permission at all — a shorter credential
  // must not unlock a wider set of actions. The one exception is Planning
  // (PLANNING_ROLES in lib/utils.ts): Management may save and delete plans,
  // which never change the real herd.
  'Management': ['dashboard_view', 'stock_view', 'batch_view', 'batch_review', 'weight_view', 'health_view', 'sales_view', 'costs_view', 'analytics_view', 'feed_view']
};

export interface CustomRoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionKey[];
  isSystem?: boolean;
}

export interface UserRoleItem {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Company' | 'Farm Owner' | 'Farm Staff' | 'Veterinarian' | 'Management' | string;
  status: 'Active' | 'Inactive';
  password?: string;
  // Write-only: a plaintext PIN to validate and hash server-side (mobile
  // app PIN sign-in). Never populated on read — see `hasPin` for whether
  // this account already has one, without ever exposing it.
  pin?: string;
  // Write-only signal: explicitly remove PIN sign-in for this account,
  // regardless of whether `pin` also carries a value.
  clearPin?: boolean;
  // Read-only: whether a PIN is currently set. Derived server-side from
  // pin_hash being non-null — the hash itself is never sent to clients.
  hasPin?: boolean;
  permissions?: PermissionKey[];
  farmLocation?: string;
}

export interface FarmItem {
  id: string;
  name: string;
  ownerId?: string;
  managerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
  address?: string;
  capacity?: number;
  notes?: string;
  /** Run by the company itself: office accounts do its work, so having no farm owner is normal. */
  companyRun?: boolean;
}

export interface MasterSetup {
  breeds: string[];
  buyTypes: string[];
  healthStatuses: string[];
  vaccineTypes: string[];
  feedTypes: string[];
  paymentMethods: string[];
  sexes: string[];
  diseaseTypes: string[];
  batchTypes: string[];
  weightUnits: string[];
  revenueTypes: string[];
  purchaseTypes: string[];
  /** Kinds of farm running cost (Costs page). Missing in older settings: the defaults are used. */
  costCategories?: string[];
  users: UserRoleItem[];
  roles?: CustomRoleDefinition[];
  farms?: FarmItem[];
}
