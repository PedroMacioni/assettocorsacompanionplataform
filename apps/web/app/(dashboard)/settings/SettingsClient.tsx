"use client";

import { useState, useEffect, useRef } from "react";
import {
  User, Palette, Key, Download, Check, Copy, Eye, EyeOff,
  RefreshCw, Sun, Moon, Globe, ChevronRight, Camera, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── constants ───────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#e8612a", "#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b",
];

const SECTIONS = [
  { id: "profile",    label: "Profile",     icon: User },
  { id: "appearance", label: "Appearance",  icon: Palette },
  { id: "agent",      label: "Agent Token", icon: Key },
  { id: "download",   label: "Download",    icon: Download },
] as const;

type Section = (typeof SECTIONS)[number]["id"];
type Theme   = "dark" | "light";
type Lang    = "en" | "pt-BR";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "DR";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  const months = Math.floor(days / 30);
  if (months > 0) return `${months}mo ago`;
  if (days > 0) return `${days}d ago`;
  return "today";
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ─── props ────────────────────────────────────────────────────────────────────

type Props = {
  userId: string;
  email: string;
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
  savedTheme: string | null;
  savedLang: string | null;
  memberSince: string;
  totalSessions: number;
  lastSessionAt: string | null;
};

// ─── main component ───────────────────────────────────────────────────────────

export function SettingsClient(props: Props) {
  const [section, setSection]           = useState<Section>("profile");
  const [displayName, setDisplayName]   = useState(props.displayName);
  const [avatarColor, setAvatarColor]   = useState(props.avatarColor);
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(props.avatarUrl);
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState("");
  const [theme, setTheme]               = useState<Theme>("dark");
  const [lang, setLang]                 = useState<Lang>("en");
  const [token, setToken]               = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [saveError, setSaveError]       = useState("");
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [savedAppearance, setSavedAppearance]   = useState(false);
  const [copied, setCopied]             = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = (props.savedTheme as Theme | null) ?? (localStorage.getItem("apex-theme") as Theme | null) ?? "dark";
    const l = (props.savedLang as Lang | null) ?? (localStorage.getItem("apex-lang") as Lang | null) ?? "en";
    setTheme(t);
    setLang(l);
    applyThemeToDom(t);

    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── theme ────────────────────────────────────────────────────────────────────

  function applyThemeToDom(t: Theme) {
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  function applyTheme(t: Theme) {
    setTheme(t);
    localStorage.setItem("apex-theme", t);
    applyThemeToDom(t);
  }

  // ── language ─────────────────────────────────────────────────────────────────

  function applyLang(l: Lang) {
    setLang(l);
    localStorage.setItem("apex-lang", l);
  }

  // ── avatar upload ─────────────────────────────────────────────────────────────

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be smaller than 2 MB.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${props.userId}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateErr) throw updateErr;

      setAvatarUrl(publicUrl);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setUploadError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null },
      });
      if (error) throw error;
      setAvatarUrl(null);
    } catch {
      setUploadError("Could not remove photo. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── save profile ─────────────────────────────────────────────────────────────

  async function saveProfile() {
    setSaving(true);
    setSaveError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName, avatar_color: avatarColor },
      });
      if (error) throw error;

      await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", props.userId);

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── save appearance ───────────────────────────────────────────────────────────

  async function saveAppearance() {
    setSavingAppearance(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { theme, lang },
      });
      if (error) throw error;
      setSavedAppearance(true);
      setTimeout(() => setSavedAppearance(false), 2500);
    } catch {
      // applied locally already
    } finally {
      setSavingAppearance(false);
    }
  }

  // ── token actions ─────────────────────────────────────────────────────────────

  function copyToken() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function renewToken() {
    const supabase = createClient();
    const { data } = await supabase.auth.refreshSession();
    if (data.session) setToken(data.session.access_token);
  }

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-8 max-w-5xl">
      {/* Left nav */}
      <div className="w-56 shrink-0 space-y-1">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Settings
          </p>
          <h1 className="text-xl font-bold text-foreground">Account</h1>
        </div>

        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium w-full text-left",
              "transition-all duration-150",
              section === id
                ? "text-foreground bg-muted"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {section === id && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
            )}
            <Icon
              className={cn(
                "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                section === id ? "text-primary" : "text-muted-foreground"
              )}
            />
            {label}
            {section === id && (
              <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
            )}
          </button>
        ))}

        {/* Account stats */}
        <div className="!mt-8 p-3.5 rounded-md bg-muted border border-border space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Account
          </p>
          {[
            { label: "Member since", value: formatMemberSince(props.memberSince) },
            { label: "Sessions", value: props.totalSessions.toLocaleString() },
            ...(props.lastSessionAt
              ? [{ label: "Last sync", value: timeAgo(props.lastSessionAt) }]
              : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className="text-[10px] font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1">

        {/* ── PROFILE ──────────────────────────────────────────────────── */}
        {section === "profile" && (
          <div className="space-y-6">
            <SectionHeader title="Profile" description="Your public identity inside the app." />

            {/* Avatar */}
            <div className="bg-card border border-border rounded-md p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Avatar
              </p>
              <div className="flex items-center gap-6">
                {/* Avatar preview + upload trigger */}
                <div className="relative shrink-0 group">
                  <div
                    className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center border-2 transition-all duration-200"
                    style={{
                      backgroundColor: avatarUrl ? "transparent" : `${avatarColor}18`,
                      borderColor: avatarUrl ? "var(--border)" : `${avatarColor}50`,
                    }}
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold" style={{ color: avatarColor }}>
                        {getInitials(displayName || props.email)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
                  >
                    <Camera className="h-5 w-5 text-white" />
                  </button>
                </div>

                {/* Upload controls */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150",
                        uploading
                          ? "bg-muted border-border text-muted-foreground cursor-not-allowed"
                          : "bg-muted border-border text-foreground hover:border-primary"
                      )}
                    >
                      <Camera className="h-3 w-3" />
                      {uploading ? "Uploading…" : "Upload photo"}
                    </button>

                    {avatarUrl && (
                      <button
                        onClick={removeAvatar}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-all duration-150"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">JPG, PNG or WebP · max 2 MB</p>
                  {uploadError && <p className="text-[11px] text-destructive mt-1">{uploadError}</p>}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Color swatches — only when no photo */}
              {!avatarUrl && (
                <div className="mt-5 pt-5 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">Initials color</p>
                  <div className="flex gap-2">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setAvatarColor(c)}
                        title={c}
                        className={cn(
                          "w-7 h-7 rounded-full transition-all duration-150",
                          avatarColor === c
                            ? "ring-2 ring-offset-2 ring-offset-card scale-110"
                            : "hover:scale-105 opacity-70 hover:opacity-100"
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Name + email */}
            <div className="bg-card border border-border rounded-md p-6 space-y-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Details
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your driver name"
                  className="w-full bg-muted border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={props.email}
                  disabled
                  className="w-full bg-background border border-border rounded-md px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={saving}
                className={cn(
                  "px-5 py-2.5 rounded-md text-sm font-semibold transition-all duration-150",
                  saving
                    ? "bg-primary/40 text-primary-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                )}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-green-500 animate-in fade-in duration-200">
                  <Check className="h-4 w-4" />
                  Saved
                </span>
              )}
              {saveError && <span className="text-sm text-destructive">{saveError}</span>}
            </div>
          </div>
        )}

        {/* ── APPEARANCE ───────────────────────────────────────────────── */}
        {section === "appearance" && (
          <div className="space-y-6">
            <SectionHeader title="Appearance" description="Customize the look and feel of the app." />

            {/* Theme */}
            <div className="bg-card border border-border rounded-md p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Theme
              </p>
              <div className="grid grid-cols-2 gap-4">
                <ThemeCard id="dark" active={theme === "dark"} onClick={() => applyTheme("dark")} />
                <ThemeCard id="light" active={theme === "light"} onClick={() => applyTheme("light")} />
              </div>
            </div>

            {/* Language */}
            <div className="bg-card border border-border rounded-md p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Language
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: "en" as Lang, label: "English", sub: "United States" },
                    { id: "pt-BR" as Lang, label: "Português", sub: "Brasil" },
                  ] as const
                ).map(({ id, label, sub }) => (
                  <button
                    key={id}
                    onClick={() => applyLang(id)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-md border-2 text-left transition-all duration-150",
                      lang === id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    <Globe className={cn("h-4 w-4 shrink-0", lang === id ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className={cn("text-sm font-semibold", lang === id ? "text-foreground" : "text-muted-foreground")}>
                        {label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{sub}</p>
                    </div>
                    {lang === id && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Save appearance */}
            <div className="flex items-center gap-3">
              <button
                onClick={saveAppearance}
                disabled={savingAppearance}
                className={cn(
                  "px-5 py-2.5 rounded-md text-sm font-semibold transition-all duration-150",
                  savingAppearance
                    ? "bg-primary/40 text-primary-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                )}
              >
                {savingAppearance ? "Saving…" : "Save preferences"}
              </button>
              {savedAppearance && (
                <span className="flex items-center gap-1.5 text-sm text-green-500 animate-in fade-in duration-200">
                  <Check className="h-4 w-4" />
                  Saved
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── AGENT TOKEN ──────────────────────────────────────────────── */}
        {section === "agent" && (
          <div className="space-y-6">
            <SectionHeader title="Agent Token" description="Use this token to authenticate CompanionAgent on your PC." />

            <div className="bg-card border border-border rounded-md p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Access token</label>
                <div className="flex gap-2">
                  <input
                    type={tokenVisible ? "text" : "password"}
                    value={token}
                    readOnly
                    className="flex-1 bg-muted border border-border rounded-md px-3.5 py-2.5 text-xs font-mono text-foreground focus:outline-none"
                  />
                  <button
                    onClick={() => setTokenVisible((v) => !v)}
                    className="px-3 py-2.5 bg-muted border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title={tokenVisible ? "Hide" : "Show"}
                  >
                    {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyToken}
                  className="flex items-center gap-2 px-4 py-2.5 bg-muted border border-border rounded-md text-sm font-medium text-foreground hover:border-primary transition-all duration-150"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-green-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy token
                    </>
                  )}
                </button>
                <button
                  onClick={renewToken}
                  className="flex items-center gap-2 px-4 py-2.5 bg-muted border border-border rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all duration-150"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Renew
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-md p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                How to use
              </p>
              <ol className="space-y-3">
                {[
                  "Download and run the CompanionAgent installer",
                  "Open the settings window from the system tray icon",
                  "Paste this token in the \"Agent Token\" field",
                  "The agent will start syncing your sessions automatically",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold text-foreground">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* ── DOWNLOAD ─────────────────────────────────────────────────── */}
        {section === "download" && (
          <div className="space-y-6">
            <SectionHeader
              title="Download CompanionAgent"
              description="Windows background app that syncs your Assetto Corsa history."
            />

            <div className="bg-card border border-border rounded-md p-6 space-y-6">
              <div className="space-y-4">
                {[
                  { title: "Install", desc: "Download and run the installer. No admin rights required.", icon: Download },
                  { title: "Authenticate", desc: "Paste your Agent Token from the Agent Token section.", icon: Key },
                  { title: "Race", desc: "The agent runs in the system tray and syncs sessions automatically.", icon: Check },
                ].map(({ title, desc, icon: Icon }, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="shrink-0 w-9 h-9 rounded-md bg-primary/[0.08] border border-primary/[0.18] flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="px-5 py-2.5 bg-muted border border-border rounded-md text-sm font-semibold text-muted-foreground cursor-not-allowed"
                >
                  Coming soon — GitHub Releases
                </button>
                <p className="text-xs text-muted-foreground">Available for Windows 10/11</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function ThemeCard({ id, active, onClick }: { id: "dark" | "light"; active: boolean; onClick: () => void }) {
  const isDark = id === "dark";

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md overflow-hidden border-2 text-left transition-all duration-150 w-full",
        active ? "border-primary" : "border-border hover:border-muted-foreground"
      )}
    >
      {/* Preview — intentionally hardcoded to always show the theme preview colors */}
      <div className={cn("p-4 space-y-2", isDark ? "bg-[#0d0d0f]" : "bg-[#f0f0f0]")}>
        <div className={cn("h-1.5 w-16 rounded-full", isDark ? "bg-[#2a2a2c]" : "bg-[#d0d0d0]")} />
        <div className={cn("h-6 w-full rounded", isDark ? "bg-[#161618]" : "bg-[#e0e0e0]")} />
        <div className="flex gap-1.5">
          {[40, 56, 48].map((w, i) => (
            <div
              key={i}
              className={cn("h-3 rounded", isDark ? "bg-[#1e1e20]" : "bg-[#d8d8d8]")}
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      {/* Label */}
      <div className={cn("px-4 py-3 flex items-center justify-between", isDark ? "bg-[#161618]" : "bg-white")}>
        <div className="flex items-center gap-2">
          {isDark ? (
            <Moon className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-[#6b6b72]")} />
          ) : (
            <Sun className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-[#999]")} />
          )}
          <span className={cn(
            "text-sm font-semibold",
            isDark ? (active ? "text-white" : "text-[#6b6b72]") : (active ? "text-[#111]" : "text-[#999]")
          )}>
            {isDark ? "Dark" : "Light"}
          </span>
        </div>
        {active && <Check className="h-3.5 w-3.5 text-primary" />}
      </div>
    </button>
  );
}
