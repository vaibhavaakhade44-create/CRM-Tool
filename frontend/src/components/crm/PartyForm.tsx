import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import api from "@/lib/api";
import { getApiError } from "@/lib/utils";
import type { Party, PartyType } from "@/types";
import {
  kDigits, kDecimal, kAlphaNum, kName, kAlpha, kPhone, kGSTIN, kPAN, kIFSC, upperReg,
  isOptGSTIN, isOptPAN, isOptIFSC, isOptIEC, isOptPhone, isOptPIN, isOptBankAC,
} from "@/lib/fieldRules";

const schema = z.object({
  type:             z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  name:             z.string().min(2, "Name required").max(200),
  displayName:      z.string().max(200).optional(),
  email:            z.string().email("Invalid email").optional().or(z.literal("")),
  phone:            z.string().refine(isOptPhone, "Invalid phone number").optional(),
  mobile:           z.string().refine(isOptPhone, "Invalid mobile number").optional(),
  address:          z.string().optional(),
  city:             z.string().max(100).optional(),
  state:            z.string().max(100).optional(),
  country:          z.string().optional(),
  pincode:          z.string().refine(isOptPIN, "Pincode must be 6 digits").optional(),
  gstin:            z.string().refine(isOptGSTIN, "Invalid GSTIN. Format: 22AAAAA0000A1Z5").optional(),
  pan:              z.string().refine(isOptPAN, "Invalid PAN. Format: AAAAA0000A").optional(),
  iecCode:          z.string().refine(isOptIEC, "Invalid IEC. Must be 10 alphanumeric characters").optional(),
  currency:         z.string().optional(),
  creditLimit:      z.coerce.number().nonnegative().optional(),
  paymentTermsDays: z.coerce.number().int().nonnegative().optional(),
  bankName:         z.string().max(100).optional(),
  bankAccount:      z.string().refine(isOptBankAC, "Bank account must be 9–18 digits").optional(),
  bankIfsc:         z.string().refine(isOptIFSC, "Invalid IFSC. Format: ABCD0123456").optional(),
  bankBranch:       z.string().max(100).optional(),
  notes:            z.string().optional(),
  assignedToId:     z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const TABS = ["Basic", "Address", "Business", "Banking"] as const;
type Tab = typeof TABS[number];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (party: Party) => void;
  party?: Party | null;
  defaultType?: PartyType;
}

export function PartyForm({ open, onClose, onSaved, party, defaultType = "CUSTOMER" }: Props) {
  const isEdit = !!party;
  const [tab, setTab] = useState<Tab>("Basic");
  const [apiError, setApiError] = useState("");
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) api.get("/hr?status=ACTIVE").then(r => setEmployees(r.data.data?.employees ?? [])).catch(() => {});
  }, [open]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { type: defaultType, currency: "INR", country: "IN" },
  });

  useEffect(() => {
    if (open) {
      setTab("Basic");
      setApiError("");
      if (party) {
        reset({
          type: party.type,
          name: party.name,
          displayName: party.displayName ?? "",
          email: party.email ?? "",
          phone: party.phone ?? "",
          mobile: party.mobile ?? "",
          address: party.address ?? "",
          city: party.city ?? "",
          state: party.state ?? "",
          country: party.country ?? "IN",
          pincode: party.pincode ?? "",
          gstin: party.gstin ?? "",
          pan: party.pan ?? "",
          iecCode: party.iecCode ?? "",
          currency: party.currency ?? "INR",
          creditLimit: party.creditLimit ?? undefined,
          paymentTermsDays: party.paymentTermsDays ?? undefined,
          bankName: party.bankName ?? "",
          bankAccount: party.bankAccount ?? "",
          bankIfsc: party.bankIfsc ?? "",
          bankBranch: party.bankBranch ?? "",
          notes: party.notes ?? "",
          assignedToId: party.assignedToId ?? "",
        });
      } else {
        reset({ type: defaultType, currency: "INR", country: "IN", assignedToId: "" });
      }
    }
  }, [open, party, defaultType, reset]);

  const onSubmit = async (data: FormData) => {
    setApiError("");
    try {
      const clean = Object.fromEntries(Object.entries(data).filter(([k, v]) => k === "assignedToId" || (v !== "" && v !== undefined)));
      const res = isEdit
        ? await api.patch<{ data: Party }>(`/parties/${party!.id}`, clean)
        : await api.post<{ data: Party }>("/parties", clean);
      onSaved(res.data.data);
      onClose();
    } catch (err) {
      setApiError(getApiError(err));
    }
  };

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${tab === t ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit — ${party!.name}` : "Add New Party"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? "Save Changes" : "Create Party"}
          </Button>
        </>
      }
    >
      {apiError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{apiError}</div>}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
        {TABS.map((t) => <button key={t} type="button" className={tabClass(t)} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <form className="space-y-4">
        {/* ── Basic ── */}
        {tab === "Basic" && (
          <>
            <Select
              label="Party Type *"
              options={[{ value: "CUSTOMER", label: "Customer" }, { value: "SUPPLIER", label: "Supplier" }, { value: "BOTH", label: "Both (Customer & Supplier)" }]}
              value={watch("type")}
              onChange={(e) => setValue("type", e.target.value as PartyType)}
              error={errors.type?.message}
            />
            <Input label="Company / Party Name *" placeholder="ABC Traders Pvt Ltd" error={errors.name?.message} maxLength={200} onKeyDown={kName} {...register("name")} />
            <Input label="Display Name" placeholder="Short name shown in lists" maxLength={200} onKeyDown={kName} {...register("displayName")} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Email" type="email" placeholder="info@abc.com" error={errors.email?.message} {...register("email")} />
              <Input label="Phone" placeholder="+91 9876543210" error={errors.phone?.message} maxLength={15} onKeyDown={kPhone} {...register("phone")} />
            </div>
            <Input label="Mobile" placeholder="+91 9876543210" error={errors.mobile?.message} maxLength={15} onKeyDown={kPhone} {...register("mobile")} />
            <Select
              label="Assigned To"
              options={[{ value: "", label: "Unassigned — visible to whole team" }, ...employees.map(e => ({ value: e.id, label: e.name }))]}
              value={watch("assignedToId") ?? ""}
              onChange={(e) => setValue("assignedToId", e.target.value)}
            />
            <Textarea label="Internal Notes" placeholder="Any notes about this party..." {...register("notes")} />
          </>
        )}

        {/* ── Address ── */}
        {tab === "Address" && (
          <>
            <Textarea label="Street Address" placeholder="123, Main Street, Industrial Area" rows={2} {...register("address")} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="City" placeholder="Mumbai" maxLength={100} onKeyDown={kAlpha} {...register("city")} />
              <Input label="State" placeholder="Maharashtra" maxLength={100} onKeyDown={kAlpha} {...register("state")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Country"
                options={[{ value: "IN", label: "India" }, { value: "US", label: "USA" }, { value: "GB", label: "UK" }, { value: "AE", label: "UAE" }, { value: "SG", label: "Singapore" }, { value: "CN", label: "China" }]}
                value={watch("country") || "IN"}
                onChange={(e) => setValue("country", e.target.value)}
              />
              <Input label="Pincode" placeholder="400001" error={errors.pincode?.message} maxLength={6} onKeyDown={kDigits} {...register("pincode")} />
            </div>
          </>
        )}

        {/* ── Business ── */}
        {tab === "Business" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => { const f = register("gstin"); return <Input label="GSTIN" placeholder="22AAAAA0000A1Z5" error={errors.gstin?.message} maxLength={15} onKeyDown={kGSTIN} {...f} {...upperReg(f.onChange)} />; })()}
              {(() => { const f = register("pan"); return <Input label="PAN" placeholder="AAAAA0000A" error={errors.pan?.message} maxLength={10} onKeyDown={kPAN} {...f} {...upperReg(f.onChange)} />; })()}
            </div>
            {(() => { const f = register("iecCode"); return <Input label="IEC Code" placeholder="AABCD1234E" error={errors.iecCode?.message} maxLength={10} onKeyDown={kAlphaNum} {...f} {...upperReg(f.onChange)} />; })()}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Currency"
                options={[{ value: "INR", label: "INR" }, { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "GBP", label: "GBP" }, { value: "AED", label: "AED" }]}
                value={watch("currency") || "INR"}
                onChange={(e) => setValue("currency", e.target.value)}
              />
              <Input label="Payment Terms (days)" type="number" placeholder="30" onKeyDown={kDigits} {...register("paymentTermsDays")} />
            </div>
            <Input label="Credit Limit" type="number" placeholder="100000" onKeyDown={kDecimal} {...register("creditLimit")} />
          </>
        )}

        {/* ── Banking ── */}
        {tab === "Banking" && (
          <>
            <Input label="Bank Name" placeholder="HDFC Bank" maxLength={100} onKeyDown={kName} {...register("bankName")} />
            <Input label="Account Number" placeholder="0012345678901234" error={errors.bankAccount?.message} maxLength={18} onKeyDown={kDigits} {...register("bankAccount")} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => { const f = register("bankIfsc"); return <Input label="IFSC Code" placeholder="HDFC0001234" error={errors.bankIfsc?.message} maxLength={11} onKeyDown={kIFSC} {...f} {...upperReg(f.onChange)} />; })()}
              <Input label="Branch" placeholder="Andheri West, Mumbai" maxLength={100} onKeyDown={kAlpha} {...register("bankBranch")} />
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
