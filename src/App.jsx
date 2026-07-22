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

async function uploadCaseFile(caseId, stage, file) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${caseId}/${stage}/${Date.now()}_${safeName}`;
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
   شرائح المراحل (Signature element)
--------------------------------------------------------------- */

function StageFan({ active, onSelect, status }) {
  // status: {design:'filled', prova:'filled'|'empty', final:'filled'|'empty'}
  return (
    <div className="flex items-end gap-0 mb-6">
      {STAGES.map((s, i) => {
        const meta = STAGE_META[s];
        const isActive = active === s;
        const filled = status[s] === "filled";
        return (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="relative px-6 pt-3 pb-3 rounded-t-xl text-sm font-semibold transition-all"
            style={{
              background: isActive ? meta.color : meta.tint,
              color: isActive ? "#fff" : meta.color,
              marginInlineEnd: i < 2 ? "-10px" : 0,
              transform: isActive ? "translateY(0px)" : `translateY(6px) rotate(${(i - 1) * 1.5}deg)`,
              zIndex: isActive ? 10 : 3 - i,
              boxShadow: isActive ? "0 8px 20px -6px rgba(0,0,0,0.25)" : "0 2px 6px rgba(0,0,0,0.06)",
              fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            }}
          >
            <div className="flex items-center gap-1.5">
              {filled ? (
                <CheckCircle2 size={14} color={isActive ? "#fff" : meta.color} />
              ) : (
                <Circle size={14} color={isActive ? "#fff" : "#B9BCB9"} />
              )}
              {meta.label}
            </div>
            <div className="text-[10px] opacity-80 mt-0.5">{meta.sub}</div>
          </button>
        );
      })}
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

function AdminUploadForm({ stage, caseItem, onDone }) {
  const meta = STAGE_META[stage];
  const [doctorName, setDoctorName] = useState(caseItem.doctorName);
  const [caseName, setCaseName] = useState(caseItem.caseName);
  const [crownCount, setCrownCount] = useState("");
  const [shade, setShade] = useState(SHADES[0]);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!doctorName.trim() || !caseName.trim() || !crownCount || !file) {
      setError("من فضلك املأ كل الحقول وارفع الملف");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`الملف أكبر من ${MAX_FILE_MB} ميجا، اختار ملف أصغر`);
      return;
    }
    setSaving(true);
    try {
      const record = {
        doctorName: doctorName.trim(),
        caseName: caseName.trim(),
        crownCount: Number(crownCount),
        shade,
        note: note.trim(),
        fileName: file.name,
        file,
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

      <FileDropZone file={file} onSelect={setFile} placeholder="Choose case file" />

      {error && <p className="text-xs text-[#B1503F] mt-2">{error}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="mt-3 w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: meta.color }}
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        رفع لمرحلة {meta.label}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   فورم إضافة حالة جديدة (دكتور)
--------------------------------------------------------------- */

function NewCaseForm({ onCreated, onClose }) {
  const [doctorName, setDoctorName] = useState("");
  const [caseName, setCaseName] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!doctorName.trim() || !caseName.trim() || !file) {
      setError("اكتب اسم الدكتور واسم الحالة وارفع الملف");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`الملف أكبر من ${MAX_FILE_MB} ميجا، اختار ملف أصغر`);
      return;
    }
    setSaving(true);
    try {
      await onCreated({
        doctorName: doctorName.trim(),
        caseName: caseName.trim(),
        note: note.trim(),
        fileName: file.name,
        file,
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
          value={doctorName}
          onChange={(e) => setDoctorName(e.target.value)}
          placeholder="e.g. Dr. Ahmed Sami"
          className="w-full rounded-lg border border-[#E4E0D8] px-3 py-2 text-sm mb-3 outline-none focus:border-[#1F5C57]"
        />

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

        <FileDropZone file={file} onSelect={setFile} placeholder="Upload design file" />

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

function AdminNewCaseForm({ onCreated, onClose }) {
  const [doctorName, setDoctorName] = useState("");
  const [caseName, setCaseName] = useState("");
  const [crownCount, setCrownCount] = useState("");
  const [shade, setShade] = useState(SHADES[0]);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!doctorName.trim() || !caseName.trim() || !crownCount || !file) {
      setError("من فضلك املأ كل الحقول وارفع الملف");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`الملف أكبر من ${MAX_FILE_MB} ميجا، اختار ملف أصغر`);
      return;
    }
    setSaving(true);
    try {
      await onCreated({
        doctorName: doctorName.trim(),
        caseName: caseName.trim(),
        crownCount: Number(crownCount),
        shade,
        note: note.trim(),
        fileName: file.name,
        file,
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
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full rounded-lg border border-[#E4E0D8] px-2.5 py-2 text-sm outline-none focus:border-[#1F5C57]"
            />
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

        <FileDropZone file={file} onSelect={setFile} placeholder="Upload design file" />

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

function CaseDetail({ caseItem, user, initialStage, onBack, onLoadStage, onSaveStage, onToggleDone, onDeleteCase, onDeleteStageFile }) {
  const role = user.role;
  const canManage = role === "admin" || caseItem.uploadedBy === user.id;
  const [activeStage, setActiveStage] = useState(initialStage || "design");
  const [stageData, setStageData] = useState({ design: null, prova: null, final: null });
  const [loading, setLoading] = useState(true);
  const [deletingCase, setDeletingCase] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [d, p, f] = await Promise.all([
      onLoadStage(caseItem.id, "design"),
      onLoadStage(caseItem.id, "prova"),
      onLoadStage(caseItem.id, "final"),
    ]);
    setStageData({ design: d, prova: p, final: f });
    setLoading(false);
  }, [caseItem.id, onLoadStage]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const status = {
    design: stageData.design ? "filled" : "empty",
    prova: stageData.prova ? "filled" : "empty",
    final: stageData.final ? "filled" : "empty",
  };

  const handleAdminUpload = async (record) => {
    await onSaveStage(caseItem.id, activeStage, record);
    await loadAll();
  };

  const handleDeleteCase = async () => {
    if (!window.confirm("متأكد إنك عايز تمسح الحالة دي بكل مراحلها؟ الإجراء ده مش قابل للتراجع.")) return;
    setDeletingCase(true);
    try {
      await onDeleteCase(caseItem.id);
    } finally {
      setDeletingCase(false);
    }
  };

  const handleDeleteFile = async (stage) => {
    if (!window.confirm("متأكد إنك عايز تمسح ملف المرحلة دي؟")) return;
    setDeletingFile(true);
    try {
      await onDeleteStageFile(caseItem.id, stage);
      await loadAll();
    } finally {
      setDeletingFile(false);
    }
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#6B7674] mb-4 hover:text-[#22302E]">
        <ArrowRight size={16} /> رجوع
      </button>

      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-2xl text-[#22302E]" style={{ fontFamily: "'Markazi Text', serif", fontWeight: 600 }}>
            {caseItem.caseName}
          </h2>
          <p className="text-sm text-[#6B7674] flex items-center gap-1.5 mt-1">
            <UserRound size={13} /> {caseItem.doctorName}
            <span className="mx-1">·</span>
            <Calendar size={13} /> {formatDate(caseItem.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === "admin" ? (
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
          ) : (
            caseItem.done && (
              <span
                className="text-xs font-bold px-3 py-1.5 rounded-full border-2"
                style={{ color: "#3F7A56", borderColor: "#3F7A56", transform: "rotate(-3deg)" }}
              >
                ✓ تمت
              </span>
            )
          )}
          {canManage && (
            <button
              onClick={handleDeleteCase}
              disabled={deletingCase}
              title="امسح الحالة كلها"
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold border border-[#E4E0D8] text-[#B1503F] hover:bg-[#FBEDEA] disabled:opacity-50"
            >
              {deletingCase ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          )}
        </div>
      </div>

      <StageFan active={activeStage} onSelect={setActiveStage} status={status} />

      <div className="rounded-2xl bg-white border border-[#EFEBE2] p-5 min-h-[220px]">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#9AA29F]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : activeStage === "design" ? (
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: STAGE_META.design.color }}>
              بيانات مرحلة الديزاين
            </p>
            {stageData.design ? (
              <>
                <DataRow label="Doctor" value={stageData.design.doctorName} />
                <DataRow label="Patient" value={stageData.design.caseName} />
                {stageData.design.crownCount != null && (
                  <DataRow label="N.O.C." value={stageData.design.crownCount} />
                )}
                {stageData.design.shade && <DataRow label="Shade" value={stageData.design.shade} />}
                {stageData.design.note && <DataRow label="Note" value={stageData.design.note} />}
                <DataRow label="تاريخ الرفع" value={formatDate(stageData.design.uploadedAt)} />
                <FilePreviewCard
                  record={stageData.design}
                  deleting={deletingFile}
                  onDelete={canManage ? () => handleDeleteFile("design") : undefined}
                />
              </>
            ) : (
              <EmptyState text="لسه معملش رفع ملف الديزاين" />
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: STAGE_META[activeStage].color }}>
              بيانات مرحلة {STAGE_META[activeStage].label} — من المعمل
            </p>
            {stageData[activeStage] ? (
              <>
                <DataRow label="Doctor" value={stageData[activeStage].doctorName} />
                <DataRow label="Patient" value={stageData[activeStage].caseName} />
                <DataRow label="N.O.C." value={stageData[activeStage].crownCount} />
                <DataRow label="Shade" value={stageData[activeStage].shade} />
                {stageData[activeStage].note && <DataRow label="Note" value={stageData[activeStage].note} />}
                <DataRow label="تاريخ الرفع" value={formatDate(stageData[activeStage].uploadedAt)} />
                <FilePreviewCard
                  record={stageData[activeStage]}
                  deleting={deletingFile}
                  onDelete={canManage ? () => handleDeleteFile(activeStage) : undefined}
                />
              </>
            ) : role === "admin" ? (
              <AdminUploadForm stage={activeStage} caseItem={caseItem} onDone={handleAdminUpload} />
            ) : (
              <EmptyState text={`المعمل لسه ماعملش مرحلة ${STAGE_META[activeStage].label}`} />
            )}
          </div>
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

function FileDropZone({ file, onSelect, placeholder = "Choose or drop a file" }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  };

  return (
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
      <span className="text-[#22302E]">{file ? file.name : dragging ? "سيب الملف هنا" : placeholder}</span>
      <input type="file" className="hidden" onChange={(e) => onSelect(e.target.files?.[0] || null)} />
    </label>
  );
}

/* ---------------------------------------------------------------
   كارت حالة فى الليستة
--------------------------------------------------------------- */

function CaseCard({ item, stage, downloadable, onOpen, onDownload, showDoctor }) {
  const filled = { design: true, prova: !!item.provaFilled, final: !!item.finalFilled };
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (downloading || !downloadable) return;
    setDownloading(true);
    try {
      await onDownload(item.id, stage);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="w-full text-right rounded-xl border border-[#EFEBE2] bg-white p-4 hover:border-[#1F5C57] transition-colors relative cursor-pointer"
      onClick={onOpen}
      style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
    >
      {item.done && (
        <span
          className="absolute left-3 top-3 text-[10px] font-bold px-2 py-0.5 rounded-full border-2"
          style={{ color: "#3F7A56", borderColor: "#3F7A56", transform: "rotate(-4deg)" }}
        >
          ✓ تمت
        </span>
      )}
      <div className="flex items-center gap-1.5 mb-1.5">
        {STAGES.map((s) => (
          <span
            key={s}
            className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              color: filled[s] ? STAGE_META[s].color : "#B9BCB9",
              background: filled[s] ? STAGE_META[s].tint : "#F3F1EC",
            }}
          >
            {filled[s] ? <CheckCircle2 size={10} /> : <Circle size={10} />}
            {STAGE_META[s].label}
          </span>
        ))}
      </div>
      <p className="text-base text-[#22302E] font-semibold mb-1">{item.caseName}</p>
      {showDoctor && (
        <p className="text-xs text-[#6B7674] flex items-center gap-1">
          <UserRound size={12} /> {item.doctorName}
        </p>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-[#9AA29F] flex items-center gap-1">
          <Calendar size={12} /> {formatDate(item.createdAt)}
        </p>
        <button
          onClick={handleDownload}
          disabled={!downloadable || downloading}
          title={downloadable ? "Download" : "No file yet"}
          className="flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: "#1F5C57", background: downloadable ? "#E7F0EE" : "transparent" }}
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
  const scope = user.role === "admin" ? index : index.filter((c) => c.uploadedBy === user.id);

  const statFor = (stage) => {
    if (stage === "design") {
      return { big: scope.length, label: "كل الحالات" };
    }
    const key = stage === "prova" ? "provaFilled" : "finalFilled";
    const filledCount = scope.filter((c) => c[key]).length;
    if (user.role === "admin") {
      const pending = scope.length - filledCount;
      return pending > 0
        ? { big: pending, label: "محتاجة رفع", alert: true }
        : { big: filledCount, label: "كلها مرفوعة" };
    }
    return { big: filledCount, label: "جاهزة" };
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <h2 className="text-2xl text-[#22302E] mb-1" style={{ fontFamily: "'Markazi Text', serif", fontWeight: 600 }}>
        أهلاً {user.name}
      </h2>
      <p className="text-sm text-[#6B7674] mb-6">اختار المرحلة اللي عايز تدخلها</p>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {STAGES.map((s) => {
          const meta = STAGE_META[s];
          const stat = statFor(s);
          return (
            <button
              key={s}
              onClick={() => onSelectStage(s)}
              className="aspect-square rounded-2xl flex flex-col items-center justify-center text-center p-3 transition-transform hover:-translate-y-1 relative overflow-hidden"
              style={{ background: meta.color, boxShadow: "0 10px 24px -10px rgba(0,0,0,0.35)" }}
            >
              {stat.alert && (
                <span className="absolute top-2.5 left-2.5 w-2.5 h-2.5 rounded-full bg-[#EDD9B4] animate-pulse" />
              )}
              {user.role === "admin" && (
                <span className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {stat.big}
                </span>
              )}
              <span
                className={`text-white text-lg sm:text-xl font-semibold tracking-wide ${user.role === "admin" ? "mt-2" : ""}`}
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {meta.labelEn}
              </span>
              {user.role === "admin" && <span className="text-white/70 text-[11px] mt-0.5">{stat.label}</span>}
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

function StageList({ user, stage, index, loading, onBack, onOpenCase, onNewCase, onDownload, search, setSearch, sortMode, setSortMode }) {
  const meta = STAGE_META[stage];
  const myCases = useMemo(() => index.filter((c) => c.uploadedBy === user.id), [index, user.id]);

  const visibleCases = useMemo(() => {
    let list = user.role === "admin" ? index : myCases;
    if (user.role === "admin" && search.trim()) {
      const q = search.trim();
      list = list.filter((c) => c.doctorName.includes(q));
    }
    const sorted = [...list].sort((a, b) => {
      if (sortMode === "done") {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return sorted;
  }, [index, myCases, user.role, search, sortMode]);

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
        <button
          onClick={onNewCase}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
          style={{ background: "#1F5C57" }}
        >
          <Plus size={15} /> حالة جديدة
        </button>
      </div>

      {user.role === "admin" && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute right-3 top-2.5 text-[#9AA29F]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by doctor name..."
              className="w-full rounded-lg border border-[#E4E0D8] pr-9 pl-3 py-2 text-sm outline-none focus:border-[#1F5C57] bg-white"
            />
          </div>
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
        </div>
      )}

      {user.role === "admin" && search.trim() && !loading && (
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 mb-4 text-sm font-semibold"
          style={{ background: "#E7F0EE", color: "#1F5C57" }}
        >
          <UserRound size={15} />
          {search.trim()} — إجمالي {visibleCases.length} حالة
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
              stage={stage}
              downloadable={stage === "design" ? true : stage === "prova" ? !!c.provaFilled : !!c.finalFilled}
              onOpen={() => onOpenCase(c.id)}
              onDownload={onDownload}
              showDoctor
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

  const loadIndex = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
    if (!error && data) {
      setIndex(
        data.map((c) => ({
          id: c.id,
          doctorName: c.doctor_name,
          caseName: c.case_name,
          uploadedBy: c.uploaded_by,
          createdAt: c.created_at,
          done: c.done,
          provaFilled: c.prova_filled,
          finalFilled: c.final_filled,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  const loadStage = useCallback(async (caseId, stage) => {
    const { data, error } = await supabase
      .from("case_stage_files")
      .select("*")
      .eq("case_id", caseId)
      .eq("stage", stage)
      .maybeSingle();
    if (error || !data) return null;
    return {
      doctorName: data.doctor_name,
      caseName: data.case_name,
      crownCount: data.crown_count,
      shade: data.shade,
      note: data.note,
      fileName: data.file_name,
      filePath: data.file_path,
      fileUrl: getFileUrl(data.file_path),
      uploadedAt: data.uploaded_at,
    };
  }, []);

  const downloadFile = useCallback(
    async (caseId, stage) => {
      const record = await loadStage(caseId, stage);
      if (!record || !record.fileUrl) return;
      await triggerFileDownload(record.fileUrl, record.fileName);
    },
    [loadStage]
  );

  const saveStage = useCallback(
    async (caseId, stage, record) => {
      const filePath = await uploadCaseFile(caseId, stage, record.file);
      const { error } = await supabase.from("case_stage_files").upsert(
        {
          case_id: caseId,
          stage,
          doctor_name: record.doctorName,
          case_name: record.caseName,
          crown_count: record.crownCount,
          shade: record.shade,
          note: record.note || null,
          file_path: filePath,
          file_name: record.fileName,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "case_id,stage" }
      );
      if (error) throw error;

      const updateFields = stage === "prova" ? { prova_filled: true } : stage === "final" ? { final_filled: true } : {};
      if (Object.keys(updateFields).length) {
        await supabase.from("cases").update(updateFields).eq("id", caseId);
      }
      await loadIndex();
    },
    [loadIndex]
  );

  const deleteStageFile = useCallback(
    async (caseId, stage) => {
      const record = await loadStage(caseId, stage);
      if (record?.filePath) {
        await supabase.storage.from(CASE_FILES_BUCKET).remove([record.filePath]);
      }
      await supabase.from("case_stage_files").delete().eq("case_id", caseId).eq("stage", stage);

      const updateFields = stage === "prova" ? { prova_filled: false } : stage === "final" ? { final_filled: false } : {};
      if (Object.keys(updateFields).length) {
        await supabase.from("cases").update(updateFields).eq("id", caseId);
      }
      await loadIndex();
    },
    [loadStage, loadIndex]
  );

  const deleteCase = useCallback(
    async (caseId) => {
      const [design, prova, final] = await Promise.all([
        loadStage(caseId, "design"),
        loadStage(caseId, "prova"),
        loadStage(caseId, "final"),
      ]);
      const paths = [design, prova, final].filter((r) => r?.filePath).map((r) => r.filePath);
      if (paths.length) {
        await supabase.storage.from(CASE_FILES_BUCKET).remove(paths);
      }
      await supabase.from("cases").delete().eq("id", caseId);
      await loadIndex();
      setSelectedId(null);
      setScreen("stage");
    },
    [loadStage, loadIndex]
  );

  const toggleDone = async (caseId, done) => {
    await supabase.from("cases").update({ done }).eq("id", caseId);
    setIndex((prev) => prev.map((c) => (c.id === caseId ? { ...c, done } : c)));
  };

  const createCase = async ({ doctorName, caseName, note, crownCount, shade, fileName, file }) => {
    const { data: newCase, error: caseError } = await supabase
      .from("cases")
      .insert({
        doctor_name: doctorName,
        case_name: caseName,
        uploaded_by: user.id,
        done: false,
        prova_filled: false,
        final_filled: false,
      })
      .select()
      .single();
    if (caseError) throw caseError;

    const filePath = await uploadCaseFile(newCase.id, "design", file);
    const { error: fileError } = await supabase.from("case_stage_files").insert({
      case_id: newCase.id,
      stage: "design",
      doctor_name: doctorName,
      case_name: caseName,
      crown_count: crownCount != null ? crownCount : null,
      shade: shade || null,
      note: note || null,
      file_path: filePath,
      file_name: fileName,
      uploaded_at: new Date().toISOString(),
    });
    if (fileError) throw fileError;

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
            initialStage={activeStage}
            onBack={() => setScreen("stage")}
            onLoadStage={loadStage}
            onSaveStage={saveStage}
            onToggleDone={toggleDone}
            onDeleteCase={deleteCase}
            onDeleteStageFile={deleteStageFile}
          />
        )}
      </div>

      {showNewCase &&
        (user.role === "admin" ? (
          <AdminNewCaseForm onCreated={createCase} onClose={() => setShowNewCase(false)} />
        ) : (
          <NewCaseForm onCreated={createCase} onClose={() => setShowNewCase(false)} />
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

  const loadProfile = useCallback(async (userId) => {
    setProfileLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!error && data) {
      setProfile({ id: data.id, name: data.name, role: data.role });
    } else {
      setProfile(null);
    }
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
      loadProfile(session.user.id);
    } else {
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
