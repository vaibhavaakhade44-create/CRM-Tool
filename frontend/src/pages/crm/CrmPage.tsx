import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Users, TruckIcon, RefreshCw, Calendar, Phone, Mail, Building2, Upload, X, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import BulkImportModal from "@/components/ui/BulkImportModal";
import { Badge } from "@/components/ui/Badge";
import { PartyForm } from "@/components/crm/PartyForm";
import api from "@/lib/api";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { Party, CrmStats, PartyType } from "@/types";
import { useTranslation } from 'react-i18next';

interface FollowUp {
  id: string;
  subject?: string | null;
  description: string;
  followUpDate: string;
  party: { id: string; name: string; phone?: string | null; mobile?: string | null; email?: string | null };
  createdBy: { id: string; name: string };
}

function FollowUpsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"upcoming" | "overdue">("upcoming");
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ data: { followUps: FollowUp[] } }>("/parties/follow-ups", { params: { filter: tab } })
      .then(res => setItems(res.data.data.followUps))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <Card>
      <div className="p-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-600" />
          <h2 className="font-semibold text-slate-800">Follow-ups</h2>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 pt-3 flex gap-1 p-1 bg-slate-100 rounded-xl w-fit ml-4 mt-3">
        <button
          onClick={() => setTab("upcoming")}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === "upcoming" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setTab("overdue")}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === "overdue" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Overdue
        </button>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            {tab === "overdue" ? <Clock className="w-10 h-10 text-slate-200" /> : <Calendar className="w-10 h-10 text-slate-200" />}
            <p className="text-slate-400 text-sm">No {tab} follow-ups</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((f) => (
              <div
                key={f.id}
                onClick={() => navigate(`/crm/${f.party.id}`)}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                    {getInitials(f.party.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{f.party.name}</p>
                    <p className="text-xs text-slate-500 truncate">{f.subject || f.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  {tab === "overdue" && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  <span className={`text-xs font-medium ${tab === "overdue" ? "text-red-600" : "text-orange-600"}`}>
                    {formatDateTime(f.followUpDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

const TYPE_TABS: { key: PartyType | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CUSTOMER", label: "Customers" },
  { key: "SUPPLIER", label: "Suppliers" },
  { key: "BOTH", label: "Both" },
];

const TYPE_BADGE: Record<PartyType, { label: string; variant: "blue" | "green" | "purple" }> = {
  CUSTOMER: { label: "Customer", variant: "blue" },
  SUPPLIER: { label: "Supplier", variant: "green" },
  BOTH:     { label: "Both",     variant: "purple" },
};

export default function CrmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab]   = useState<PartyType | "ALL">("ALL");
  const [search, setSearch]         = useState("");
  const [parties, setParties]       = useState<Party[]>([]);
  const [stats, setStats]           = useState<CrmStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [showForm, setShowForm]     = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [defaultType, setDefaultType] = useState<PartyType>("CUSTOMER");
  const [showFollowUps, setShowFollowUps] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<{ data: CrmStats }>("/parties/stats");
      setStats(res.data.data);
    } catch { /* ignore */ }
  }, []);

  const fetchParties = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (activeTab !== "ALL") params.type = activeTab;
      if (search.trim()) params.search = search.trim();
      const res = await api.get<{ data: { parties: Party[]; total: number } }>("/parties", { params });
      setParties(res.data.data.parties);
      setTotal(res.data.data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [activeTab, search, page]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { setPage(1); }, [activeTab, search]);
  useEffect(() => { fetchParties(); }, [fetchParties]);

  const handleSaved = (party: Party) => {
    fetchParties();
    fetchStats();
    navigate(`/crm/${party.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{ t('page_crm') }</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage customers, suppliers and contacts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Upload className="w-4 h-4" />} onClick={() => setShowImport(true)}>
            Import CSV
          </Button>
          <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => { setDefaultType("SUPPLIER"); setShowForm(true); }}>
            Add Supplier
          </Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setDefaultType("CUSTOMER"); setShowForm(true); }}>
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Parties", value: stats.total, icon: <Building2 className="w-5 h-5 text-slate-600" />, bg: "bg-slate-50" },
            { label: "Customers", value: stats.customers, icon: <Users className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50" },
            { label: "Suppliers", value: stats.suppliers, icon: <TruckIcon className="w-5 h-5 text-green-600" />, bg: "bg-green-50" },
            { label: "Follow-ups This Week", value: stats.followUpsThisWeek, icon: <Calendar className="w-5 h-5 text-orange-600" />, bg: "bg-orange-50", onClick: () => setShowFollowUps(true) },
          ].map((s) => (
            <Card key={s.label}>
              <div
                className={`flex items-center gap-3 p-4 ${s.onClick ? "cursor-pointer" : ""}`}
                onClick={s.onClick}
                role={s.onClick ? "button" : undefined}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>{s.icon}</div>
                <div>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-xl font-bold text-slate-800">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showFollowUps && <FollowUpsPanel onClose={() => { setShowFollowUps(false); fetchStats(); }} />}

      {/* Filters */}
      <Card>
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          {/* Type tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {TYPE_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${activeTab === t.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, GSTIN..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <button onClick={fetchParties} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : parties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="w-12 h-12 text-slate-200" />
              <p className="text-slate-500 font-medium">No parties found</p>
              <p className="text-slate-400 text-sm">Add your first customer or supplier to get started</p>
              <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Add Party</Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-t border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Party</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Contact</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">GSTIN</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Tags</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parties.map((party) => {
                  const primary = party.contacts?.[0];
                  const { label, variant } = TYPE_BADGE[party.type];
                  return (
                    <tr
                      key={party.id}
                      onClick={() => navigate(`/crm/${party.id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {/* Name */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                            {getInitials(party.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{party.name}</p>
                            {party.displayName && <p className="text-xs text-slate-400">{party.displayName}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Type */}
                      <td className="px-6 py-3">
                        <Badge label={label} variant={variant} />
                      </td>
                      {/* Contact */}
                      <td className="px-6 py-3">
                        <div className="space-y-0.5">
                          {(party.email || primary?.email) && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[160px]">{party.email || primary?.email}</span>
                            </div>
                          )}
                          {(party.phone || party.mobile || primary?.phone || primary?.mobile) && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span>{party.phone || party.mobile || primary?.phone || primary?.mobile}</span>
                            </div>
                          )}
                          {!party.email && !party.phone && !party.mobile && !primary && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                      {/* Location */}
                      <td className="px-6 py-3 text-sm text-slate-500">
                        {[party.city, party.state].filter(Boolean).join(", ") || <span className="text-slate-300">—</span>}
                      </td>
                      {/* GSTIN */}
                      <td className="px-6 py-3">
                        {party.gstin
                          ? <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{party.gstin}</span>
                          : <span className="text-slate-300 text-sm">—</span>}
                      </td>
                      {/* Tags */}
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(party.tags || []).length === 0
                            ? <span className="text-slate-300 text-xs">—</span>
                            : (party.tags || []).map(tag => {
                                const COLORS = ["#818cf8","#10b981","#f59e0b","#60a5fa","#a78bfa","#fb923c"];
                                let h = 0; for (const c of tag) h = (h * 31 + c.charCodeAt(0)) % COLORS.length;
                                const col = COLORS[Math.abs(h)];
                                return <span key={tag} style={{ padding: "1px 6px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: col + "20", color: col }}>{tag}</span>;
                              })}
                        </div>
                      </td>
                      {/* Comm count */}
                      <td className="px-6 py-3 text-right">
                        <span className="text-sm font-medium text-slate-500">{party._count?.communications ?? 0}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <PartyForm open={showForm} onClose={() => setShowForm(false)} onSaved={handleSaved} defaultType={defaultType} />

      {showImport && (
        <BulkImportModal
          title="Import Parties (Customers / Suppliers)"
          endpoint="/parties/bulk-import"
          onClose={() => setShowImport(false)}
          onSuccess={() => { fetchParties(); fetchStats(); }}
          columns={[
            { key: "Name", label: "Name", required: true },
            { key: "Type", label: "Type" },
            { key: "Email", label: "Email" },
            { key: "Phone", label: "Phone" },
            { key: "GSTIN", label: "GSTIN" },
            { key: "City", label: "City" },
            { key: "State", label: "State" },
          ]}
          sampleRows={[
            { Name: "Acme Corp", Type: "CUSTOMER", Email: "acme@example.com", Phone: "9876543210", GSTIN: "27AAPFU0939F1ZV", City: "Mumbai", State: "Maharashtra" },
            { Name: "Global Supplies", Type: "SUPPLIER", Email: "gs@example.com", Phone: "9123456789", GSTIN: "", City: "Delhi", State: "Delhi" },
          ]}
        />
      )}
    </div>
  );
}
