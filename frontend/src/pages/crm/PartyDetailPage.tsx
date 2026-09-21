import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Edit2, Phone, Mail, Globe, MapPin, Hash, Building,
  Plus, Trash2, Star, MessageSquare, PhoneCall, AtSign, Users,
  CalendarDays, RefreshCw, Clock, Tag, X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PartyForm } from "@/components/crm/PartyForm";
import DocumentsPanel from "@/components/DocumentsPanel";
import RecordComments from "@/components/RecordComments";
import CustomFieldRenderer from "@/components/CustomFieldRenderer";
import api from "@/lib/api";
import { getInitials, getApiError, formatDate, formatDateTime } from "@/lib/utils";
import type { Party, Contact, CommunicationType } from "@/types";
import ConfirmDialog from "@/components/ConfirmDialog";

// ── Comm type meta ────────────────────────────────────────────
const COMM_META: Record<CommunicationType, { icon: React.ReactNode; label: string; color: string }> = {
  CALL:     { icon: <PhoneCall className="w-4 h-4" />,    label: "Call",      color: "text-green-600 bg-green-50" },
  EMAIL:    { icon: <AtSign className="w-4 h-4" />,       label: "Email",     color: "text-blue-600 bg-blue-50" },
  MEETING:  { icon: <Users className="w-4 h-4" />,        label: "Meeting",   color: "text-purple-600 bg-purple-50" },
  NOTE:     { icon: <MessageSquare className="w-4 h-4" />,label: "Note",      color: "text-slate-600 bg-slate-100" },
  WHATSAPP: { icon: <MessageSquare className="w-4 h-4" />,label: "WhatsApp",  color: "text-emerald-600 bg-emerald-50" },
};

// ── Contact Form ──────────────────────────────────────────────
const contactSchema = z.object({
  name:        z.string().min(1, "Name required"),
  designation: z.string().optional(),
  email:       z.string().email("Invalid email").optional().or(z.literal("")),
  phone:       z.string().optional(),
  mobile:      z.string().optional(),
  isPrimary:   z.boolean().optional(),
});
type ContactForm = z.infer<typeof contactSchema>;

function ContactModal({ open, onClose, onSaved, partyId, contact }: {
  open: boolean; onClose: () => void; onSaved: () => void; partyId: string; contact?: Contact | null;
}) {
  const [apiError, setApiError] = useState("");
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
  });

  useEffect(() => {
    if (open) {
      reset(contact ? { name: contact.name, designation: contact.designation ?? "", email: contact.email ?? "", phone: contact.phone ?? "", mobile: contact.mobile ?? "", isPrimary: contact.isPrimary } : {});
    }
  }, [open, contact, reset]);

  const onSubmit = async (data: ContactForm) => {
    setApiError("");
    try {
      if (contact) await api.patch(`/parties/${partyId}/contacts/${contact.id}`, data);
      else await api.post(`/parties/${partyId}/contacts`, data);
      onSaved();
      onClose();
    } catch (err) { setApiError(getApiError(err)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={contact ? "Edit Contact" : "Add Contact"} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Save</Button></>}>
      {apiError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{apiError}</div>}
      <div className="space-y-3">
        <Input label="Name *" {...register("name")} error={errors.name?.message} />
        <Input label="Designation" placeholder="Manager, Director..." {...register("designation")} />
        <Input label="Email" type="email" {...register("email")} error={errors.email?.message} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Phone" {...register("phone")} />
          <Input label="Mobile" {...register("mobile")} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded" checked={watch("isPrimary") ?? false} onChange={(e) => setValue("isPrimary", e.target.checked)} />
          <span className="text-sm text-slate-700">Set as primary contact</span>
        </label>
      </div>
    </Modal>
  );
}

// ── Communication Log Form ────────────────────────────────────
const commSchema = z.object({
  type:         z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "WHATSAPP"]),
  subject:      z.string().optional(),
  description:  z.string().min(1, "Description required"),
  outcome:      z.string().optional(),
  followUpDate: z.string().optional(),
});
type CommForm = z.infer<typeof commSchema>;

function CommModal({ open, onClose, onSaved, partyId }: {
  open: boolean; onClose: () => void; onSaved: () => void; partyId: string;
}) {
  const [apiError, setApiError] = useState("");
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CommForm>({
    resolver: zodResolver(commSchema),
    defaultValues: { type: "NOTE" },
  });

  useEffect(() => { if (open) reset({ type: "NOTE" }); }, [open, reset]);

  const onSubmit = async (data: CommForm) => {
    setApiError("");
    try {
      const payload = {
        ...data,
        followUpDate: data.followUpDate ? new Date(data.followUpDate).toISOString() : undefined,
      };
      await api.post(`/parties/${partyId}/communications`, payload);
      onSaved();
      onClose();
    } catch (err) { setApiError(getApiError(err)); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Log Entry" size="md"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Add Log</Button></>}>
      {apiError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{apiError}</div>}
      <div className="space-y-3">
        <Select
          label="Type"
          options={[{ value: "NOTE", label: "Note" }, { value: "CALL", label: "Call" }, { value: "EMAIL", label: "Email" }, { value: "MEETING", label: "Meeting" }, { value: "WHATSAPP", label: "WhatsApp" }]}
          value={watch("type")}
          onChange={(e) => setValue("type", e.target.value as CommunicationType)}
        />
        <Input label="Subject" placeholder="Brief subject..." {...register("subject")} />
        <Textarea label="Description *" placeholder="What was discussed / noted..." rows={3} {...register("description")} error={errors.description?.message} />
        <Input label="Outcome" placeholder="Next steps, result..." {...register("outcome")} />
        <Input label="Follow-up Date & Time" type="datetime-local" {...register("followUpDate")} />
      </div>
    </Modal>
  );
}

// ── Inline Tag Editor ─────────────────────────────────────────
const TAG_PALETTE = ["#818cf8","#10b981","#f59e0b","#60a5fa","#a78bfa","#fb923c","#34d399","#ef4444","#c084fc","#38bdf8"];
function tagColor(tag: string) { let h = 0; for (const c of tag) h = (h * 31 + c.charCodeAt(0)) % TAG_PALETTE.length; return TAG_PALETTE[Math.abs(h)]; }

function PartyTagEditor({ partyId, initialTags, onUpdated }: { partyId: string; initialTags: string[]; onUpdated: () => void }) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (newTags: string[]) => {
    setSaving(true);
    try { await api.patch(`/parties/${partyId}`, { tags: newTags }); onUpdated(); } catch { /* ignore */ }
    setSaving(false);
  };

  const add = () => {
    const val = input.trim().toLowerCase();
    if (!val || tags.includes(val)) { setInput(""); return; }
    const next = [...tags, val];
    setTags(next); setInput(""); save(next);
  };

  const remove = (tag: string) => { const next = tags.filter(x => x !== tag); setTags(next); save(next); };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      {tags.map(tag => (
        <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: tagColor(tag) + "20", color: tagColor(tag) }}>
          {tag}
          <button onClick={() => remove(tag)} className="cursor-pointer" style={{ background: "none", border: "none", color: tagColor(tag), padding: 0, lineHeight: 1 }}><XIcon size={10} /></button>
        </span>
      ))}
      {saving && <span className="text-xs text-slate-400">saving…</span>}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        placeholder="+ tag"
        className="text-xs border border-dashed border-slate-300 rounded-full px-2 py-0.5 text-slate-500 focus:outline-none focus:border-blue-400 w-16"
      />
    </div>
  );
}

// ── Main Detail Page ──────────────────────────────────────────
type DetailTab = "overview" | "contacts" | "communications" | "documents" | "comments" | "custom_fields";

export default function PartyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [party, setParty]           = useState<Party | null>(null);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<DetailTab>("overview");
  const [showEdit, setShowEdit]     = useState(false);
  const [showContact, setShowContact]   = useState(false);
  const [editContact, setEditContact]   = useState<Contact | null>(null);
  const [showComm, setShowComm]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "contact" | "comm"; id: string; label: string } | null>(null);

  const fetchParty = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Party }>(`/parties/${id}`);
      setParty(res.data.data);
    } catch { navigate("/crm"); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { fetchParty(); }, [fetchParty]);

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === "contact")
        await api.delete(`/parties/${id}/contacts/${confirmDelete.id}`);
      else
        await api.delete(`/parties/${id}/communications/${confirmDelete.id}`);
      fetchParty();
    } catch { /* ignore */ }
    setConfirmDelete(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  if (!party) return null;

  const TYPE_BADGE_MAP: Record<string, { label: string; variant: "blue" | "green" | "purple" }> = {
    CUSTOMER: { label: "Customer", variant: "blue" },
    SUPPLIER: { label: "Supplier", variant: "green" },
    BOTH:     { label: "Both",     variant: "purple" },
  };
  const typeBadge = TYPE_BADGE_MAP[party.type];

  const tabClass = (t: DetailTab) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate("/crm")} className="mt-1 p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-800">{party.name}</h1>
            <Badge label={typeBadge.label} variant={typeBadge.variant} />
          </div>
          {party.displayName && <p className="text-slate-500 text-sm mt-0.5">{party.displayName}</p>}
        </div>
        <Button variant="outline" size="sm" icon={<Edit2 className="w-4 h-4" />} onClick={() => setShowEdit(true)}>
          Edit
        </Button>
      </div>

      {/* Quick info strip */}
      <div className="flex flex-wrap gap-4">
        {party.email && (
          <a href={`mailto:${party.email}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors">
            <Mail className="w-4 h-4 text-slate-400" />{party.email}
          </a>
        )}
        {party.phone && (
          <a href={`tel:${party.phone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors">
            <Phone className="w-4 h-4 text-slate-400" />{party.phone}
          </a>
        )}
        {party.website && (
          <a href={party.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors">
            <Globe className="w-4 h-4 text-slate-400" />{party.website}
          </a>
        )}
        {(party.city || party.state) && (
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <MapPin className="w-4 h-4 text-slate-400" />{[party.city, party.state, party.country].filter(Boolean).join(", ")}
          </span>
        )}
        {party.gstin && (
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <Hash className="w-4 h-4 text-slate-400" />{party.gstin}
          </span>
        )}
      </div>

      {/* Tags */}
      <PartyTagEditor partyId={party.id} initialTags={party.tags || []} onUpdated={fetchParty} />

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        <button className={tabClass("overview")} onClick={() => setTab("overview")}>Overview</button>
        <button className={tabClass("contacts")} onClick={() => setTab("contacts")}>
          Contacts {(party.contacts?.length ?? 0) > 0 && <span className="ml-1.5 text-xs bg-slate-200 text-slate-600 rounded-full px-1.5">{party.contacts?.length}</span>}
        </button>
        <button className={tabClass("communications")} onClick={() => setTab("communications")}>
          Activity Log {(party.communications?.length ?? 0) > 0 && <span className="ml-1.5 text-xs bg-slate-200 text-slate-600 rounded-full px-1.5">{party.communications?.length}</span>}
        </button>
        <button className={tabClass("documents")} onClick={() => setTab("documents")}>Documents</button>
        <button className={tabClass("comments")} onClick={() => setTab("comments")}>Comments</button>
        <button className={tabClass("custom_fields")} onClick={() => setTab("custom_fields")}>Custom Fields</button>
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left — details */}
          <div className="xl:col-span-2 space-y-4">
            <Card>
              <CardHeader><h3 className="font-semibold text-slate-700">Business Details</h3></CardHeader>
              <CardBody>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {[
                    { label: "GSTIN",          value: party.gstin },
                    { label: "PAN",            value: party.pan },
                    { label: "IEC Code",       value: party.iecCode },
                    { label: "Currency",       value: party.currency },
                    { label: "Credit Limit",   value: party.creditLimit != null ? `${party.currency} ${party.creditLimit.toLocaleString()}` : null },
                    { label: "Payment Terms",  value: party.paymentTermsDays != null ? `${party.paymentTermsDays} days` : null },
                  ].map(({ label, value }) => value ? (
                    <div key={label}>
                      <dt className="text-slate-400 text-xs uppercase tracking-wide">{label}</dt>
                      <dd className="font-medium text-slate-700 mt-0.5">{value}</dd>
                    </div>
                  ) : null)}
                </dl>
              </CardBody>
            </Card>

            {party.address && (
              <Card>
                <CardHeader><h3 className="font-semibold text-slate-700">Address</h3></CardHeader>
                <CardBody className="text-sm text-slate-600 space-y-1">
                  <p>{party.address}</p>
                  <p>{[party.city, party.state, party.pincode].filter(Boolean).join(", ")}</p>
                  <p>{party.country}</p>
                </CardBody>
              </Card>
            )}

            {(party.bankName || party.bankAccount) && (
              <Card>
                <CardHeader><h3 className="font-semibold text-slate-700">Banking</h3></CardHeader>
                <CardBody>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {[
                      { label: "Bank",    value: party.bankName },
                      { label: "Account", value: party.bankAccount },
                      { label: "IFSC",    value: party.bankIfsc },
                      { label: "Branch",  value: party.bankBranch },
                    ].map(({ label, value }) => value ? (
                      <div key={label}>
                        <dt className="text-slate-400 text-xs uppercase tracking-wide">{label}</dt>
                        <dd className="font-medium text-slate-700 font-mono mt-0.5">{value}</dd>
                      </div>
                    ) : null)}
                  </dl>
                </CardBody>
              </Card>
            )}

            {party.notes && (
              <Card>
                <CardHeader><h3 className="font-semibold text-slate-700">Notes</h3></CardHeader>
                <CardBody className="text-sm text-slate-600 whitespace-pre-wrap">{party.notes}</CardBody>
              </Card>
            )}
          </div>

          {/* Right — summary */}
          <div className="space-y-4">
            <Card>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                    {getInitials(party.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{party.name}</p>
                    <p className="text-xs text-slate-400">Since {formatDate(party.createdAt)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <Building className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Contacts</p>
                    <p className="font-bold text-slate-700">{party.contacts?.length ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <MessageSquare className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">Log Entries</p>
                    <p className="font-bold text-slate-700">{party.communications?.length ?? 0}</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Follow-ups */}
            {(party.communications?.filter((c) => c.followUpDate && new Date(c.followUpDate) >= new Date()) ?? []).length > 0 && (
              <Card>
                <CardHeader><h3 className="font-semibold text-slate-700 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-orange-500" /> Upcoming Follow-ups</h3></CardHeader>
                <CardBody className="space-y-2">
                  {(party.communications ?? []).filter((c) => c.followUpDate && new Date(c.followUpDate) >= new Date()).slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-start gap-2 text-sm">
                      <Clock className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-slate-700 font-medium">{c.subject || c.description.slice(0, 40)}</p>
                        <p className="text-xs text-orange-600">{formatDateTime(c.followUpDate!)}</p>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Contacts ── */}
      {tab === "contacts" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setEditContact(null); setShowContact(true); }}>
              Add Contact
            </Button>
          </div>
          {(party.contacts?.length ?? 0) === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Users className="w-10 h-10 text-slate-200" />
                <p className="text-slate-500">No contacts yet</p>
                <Button size="sm" onClick={() => setShowContact(true)}>Add First Contact</Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {party.contacts!.map((c) => (
                <Card key={c.id}>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-semibold">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                            {c.isPrimary && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                          </div>
                          {c.designation && <p className="text-xs text-slate-400">{c.designation}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditContact(c); setShowContact(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDelete({ type: "contact", id: c.id, label: c.name })} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600"><Mail className="w-3 h-3" />{c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600"><Phone className="w-3 h-3" />{c.phone}</a>}
                      {c.mobile && <a href={`tel:${c.mobile}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600"><Phone className="w-3 h-3" />{c.mobile}</a>}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Communications ── */}
      {tab === "communications" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowComm(true)}>Add Log Entry</Button>
          </div>
          {(party.communications?.length ?? 0) === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <MessageSquare className="w-10 h-10 text-slate-200" />
                <p className="text-slate-500">No activity logged yet</p>
                <Button size="sm" onClick={() => setShowComm(true)}>Log First Activity</Button>
              </div>
            </Card>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-4 pl-16">
                {party.communications!.map((comm) => {
                  const meta = COMM_META[comm.type];
                  return (
                    <div key={comm.id} className="relative">
                      {/* Icon on timeline */}
                      <div className={`absolute -left-10 w-8 h-8 rounded-full flex items-center justify-center ${meta.color}`}>
                        {meta.icon}
                      </div>
                      <Card>
                        <CardBody>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge label={meta.label} variant="slate" />
                                {comm.subject && <span className="text-sm font-semibold text-slate-700">{comm.subject}</span>}
                              </div>
                              <p className="text-sm text-slate-600 mt-2">{comm.description}</p>
                              {comm.outcome && <p className="text-sm text-slate-500 mt-1 italic">→ {comm.outcome}</p>}
                              {comm.followUpDate && (
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-orange-600">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  Follow-up: {formatDateTime(comm.followUpDate)}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0 flex items-start gap-2">
                              <div>
                                <p className="text-xs text-slate-400">{formatDate(comm.createdAt)}</p>
                                <p className="text-xs text-slate-400">{comm.createdBy.name}</p>
                              </div>
                              <button onClick={() => setConfirmDelete({ type: "comm", id: comm.id, label: comm.subject || comm.description.slice(0, 40) })} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors cursor-pointer mt-0.5">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Documents ── */}
      {tab === "documents" && (
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-700">Documents &amp; Attachments</h3></CardHeader>
          <CardBody>
            <DocumentsPanel entityType="PARTY" entityId={party.id} />
          </CardBody>
        </Card>
      )}

      {/* ── Comments ── */}
      {tab === "comments" && (
        <Card>
          <CardBody>
            <RecordComments entityType="PARTY" entityId={party.id} />
          </CardBody>
        </Card>
      )}

      {/* ── Custom Fields ── */}
      {tab === "custom_fields" && (
        <Card>
          <CardBody>
            <CustomFieldRenderer entity="PARTY" entityId={party.id} />
          </CardBody>
        </Card>
      )}

      {/* Modals */}
      <PartyForm open={showEdit} onClose={() => setShowEdit(false)} onSaved={() => fetchParty()} party={party} />
      <ContactModal open={showContact} onClose={() => setShowContact(false)} onSaved={fetchParty} partyId={id!} contact={editContact} />
      <CommModal open={showComm} onClose={() => setShowComm(false)} onSaved={fetchParty} partyId={id!} />

      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.type === "contact" ? "Delete Contact" : "Delete Log Entry"}
          message={`"${confirmDelete.label}" will be permanently deleted.`}
          confirmLabel="Delete"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
