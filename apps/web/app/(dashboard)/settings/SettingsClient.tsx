"use client";

import { useState, useEffect } from "react";
import {
  User, Palette, Key, Download, Check, Copy, Eye, EyeOff,
  RefreshCw, Sun, Moon, Globe, ChevronRight,
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
  memberSince: string;
  totalSessions: number;
  lastSessionAt: string | null;
};

// ─── main component ───────────────────────────────────────────────────────────

export function SettingsClient(props: Props) {
  const [section, setSection]         = useState<Section>("profile");
  const [displayName, setDisplayName] = useState(props.displayName);
  const [avatarColor, setAvatarColor] = useState(props.avatarColor);
  const [theme, setTheme]             = useState<Theme>("dark");
  const [lang, setLang]               = useState<Lang>("en");
  const [token, setToken]             = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [copied, setCopied]           = useState(false);

  // Read persisted theme + language
  useEffect(() => {
    try {
      const t = localStorage.getItem("apex-theme") as Theme | null;
      if (t) setTheme(t);
      const l = localStorage.getItem("apex-lang") as Lang | null;
      if (l) setLang(l);
    } catch {}

    // Fetch token
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
  }, []);

  // ── theme toggle ────────────────────────────────────────────────────────────
  function applyTheme(t: Theme) {
    setTheme(t);
    localStorage.setItem("apex-theme", t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  // ── language toggle ─────────────────────────────────────────────────────────
  function applyLang(l: Lang) {
    setLang(l);
    localStorage.setItem("apex-lang", l);
  }

  // ── save profile ────────────────────────────────────────────────────────────
  async function saveProfile() {
    setSaving(true);
    setSaveError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName, avatar_color: avatarColor },
      });
      if (error) throw error;

      // Best-effort profiles table update
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

  // ── token actions ───────────────────────────────────────────────────────────
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

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-8 max-w-5xl">
      {/* Left nav */}
      <div className="w-56 shrink-0 space-y-1">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-1">
            Settings
          </p>
          <h1 className="text-xl font-bold text-white">Account</h1>
        </div>

        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium w-full text-left",
              "transition-all duration-150",
              section === id
                ? "text-white bg-[#1a1a1c]"
                : "text-[#6b6b72] hover:text-white hover:bg-[#161618]"
            )}
          >
            {section === id && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#e8612a] rounded-r-full" />
            )}
            <Icon
              className={cn(
                "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                section === id ? "text-[#e8612a]" : "text-[#6b6b72]"
              )}
            />
            {label}
            {section === id && (
              <ChevronRight className="h-3 w-3 ml-auto text-[#6b6b72]" />
            )}
          </button>
        ))}

        {/* Account stats */}
        <div className="!mt-8 p-3.5 rounded-md bg-[#161618] border border-[#2a2a2c] space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-2">
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
              <span className="text-[10px] text-[#6b6b72]">{label}</span>
              <span className="text-[10px] font-semibold text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1">
        {/* ── PROFILE ──────────────────────────────────────────────────── */}
        {section === "profile" && (
          <div className="space-y-6">
            <SectionHeader
              title="Profile"
              description="Your public identity inside the app."
            />

            {/* Avatar + color picker */}
            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
                Avatar
              </p>
              <div className="flex items-center gap-6">
                {/* Avatar preview */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-200"
                  style={{
                    backgroundColor: `${avatarColor}18`,
                    borderColor: `${avatarColor}50`,
                  }}
                >
                  <span
                    className="text-xl font-bold transition-colors duration-200"
                    style={{ color: avatarColor }}
                  >
                    {getInitials(displayName || props.email)}
                  </span>
                </div>

                {/* Color swatches */}
                <div>
                  <p className="text-xs text-[#6b6b72] mb-3">Color</p>
                  <div className="flex gap-2">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setAvatarColor(c)}
                        title={c}
                        className={cn(
                          "w-7 h-7 rounded-full transition-all duration-150",
                          avatarColor === c
                            ? "ring-2 ring-offset-2 ring-offset-[#161618] scale-110"
                            : "hover:scale-105 opacity-70 hover:opacity-100"
                        )}
                        style={{
                          backgroundColor: c,
                          ...(avatarColor === c ? { ringColor: c } : {}),
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Name + email */}
            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6 space-y-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72]">
                Details
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b6b72]">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your driver name"
                  className="w-full bg-[#1e1e20] border border-[#2a2a2c] rounded-md px-3.5 py-2.5 text-sm text-white placeholder-[#6b6b72] focus:border-[#e8612a] focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#6b6b72]">Email</label>
                <input
                  type="email"
                  value={props.email}
                  disabled
                  className="w-full bg-[#161618] border border-[#2a2a2c] rounded-md px-3.5 py-2.5 text-sm text-[#6b6b72] cursor-not-allowed"
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
                    ? "bg-[#e8612a60] text-white cursor-not-allowed"
                    : "bg-[#e8612a] text-white hover:bg-[#d4541f] active:scale-95"
                )}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>

              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-[#22c55e] animate-in fade-in duration-200">
                  <Check className="h-4 w-4" />
                  Saved
                </span>
              )}
              {saveError && (
                <span className="text-sm text-[#ef4444]">{saveError}</span>
              )}
            </div>
          </div>
        )}

        {/* ── APPEARANCE ───────────────────────────────────────────────── */}
        {section === "appearance" && (
          <div className="space-y-6">
            <SectionHeader
              title="Appearance"
              description="Customize the look and feel of the app."
            />

            {/* Theme */}
            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
                Theme
              </p>
              <div className="grid grid-cols-2 gap-4">
                <ThemeCard
                  id="dark"
                  active={theme === "dark"}
                  onClick={() => applyTheme("dark")}
                />
                <ThemeCard
                  id="light"
                  active={theme === "light"}
                  onClick={() => applyTheme("light")}
                />
              </div>
            </div>

            {/* Language */}
            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6">
              <div className="flex items-start justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72]">
                  Language
                </p>
                <span className="text-[10px] bg-[#1e1e20] border border-[#2a2a2c] text-[#6b6b72] px-2 py-0.5 rounded">
                  Preference saved · full i18n coming soon
                </span>
              </div>
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
                        ? "border-[#e8612a] bg-[#e8612a08]"
                        : "border-[#2a2a2c] hover:border-[#6b6b72]"
                    )}
                  >
                    <Globe
                      className={cn(
                        "h-4 w-4 shrink-0",
                        lang === id ? "text-[#e8612a]" : "text-[#6b6b72]"
                      )}
                    />
                    <div>
                      <p className={cn("text-sm font-semibold", lang === id ? "text-white" : "text-[#6b6b72]")}>
                        {label}
                      </p>
                      <p className="text-[10px] text-[#6b6b72]">{sub}</p>
                    </div>
                    {lang === id && <Check className="h-3.5 w-3.5 text-[#e8612a] ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AGENT TOKEN ──────────────────────────────────────────────── */}
        {section === "agent" && (
          <div className="space-y-6">
            <SectionHeader
              title="Agent Token"
              description="Use this token to authenticate CompanionAgent on your PC."
            />

            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6 space-y-5">
              {/* Token display */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#6b6b72]">
                  Access token
                </label>
                <div className="flex gap-2">
                  <input
                    type={tokenVisible ? "text" : "password"}
                    value={token}
                    readOnly
                    className="flex-1 bg-[#1e1e20] border border-[#2a2a2c] rounded-md px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                  <button
                    onClick={() => setTokenVisible((v) => !v)}
                    className="px-3 py-2.5 bg-[#1e1e20] border border-[#2a2a2c] rounded-md text-[#6b6b72] hover:text-white transition-colors"
                    title={tokenVisible ? "Hide" : "Show"}
                  >
                    {tokenVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={copyToken}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e20] border border-[#2a2a2c] rounded-md text-sm font-medium text-white hover:border-[#e8612a] transition-all duration-150"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#22c55e]" />
                      <span className="text-[#22c55e]">Copied!</span>
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
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e20] border border-[#2a2a2c] rounded-md text-sm font-medium text-[#6b6b72] hover:text-white hover:border-[#6b6b72] transition-all duration-150"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Renew
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-4">
                How to use
              </p>
              <ol className="space-y-3">
                {[
                  "Download and run the CompanionAgent installer",
                  "Open the settings window from the system tray icon",
                  "Paste this token in the \"Agent Token\" field",
                  "The agent will start syncing your sessions automatically",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#6b6b72]">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#1e1e20] border border-[#2a2a2c] flex items-center justify-center text-[10px] font-bold text-white">
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

            <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-6 space-y-6">
              {/* Steps */}
              <div className="space-y-4">
                {[
                  {
                    title: "Install",
                    desc: "Download and run the installer. No admin rights required.",
                    icon: Download,
                  },
                  {
                    title: "Authenticate",
                    desc: "Paste your Agent Token from the Agent Token section.",
                    icon: Key,
                  },
                  {
                    title: "Race",
                    desc: "The agent runs in the system tray and syncs sessions automatically.",
                    icon: Check,
                  },
                ].map(({ title, desc, icon: Icon }, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="shrink-0 w-9 h-9 rounded-md bg-[#e8612a15] border border-[#e8612a30] flex items-center justify-center">
                      <Icon className="h-4 w-4 text-[#e8612a]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="text-xs text-[#6b6b72] mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-[#2a2a2c]" />

              <div className="flex items-center gap-3">
                <button
                  disabled
                  className="px-5 py-2.5 bg-[#1e1e20] border border-[#2a2a2c] rounded-md text-sm font-semibold text-[#6b6b72] cursor-not-allowed"
                >
                  Coming soon — GitHub Releases
                </button>
                <p className="text-xs text-[#6b6b72]">
                  Available for Windows 10/11
                </p>
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
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="text-sm text-[#6b6b72] mt-0.5">{description}</p>
    </div>
  );
}

function ThemeCard({
  id,
  active,
  onClick,
}: {
  id: "dark" | "light";
  active: boolean;
  onClick: () => void;
}) {
  const isDark = id === "dark";

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md overflow-hidden border-2 text-left transition-all duration-150 w-full",
        active ? "border-[#e8612a]" : "border-[#2a2a2c] hover:border-[#6b6b72]"
      )}
    >
      {/* Preview */}
      <div
        className={cn("p-4 space-y-2", isDark ? "bg-[#0d0d0f]" : "bg-[#f0f0f0]")}
      >
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
      <div
        className={cn(
          "px-4 py-3 flex items-center justify-between",
          isDark ? "bg-[#161618]" : "bg-white"
        )}
      >
        <div className="flex items-center gap-2">
          {isDark ? (
            <Moon className={cn("h-3.5 w-3.5", active ? "text-[#e8612a]" : "text-[#6b6b72]")} />
          ) : (
            <Sun className={cn("h-3.5 w-3.5", active ? "text-[#e8612a]" : "text-[#6b6b72]")} />
          )}
          <span
            className={cn(
              "text-sm font-semibold",
              isDark ? (active ? "text-white" : "text-[#6b6b72]") : (active ? "text-[#111]" : "text-[#999]")
            )}
          >
            {isDark ? "Dark" : "Light"}
          </span>
        </div>
        {active && <Check className="h-3.5 w-3.5 text-[#e8612a]" />}
      </div>
    </button>
  );
}
