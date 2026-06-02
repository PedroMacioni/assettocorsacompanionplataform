import { getTranslations } from "next-intl/server";
import { ArrowDownToLine, Monitor, CheckCircle2, ExternalLink } from "lucide-react";

const REPO = "PedroMacioni/ac-companion-agent";
const RELEASES_URL = `https://github.com/${REPO}/releases`;

async function getLatestRelease(): Promise<{ version: string; downloadUrl: string }> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { next: { revalidate: 3600 }, headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return { version: "", downloadUrl: RELEASES_URL };
    const data = await res.json();
    const tag: string = data.tag_name ?? "";
    const version = tag.replace(/^v/, "");
    // Prefer the actual uploaded asset; fall back to the predictable download URL
    const asset = (data.assets as Array<{ name: string; browser_download_url: string }> | undefined)
      ?.find((a) => a.name.endsWith(".exe"));
    const downloadUrl = asset?.browser_download_url
      ?? `https://github.com/${REPO}/releases/download/${tag}/SimRacingCompanion-Setup-${version}.exe`;
    return { version: tag, downloadUrl };
  } catch {
    return { version: "", downloadUrl: RELEASES_URL };
  }
}

export default async function DownloadPage() {
  const [t, release] = await Promise.all([getTranslations("Download"), getLatestRelease()]);

  const steps = [t("steps.one"), t("steps.two"), t("steps.three"), t("steps.four")];
  const requirements = [t("requirements.os"), t("requirements.ac"), t("requirements.cm")];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("yourCars")}
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Download card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Monitor className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-semibold text-foreground">
                  SimRacingCompanion-Setup.exe
                </span>
                {release.version && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                    {release.version}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{t("fileInfo")}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{t("description")}</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={release.downloadUrl}
              download
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              <ArrowDownToLine className="w-4 h-4" />
              {t("downloadButton")}
            </a>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("allReleases")}
            </a>
          </div>
        </div>
      </div>

      {/* Setup steps */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {t("steps.title")}
        </p>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">{i + 1}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          {t("requirements.title")}
        </p>
        <div className="space-y-2">
          {requirements.map((req, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary/60 shrink-0" />
              <p className="text-sm text-muted-foreground">{req}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
