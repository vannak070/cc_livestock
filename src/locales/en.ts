import { en as flowEn } from './sections/flow';
import { en as todayPageEn } from './sections/todayPage';
import { en as cattlePageEn } from './sections/cattlePage';
import { en as weightsPageEn } from './sections/weightsPage';
import { en as weighFlowEn } from './sections/weighFlow';
import { en as healthPageEn } from './sections/healthPage';
import { en as treatFlowEn } from './sections/treatFlow';
import { en as feedPageEn } from './sections/feedPage';
import { en as feedFlowsEn } from './sections/feedFlows';
export const en = {
  // Navigation & Header
  nav: {
    dashboard: 'Summary',
    today: 'Today',
    summary: 'Summary',
    weights: 'Weights',
    dailyWork: 'Daily work',
    office: 'Office',
    record: 'Record',
    recordTitle: 'What do you want to record?',
    more: 'More',
    people: 'People',
    closeMenu: 'Close menu',
    signOut: 'Sign out',
    cattleRegistry: 'Cattle',
    batchManagement: 'Batches',
    feedStock: 'Feed',
    healthVaccines: 'Health',
    financeLedger: 'Sales',
    analytics: 'Reports',
    proposalPlan: 'Planning',
    costs: 'Costs',
    farmsBranches: 'Farms',
    masterSettings: 'Settings',
    systemTitle: 'CC Livestock',
    systemSubtitle: 'Fattening Livestock Management System',
    role: 'Role',
    logout: 'Sign Out',
    overview: 'Overview',
    livestockErp: 'Livestock ERP',
    financials: 'Financials',
    insights: 'Insights',
    administration: 'Administration'
  },

  // Common Actions & Buttons
  common: {
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    search: 'Search...',
    reset: 'Reset',
    filter: 'Filter',
    allFarms: 'All Farms & Branches',
    actions: 'Actions',
    status: 'Status',
    date: 'Date',
    notes: 'Notes',
    total: 'Total',
    confirm: 'Confirm',
    close: 'Close',
    loading: 'Loading...',
    clear: 'Clear',
    select: 'Select',
    head: 'head'
  },

  // Cattle Inventory Table & Forms
  inventory: {
    title: 'Fattening Cattle Registry',
    subtitle: 'Manage cattle stock, view growth, and track biological profiles.',
    registerCow: 'Register Fattening Cattle',
    cowId: 'Cow ID',
    farm: 'Farm / Location',
    breed: 'Breed',
    sex: 'Sex',
    initialWeight: 'Initial Weight',
    currentWeight: 'Current Weight',
    purchasePrice: 'Purchase Price',
    healthStatus: 'Health Status',
    status: 'Status',
    active: 'Active',
    sold: 'Sold',
    quarantine: 'Quarantine',
    dead: 'Dead',
    noCows: 'No stock items match active filters.',
    searchPlaceholder: 'Search Tag ID or Breed...',
    paymentMethod: 'Payment Method',
    purchaseType: 'Purchase Type',
    supplier: 'Supplier / Owner',
    remark: 'Remark / Notes'
  },

  // Weight & Growth
  weight: {
    title: 'Herd Weight Tracking & Growth Log',
    logWeight: 'Log Cattle Weight',
    oldWeight: 'Previous Weight',
    currentWeight: 'Current Weight',
    weightGain: 'Weight Gain / Loss',
    adg: 'Average Daily Gain (ADG)',
    trackingDate: 'Log Date',
    recordWeights: 'Record Weights'
  },

  // Batches & Diet Management
  batches: {
    title: 'Fattening Management & Rations',
    subtitle: 'Manage rations, weights, and average daily gain (ADG) for the entire fattening herd.',
    newBatch: 'New Batch',
    editBatch: 'Edit Batch',
    deleteBatch: 'Delete Batch',
    allBatches: 'All Batches',
    deleteConfirmTitle: 'Delete Batch?',
    deleteConfirmDesc: 'Are you sure you want to delete this fattening batch? Enrolled cattle will be unassigned.',
    herdAllocation: 'Herd & Allocation',
    dailyFeedRation: 'Daily Feed Ration',
    adgReports: 'ADG Reports & Growth',
    ingredientName: 'Ingredient Name',
    portionHead: 'Portion / Head (kg)',
    unitCost: 'Unit Cost (KHR)',
    totalRationCost: 'Total Ration Cost',
    cattleInFattening: 'Cattle In Fattening',
    totalHerdBiomass: 'Total Herd Weight',
    avgWeightPerHead: 'Avg Weight per Head',
    dailyFeedCost: 'Daily Feed Expense',
    currentHerdList: 'Current Fattening Herd Members',
    addCattleToBatch: 'Add Cattle to Batch',
    feedRecipeTitle: 'Daily Ration Formula'
  },

  // Medical & Vaccines
  health: {
    title: 'Medical & Vaccine Health Logs',
    subtitle: 'Track cattle vaccinations, disease treatments, and veterinary care logs.',
    addLog: 'Add Health Log',
    editLog: 'Edit Health Log',
    deleteLog: 'Delete Health Log',
    treatmentType: 'Treatment Type',
    medicineName: 'Medicine Name',
    vetDoctor: 'Veterinarian / Doctor',
    cost: 'Cost (KHR)',
    vaccine: 'Vaccination',
    deworming: 'Deworming',
    checkup: 'Routine Checkup',
    treatment: 'Treatment',
    medicalCost: 'Medical Expense',
    totalHealthLogs: 'Total Treatment Logs',
    noHealthLogs: 'No medical or vaccine records found.'
  },

  // Financial Ledger & Revenue
  finance: {
    title: 'Sales & Revenue',
    subtitle: 'Financial ledger for tracking cattle sales revenue against the cost of acquiring the cattle.',
    recordSale: 'Record Cattle Sale',
    totalSalesRevenue: 'Total Sales Revenue',
    netProfit: 'Net Farm Profit',
    salesLedger: 'Sales Revenue Ledger',
    category: 'Category',
    amount: 'Amount (KHR)',
    unitPrice: 'Unit Price (KHR/kg)',
    totalPrice: 'Total Sale Amount',
    buyer: 'Buyer Name',
    saleType: 'Sale Basis',
    salesDate: 'Sale Date',
    weightBasis: 'Weight Basis',
    lumpsumBasis: 'Lumpsum Basis',
  },

  // Growth & Profit Analytics
  analytics: {
    title: 'Growth & Profit Analytics',
    subtitle: 'Enterprise Business Intelligence dashboard for tracking ADG, mortality, feed costs, and ROI.',
    overview: 'Overview Summary',
    demographics: 'Herd Demographics',
    batchPerformance: 'Batch Performance',
    healthAnalytics: 'Medical & Health Insights',
    financialPerformance: 'Financial BI Analytics',
    herdDistribution: 'Breed Distribution',
    healthStatusRatio: 'Health Status Breakdown',
    weightGainTrend: 'Herd Weight Progress Trend',
    revenueVsExpense: 'Monthly Sales Revenue',
    adgLeaderboard: 'ADG Performance Leaders'
  },

  // Farms & Stall Branches
  farms: {
    title: 'Farms & Stall Branches',
    subtitle: 'Manage farm locations, barn capacities, owner accounts, and staff assignments.',
    addFarm: 'Add New Farm Branch',
    editFarm: 'Edit Farm Branch',
    deleteFarm: 'Delete Farm Branch',
    farmName: 'Farm Name',
    address: 'Location Address',
    capacity: 'Barn Capacity',
    ownerName: 'Farm Owner Name',
    ownerEmail: 'Owner Email Account',
    notes: 'Notes / Description',
    totalFarms: 'Total Registered Farms',
    assignedStaff: 'Assigned Staff & Vets'
  },

  // ERP Master Setup
  settings: {
    title: 'ERP Master Setup',
    subtitle: 'Configure user roles, permissions, master dropdown parameters, and database backups.',
    userManagement: 'Users & Access Control',
    systemParams: 'System Parameters',
    backupMigration: 'Backup & Database Sync',
    addUser: 'Add User Account',
    editUser: 'Edit User Account',
    userName: 'User Name',
    userEmail: 'Email Address',
    userRole: 'Assigned Role',
    permissions: 'Module Permissions'
  },

  // Dashboard & Metrics
  dashboard: {
    totalHerd: 'Active Herd',
    totalFarms: 'Total Farms',
    avgWeight: 'Avg Weight',
    assetValue: 'Asset Value',
    monthlySales: 'Monthly Revenue',
    recentActivity: 'Recent Farm Activities'
  },

  // Farm running costs (Costs page and Record → Cost). {placeholders} are filled in by the screen.
  costs: {
    title: 'Costs',
    intro: 'Wages, power and water, fuel, repairs and other farm costs. Feed, medicine and cattle are counted from their own pages.',
    record: 'Record a cost',
    recordShort: 'Cost',
    thisMonth: 'This month',
    lastMonth: 'Last month',
    all: 'All',
    period: 'Period',
    farm: 'Farm',
    allFarms: 'All farms',
    allTime: 'all time',
    totalFor: 'Running costs, {period}',
    countOne: '{n} cost written down',
    countMany: '{n} costs written down',
    wentOn: 'What it went on',
    noneYet: 'No costs written down yet.',
    noneFor: 'No costs for {period}.',
    by: 'by {name}',
    showMore: 'Show more ({n} left)',
    deleteAria: 'Delete {category} cost of {amount} on {date}',
    deleteTitle: 'Delete this cost?',
    deleteBody: '{category}, {amount} on {date} at {farm}. Only delete it if it was written down by mistake.',
    deleteConfirm: 'Delete',
    deleteFailed: 'Could not delete',
    somethingWrong: 'Something went wrong.',
    ok: 'OK',
    months: 'January,February,March,April,May,June,July,August,September,October,November,December',
    // Flow
    whatTitle: 'What was the cost for?',
    whatSub: 'Feed, medicine and cattle are counted from their own pages, so they are not here.',
    amountTitle: 'How much for {category}?',
    amountTitleOther: 'How much was paid?',
    amountSub: 'In riel.',
    amountLabel: 'Amount (៛)',
    amountAria: 'Amount in riel',
    whereTitle: 'Which farm, and when?',
    whereSub: 'Which farm paid it, and the day.',
    whereSubLocked: 'The day it was paid.',
    whichFarm: 'Which farm?',
    datePaid: 'Date paid',
    noteTitle: 'Anything else?',
    noteSub: 'For example who was paid or what was fixed (optional).',
    noteLabel: 'Note (optional)',
    noteAria: 'Note',
    doneTitle: 'Cost saved',
    doneSub: 'It is now part of the farm costs.',
    doneMessage: '{amount} for {category} saved',
    again: 'Record another cost',
    finished: "I'm done",
    next: 'Next',
    save: 'Save cost',
    saving: 'Saving…',
    search: 'Search',
    searchAria: 'Search the list',
    noMatch: 'Nothing matches that.',
    errAmount: 'Type how much was paid.',
    errFarm: 'Choose which farm paid it.',
    errDate: 'Choose the date it was paid.',
    errSave: 'Could not save. Please try again.',
    // The built-in kinds of cost, by the English name they are saved under. Kinds added in Settings show as typed.
    categories: {
      'Wages': 'Wages',
      'Power and water': 'Power and water',
      'Fuel and transport': 'Fuel and transport',
      'Repairs and equipment': 'Repairs and equipment',
      'Bank interest': 'Bank interest',
      'Rent': 'Rent',
      'Other': 'Other'
    }
  },

  // Sign-in screen
  login: {
    tagline: 'Farm records for your cattle',
    title: 'Sign in',
    email: 'Email',
    password: 'Password',
    show: 'Show',
    hide: 'Hide',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    tryAgain: 'Try again',
    forgot: 'Forgot your password? Ask your farm manager to reset it for you.',
    wrongTitle: 'Email or password is not correct',
    wrongDetail: 'Check both and try again. Tap Show to see what you typed.',
    offlineTitle: 'Could not sign in right now',
    offlineDetail: 'Check your internet connection and try again.'
  },

  // The Record buttons (Today and the phone's Record button)
  record: {
    feedToday: 'Feed today',
    weigh: 'Weigh',
    treat: 'Treat',
    addCattle: 'Add cattle',
    sell: 'Sell',
    feedIn: 'Feed in',
    cost: 'Cost'
  },

  // Choosing a farm
  farm: {
    workingOn: 'Working on',
    allFarms: 'All farms',
    farm: 'Farm',
    search: 'Search',
    searchAria: 'Search the list'
  },

  // Sections for the redesigned screens live in ./sections (one file each).
  flow: flowEn,
  todayPage: todayPageEn,
  cattlePage: cattlePageEn,
  weightsPage: weightsPageEn,
  weighFlow: weighFlowEn,
  healthPage: healthPageEn,
  treatFlow: treatFlowEn,
  feedPage: feedPageEn,
  feedFlows: feedFlowsEn,

  // Install as an app (PWA)
  pwa: {
    install: 'Install app',
    installTitle: 'Install CC Livestock',
    installIntro: 'Add CC Livestock to this device so it opens like a normal app, with its own icon.',
    iosStep1: 'Tap the Share button (the square with an arrow pointing up). On newer iOS, tap ••• first.',
    iosStep2: 'Scroll down and tap "Add to Home Screen".',
    iosStep3: 'Tap "Add". The CC Livestock icon appears on your Home Screen.',
    macStep1: 'In the menu bar, click File (or the Share button in the toolbar).',
    macStep2: 'Choose "Add to Dock".',
    macStep3: 'Click "Add". CC Livestock now opens from the Dock like any other app.',
    signInAgain: 'You will need to sign in once more inside the installed app.',
    share: 'Share app',
    shareTitle: 'Share CC Livestock',
    shareIntro: 'Scan this QR code with a phone camera, or send the link. They will need an account to sign in.',
    shareText: 'Open CC Livestock and tap "Install app" to add it to your phone.',
    shareVia: 'Share…',
    copyLink: 'Copy link',
    copied: 'Link copied',
    downloadQr: 'Download QR code'
  }
};

export type TranslationKeys = typeof en;

/**
 * Another language may lag behind English: any key it lacks falls back to the
 * English text (see `t()` in src/context/LanguageContext.tsx).
 */
export type PartialTranslations = { [S in keyof TranslationKeys]?: Partial<TranslationKeys[S]> };
