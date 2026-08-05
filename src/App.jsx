import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, CASE_FILES_BUCKET } from "./supabaseClient.js";
import {
  Upload,
  Download,
  Search,
  Plus,
  LogOut,
  FileText,
  Calendar,
  ShieldCheck,
  UserRound,
  ArrowRight,
  X,
  CheckCircle2,
  Circle,
  Loader2,
  Building2,
  ClipboardList,
  ChevronDown,
  Trash2,
  Star,
} from "lucide-react";

/* ---------------------------------------------------------------
   ثوابت
--------------------------------------------------------------- */

const SHADES = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
];

const PRICE_LIST = {
  "XT": 350,
  "Mono": 450,
  "Multi": 650,
  "Zolid": 800,
  "Emax": 1600,
  "Bar": 250,
  "DSD + model": 550,
  "Post": 200,
  "Veneer": 1800,
  "Night Guard": 150,
  "Zolid Ultra": 850,
  "Custome Abutment": 950,
  "PMMA Printed": 100,
  "PMMA Milled": 150,
  "models": 300,
  "Jig": 1000,
  "fath": 200,
  "milled titanium bar": 850,
  "Design": 50,
  "Snap on": 1000,
  "ingivectomy": 400,
  "Scanner": 200,
};
const PRICE_TYPES = Object.keys(PRICE_LIST);
const USER_VISIBLE_PRICE_TYPES = ["XT", "Mono", "Multi", "Zolid", "Zolid Ultra", "PMMA Milled"];

const STAGES = ["final", "prova", "design"];

const STAGE_META = {
  design: { label: "ديزاين", labelEn: "Design", sub: "الطبعة الأولى", color: "#4A6A8A", tint: "#EEF2F6" },
  prova: { label: "بروفا", labelEn: "Prova", sub: "التجربة", color: "#C6963E", tint: "#FBF3E4" },
  final: { label: "فاينال", labelEn: "Final", sub: "التسليم النهائي", color: "#1F5C57", tint: "#E7F0EE" },
};

const MAX_FILE_MB = 50;

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function getViewedCaseIds(userId) {
  try {
    const raw = localStorage.getItem(`viewed-cases:${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markCaseViewed(userId, caseId) {
  try {
    const set = getViewedCaseIds(userId);
    set.add(caseId);
    localStorage.setItem(`viewed-cases:${userId}`, JSON.stringify([...set]));
  } catch {
    // best-effort only
  }
}

async function uploadCaseFile(caseId, stage, file, idx = 0) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${caseId}/${stage}/${Date.now()}_${idx}_${safeName}`;
  const { error } = await supabase.storage.from(CASE_FILES_BUCKET).upload(path, file, {
    upsert: true,
  });
  if (error) throw error;
  return path;
}

function getFileUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(CASE_FILES_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

async function triggerFileDownload(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "file";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/* ---------------------------------------------------------------
   شاشة الدخول
--------------------------------------------------------------- */

function usernameToEmail(username) {
  const clean = username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z.]/g, "");
  return `${clean}@dentallab.local`;
}

function normalizeDisplayName(username) {
  return username.trim().replace(/\s+/g, " ");
}

function LoginScreen() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [role, setRole] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const usernameValid = /^[a-zA-Z]+(\s[a-zA-Z]+)*$/.test(username.trim()) && username.trim().length >= 3;

  const submit = async () => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("من فضلك املأ كل الحقول");
      return;
    }
    if (!usernameValid) {
      setError("الاسم لازم يكون حروف إنجليزي ومسافات بس (3 حروف على الأقل)، من غير أرقام أو رموز");
      return;
    }
    setBusy(true);
    try {
      const pseudoEmail = usernameToEmail(username);
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: pseudoEmail,
          password,
        });
        if (signUpError) {
          if (signUpError.message?.toLowerCase().includes("already registered")) {
            throw new Error("الاسم ده مستخدم بالفعل، اختار اسم تاني");
          }
          throw signUpError;
        }

        if (data.session && data.user) {
          const { error: profileError } = await supabase.from("profiles").insert({
            id: data.user.id,
            name: normalizeDisplayName(username),
            role,
          });
          if (profileError) throw profileError;
          // onAuthStateChange in App will pick up the session and load the profile
        } else {
          setError("الحساب اتعمل بس محتاج تأكيد. كلم الأدمن بتاع Supabase يشيل خطوة تأكيد الإيميل.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: pseudoEmail,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (e) {
      setError(e.message === "Invalid login credentials" ? "اسم الدخول أو الباسورد غلط" : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen w-full flex" style={{ background: "#F6F3EE" }}>
      {/* لوحة الهوية */}
      <div
        className="hidden md:flex md:w-5/12 relative overflow-hidden items-center justify-center"
        style={{ background: "#1F5C57" }}
      >
        <div className="relative z-10 px-12 text-right">
          <p
            className="text-sm tracking-widest mb-3"
            style={{ color: "#C6963E", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
          >
            نظام متابعة الحالات
          </p>
          <h1
            className="text-5xl leading-[1.15] text-white mb-6"
            style={{ fontFamily: "'Markazi Text', serif", fontWeight: 600 }}
          >
            من الطبعة
            <br />
            للتسليم النهائي
          </h1>
          <p className="text-white/70 max-w-xs leading-relaxed" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
            ديزاين، بروفا، فاينال — كل حالة سنّ بمراحلها وملفاتها في مكان واحد بين المعمل والعيادة.
          </p>
        </div>

        {/* شعار الفان (شرائح دليل اللون) */}
        <div className="absolute -left-10 bottom-[-40px] flex items-end">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className="w-24 h-40 rounded-t-2xl mx-[-14px] shadow-2xl"
              style={{
                background: STAGE_META[s].color,
                transform: `rotate(${(i - 1) * 8}deg) translateY(${i === 1 ? -14 : 0}px)`,
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      </div>

      {/* فورم الدخول */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode("login")}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
              style={{
                background: mode === "login" ? "#1F5C57" : "#EFEBE2",
                color: mode === "login" ? "#fff" : "#6B7674",
              }}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setMode("signup")}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
              style={{
                background: mode === "signup" ? "#1F5C57" : "#EFEBE2",
                color: mode === "signup" ? "#fff" : "#6B7674",
              }}
            >
              حساب جديد
            </button>
          </div>

          {mode === "signup" && (
            <>
              <p className="text-sm text-[#6B7674] mb-3">اختار صفتك</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  onClick={() => setRole("user")}
                  className="rounded-xl p-4 text-right border-2 transition-all"
                  style={{
                    borderColor: role === "user" ? "#1F5C57" : "#E4E0D8",
                    background: role === "user" ? "#E7F0EE" : "#fff",
                  }}
                >
                  <UserRound size={20} color="#1F5C57" />
                  <div className="mt-2 text-sm font-semibold text-[#22302E]">مستخدم</div>
                  <div className="text-xs text-[#6B7674]">أرفع حالات وأتابعها</div>
                </button>
                <button
                  onClick={() => setRole("admin")}
                  className="rounded-xl p-4 text-right border-2 transition-all"
                  style={{
                    borderColor: role === "admin" ? "#1F5C57" : "#E4E0D8",
                    background: role === "admin" ? "#E7F0EE" : "#fff",
                  }}
                >
                  <ShieldCheck size={20} color="#1F5C57" />
                  <div className="mt-2 text-sm font-semibold text-[#22302E]">أدمن المعمل</div>
                  <div className="text-xs text-[#6B7674]">أدير كل الحالات</div>
                </button>
              </div>
            </>
          )}

          <label className="block text-xs text-[#6B7674] mb-1.5">الاسم (بالإنجليزي)</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Sara Ahmed"
            className="w-full rounded-lg border border-[#E4E0D8] px-3 py-2.5 text-sm outline-none focus:border-[#1F5C57] mb-4"
            style={{ direction: "ltr", textAlign: "right" }}
          />

          <label className="block text-xs text-[#6B7674] mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••••••"
            className="w-full rounded-lg border border-[#E4E0D8] px-3 py-2.5 text-sm outline-none focus:border-[#1F5C57] mb-2"
          />

          {error && <p className="text-xs text-[#B1503F] mt-2">{error}</p>}

          <button
            disabled={busy}
            onClick={submit}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 mt-4"
            style={{ background: "#1F5C57" }}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {mode === "signup" ? "إنشاء الحساب" : "دخول"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   عناصر عرض بيانات
--------------------------------------------------------------- */

function DataRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-[#EFEBE2] last:border-0">
      <span className="text-xs text-[#6B7674]">{label}</span>
      <span className="text-sm text-[#22302E] font-medium" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function FilePreviewCard({ record, onDelete, deleting }) {
  const [downloading, setDownloading] = useState(false);
  if (!record) return null;

  const handleDownload = async () => {
    if (!record.fileUrl || downloading) return;
    setDownloading(true);
    try {
      await triggerFileDownload(record.fileUrl, record.fileName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-[#E4E0D8] bg-white px-3 py-2.5 mt-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={16} color="#6B7674" />
        <span className="text-xs text-[#22302E] truncate max-w-[140px]">{record.fileName}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1 text-xs font-semibold text-[#1F5C57] hover:opacity-70 disabled:opacity-50"
        >
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} تحميل
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="flex items-center gap-1 text-xs font-semibold text-[#B1503F] hover:opacity-70 disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   فورم رفع من الأدمن (بروفا / فاينال)
--------------------------------------------------------------- */

function AdminUploadForm({ stage, caseItem, initial, onDone }) {
  const meta = STAGE_META[stage];
  const [doctorName, setDoctorName] = useState(initial?.doctorName ?? caseItem.doctorName);
  const [caseName, setCaseName] = useState(initial?.caseName ?? caseItem.caseName);
  const [crownCount, setCrownCount] = useState(initial?.crownCount != null ? String(initial.crownCount) : "");
  const [shade, setShade] = useState(initial?.shade || SHADES[0]);
  const [priceType, setPriceType] = useState(initial?.priceType || PRICE_TYPES[0]);
  const [note, setNote] = useState(initial?.note || "");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const addFiles = (picked) => setFiles((prev) => [...prev, ...picked]);
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setError("");
    if (!doctorName.trim() || !caseName.trim() || !crownCount) {
      setError("من فضلك املأ كل الحقول");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setError(`الملف "${tooBig.name}" أكبر من ${MAX_FILE_MB} ميجا`);
      return;
    }
    setSaving(true);
    try {
      const record = {
        doctorName: doctorName.trim(),
        caseName: caseName.trim(),
        crownCount: Number(crownCount),
        shade,
        priceType: stage === "final" ? priceType : null,
        note: note.trim(),
        files,
      };
      await onDone(record);
    } catch (e) {
      setError(e.message || "حصل خطأ أثناء الرفع، جرب تاني");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed p-4" style={{ borderColor: meta.color, background: meta.tint }}>
      <p className="text-sm font-semibold mb-3" style={{ color: meta.color }}>
        رفع ملف مرحلة {meta.label}
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[11px] text-[#6B7674] mb-1">Doctor</label>
          <input
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
            className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57] bg-white"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[#6B7674] mb-1">Patient</label>
          <input
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57] bg-white"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[#6B7674] mb-1">N.O.C.</label>
          <input
            type="number"
            min="1"
            value={crownCount}
            onChange={(e) => setCrownCount(e.target.value)}
            className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57] bg-white"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[#6B7674] mb-1">Shade</label>
          <div className="relative">
            <select
              value={shade}
              onChange={(e) => setShade(e.target.value)}
              className="w-full appearance-none rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57] bg-white"
            >
              {SHADES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute left-2 top-2.5 pointer-events-none text-[#6B7674]" />
          </div>
        </div>
        {stage === "final" && (
          <div className="col-span-2">
            <label className="block text-[11px] text-[#6B7674] mb-1">Price</label>
            <div className="relative">
              <select
                value={priceType}
                onChange={(e) => setPriceType(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57] bg-white"
              >
                {PRICE_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p} — {PRICE_LIST[p]}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-2 top-2.5 pointer-events-none text-[#6B7674]" />
            </div>
          </div>
        )}
        <div className="col-span-2">
          <label className="block text-[11px] text-[#6B7674] mb-1">Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57] bg-white"
          />
        </div>
      </div>

      <FileDropZone files={files} onAdd={addFiles} onRemove={removeFile} placeholder="Choose case files (optional)" />

      {error && <p className="text-xs text-[#B1503F] mt-2">{error}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: meta.color }}
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {initial ? "حفظ التعديلات" : `رفع لمرحلة ${meta.label}`}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   فورم إضافة حالة جديدة (دكتور)
--------------------------------------------------------------- */

function NewCaseForm({ onCreated, onClose, doctorSuggestions }) {
  const [doctorName, setDoctorName] = useState("");
  const [caseName, setCaseName] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const addFiles = (picked) => setFiles((prev) => [...prev, ...picked]);
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setError("");
    if (!doctorName.trim() || !caseName.trim() || files.length === 0) {
      setError("اكتب اسم الدكتور واسم الحالة وارفع ملف واحد على الأقل");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setError(`الملف "${tooBig.name}" أكبر من ${MAX_FILE_MB} ميجا`);
      return;
    }
    setSaving(true);
    try {
      await onCreated({
        doctorName: doctorName.trim(),
        caseName: caseName.trim(),
        note: note.trim(),
        files,
      });
    } catch (e) {
      setError(e.message || "حصل خطأ أثناء الرفع، جرب تاني");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#22302E]">حالة جديدة</h3>
          <button onClick={onClose}>
            <X size={18} color="#6B7674" />
          </button>
        </div>

        <label className="block text-[11px] text-[#6B7674] mb-1">Doctor</label>
        <input
          autoFocus
          list="doctor-suggestions-user"
          value={doctorName}
          onChange={(e) => setDoctorName(e.target.value)}
          placeholder="e.g. Dr. Ahmed Sami"
          className="w-full rounded-lg border border-[#E4E0D8] px-3 py-2 text-sm mb-3 outline-none focus:border-[#1F5C57]"
        />
        <datalist id="doctor-suggestions-user">
          {doctorSuggestions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        <label className="block text-[11px] text-[#6B7674] mb-1">Patient</label>
        <input
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="e.g. Upper Zirconia Crown"
          className="w-full rounded-lg border border-[#E4E0D8] px-3 py-2 text-sm mb-3 outline-none focus:border-[#1F5C57]"
        />

        <label className="block text-[11px] text-[#6B7674] mb-1">Note</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
          className="w-full rounded-lg border border-[#E4E0D8] px-3 py-2 text-sm mb-3 outline-none focus:border-[#1F5C57]"
        />

        <FileDropZone files={files} onAdd={addFiles} onRemove={removeFile} placeholder="Upload one or more files" />

        {error && <p className="text-xs text-[#B1503F] mt-2">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="mt-4 w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "#1F5C57" }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          إنشاء الحالة
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   فورم حالة جديدة (أدمن) — بيانات أوسع من المستخدم
--------------------------------------------------------------- */

function AdminNewCaseForm({ stage, onCreated, onClose, doctorSuggestions }) {
  const [doctorName, setDoctorName] = useState("");
  const [caseName, setCaseName] = useState("");
  const [crownCount, setCrownCount] = useState("");
  const [shade, setShade] = useState(SHADES[0]);
  const [priceType, setPriceType] = useState(PRICE_TYPES[0]);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const addFiles = (picked) => setFiles((prev) => [...prev, ...picked]);
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setError("");
    if (!doctorName.trim() || !caseName.trim() || !crownCount || files.length === 0) {
      setError("من فضلك املأ كل الحقول وارفع ملف واحد على الأقل");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setError(`الملف "${tooBig.name}" أكبر من ${MAX_FILE_MB} ميجا`);
      return;
    }
    setSaving(true);
    try {
      await onCreated({
        doctorName: doctorName.trim(),
        caseName: caseName.trim(),
        crownCount: Number(crownCount),
        shade,
        priceType: stage === "final" ? priceType : null,
        note: note.trim(),
        files,
      });
    } catch (e) {
      setError(e.message || "حصل خطأ أثناء الرفع، جرب تاني");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#22302E]">حالة جديدة</h3>
          <button onClick={onClose}>
            <X size={18} color="#6B7674" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-[#6B7674] mb-1">Doctor</label>
            <input
              autoFocus
              list="doctor-suggestions-admin"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57]"
            />
            <datalist id="doctor-suggestions-admin">
              {doctorSuggestions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] text-[#6B7674] mb-1">Patient</label>
            <input
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
              className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57]"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#6B7674] mb-1">N.O.C.</label>
            <input
              type="number"
              min="1"
              value={crownCount}
              onChange={(e) => setCrownCount(e.target.value)}
              className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57]"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#6B7674] mb-1">Shade</label>
            <div className="relative">
              <select
                value={shade}
                onChange={(e) => setShade(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57]"
              >
                {SHADES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-2 top-2.5 pointer-events-none text-[#6B7674]" />
            </div>
          </div>
          {stage === "final" && (
            <div className="col-span-2">
              <label className="block text-[11px] text-[#6B7674] mb-1">Price</label>
              <div className="relative">
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57]"
                >
                  {PRICE_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p} — {PRICE_LIST[p]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute left-2 top-2.5 pointer-events-none text-[#6B7674]" />
              </div>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-[11px] text-[#6B7674] mb-1">Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57]"
            />
          </div>
        </div>

        <FileDropZone files={files} onAdd={addFiles} onRemove={removeFile} placeholder="Upload one or more files" />

        {error && <p className="text-xs text-[#B1503F] mt-2">{error}</p>}

        <button
          onClick={submit}
          disabled={saving}
          className="mt-4 w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "#1F5C57" }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          إنشاء الحالة
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   تفاصيل الحالة
--------------------------------------------------------------- */

function CaseDetail({ caseItem, user, onBack, onLoadStage, onSaveStage, onToggleDone, onToggleStarred, onDeleteCase, onDeleteFile }) {
  const role = user.role;
  const stage = caseItem.stage;
  const meta = STAGE_META[stage];
  const canManage = role === "admin" || caseItem.uploadedBy === user.id;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await onLoadStage(caseItem.id, stage);
    setRecord(r);
    setLoading(false);
  }, [caseItem.id, stage, onLoadStage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdminUpload = async (rec) => {
    await onSaveStage(caseItem.id, stage, rec);
    setEditing(false);
    await load();
  };

  const handleDeleteCase = async () => {
    if (!window.confirm("متأكد إنك عايز تمسح الحالة دي؟ الإجراء ده مش قابل للتراجع.")) return;
    setDeletingCase(true);
    try {
      await onDeleteCase(caseItem.id);
    } finally {
      setDeletingCase(false);
    }
  };

  const handleDeleteFile = async (fileId, filePath) => {
    if (!window.confirm("متأكد إنك عايز تمسح الملف؟")) return;
    setDeletingFileId(fileId);
    try {
      await onDeleteFile(fileId, filePath);
      await load();
    } finally {
      setDeletingFileId(null);
    }
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#6B7674] mb-4 hover:text-[#22302E]">
        <ArrowRight size={16} /> رجوع
      </button>

      <div className="flex items-start justify-between mb-1">
        <div>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: meta.color, background: meta.tint }}
          >
            {meta.labelEn}
          </span>
          <h2 className="text-2xl text-[#22302E] mt-1" style={{ fontFamily: "'Markazi Text', serif", fontWeight: 600 }}>
            {caseItem.caseName}
          </h2>
          <p className="text-sm text-[#6B7674] flex items-center gap-1.5 mt-1">
            <UserRound size={13} /> {caseItem.doctorName}
            <span className="mx-1">·</span>
            <Calendar size={13} /> {formatDate(caseItem.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleDone(caseItem.id, !caseItem.done)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors"
            style={{
              borderColor: caseItem.done ? "#3F7A56" : "#E4E0D8",
              color: caseItem.done ? "#3F7A56" : "#6B7674",
              background: caseItem.done ? "#E7F2EA" : "#fff",
            }}
          >
            <CheckCircle2 size={14} /> {caseItem.done ? "تمت الحالة" : "علّم كـ تمت"}
          </button>
          <button
            onClick={() => onToggleStarred(caseItem.id, !caseItem.starred)}
            title="علّم بنجمة"
            className="flex items-center justify-center rounded-full w-8 h-8 border transition-colors"
            style={{
              borderColor: caseItem.starred ? "#C6963E" : "#E4E0D8",
              background: caseItem.starred ? "#FBF3E4" : "#fff",
            }}
          >
            <Star size={14} color={caseItem.starred ? "#C6963E" : "#9AA29F"} fill={caseItem.starred ? "#C6963E" : "none"} />
          </button>
          {canManage && (
            <button
              onClick={handleDeleteCase}
              disabled={deletingCase}
              title="امسح الحالة"
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold border border-[#E4E0D8] text-[#B1503F] hover:bg-[#FBEDEA] disabled:opacity-50"
            >
              {deletingCase ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#EFEBE2] p-5 min-h-[220px] mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#9AA29F]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : editing ? (
          <AdminUploadForm stage={stage} caseItem={caseItem} initial={record} onDone={handleAdminUpload} />
        ) : record ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold" style={{ color: meta.color }}>
                بيانات {meta.label}
              </p>
              {role === "admin" && (
                <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[#1F5C57] hover:opacity-70">
                  تعديل
                </button>
              )}
            </div>
            <DataRow label="Doctor" value={record.doctorName} />
            <DataRow label="Patient" value={record.caseName} />
            {record.crownCount != null && <DataRow label="N.O.C." value={record.crownCount} />}
            {record.shade && <DataRow label="Shade" value={record.shade} />}
            {record.priceType && <DataRow label="Price" value={`${record.priceType} — ${PRICE_LIST[record.priceType] || 0} × ${record.crownCount || 0} = ${(PRICE_LIST[record.priceType] || 0) * (record.crownCount || 0)}`} />}
            {record.note && <DataRow label="Note" value={record.note} />}
            <DataRow label="تاريخ الرفع" value={formatDate(record.uploadedAt)} />
            {record.files.length === 0 ? (
              <p className="text-xs text-[#9AA29F] mt-3">مفيش ملفات مرفوعة</p>
            ) : (
              record.files.map((f) => (
                <FilePreviewCard
                  key={f.id}
                  record={f}
                  deleting={deletingFileId === f.id}
                  onDelete={canManage ? () => handleDeleteFile(f.id, f.filePath) : undefined}
                />
              ))
            )}
          </div>
        ) : (
          <EmptyState text="مفيش بيانات للحالة دي" />
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-center">
      <ClipboardList size={26} color="#C7C2B6" />
      <p className="text-sm text-[#9AA29F] mt-2">{text}</p>
    </div>
  );
}

/* ---------------------------------------------------------------
   منطقة رفع الملف — دروب أو دوس عادي
--------------------------------------------------------------- */

function FileDropZone({ files, onAdd, onRemove, placeholder = "Choose or drop files" }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length) onAdd(dropped);
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-sm cursor-pointer transition-colors"
        style={{
          borderColor: dragging ? "#1F5C57" : "#C7C2B6",
          background: dragging ? "#E7F0EE" : "#fff",
        }}
      >
        <Upload size={15} color={dragging ? "#1F5C57" : "#6B7674"} />
        <span className="text-[#22302E]">
          {dragging ? "سيب الملفات هنا" : files.length ? `${files.length} ملف مختار — ضيف كمان` : placeholder}
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            if (picked.length) onAdd(picked);
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-[#E4E0D8] bg-white px-3 py-1.5"
            >
              <span className="text-xs text-[#22302E] truncate max-w-[220px]">{f.name}</span>
              <button onClick={() => onRemove(i)} className="text-[#B1503F] hover:opacity-70">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   كارت حالة فى الليستة
--------------------------------------------------------------- */

function CaseCard({ item, onOpen, onDownload, showDoctor, isNew }) {
  const meta = STAGE_META[item.stage];
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await onDownload(item.id, item.stage);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="w-full text-right rounded-xl border bg-white p-4 hover:border-[#1F5C57] transition-colors relative cursor-pointer"
      onClick={onOpen}
      style={{
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
        borderColor: isNew ? "#1F5C57" : "#EFEBE2",
        borderWidth: isNew ? 1.5 : 1,
      }}
    >
      <div className="absolute left-3 top-3 flex items-center gap-1.5">
        {isNew && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: "#1F5C57" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> جديدة
          </span>
        )}
        {item.starred && <Star size={14} color="#C6963E" fill="#C6963E" />}
        {item.done && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border-2"
            style={{ color: "#3F7A56", borderColor: "#3F7A56", transform: "rotate(-4deg)" }}
          >
            ✓ تمت
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: meta.color, background: meta.tint }}
        >
          {meta.labelEn}
        </span>
      </div>
      {showDoctor ? (
        <>
          <p className="text-base text-[#22302E] font-semibold mb-1 flex items-center gap-1">
            <UserRound size={13} /> {item.doctorName}
          </p>
          <p className="text-xs text-[#6B7674]">{item.caseName}</p>
        </>
      ) : (
        <p className="text-base text-[#22302E] font-semibold mb-1">{item.caseName}</p>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-[#9AA29F] flex items-center gap-1">
          <Calendar size={12} /> {formatDate(item.createdAt)}
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          title="Download"
          className="flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: "#1F5C57", background: "#E7F0EE" }}
        >
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Download
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   الشاشة الرئيسية — تلات مربعات كبيرة
--------------------------------------------------------------- */

function StageHome({ user, index, onSelectStage }) {
  return (
    <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <h2 className="text-2xl text-[#22302E] mb-1" style={{ fontFamily: "'Markazi Text', serif", fontWeight: 600 }}>
        أهلاً {user.name}
      </h2>
      <p className="text-sm text-[#6B7674] mb-6">اختار المرحلة اللي عايز تدخلها</p>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {STAGES.map((s) => {
          const meta = STAGE_META[s];
          return (
            <button
              key={s}
              onClick={() => onSelectStage(s)}
              className="aspect-square rounded-2xl flex flex-col items-center justify-center text-center p-3 transition-transform hover:-translate-y-1 relative overflow-hidden"
              style={{ background: meta.color, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.35)" }}
            >
              <span
                className="text-white text-lg sm:text-xl font-semibold tracking-wide"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {meta.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ليستة حالات مرحلة معيّنة
--------------------------------------------------------------- */

function StageList({ user, stage, index, loading, onBack, onOpenCase, onNewCase, onDownload, sortMode, setSortMode }) {
  const meta = STAGE_META[stage];
  const isAdminFinal = user.role === "admin" && stage === "final";
  const viewedIds = useMemo(() => getViewedCaseIds(user.id), [user.id, index]);

  const [reportMonth, setReportMonth] = useState("");
  const [reportDoctor, setReportDoctor] = useState("");

  useEffect(() => {
    setReportDoctor("");
  }, [reportMonth]);

  const baseCases = useMemo(() => {
    let list = index.filter((c) => c.stage === stage);
    if (stage === "final" && user.role !== "admin") {
      list = list.filter((c) => c.priceType && USER_VISIBLE_PRICE_TYPES.includes(c.priceType));
    }
    return list;
  }, [index, stage, user.role]);

  const visibleCases = useMemo(() => {
    return [...baseCases].sort((a, b) => {
      if (sortMode === "done") {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [baseCases, sortMode]);

  const monthCases = useMemo(() => {
    if (!reportMonth) return [];
    return baseCases.filter((c) => (c.createdAt || "").slice(0, 7) === reportMonth);
  }, [baseCases, reportMonth]);

  const doctorsInMonth = useMemo(() => [...new Set(monthCases.map((c) => c.doctorName))].sort(), [monthCases]);

  const doctorRows = useMemo(() => {
    if (!reportDoctor) return [];
    return monthCases
      .filter((c) => c.doctorName === reportDoctor)
      .map((c) => {
        const price = PRICE_LIST[c.priceType] || 0;
        const crowns = c.crownCount || 0;
        return { id: c.id, caseName: c.caseName, crownCount: crowns, price, total: price * crowns };
      });
  }, [monthCases, reportDoctor]);

  const grandTotal = doctorRows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#6B7674] mb-4 hover:text-[#22302E]">
        <ArrowRight size={16} /> رجوع للرئيسية
      </button>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: meta.color }} />
          <h2 className="text-2xl text-[#22302E]" style={{ fontFamily: "'Markazi Text', serif", fontWeight: 600 }}>
            {meta.label} <span className="text-base text-[#9AA29F]">— {meta.sub}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "admin" && (
            <div className="relative">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className="appearance-none rounded-lg border border-[#E4E0D8] bg-white pl-8 pr-3 py-2 text-sm outline-none focus:border-[#1F5C57]"
              >
                <option value="done">غير المكتملة أولاً</option>
                <option value="date">الأحدث أولاً</option>
              </select>
              <ChevronDown size={14} className="absolute left-2.5 top-2.5 pointer-events-none text-[#6B7674]" />
            </div>
          )}
          <button
            onClick={onNewCase}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
            style={{ background: "#1F5C57" }}
          >
            <Plus size={15} /> حالة جديدة
          </button>
        </div>
      </div>

      {isAdminFinal && (
        <div className="rounded-xl border border-[#E4E0D8] bg-white p-4 mb-5">
          <p className="text-xs font-semibold text-[#6B7674] mb-2">تقرير شهري</p>
          <input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="rounded-lg border border-[#E4E0D8] bg-white px-3 py-2 text-sm outline-none focus:border-[#1F5C57] mb-3"
          />

          {reportMonth &&
            (doctorsInMonth.length === 0 ? (
              <p className="text-xs text-[#9AA29F]">مفيش حالات في الشهر ده</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {doctorsInMonth.map((d) => (
                  <button
                    key={d}
                    onClick={() => setReportDoctor(d)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors"
                    style={{
                      borderColor: reportDoctor === d ? "#1F5C57" : "#E4E0D8",
                      background: reportDoctor === d ? "#1F5C57" : "#fff",
                      color: reportDoctor === d ? "#fff" : "#22302E",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            ))}

          {reportDoctor && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-[#6B7674] border-b border-[#E4E0D8]">
                    <th className="text-right py-1.5 pr-2">Patient</th>
                    <th className="text-right py-1.5 px-2">N.O.C.</th>
                    <th className="text-right py-1.5 px-2">Price</th>
                    <th className="text-right py-1.5 pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorRows.map((r) => (
                    <tr key={r.id} className="border-b border-[#F3F1EC]">
                      <td className="py-1.5 pr-2 text-[#22302E]">{r.caseName}</td>
                      <td className="py-1.5 px-2 text-[#22302E]">{r.crownCount}</td>
                      <td className="py-1.5 px-2 text-[#22302E]">{r.price}</td>
                      <td className="py-1.5 pl-2 text-[#22302E] font-semibold">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="py-2 pr-2 text-[#6B7674] font-semibold">
                      الإجمالي
                    </td>
                    <td className="py-2 pl-2 font-bold" style={{ color: "#1F5C57" }}>
                      {grandTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-[#9AA29F]">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : visibleCases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E4E0D8] bg-white/60 py-16 text-center">
          <ClipboardList size={26} color="#C7C2B6" className="mx-auto mb-2" />
          <p className="text-sm text-[#9AA29F]">
            {user.role === "admin" ? "لسه مفيش حالات هنا" : "ابدأ بإضافة أول حالة"}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visibleCases.map((c) => (
            <CaseCard
              key={c.id}
              item={c}
              onOpen={() => onOpenCase(c.id)}
              onDownload={onDownload}
              showDoctor
              isNew={!viewedIds.has(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   لوحة التحكم
--------------------------------------------------------------- */

function Dashboard({ user, onLogout }) {
  const [index, setIndex] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home"); // 'home' | 'stage' | 'detail'
  const [activeStage, setActiveStage] = useState("design");
  const [selectedId, setSelectedId] = useState(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("done"); // 'done' | 'date'

  const doctorSuggestions = useMemo(() => [...new Set(index.map((c) => c.doctorName).filter(Boolean))].sort(), [index]);

  const loadIndex = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setIndex(
        data.map((c) => ({
          id: c.id,
          stage: c.stage,
          doctorName: c.doctor_name,
          caseName: c.case_name,
          uploadedBy: c.uploaded_by,
          createdAt: c.created_at,
          done: c.done,
          starred: c.starred,
          crownCount: c.crown_count,
          priceType: c.price_type,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  const loadStage = useCallback(async (caseId, stage) => {
    const [{ data: meta }, { data: files }] = await Promise.all([
      supabase.from("case_stage_files").select("*").eq("case_id", caseId).eq("stage", stage).maybeSingle(),
      supabase.from("case_files").select("*").eq("case_id", caseId).eq("stage", stage).order("uploaded_at", { ascending: true }),
    ]);
    if (!meta) return null;
    return {
      doctorName: meta.doctor_name,
      caseName: meta.case_name,
      crownCount: meta.crown_count,
      shade: meta.shade,
      priceType: meta.price_type,
      note: meta.note,
      uploadedAt: meta.uploaded_at,
      files: (files || []).map((f) => ({
        id: f.id,
        fileName: f.file_name,
        filePath: f.file_path,
        fileUrl: getFileUrl(f.file_path),
        uploadedAt: f.uploaded_at,
      })),
    };
  }, []);

  const downloadFile = useCallback(
    async (caseId, stage) => {
      const record = await loadStage(caseId, stage);
      if (!record || !record.files.length) return;
      for (const f of record.files) {
        await triggerFileDownload(f.fileUrl, f.fileName);
      }
    },
    [loadStage]
  );

  const saveStage = useCallback(
    async (caseId, stage, record) => {
      const { error } = await supabase.from("case_stage_files").upsert(
        {
          case_id: caseId,
          stage,
          doctor_name: record.doctorName,
          case_name: record.caseName,
          crown_count: record.crownCount,
          shade: record.shade,
          price_type: record.priceType || null,
          note: record.note || null,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "case_id,stage" }
      );
      if (error) throw error;

      await supabase
        .from("cases")
        .update({ crown_count: record.crownCount, price_type: record.priceType || null })
        .eq("id", caseId);

      if (record.files && record.files.length) {
        const inserts = [];
        for (let i = 0; i < record.files.length; i++) {
          const f = record.files[i];
          const filePath = await uploadCaseFile(caseId, stage, f, i);
          inserts.push({ case_id: caseId, stage, file_path: filePath, file_name: f.name, uploaded_at: new Date().toISOString() });
        }
        const { error: filesError } = await supabase.from("case_files").insert(inserts);
        if (filesError) throw filesError;
      }
      await loadIndex();
    },
    [loadIndex]
  );

  const deleteFile = useCallback(async (fileId, filePath) => {
    if (filePath) {
      await supabase.storage.from(CASE_FILES_BUCKET).remove([filePath]);
    }
    await supabase.from("case_files").delete().eq("id", fileId);
  }, []);

  const deleteCase = useCallback(
    async (caseId) => {
      const { data: files } = await supabase.from("case_files").select("file_path").eq("case_id", caseId);
      const paths = (files || []).map((f) => f.file_path).filter(Boolean);
      if (paths.length) {
        await supabase.storage.from(CASE_FILES_BUCKET).remove(paths);
      }
      await supabase.from("cases").delete().eq("id", caseId);
      await loadIndex();
      setSelectedId(null);
      setScreen("stage");
    },
    [loadIndex]
  );

  const toggleDone = async (caseId, done) => {
    await supabase.from("cases").update({ done }).eq("id", caseId);
    setIndex((prev) => prev.map((c) => (c.id === caseId ? { ...c, done } : c)));
  };

  const toggleStarred = async (caseId, starred) => {
    await supabase.from("cases").update({ starred }).eq("id", caseId);
    setIndex((prev) => prev.map((c) => (c.id === caseId ? { ...c, starred } : c)));
  };

  const createCase = async ({ doctorName, caseName, note, crownCount, shade, priceType, files }) => {
    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        doctor_name: doctorName,
        case_name: caseName,
        uploaded_by: user.id,
        stage: activeStage,
        done: false,
        crown_count: crownCount != null ? crownCount : null,
        price_type: priceType || null,
      })
      .select()
      .single();
    if (caseError) throw caseError;

    const { error: metaError } = await supabase.from("case_stage_files").insert({
      case_id: newCase.id,
      stage: activeStage,
      doctor_name: doctorName,
      case_name: caseName,
      crown_count: crownCount != null ? crownCount : null,
      shade: shade || null,
      price_type: priceType || null,
      note: note || null,
      uploaded_at: new Date().toISOString(),
    });
    if (metaError) throw metaError;

    const inserts = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const filePath = await uploadCaseFile(newCase.id, activeStage, f, i);
      inserts.push({ case_id: newCase.id, stage: activeStage, file_path: filePath, file_name: f.name, uploaded_at: new Date().toISOString() });
    }
    if (inserts.length) {
      const { error: fileError } = await supabase.from("case_files").insert(inserts);
      if (fileError) throw fileError;
    }

    await loadIndex();
    setShowNewCase(false);
    setSelectedId(newCase.id);
    setScreen("detail");
  };

  const selected = index.find((c) => c.id === selectedId);

  const goHome = () => {
    setScreen("home");
    setSelectedId(null);
  };

  const goStage = (stage) => {
    setActiveStage(stage);
    setScreen("stage");
  };

  const openCase = (id) => {
    markCaseViewed(user.id, id);
    setSelectedId(id);
    setScreen("detail");
  };

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: "#F6F3EE", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      {/* top bar */}
      <div className="border-b border-[#EFEBE2] bg-white">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <button className="flex items-center gap-2" onClick={goHome}>
            <Building2 size={20} color="#1F5C57" />
            <div className="text-right">
              <p className="text-sm font-semibold text-[#22302E] leading-tight">معمل الأسنان</p>
              <p className="text-[11px] text-[#9AA29F] leading-tight">
                {user.role === "admin" ? "دخول كأدمن" : "دخول كمستخدم"} · {user.name}
              </p>
            </div>
          </button>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-[#6B7674] hover:text-[#B1503F]">
            <LogOut size={14} /> خروج
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6">
        {screen === "home" && <StageHome user={user} index={index} onSelectStage={goStage} />}

        {screen === "stage" && (
          <StageList
            user={user}
            stage={activeStage}
            index={index}
            loading={loading}
            onBack={goHome}
            onOpenCase={openCase}
            onNewCase={() => setShowNewCase(true)}
            onDownload={downloadFile}
            onLoadStage={loadStage}
            search={search}
            setSearch={setSearch}
            sortMode={sortMode}
            setSortMode={setSortMode}
          />
        )}

        {screen === "detail" && selected && (
          <CaseDetail
            caseItem={selected}
            user={user}
            onBack={() => setScreen("stage")}
            onLoadStage={loadStage}
            onSaveStage={saveStage}
            onToggleDone={toggleDone}
            onToggleStarred={toggleStarred}
            onDeleteCase={deleteCase}
            onDeleteFile={deleteFile}
          />
        )}
      </div>

      {showNewCase &&
        (user.role === "admin" ? (
          <AdminNewCaseForm
            stage={activeStage}
            doctorSuggestions={doctorSuggestions}
            onCreated={createCase}
            onClose={() => setShowNewCase(false)}
          />
        ) : (
          <NewCaseForm doctorSuggestions={doctorSuggestions} onCreated={createCase} onClose={() => setShowNewCase(false)} />
        ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   App
--------------------------------------------------------------- */

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const loadedUserId = React.useRef(null);

  const loadProfile = useCallback(async (userId) => {
    setProfileLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!error && data) {
      setProfile({ id: data.id, name: data.name, role: data.role });
    } else {
      setProfile(null);
    }
    loadedUserId.current = userId;
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      // Skip re-fetching (and re-showing the loading screen) if it's still the
      // same signed-in user — e.g. a token refresh on tab refocus shouldn't
      // remount the whole dashboard and wipe in-progress screen state.
      if (loadedUserId.current !== session.user.id) {
        loadProfile(session.user.id);
      }
    } else {
      loadedUserId.current = null;
      setProfile(null);
    }
  }, [session, loadProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F6F3EE" }}>
        <Loader2 className="animate-spin" size={24} color="#1F5C57" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F6F3EE" }}>
        <Loader2 className="animate-spin" size={24} color="#1F5C57" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center"
        style={{ background: "#F6F3EE", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
      >
        <p className="text-sm text-[#6B7674] max-w-xs">
          حصلت مشكلة في تحميل بياناتك. جرب تاني أو سجّل خروج وادخل تاني.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => session?.user && loadProfile(session.user.id)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "#1F5C57" }}
          >
            حاول تاني
          </button>
          <button onClick={handleLogout} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#6B7674] border border-[#E4E0D8]">
            خروج
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard user={profile} onLogout={handleLogout} />;
}
