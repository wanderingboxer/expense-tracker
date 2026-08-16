"use client";

import { useSession } from "@/lib/auth-client";
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
} from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Gmail Connection */}
      <Section title="Gmail Connection" icon={<Mail className="w-5 h-5" />}>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Connected
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {session?.user?.email ?? "user@example.com"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
          Last synced: 2 hours ago
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton icon={<RefreshCw className="w-4 h-4" />} label="Sync Now" />
          <ActionButton icon={<Link2 className="w-4 h-4" />} label="Reconnect" variant="secondary" />
          <ActionButton icon={<Unlink className="w-4 h-4" />} label="Disconnect" variant="danger" />
        </div>
      </Section>

      {/* Categories */}
      <Section title="Categories" icon={<span className="text-lg">🏷</span>}>
        <div className="space-y-2">
          {["Food & Dining", "Shopping", "Transport", "Housing", "Utilities", "Entertainment", "Groceries"].map(
            (cat) => (
              <div
                key={cat}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
        <button className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
          <Plus className="w-4 h-4" /> Add category
        </button>
      </Section>

      {/* Accounts */}
      <Section title="Financial Accounts" icon={<CreditCard className="w-5 h-5" />}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Add your bank accounts and credit cards for better tracking.
        </p>
        <button className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
          <Plus className="w-4 h-4" /> Add account
        </button>
      </Section>

      {/* Privacy */}
      <Section title="Privacy & Data" icon={<AlertTriangle className="w-5 h-5" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Export your data
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Download all your transactions and settings as JSON.
              </p>
            </div>
            <ActionButton icon={<Download className="w-4 h-4" />} label="Export" variant="secondary" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Delete all data
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Permanently remove all transactions. This cannot be undone.
              </p>
            </div>
            <ActionButton icon={<Trash2 className="w-4 h-4" />} label="Delete Data" variant="danger" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Delete account
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Remove your account and all associated data permanently.
              </p>
            </div>
            <ActionButton icon={<Trash2 className="w-4 h-4" />} label="Delete Account" variant="danger" />
          </div>
        </div>
      </Section>
    </div>
  );
}

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
}: {
  icon: React.ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const styles = {
    primary:
      "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary:
      "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
    danger:
      "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40",
  };

  return (
    <button
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${styles[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}
