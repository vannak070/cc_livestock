'use client';

import React, { useState, useEffect } from 'react';
import { MasterSetup, UserRoleItem, CustomRoleDefinition, PermissionKey, PERMISSION_MODULES, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Settings, Shield, DollarSign, Plus, Trash2, Edit2, UserPlus, CheckCircle2, ShieldCheck, KeyRound, Sparkles, Award } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSettingsAction } from '@/app/actions';
import { ConfirmModal } from './ui/confirm-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { useLanguage } from '@/context/LanguageContext';
import { TablePagination } from './common/TablePagination';
import { generateTempPassword } from '@/lib/generate-temp-password';
import { MIN_PIN_LENGTH } from '@/lib/pin';

interface SettingsTabProps {
  settings: MasterSetup;
  currentUser?: UserRoleItem;
}

const DEFAULT_SYSTEM_ROLES: CustomRoleDefinition[] = [
  { id: 'ROLE-01', name: 'Super Admin', description: 'Full system management and security authority.', permissions: ALL_PERMISSIONS, isSystem: true },
  { id: 'ROLE-02', name: 'Admin', description: 'Full business operations control and user creation privileges.', permissions: DEFAULT_ROLE_PERMISSIONS['Admin'], isSystem: true },
  { id: 'ROLE-03', name: 'Company', description: 'Manages user accounts, permissions, and multiple farms under them.', permissions: DEFAULT_ROLE_PERMISSIONS['Company'], isSystem: true },
  { id: 'ROLE-04', name: 'Farm Owner', description: 'Full operational control and lifecycle management of their specific farm.', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Owner'], isSystem: true },
  { id: 'ROLE-05', name: 'Farm Staff', description: 'Records weights, health logs, and tracks daily checklists based on custom permissions.', permissions: DEFAULT_ROLE_PERMISSIONS['Farm Staff'], isSystem: true },
  { id: 'ROLE-06', name: 'Veterinarian', description: 'Responsible for health tracking, medical records, deworming, and diagnostics.', permissions: DEFAULT_ROLE_PERMISSIONS['Veterinarian'], isSystem: true },
  { id: 'ROLE-07', name: 'Management', description: 'Read-only reporting access on the mobile app — no create, edit, or delete permissions. Signs in with a PIN.', permissions: DEFAULT_ROLE_PERMISSIONS['Management'], isSystem: true }
];

export default function SettingsTab({ settings, currentUser }: SettingsTabProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<'livestock' | 'financial' | 'users'>('livestock');

  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  const isFarmOwner = currentUser?.role === 'Farm Owner';

  useEffect(() => {
    if (isFarmOwner && subTab !== 'users') {
      setSubTab('users');
    }
  }, [isFarmOwner, subTab]);

  // Input states for adding new configurations
  const [newItemText, setNewItemText] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<keyof Omit<MasterSetup, 'users' | 'roles' | 'farms'>>('breeds');

  // Available roles list (system + custom created roles)
  const currentRoles: CustomRoleDefinition[] = settings.roles && settings.roles.length > 0 ? settings.roles : DEFAULT_SYSTEM_ROLES;

  // User form & permission states
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userPin, setUserPin] = useState('');
  const [clearPin, setClearPin] = useState(false);
  const [userRole, setUserRole] = useState<string>('Company');
  const [userPermissions, setUserPermissions] = useState<PermissionKey[]>(DEFAULT_ROLE_PERMISSIONS['Company'] || []);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFarmLocation, setUserFarmLocation] = useState<string>('');

  // Custom Role Modal States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRoleDefinition | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<PermissionKey[]>(ALL_PERMISSIONS);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm?: () => void;
    type: 'danger' | 'warning' | 'success' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: 'warning'
  });

  // Mutation to save settings updates to server action
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: MasterSetup) => {
      const res = await updateSettingsAction(updatedSettings);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    },
    onError: (err: Error) => {
      // Surfaced here rather than silently swallowed — this mutation backs
      // several forms (users, roles, master lists), several of which close
      // their own dialog and reset their own fields the instant `.mutate()`
      // is called, before this async result comes back either way.
      alert(err.message || 'That change could not be saved. Please try again.');
    }
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;

    const list = [...(settings[activeCategory] as string[])];
    if (list.includes(newItemText.trim())) {
      setConfirmModal({
        isOpen: true,
        title: 'Option Exists',
        description: `The item "${newItemText.trim()}" is already present in this category.`,
        type: 'info',
        confirmText: 'OK'
      });
      return;
    }

    const updatedSettings: MasterSetup = {
      ...settings,
      [activeCategory]: [...list, newItemText.trim()]
    };

    updateSettingsMutation.mutate(updatedSettings);
    setNewItemText('');
  };

  const handleRemoveItem = (category: keyof Omit<MasterSetup, 'users' | 'roles'>, index: number) => {
    const list = [...(settings[category] as string[])];
    list.splice(index, 1);

    const updatedSettings: MasterSetup = {
      ...settings,
      [category]: list
    };

    updateSettingsMutation.mutate(updatedSettings);
  };

  const handleStartEditUser = (user: UserRoleItem) => {
    setEditingUserId(user.id);
    setUserName(user.name);
    setUserEmail(user.email);
    setUserPassword(''); // never prefill — the API no longer returns stored passwords
    setUserPin(''); // never prefill — only `hasPin` (a boolean) ever comes back
    setClearPin(false);
    setUserRole(user.role);
    const matchedRole = currentRoles.find(r => r.name === user.role);
    setUserPermissions(user.permissions && user.permissions.length > 0 ? user.permissions : (matchedRole ? matchedRole.permissions : (DEFAULT_ROLE_PERMISSIONS[user.role] || [])));
    setUserFarmLocation(user.farmLocation || '');
    setIsAddingUser(true);
  };

  const handleRoleSelectChange = (newRoleName: string) => {
    setUserRole(newRoleName);
    const matchedRole = currentRoles.find(r => r.name === newRoleName);
    if (matchedRole) {
      setUserPermissions(matchedRole.permissions);
    } else if (DEFAULT_ROLE_PERMISSIONS[newRoleName]) {
      setUserPermissions(DEFAULT_ROLE_PERMISSIONS[newRoleName]);
    }
  };

  const togglePermission = (key: PermissionKey) => {
    setUserPermissions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleModulePermissions = (moduleKeys: PermissionKey[]) => {
    const allEnabled = moduleKeys.every(k => userPermissions.includes(k));
    if (allEnabled) {
      setUserPermissions(prev => prev.filter(k => !moduleKeys.includes(k)));
    } else {
      setUserPermissions(prev => Array.from(new Set([...prev, ...moduleKeys])));
    }
  };

  const handleApplyPreset = (presetName: string) => {
    if (presetName === 'all') {
      setUserPermissions(ALL_PERMISSIONS);
    } else {
      const matched = currentRoles.find(r => r.name === presetName);
      if (matched) {
        setUserPermissions(matched.permissions);
      } else if (DEFAULT_ROLE_PERMISSIONS[presetName]) {
        setUserPermissions(DEFAULT_ROLE_PERMISSIONS[presetName]);
      }
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) return;

    let updatedUsers = [...(settings.users || [])];

    const typedPin = userPin.trim();

    if (editingUserId) {
      updatedUsers = updatedUsers.map(u => {
        if (u.id === editingUserId) {
          const typedPassword = userPassword.trim();
          return {
            ...u,
            name: userName.trim(),
            email: userEmail.trim(),
            role: userRole,
            // Omit the field entirely when nothing was typed — the backend
            // keeps the user's existing password hash in that case instead
            // of resetting it (it can no longer see the old plaintext value
            // to fall back on, by design). Same rule for the PIN, with an
            // explicit "Remove PIN" checkbox for the one thing blank can't
            // mean: clear it outright.
            ...(typedPassword ? { password: typedPassword } : {}),
            ...(typedPin ? { pin: typedPin } : {}),
            ...(clearPin ? { clearPin: true } : {}),
            permissions: userPermissions,
            farmLocation: userFarmLocation.trim() || undefined
          };
        }
        return u;
      });
    } else {
      // No password typed -> generate a random one-time temporary password
      // instead of a fixed shared default, and surface it so the admin can
      // actually hand it to the new user (otherwise no one would know it).
      const typedPassword = userPassword.trim();
      const assignedPassword = typedPassword || generateTempPassword();
      const newUser: UserRoleItem = {
        id: `USR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: userName.trim(),
        email: userEmail.trim(),
        role: userRole,
        status: 'Active',
        password: assignedPassword,
        ...(typedPin ? { pin: typedPin } : {}),
        permissions: userPermissions,
        farmLocation: userFarmLocation.trim() || undefined
      };
      updatedUsers.push(newUser);
      if (!typedPassword) {
        alert(`No password was entered, so a temporary one was generated for ${newUser.email}:\n\n${assignedPassword}\n\nShare this with the user and ask them to change it after logging in. It will not be shown again.`);
      }
    }

    const updatedSettings: MasterSetup = {
      ...settings,
      users: updatedUsers
    };

    updateSettingsMutation.mutate(updatedSettings);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserPin('');
    setClearPin(false);
    setUserRole('Company');
    setUserPermissions(DEFAULT_ROLE_PERMISSIONS['Company']);
    setUserFarmLocation('');
    setEditingUserId(null);
    setIsAddingUser(false);
  };

  // Custom Role Modal Handlers
  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS['Farm Staff'] || []);
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role: CustomRoleDefinition) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setRolePermissions(role.permissions || []);
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;

    let updatedRoles = [...currentRoles];

    if (editingRole) {
      updatedRoles = updatedRoles.map(r => r.id === editingRole.id ? {
        ...r,
        name: roleName.trim(),
        description: roleDescription.trim(),
        permissions: rolePermissions
      } : r);
    } else {
      const newRole: CustomRoleDefinition = {
        id: `ROLE-${Math.floor(10 + Math.random() * 90)}`,
        name: roleName.trim(),
        description: roleDescription.trim() || 'Custom ERP User Role',
        permissions: rolePermissions,
        isSystem: false
      };
      updatedRoles.push(newRole);
    }

    const updatedSettings: MasterSetup = {
      ...settings,
      roles: updatedRoles
    };

    updateSettingsMutation.mutate(updatedSettings);
    setIsRoleModalOpen(false);
  };

  const handleDeleteRole = (roleId: string) => {
    const target = currentRoles.find(r => r.id === roleId);
    if (target?.name === 'Super Admin') {
      alert('Super Admin role cannot be deleted to prevent system lockout.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete System/Custom Role?',
      description: `Are you sure you want to delete the role "${target?.name}"? Users with this role will default back to Company.`,
      type: 'danger',
      confirmText: 'Delete Role',
      onConfirm: () => {
        const updatedRoles = currentRoles.filter(r => r.id !== roleId);
        const updatedSettings: MasterSetup = {
          ...settings,
          roles: updatedRoles
        };
        updateSettingsMutation.mutate(updatedSettings);
      }
    });
  };

  const handleToggleUserStatus = (userId: string) => {
    const updatedUsers = (settings.users || []).map(u => {
      if (u.id === userId) {
        return { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } as UserRoleItem;
      }
      return u;
    });

    const updatedSettings: MasterSetup = {
      ...settings,
      users: updatedUsers
    };

    updateSettingsMutation.mutate(updatedSettings);
  };

  const handleRemoveUser = (userId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove User Profile',
      description: 'Are you sure you want to permanently remove this user? They will lose all access to the system.',
      type: 'danger',
      confirmText: 'Remove User',
      onConfirm: () => {
        const updatedSettings: MasterSetup = {
          ...settings,
          users: (settings.users || []).filter(u => u.id !== userId)
        };
        updateSettingsMutation.mutate(updatedSettings);
      }
    });
  };

  // Human-readable titles for configuration arrays
  const categoriesMeta: Record<keyof Omit<MasterSetup, 'users' | 'roles' | 'farms'>, { label: string; description: string }> = {
    breeds: { label: 'Breeds', description: 'Master catalog of registered cattle breeds.' },
    locations: { label: 'Locations / Barns', description: 'Locations and stall/pasture identifier names.' },
    buyTypes: { label: 'Acquisition / Buy Types', description: 'Methods through which cattle enter inventory.' },
    healthStatuses: { label: 'Health Status Types', description: 'Allowable medical diagnostic classifications.' },
    vaccineTypes: { label: 'Vaccines & Dewormers', description: 'Authorized vaccines and deworming treatments.' },
    feedTypes: { label: 'Feed & Nutrition Types', description: 'Feeding program ingredient batches.' },
    paymentMethods: { label: 'Payment Methods', description: 'Corporate checkout and payout channels.' },
    sexes: { label: 'Sex Options', description: 'Biological classifications of cattle.' },
    diseaseTypes: { label: 'Common Diseases / Symptoms', description: 'Known illnesses logged during checks.' },
    batchTypes: { label: 'Batch Classification Types', description: 'Purpose options assigned to dynamic herds.' },
    weightUnits: { label: 'Measurement Units', description: 'Cattle weight measurement systems.' },
    revenueTypes: { label: 'Revenue Streams', description: 'ERP classifications for income recording.' },
    purchaseTypes: { label: 'Purchase Type Structures', description: 'Acquisition categories mapped to finances.' }
  };

  const livestockKeys: (keyof Omit<MasterSetup, 'users' | 'roles' | 'farms'>)[] = [
    'breeds',
    'locations',
    'buyTypes',
    'sexes',
    'healthStatuses',
    'vaccineTypes',
    'diseaseTypes',
    'feedTypes',
    'batchTypes',
    'weightUnits'
  ];

  const financialKeys: (keyof Omit<MasterSetup, 'users' | 'roles' | 'farms'>)[] = [
    'revenueTypes',
    'purchaseTypes',
    'paymentMethods'
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation header */}
      {!isFarmOwner ? (
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => { setSubTab('livestock'); setActiveCategory('breeds'); }}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-xs transition-all duration-150 cursor-pointer ${
 subTab === 'livestock'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Settings className="h-4 w-4" />
            {t('settings.systemParams')}
          </button>
          <button
            onClick={() => { setSubTab('financial'); setActiveCategory('revenueTypes'); }}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-xs transition-all duration-150 cursor-pointer ${
 subTab === 'financial'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            {t('finance.title')}
          </button>
          <button
            onClick={() => setSubTab('users')}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-xs transition-all duration-150 cursor-pointer ${
 subTab === 'users'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Shield className="h-4 w-4" />
            {t('settings.userManagement')}
          </button>
        </div>
      ) : (
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 ">
            <ShieldCheck className="h-5 w-5 text-emerald-600 animate-pulse" />
            Farm Staff & Vet User Management
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Create, manage, and configure security permissions for staff and veterinarians scoped to your farm: <strong className="text-emerald-700 font-bold">{currentUser.farmLocation}</strong>.
          </p>
        </div>
      )}

      {/* Content for Livestock Setup & Financial Setup lists */}
      {(subTab === 'livestock' || subTab === 'financial') && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Navigation Selection list */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs h-fit space-y-1">
            <h4 className="text-xs font-bold text-slate-400 px-3.5 mb-3.5">Configure Categories</h4>
            {(subTab === 'livestock' ? livestockKeys : financialKeys).map(key => {
              const isActive = activeCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-between cursor-pointer ${
 isActive
 ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span>{categoriesMeta[key]?.label}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
 isActive 
 ? 'bg-[#D1FAE5] text-[#065F46]' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {((settings[key] || []) as string[]).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right management view */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="border-b border-slate-100 p-6">
                <CardTitle className="text-base font-bold text-slate-800">
                  Manage {categoriesMeta[activeCategory]?.label}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  {categoriesMeta[activeCategory]?.description} Custom options will automatically update input forms.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Form to add item */}
                <form onSubmit={handleAddItem} className="flex gap-3">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={e => setNewItemText(e.target.value)}
                    placeholder={`Enter new ${categoriesMeta[activeCategory]?.label.toLowerCase()} option...`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Plus className="h-4 w-4" /> Add Item
                  </button>
                </form>

                {/* Items tags/pills list */}
                <div className="flex flex-wrap gap-2.5 pt-2">
                  {((settings[activeCategory] || []) as string[]).map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 border border-slate-200/80 rounded-xl py-2 px-3.5 text-xs font-bold text-slate-700 flex items-center gap-2 group hover:border-slate-300 transition-all"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(activeCategory, idx)}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 rounded cursor-pointer"
                        title="Delete option"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {((settings[activeCategory] || []) as string[]).length === 0 && (
                    <p className="text-xs text-slate-400 font-semibold italic py-4">
                      No custom entries created yet. Add one above.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Content for User Permissions & Roles sub-tab */}
      {subTab === 'users' && (
        <div className="space-y-6 text-left">
          {/* Custom Roles Manager Panel */}
          {!isFarmOwner && (
            <Card className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 p-6 gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Award className="h-5 w-5 text-emerald-600" />
                    ERP Master Roles Management ({currentRoles.length} Roles Defined)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-1">
                    Create custom system roles (e.g. Veterinarian, Accountant, Feed Manager) with preset permission matrixes.
                  </CardDescription>
                </div>
                <button
                  onClick={openCreateRoleModal}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  Create New Custom Role
                </button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {currentRoles.map(role => (
                    <div key={role.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 flex flex-col justify-between hover:border-slate-300 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800">{role.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
 role.isSystem ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {role.isSystem ? 'System' : 'Custom'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{role.description}</p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-xs">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          {role.permissions.length} / {ALL_PERMISSIONS.length} Functions
                        </span>
                        <div className="space-x-1">
                          <button
                            type="button"
                            onClick={() => openEditRoleModal(role)}
                            className="px-2 py-1 text-slate-600 hover:text-slate-900 text-xs font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          {role.name !== 'Super Admin' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(role.id)}
                              className="px-2 py-1 text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Accounts & Permission Assignment Card */}
          <Card className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 p-6 gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  ERP User Accounts & Function Permissions
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  Authorize employees, assign system roles, and fine-tune function-level permissions.
                </CardDescription>
              </div>
              {!isAddingUser && !editingUserId && (
                <button
                  onClick={() => {
                    setIsAddingUser(true);
                    setEditingUserId(null);
                    setUserName('');
                    setUserEmail('');
                    setUserPassword('');
                    if (isFarmOwner) {
                      setUserRole('Farm Staff');
                      setUserPermissions(DEFAULT_ROLE_PERMISSIONS['Farm Staff']);
                      setUserFarmLocation(currentUser.farmLocation || '');
                    } else {
                      setUserRole('Company');
                      setUserPermissions(DEFAULT_ROLE_PERMISSIONS['Company']);
                      setUserFarmLocation('');
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                >
                  <UserPlus className="h-4 w-4" />
                  Add User Account
                </button>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 bg-slate-50/50">
                      <th className="py-3 pl-3">Employee Profile</th>
                      <th className="py-3">System Role</th>
                      <th className="py-3">Location Scope</th>
                      <th className="py-3">Function Access</th>
                      <th className="py-3">Account Status</th>
                      <th className="py-3 text-right pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const allUsers = (settings.users || []).filter(u => {
                        if (isFarmOwner) {
                          return u.farmLocation === currentUser.farmLocation && (u.role === 'Farm Staff' || u.role === 'Veterinarian');
                        }
                        return true;
                      });
                      const paginatedUsers = allUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize);

                      if (paginatedUsers.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                              No system users found.
                            </td>
                          </tr>
                        );
                      }

                      return paginatedUsers.map(user => {
                        const enabledCount = user.permissions?.length || (DEFAULT_ROLE_PERMISSIONS[user.role]?.length || 0);
                        return (
                          <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 pl-3">
                              <p className="font-bold text-slate-800">{user.name}</p>
                              <p className="text-xs text-slate-400">{user.email}</p>
                            </td>
                            <td className="py-3.5">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
 user.role === 'Super Admin' ? 'bg-red-50 text-red-700 border-red-200' :
                                user.role === 'Admin' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                user.role === 'Company' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                user.role === 'Farm Owner' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                user.role === 'Farm Staff' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                user.role === 'Veterinarian' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-slate-100 text-slate-650 border-slate-200'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="py-3.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${
 user.farmLocation ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                              }`}>
                                {user.farmLocation || 'Global (All Farms)'}
                              </span>
                            </td>
                            <td className="py-3.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                {enabledCount} / {ALL_PERMISSIONS.length} Functions
                              </span>
                            </td>
                            <td className="py-3.5">
                              {user.role === 'Super Admin' ? (
                                <span className="text-xs font-bold text-red-500">Active (Locked)</span>
                              ) : (
                                <button
                                  onClick={() => handleToggleUserStatus(user.id)}
                                  className={`text-xs font-bold transition-colors cursor-pointer ${
 user.status === 'Active' ? 'text-emerald-600 hover:text-emerald-700 hover:underline' : 'text-slate-400 hover:text-slate-500 hover:underline'
                                  }`}
                                >
                                  {user.status}
                                </button>
                              )}
                            </td>
                            <td className="py-3.5 text-right pr-3 space-x-1">
                              <button
                                onClick={() => handleStartEditUser(user)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Edit Account
                              </button>
                              {user.role !== 'Super Admin' && (
                                <button
                                  onClick={() => handleRemoveUser(user.id)}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={userPage}
                totalItems={(settings.users || []).filter(u => isFarmOwner ? (u.farmLocation === currentUser.farmLocation && (u.role === 'Farm Staff' || u.role === 'Veterinarian')) : true).length}
                pageSize={userPageSize}
                onPageChange={setUserPage}
                onPageSizeChange={setUserPageSize}
                itemLabel="users"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create / Edit Custom Role Dialog Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-3xl bg-white p-6 rounded-2xl border border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-600" />
              {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Custom Role'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Define a new system role name, description, and assign default function permissions.
            </DialogDescription>
            {editingRole?.isSystem && (
              <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl text-xs text-amber-800 font-bold leading-normal mt-3">
                ⚠️ System Role Lock: You cannot rename or delete system roles because the core system scoping rules rely on their names, but you can customize their default function permissions.
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSaveRole} className="space-y-4 pt-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Role Name (ឈ្មោះតួនាទី)</label>
                <input
                  type="text"
                  required
                  disabled={editingRole?.isSystem}
                  placeholder="e.g. Veterinarian, Feed Supervisor"
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description</label>
                <input
                  type="text"
                  placeholder="Short explanation of role duties..."
                  value={roleDescription}
                  onChange={e => setRoleDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-800">
                Default Role Function Permissions ({rolePermissions.length} / {ALL_PERMISSIONS.length} Enabled)
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                {PERMISSION_MODULES.map(module => {
                  const moduleKeys = module.items.map(i => i.key);
                  const isAllEnabled = moduleKeys.every(k => rolePermissions.includes(k));
                  return (
                    <div key={module.id} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <span className="text-xs font-bold text-slate-800">{module.label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isAllEnabled) {
                              setRolePermissions(prev => prev.filter(k => !moduleKeys.includes(k)));
                            } else {
                              setRolePermissions(prev => Array.from(new Set([...prev, ...moduleKeys])));
                            }
                          }}
                          className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                        >
                          {isAllEnabled ? 'None' : 'All'}
                        </button>
                      </div>
                      {module.items.map(item => {
                        const isChecked = rolePermissions.includes(item.key);
                        return (
                          <label key={item.key} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setRolePermissions(prev =>
                                  prev.includes(item.key) ? prev.filter(k => k !== item.key) : [...prev, item.key]
                                );
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-bold text-slate-800' : 'text-slate-500'}>
                              {item.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2 rounded-xl shadow-sm cursor-pointer"
              >
                💾 Save Custom Role
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create / Edit User Dialog Modal */}
      <Dialog open={isAddingUser} onOpenChange={(open) => { if (!open) { setIsAddingUser(false); setEditingUserId(null); } }}>
        <DialogContent className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto ${isFarmOwner ? 'max-w-md' : 'max-w-4xl'}`}>
          <DialogHeader className="text-left pb-4 border-b border-slate-100">
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600 animate-pulse" />
              {editingUserId ? `Edit User Account: ${userName}` : 'Configure New User Account'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {editingUserId ? 'Modify employee profile, system role, and access rights.' : 'Create an account for a new staff member or veterinarian.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddUser} className="space-y-6 pt-4 text-left">
            {/* Core Account Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Employee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sokha Manager"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="sokha@snrfarm.com"
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Password</label>
                <input
                  type="password"
                  required={!editingUserId}
                  placeholder={editingUserId ? "New password (optional)..." : "Password..."}
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-400">Mobile PIN Sign-in (optional)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={
                    editingUserId && settings.users.find(u => u.id === editingUserId)?.hasPin
                      ? 'PIN already set — leave blank to keep it'
                      : `${MIN_PIN_LENGTH}+ digit PIN for signing in on the mobile app`
                  }
                  value={userPin}
                  onChange={e => { setUserPin(e.target.value.replace(/[^0-9]/g, '')); setClearPin(false); }}
                  disabled={clearPin}
                  maxLength={12}
                  className="w-full bg-white border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-600"
                />
                <p className="text-xs text-slate-400">
                  Lets this person sign in on the CC Livestock mobile app with just a PIN instead of email and password. Leave blank to {editingUserId ? 'keep the current PIN unchanged.' : 'skip PIN sign-in.'}
                </p>
                {editingUserId && settings.users.find(u => u.id === editingUserId)?.hasPin && (
                  <label className="flex items-center gap-1.5 text-xs font-bold text-red-600 pt-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clearPin}
                      onChange={e => { setClearPin(e.target.checked); if (e.target.checked) setUserPin(''); }}
                    />
                    Remove PIN sign-in for this account
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Role Selection</label>
                <select
                  value={userRole}
                  disabled={editingUserId !== null && settings.users.find(u => u.id === editingUserId)?.role === 'Super Admin'}
                  onChange={e => handleRoleSelectChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {currentRoles
                    .filter(r => !isFarmOwner || r.name === 'Farm Staff' || r.name === 'Veterinarian')
                    .map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold text-slate-400">Farm Location Scope</label>
                <select
                  value={userFarmLocation}
                  disabled={isFarmOwner}
                  onChange={e => setUserFarmLocation(e.target.value)}
                  className="w-full bg-white border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="">All Farms (គ្មានដែនកំណត់)</option>
                  {(settings.locations || []).map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            {!isFarmOwner && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Apply Quick Permission Preset:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {!isFarmOwner && (
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('all')}
                      className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Select All (Super Admin)
                    </button>
                  )}
                  {currentRoles
                    .slice(1)
                    .filter(r => !isFarmOwner || r.name === 'Farm Staff' || r.name === 'Veterinarian')
                    .map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleApplyPreset(r.name)}
                        className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        {r.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Function Permission Matrix Checkboxes Grid */}
            {!isFarmOwner && (
              <div className="space-y-4">
                <h6 className="text-xs font-bold text-slate-800 tracking-tight">
                  Granular Function Permission Matrix ({userPermissions.length} / {ALL_PERMISSIONS.length} Enabled)
                </h6>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PERMISSION_MODULES.map(module => {
                    const moduleKeys = module.items.map(i => i.key);
                    const isAllEnabled = moduleKeys.every(k => userPermissions.includes(k));
                    return (
                      <div key={module.id} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold text-slate-800">{module.label}</span>
                          <button
                            type="button"
                            onClick={() => toggleModulePermissions(moduleKeys)}
                            className="text-xs font-bold text-emerald-650 hover:underline cursor-pointer"
                          >
                            {isAllEnabled ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {module.items.map(item => {
                            const isChecked = userPermissions.includes(item.key);
                            return (
                              <label
                                key={item.key}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
 isChecked
 ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(item.key)}
                                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div>
                                  <p className="font-bold leading-tight">{item.label}</p>
                                  <p className="text-xs text-slate-400 font-normal leading-tight mt-0.5">{item.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddingUser(false);
                  setEditingUserId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-6 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                {editingUserId ? '💾 Update User & Permissions' : '💾 Save New User'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {confirmModal.isOpen && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          description={confirmModal.description}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
        />
      )}
    </div>
  );
}
