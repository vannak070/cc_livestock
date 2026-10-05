import { PartialTranslations } from './en';

export const km: PartialTranslations = {
  // Navigation & Header
  nav: {
    dashboard: 'ផ្ទាំងគ្រប់គ្រង',
    cattleRegistry: 'បញ្ជីសារពើភណ្ឌគោ',
    batchManagement: 'គ្រប់គ្រងក្រុមគោ និង ចំណី',
    feedStock: 'ស្តុកចំណីគោ',
    healthVaccines: 'ព្យាបាល និង វ៉ាក់សាំង',
    financeLedger: 'ការលក់ និង ចំណូល',
    analytics: 'របាយការណ៍ និង វិភាគ',
    proposalPlan: 'ឧបករណ៍ផែនការអាជីវកម្មបំប៉ន',
    farmsBranches: 'កសិដ្ឋាន និង ក្រោលគោ',
    masterSettings: 'ការកំណត់ប្រព័ន្ធ',
    systemTitle: 'ប្រព័ន្ធគ្រប់គ្រងកសិដ្ឋាន',
    systemSubtitle: 'ប្រព័ន្ធគ្រប់គ្រងការបំប៉នគោសាច់',
    role: 'តួនាទី',
    logout: 'ចាកចេញ',
    overview: 'ទិដ្ឋភាពទូទៅ',
    livestockErp: 'គ្រប់គ្រងកសិដ្ឋាន',
    financials: 'ហិរញ្ញវត្ថុ',
    insights: 'វិភាគទិន្នន័យ',
    administration: 'ការគ្រប់គ្រង'
  },

  // Common Actions & Buttons
  common: {
    add: 'បន្ថែម',
    edit: 'កែប្រែ',
    delete: 'លុប',
    cancel: 'បោះបង់',
    save: 'រក្សាទុក',
    search: 'ស្វែងរក...',
    reset: 'កំណត់ឡើងវិញ',
    filter: 'តម្រង',
    allFarms: 'គ្រប់កសិដ្ឋានទាំងអស់',
    actions: 'សកម្មភាព',
    status: 'ស្ថានភាព',
    date: 'កាលបរិច្ឆេទ',
    notes: 'កំណត់ចំណាំ',
    total: 'សរុប',
    confirm: 'អះអាង',
    close: 'បិទ',
    loading: 'កំពុងទាញយក...',
    clear: 'សម្អាត',
    select: 'ជ្រើសរើស',
    head: 'ក្បាល'
  },

  // Cattle Inventory Table & Forms
  inventory: {
    title: 'បញ្ជីសារពើភណ្ឌគោបំប៉ន',
    subtitle: 'គ្រប់គ្រងស្តុកគោ តាមដានការលូតលាស់ និងព័ត៌មានលម្អិត។',
    registerCow: 'ចុះឈ្មោះគោបំប៉ន',
    cowId: 'លេខកូដគោ',
    farm: 'កសិដ្ឋាន / ក្រោលគោ',
    breed: 'ពូជគោ',
    sex: 'ភេទទ្រង់',
    initialWeight: 'ទម្ងន់ដើម',
    currentWeight: 'ទម្ងន់បច្ចុប្បន្ន',
    purchasePrice: 'តម្លៃទិញចូល',
    healthStatus: 'ស្ថានភាពសុខភាព',
    status: 'ស្ថានភាព',
    active: 'កំពុងបំប៉ន',
    sold: 'លក់រួច',
    quarantine: 'ចម្រោះសុខភាព',
    dead: 'ស្លាប់',
    noCows: 'មិនមានទិន្នន័យគោត្រូវនឹងតម្រងដែលបានជ្រើសរើសឡើយ។',
    searchPlaceholder: 'ស្វែងរកតាមលេខកូដ ឬ ពូជគោ...',
    paymentMethod: 'វិធីទូទាត់',
    purchaseType: 'ប្រភេទនៃការទិញ',
    supplier: 'អ្នកផ្គត់ផ្គង់ / ម្ចាស់',
    remark: 'ចំណាំ'
  },

  // Weight & Growth
  weight: {
    title: 'កំណត់ត្រាទម្ងន់ និង ការលូតលាស់',
    logWeight: 'កត់ត្រាទម្ងន់គោ',
    oldWeight: 'ទម្ងន់មុន',
    currentWeight: 'ទម្ងន់បច្ចុប្បន្ន',
    weightGain: 'ការឡើង/ស្រុតទម្ងន់',
    adg: 'កម្រិតឡើងទម្ងន់ប្រចាំថ្ងៃ',
    trackingDate: 'កាលបរិច្ឆេទកត់ត្រា',
    recordWeights: 'កត់គីឡូគោបំប៉ន'
  },

  // Batches & Diet Management
  batches: {
    title: 'កម្មវិធីបំប៉នគោសាច់',
    subtitle: 'គ្រប់គ្រងរបបចំណី ទម្ងន់ និងកម្រិតឡើងទម្ងន់ប្រចាំថ្ងៃ (ADG)។',
    newBatch: 'ក្រុមថ្មី',
    editBatch: 'កែប្រែក្រុមគោ',
    deleteBatch: 'លុបក្រុមគោ',
    allBatches: 'ក្រុមទាំងអស់',
    deleteConfirmTitle: 'តើអ្នកប្រាកដជាចង់លុបក្រុមគោនេះទេ?',
    deleteConfirmDesc: 'គោដែលនៅក្នុងក្រុមនេះនឹងត្រូវបានដកចេញពីក្រុមដោយស្វ័យប្រវត្តិ។',
    herdAllocation: 'ហ្វូងគោបំប៉ន និង បែងចែក',
    dailyFeedRation: 'ចំណីអាហារប្រចាំថ្ងៃ',
    adgReports: 'របាយការណ៍លូតលាស់ និង ADG',
    ingredientName: 'ឈ្មោះធាតុផ្សំចំណី',
    portionHead: 'បរិមាណក្នុងមួយក្បាល (គក)',
    unitCost: 'តម្លៃក្នុងមួយខ្នាត (៛)',
    totalRationCost: 'ចំណាយចំណីសរុប',
    cattleInFattening: 'ចំនួនគោបំប៉នសរុប',
    totalHerdBiomass: 'ទម្ងន់គោសរុប',
    avgWeightPerHead: 'ទម្ងន់មធ្យមភាគក្នុងមួយក្បាល',
    dailyFeedCost: 'ចំណាយចំណីប្រចាំថ្ងៃសរុប',
    currentHerdList: 'បញ្ជីឈ្មោះគោបំប៉នបច្ចុប្បន្ន',
    addCattleToBatch: 'បន្ថែមគោចូលក្នុងក្រុម',
    feedRecipeTitle: 'រូបមន្តចំណីអាហារ'
  },

  // Medical & Vaccines
  health: {
    title: 'កំណត់ត្រាព្យាបាល និង វ៉ាក់សាំង',
    subtitle: 'តាមដានការចាក់វ៉ាក់សាំង ព្យាបាលជំងឺ និងថែទាំសុខភាពសត្វ។',
    addLog: 'បន្ថែមព័ត៌មានព្យាបាល',
    editLog: 'កែប្រែព័ត៌មានព្យាបាល',
    deleteLog: 'លុបព័ត៌មានព្យាបាល',
    treatmentType: 'ប្រភេទព្យាបាល',
    medicineName: 'ឈ្មោះថ្នាំ',
    vetDoctor: 'គ្រូពេទ្យសត្វ',
    cost: 'ចំណាយ (៛)',
    vaccine: 'ចាក់វ៉ាក់សាំង',
    deworming: 'ទម្លាក់ព្រូន',
    checkup: 'ពិនិត្យសុខភាពទូទៅ',
    treatment: 'ព្យាបាលជំងឺ',
    medicalCost: 'ចំណាយព្យាបាល',
    totalHealthLogs: 'កំណត់ត្រាព្យាបាលសរុប',
    noHealthLogs: 'មិនមានព័ត៌មានព្យាបាល ឬ វ៉ាក់សាំងឡើយ។'
  },

  // Financial Ledger & Revenue
  finance: {
    title: 'ការលក់ និង ចំណូល',
    subtitle: 'តាមដានចំណូលពីការលក់គោ ធៀបនឹងតម្លៃទិញគោ។',
    recordSale: 'កត់ត្រាការលក់គោ',
    totalSalesRevenue: 'ចំណូលសរុបពីការលក់',
    netProfit: 'ប្រាក់ចំណេញសុទ្ធ',
    salesLedger: 'សៀវភៅចំណូលលក់',
    category: 'ប្រភេទចំណាយ',
    amount: 'ទឹកប្រាក់ (៛)',
    unitPrice: 'តម្លៃក្នុងមួយគីឡូ (៛)',
    totalPrice: 'ប្រាក់សរុបពីការលក់',
    buyer: 'ឈ្មោះអ្នកទិញ',
    saleType: 'រូបភាពលក់',
    salesDate: 'កាលបរិច្ឆេទលក់',
    weightBasis: 'លក់គិតតាមគីឡូ',
    lumpsumBasis: 'លក់ផ្តាច់ក្បាល'
  },

  // Growth & Profit Analytics
  analytics: {
    title: 'របាយការណ៍ និង វិភាគទិន្នន័យ',
    subtitle: 'វិភាគទិន្នន័យកសិដ្ឋាន តាមដានការលូតលាស់ កម្រិតចំណេញ និងប្រសិទ្ធភាពចំណី។',
    overview: 'ទិដ្ឋភាពទូទៅ',
    demographics: 'ស្ថិតិហ្វូងគោ',
    batchPerformance: 'ប្រសិទ្ធភាពក្រុមគោ',
    healthAnalytics: 'សុខភាពសត្វ',
    financialPerformance: 'ហិរញ្ញវត្ថុ',
    herdDistribution: 'ការបែងចែកពូជគោ',
    healthStatusRatio: 'សមាមាត្រសុខភាព',
    weightGainTrend: 'និន្នាការលូតលាស់ទម្ងន់',
    revenueVsExpense: 'ប្រៀបធៀបចំណូល និង ចំណាយ',
    adgLeaderboard: 'ចំណាត់ថ្នាក់ការលូតលាស់ ADG'
  },

  // Farms & Stall Branches
  farms: {
    title: 'កសិដ្ឋាន និង ក្រោលគោ',
    subtitle: 'គ្រប់គ្រងទីតាំងកសិដ្ឋាន សមត្ថភាពក្រោល គណនីម្ចាស់ និងបុគ្គលិក។',
    addFarm: 'បន្ថែមប្រព័ន្ធកសិដ្ឋានថ្មី',
    editFarm: 'កែប្រែកសិដ្ឋាន',
    deleteFarm: 'លុបកសិដ្ឋាន',
    farmName: 'ឈ្មោះកសិដ្ឋាន',
    address: 'អាសយដ្ឋាន',
    capacity: 'សមត្ថភាពក្រោល',
    ownerName: 'ឈ្មោះម្ចាស់កសិដ្ឋាន',
    ownerEmail: 'អ៊ីមែលម្ចាស់កសិដ្ឋាន',
    notes: 'កំណត់ចំណាំ',
    totalFarms: 'ចំនួនកសិដ្ឋានសរុប',
    assignedStaff: 'បុគ្គលិក និង គ្រូពេទ្យ'
  },

  // ERP Master Setup
  settings: {
    title: 'ការកំណត់ប្រព័ន្ធ',
    subtitle: 'កំណត់សិទ្ធិប្រើប្រាស់ គណនីបុគ្គលិក និងទិន្នន័យប្រព័ន្ធ។',
    userManagement: 'អ្នកប្រើប្រាស់ និង សិទ្ធិ',
    systemParams: 'ប៉ារ៉ាម៉ែត្រប្រព័ន្ធ',
    backupMigration: 'បម្រុងទុកទិន្នន័យ',
    addUser: 'បន្ថែមគណនីបុគ្គលិក',
    editUser: 'កែប្រែគណនី',
    userName: 'ឈ្មោះអ្នកប្រើប្រាស់',
    userEmail: 'អាសយដ្ឋានអ៊ីមែល',
    userRole: 'តួនាទី',
    permissions: 'សិទ្ធិប្រើប្រាស់'
  },

  // Dashboard & Metrics
  dashboard: {
    totalHerd: 'ចំនួនគោសរុប',
    totalFarms: 'ចំនួនកសិដ្ឋាន',
    avgWeight: 'ទម្ងន់មធ្យមភាគ',
    assetValue: 'តម្លៃទ្រព្យសកម្ម',
    monthlySales: 'ចំណូលប្រចាំខែ',
    recentActivity: 'សកម្មភាពកសិដ្ឋានថ្មីៗ'
  },

  // Install as an app (PWA)
  pwa: {
    install: 'ដំឡើងកម្មវិធី',
    installTitle: 'ដំឡើង CC Livestock',
    installIntro: 'បន្ថែម CC Livestock ទៅក្នុងឧបករណ៍នេះ ដើម្បីបើកដូចកម្មវិធីធម្មតា ដែលមានរូបតំណាងផ្ទាល់ខ្លួន។',
    iosStep1: 'ចុចប៊ូតុង Share (ការ៉េដែលមានព្រួញចង្អុលឡើងលើ)។ នៅលើ iOS ថ្មី សូមចុច ••• ជាមុនសិន។',
    iosStep2: 'រំកិលចុះក្រោម ហើយចុច "Add to Home Screen"។',
    iosStep3: 'ចុច "Add"។ រូបតំណាង CC Livestock នឹងបង្ហាញនៅលើអេក្រង់ដើម។',
    macStep1: 'នៅលើរបារម៉ឺនុយ ចុច File (ឬប៊ូតុង Share នៅលើរបារឧបករណ៍)។',
    macStep2: 'ជ្រើសរើស "Add to Dock"។',
    macStep3: 'ចុច "Add"។ CC Livestock នឹងបើកពី Dock ដូចកម្មវិធីផ្សេងទៀត។',
    signInAgain: 'អ្នកត្រូវចូលគណនីម្តងទៀតនៅក្នុងកម្មវិធីដែលបានដំឡើង។',
    share: 'ចែករំលែកកម្មវិធី',
    shareTitle: 'ចែករំលែក CC Livestock',
    shareIntro: 'ស្កេនកូដ QR នេះដោយកាមេរ៉ាទូរស័ព្ទ ឬផ្ញើតំណភ្ជាប់។ អ្នកទទួលត្រូវមានគណនីដើម្បីចូលប្រើ។',
    shareText: 'បើក CC Livestock ហើយចុច "ដំឡើងកម្មវិធី" ដើម្បីបន្ថែមទៅទូរស័ព្ទរបស់អ្នក។',
    shareVia: 'ចែករំលែក…',
    copyLink: 'ចម្លងតំណភ្ជាប់',
    copied: 'បានចម្លងតំណភ្ជាប់',
    downloadQr: 'ទាញយកកូដ QR'
  }
};
