"use client";

import { useSession } from "@/lib/auth-client";
import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  Link2,
  Unlink,
  Pencil,
  Trash2,
  Plus,
  Download,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GmailStatus {
  connected: boolean;
  lastSyncAt?: string | null;
  syncStatus?: string | null;
  errorMessage?: string | null;
}

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  isSystem: boolean;
  _count: { transactions: number };
  children?: Category[];
}

interface Account {
  id: string;
  name: string;
  type: string;
  institutionName?: string | null;
  last4?: string | null;
  _count: { transactions: number };
  transactionTotal: number;
}

const ACCOUNT_TYPES = [
  "BANK",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "WALLET",
  "CASH",
  "INVESTMENT",
  "LOAN",
] as const;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  BANK: "Bank",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  WALLET: "Wallet",
  CASH: "Cash",
  INVESTMENT: "Investment",
  LOAN: "Loan",
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-3xl space-y-6">
      <GmailSection email={session?.user?.email} />
      <CategoriesSection />
      <AccountsSection />
      <PrivacySection />
    </div>
  );
}

// ─── Gmail Section ───────────────────────────────────────────────────────────

function GmailSection({ email }: { email?: string | null }) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/gmail/sync");
      const data = await res.json();
      setStatus(data);
    } catch {
      setError("Failed to fetch Gmail status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    setActionLoading("connect");
    setError(null);
    try {
      const res = await fetch("/api/gmail/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (!res.ok) throw new Error(data.error || "Connect failed");
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Gmail? This will stop syncing new emails.")) return;
    setActionLoading("disconnect");
    setError(null);
    try {
      const res = await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteImportedData: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Disconnect failed");
      }
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setActionLoading(null);
    }
  };

  const formatLastSync = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? "s" : ""} ago`;
    return d.toLocaleDateString();
  };

  return (
    <Section title="Gmail Connection" icon={<Mail className="w-5 h-5" />}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            {status?.connected ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <XCircle className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {status?.connected ? "Connected" : "Not connected"}
              </p>
              {status?.connected && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {email ?? ""}
                </p>
              )}
            </div>
          </div>

          {status?.connected && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
              Last synced: {formatLastSync(status.lastSyncAt)}
              {status.syncStatus === "SYNCING" && (
                <span className="text-emerald-500 font-medium">Syncing...</span>
              )}
              {status.syncStatus === "ERROR" && status.errorMessage && (
                <span className="text-red-500">{status.errorMessage}</span>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}

          <div className="flex flex-wrap gap-3">
            {status?.connected && (
              <ActionButton
                icon={syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                label={syncing ? "Syncing..." : "Sync Now"}
                onClick={handleSync}
                disabled={syncing}
              />
            )}
            <ActionButton
              icon={actionLoading === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              label={status?.connected ? "Reconnect" : "Connect Gmail"}
              variant="secondary"
              onClick={handleConnect}
              disabled={actionLoading === "connect"}
            />
            {status?.connected && (
              <ActionButton
                icon={actionLoading === "disconnect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                label="Disconnect"
                variant="danger"
                onClick={handleDisconnect}
                disabled={actionLoading === "disconnect"}
              />
            )}
          </div>
        </>
      )}
    </Section>
  );
}

// ─── Categories Section ──────────────────────────────────────────────────────

function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState("#10b981");
  const [formIcon, setFormIcon] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCategories(data);
    } catch {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormColor("#10b981");
    setFormIcon("");
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setFormName(cat.name);
    setFormColor(cat.color || "#10b981");
    setFormIcon(cat.icon || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = { name: formName.trim(), color: formColor, icon: formIcon || undefined };
      const url = editing ? `/api/categories/${editing.id}` : "/api/categories";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setDialogOpen(false);
      await fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (cat._count.transactions > 0) {
      setError(`Cannot delete "${cat.name}" - it has ${cat._count.transactions} transaction(s)`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    setDeleting(cat.id);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      await fetchCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Section title="Categories" icon={<span className="text-lg">&#x1f3f7;</span>}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-2">
                  {cat.color && (
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                  </span>
                  {cat._count.transactions > 0 && (
                    <span className="text-xs text-gray-400">
                      ({cat._count.transactions})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    onClick={() => openEdit(cat)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50"
                    onClick={() => handleDelete(cat)}
                    disabled={deleting === cat.id}
                  >
                    {deleting === cat.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-gray-500">No categories yet.</p>
            )}
          </div>

          <button
            className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add category
          </button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Category name"
                  />
                </div>
                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      className="h-10 w-14 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Icon (emoji, optional)
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formIcon}
                      onChange={(e) => setFormIcon(e.target.value)}
                      placeholder="e.g. 🍔"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving || !formName.trim()}
                  >
                    {saving ? "Saving..." : editing ? "Update" : "Add"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </Section>
  );
}

// ─── Accounts Section ────────────────────────────────────────────────────────

function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("BANK");
  const [formInstitution, setFormInstitution] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAccounts(data);
    } catch {
      setError("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormType("BANK");
    setFormInstitution("");
    setDialogOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setFormName(acc.name);
    setFormType(acc.type);
    setFormInstitution(acc.institutionName || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        type: formType,
      };
      if (formInstitution.trim()) body.institutionName = formInstitution.trim();
      const url = editing ? `/api/accounts/${editing.id}` : "/api/accounts";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setDialogOpen(false);
      await fetchAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acc: Account) => {
    if (!confirm(`Delete account "${acc.name}"? It will be archived.`)) return;
    setDeleting(acc.id);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${acc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      await fetchAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Section title="Financial Accounts" icon={<CreditCard className="w-5 h-5" />}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Add your bank accounts and credit cards for better tracking.
          </p>

          {accounts.length > 0 && (
            <div className="space-y-2 mb-3">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {acc.name}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                      {acc.institutionName ? ` - ${acc.institutionName}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      onClick={() => openEdit(acc)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-50"
                      onClick={() => handleDelete(acc)}
                      disabled={deleting === acc.id}
                    >
                      {deleting === acc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4" /> Add account
          </button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Account" : "Add Account"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Account name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ACCOUNT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Institution (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving || !formName.trim()}
                  >
                    {saving ? "Saving..." : editing ? "Update" : "Add"}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </Section>
  );
}

// ─── Privacy Section ─────────────────────────────────────────────────────────

function PrivacySection() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Section title="Privacy & Data" icon={<AlertTriangle className="w-5 h-5" />}>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Export your data
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Download all your transactions as CSV.
            </p>
          </div>
          <ActionButton
            icon={exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            label={exporting ? "Exporting..." : "Export"}
            variant="secondary"
            onClick={handleExport}
            disabled={exporting}
          />
        </div>
      </div>
    </Section>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gray-600 dark:text-gray-400">{icon}</span>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  variant = "primary",
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary:
      "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
    danger:
      "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40",
  };

  return (
    <button
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {label}
    </button>
  );
}
