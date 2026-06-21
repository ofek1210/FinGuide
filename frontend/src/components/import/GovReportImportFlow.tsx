import type { ReactNode, RefObject } from "react";
import { CheckCircle, ExternalLink, FileSpreadsheet, FileText, PiggyBank, Upload } from "lucide-react";
import GlassCard from "../ui/GlassCard";
import { getGovReportImportConfig, type GovReportImportConfig, type ImportFlowDomain } from "../../config/govReportImportConfig";
import { ImportStepHeader } from "./ImportStepHeader";
import { ImportUploadZone } from "./ImportUploadZone";

export type ImportFlowStep = "landing" | "guide" | "upload";

type GovReportImportFlowProps = {
  domain: ImportFlowDomain;
  step: ImportFlowStep;
  config?: GovReportImportConfig;
  progressSteps: string[];
  // landing
  onImport: () => void;
  onManual?: () => void;
  ctaIcon?: ReactNode;
  // guide
  visitedSite: boolean;
  onVisitSite: () => void;
  onContinue: () => void;
  onBack: () => void;
  // upload
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  uploadMsg: { type: "success" | "error"; text: string } | null;
  uploadProgressStep: number | null;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onUpload: (file: File) => void;
  uploadHeaderExtra?: ReactNode;
  uploadOverrides?: Partial<{
    title: string;
    subtitle: string;
    idleTitle: string;
    idleSub: string;
    progressFallback: string;
  }>;
};

function ImportLandingStep({
  config,
  onImport,
  onManual,
  ctaIcon,
}: {
  config: GovReportImportConfig;
  onImport: () => void;
  onManual?: () => void;
  ctaIcon?: ReactNode;
}) {
  const { landing, accentColor, gradientFrom, gradientTo } = config;
  const defaultIcon = config.domain === "pension" ? <PiggyBank size={20} /> : <FileSpreadsheet size={20} />;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: "0 auto 20px",
          background: `linear-gradient(135deg, ${accentColor}1F, rgba(155,127,232,0.20))`,
          border: `1.5px solid ${accentColor}38`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38,
        }}>
          {landing.heroEmoji}
        </div>
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: "clamp(26px, 4vw, 38px)",
          fontWeight: 700, color: "#1F1F1F", margin: "0 0 14px", letterSpacing: "-0.03em",
        }}>
          {landing.title}
        </h1>
        <p style={{ fontSize: 16, color: "#7C6FA0", maxWidth: 540, margin: "0 auto 32px", lineHeight: 1.7 }}>
          {landing.subtitle}
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onImport}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "16px 36px", borderRadius: 16,
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
              color: "#fff", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 800, fontSize: 17,
              boxShadow: `0 6px 24px ${accentColor}66`,
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
          >
            {ctaIcon ?? defaultIcon}
            {landing.ctaLabel}
          </button>
          <div style={{ fontSize: 13, color: "#A89CC8" }}>{landing.ctaSub}</div>
          {onManual ? (
            <button
              type="button"
              onClick={onManual}
              style={{
                background: "none", border: "none", color: "#7C6FA0",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, textDecoration: "underline",
              }}
            >
              הזן נתונים ידנית במקום זאת
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))", gap: 16, marginBottom: 48 }}>
        {landing.benefits.map(item => (
          <GlassCard key={item.title} padding="md" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1F1F1F", marginBottom: 6 }}>{item.title}</div>
            <div style={{ fontSize: 13, color: "#7C6FA0", lineHeight: 1.55 }}>{item.desc}</div>
          </GlassCard>
        ))}
      </div>

      {landing.infoCards?.map(card => (
        <GlassCard
          key={card.title}
          padding="md"
          style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            background: `${accentColor}0A`, border: `1px solid ${accentColor}26`, marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 22, flexShrink: 0 }}>{card.emoji}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F", marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 13.5, color: "#7C6FA0", lineHeight: 1.6 }}>{card.desc}</div>
          </div>
        </GlassCard>
      ))}

      <GlassCard padding="md" style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(5,150,105,0.04)", border: "1px solid rgba(5,150,105,0.15)" }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>🔒</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F", marginBottom: 3 }}>{landing.trustNote.title}</div>
          <div style={{ fontSize: 13, color: "#7C6FA0", lineHeight: 1.5 }}>{landing.trustNote.desc}</div>
        </div>
      </GlassCard>
    </div>
  );
}

function ImportGuideStep({
  config,
  visitedSite,
  onVisitSite,
  onContinue,
  onBack,
}: {
  config: GovReportImportConfig;
  visitedSite: boolean;
  onVisitSite: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { guide, accentColor, gradientFrom, gradientTo } = config;

  return (
    <div>
      <ImportStepHeader
        stepBadge={guide.stepBadge}
        title={guide.title}
        subtitle={guide.subtitle}
        accentColor={accentColor}
        onBack={onBack}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
        {guide.steps.map((s, i) => (
          <GlassCard key={i} padding="md" elevated style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg, ${accentColor}1F, rgba(155,127,232,0.18))`,
              border: `1.5px solid ${accentColor}38`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 16, color: accentColor,
            }}>
              {s.num}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 15.5, color: "#1F1F1F" }}>{s.title}</span>
              </div>
              <p style={{ fontSize: 14, color: "#7C6FA0", margin: "0 0 10px", lineHeight: 1.6 }}>{s.desc}</p>
              {s.hasAction ? (
                <button
                  type="button"
                  onClick={onVisitSite}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 20px", borderRadius: 12,
                    background: visitedSite ? "#ECFDF5" : `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                    color: visitedSite ? "#059669" : "#fff",
                    border: visitedSite ? "1px solid rgba(5,150,105,0.25)" : "none",
                    cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 14,
                    boxShadow: visitedSite ? "none" : `0 4px 14px ${accentColor}59`,
                  }}
                >
                  {visitedSite ? (
                    <><CheckCircle size={15} /> {guide.openSiteVisited}</>
                  ) : (
                    <><ExternalLink size={15} /> {guide.openSiteDefault}</>
                  )}
                </button>
              ) : null}
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard padding="md" style={{ background: `${accentColor}0D`, border: `1px solid ${accentColor}2E`, marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{guide.tip.emoji}</span>
          <div style={{ fontSize: 13.5, color: config.domain === "insurance" ? "#92400E" : "#4A3575", lineHeight: 1.6 }}>
            {guide.tip.content}
          </div>
        </div>
      </GlassCard>

      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button
          type="button"
          onClick={onContinue}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "14px 30px", borderRadius: 14,
            background: visitedSite ? `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` : "rgba(184,157,255,0.25)",
            color: visitedSite ? "#fff" : "#A89CC8",
            border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 700, fontSize: 15,
            boxShadow: visitedSite ? `0 5px 20px ${accentColor}59` : "none",
            transition: "all 0.2s",
          }}
        >
          <Upload size={15} />
          {visitedSite ? guide.continueVisited : guide.continueDefault}
        </button>
      </div>
    </div>
  );
}

function ImportUploadStep({
  config,
  progressSteps,
  fileInputRef,
  uploading,
  uploadMsg,
  uploadProgressStep,
  isDragging,
  setIsDragging,
  onUpload,
  onBack,
  uploadHeaderExtra,
  uploadOverrides,
}: Omit<GovReportImportFlowProps, "domain" | "step" | "onImport" | "onManual" | "visitedSite" | "onVisitSite" | "onContinue" | "ctaIcon"> & { config: GovReportImportConfig }) {
  const { upload, accentColor, gradientFrom, gradientTo } = config;
  const pickFileIcon = config.domain === "pension" ? <FileText size={15} /> : <FileSpreadsheet size={15} />;

  return (
    <div>
      <ImportStepHeader
        stepBadge={upload.stepBadge}
        title={uploadOverrides?.title ?? upload.title}
        subtitle={uploadOverrides?.subtitle ?? upload.subtitle}
        accentColor={accentColor}
        onBack={onBack}
      >
        {uploadHeaderExtra}
      </ImportStepHeader>

      <ImportUploadZone
        fileInputRef={fileInputRef}
        accept={upload.accept}
        uploading={uploading}
        uploadMsg={uploadMsg}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        onUpload={onUpload}
        accentColor={accentColor}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        progressSteps={progressSteps}
        uploadProgressStep={uploadProgressStep}
        progressFallback={uploadOverrides?.progressFallback ?? upload.progressFallback}
        progressDotSize={upload.progressDotSize}
        idleEmoji={upload.idleEmoji}
        idleTitle={uploadOverrides?.idleTitle ?? upload.idleTitle}
        idleSub={uploadOverrides?.idleSub ?? upload.idleSub}
        pickFileLabel={upload.pickFileLabel}
        fileHint={upload.fileHint}
        pickFileIcon={pickFileIcon}
        uploadingHint={config.domain === "pension" ? "זה יכול לקחת כמה שניות" : undefined}
      />

      <GlassCard padding="md" style={{ background: `${accentColor}0D`, border: `1px solid ${accentColor}26` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: accentColor, marginBottom: 10 }}>{upload.afterUploadTitle}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upload.afterUploadItems.map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#5A527A" }}>
              <span style={{ color: accentColor, flexShrink: 0 }}>✓</span> {item}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export function GovReportImportFlow(props: GovReportImportFlowProps) {
  const config = props.config ?? getGovReportImportConfig(props.domain);

  if (props.step === "landing") {
    return (
      <ImportLandingStep
        config={config}
        onImport={props.onImport}
        onManual={props.onManual}
        ctaIcon={props.ctaIcon}
      />
    );
  }

  if (props.step === "guide") {
    return (
      <ImportGuideStep
        config={config}
        visitedSite={props.visitedSite}
        onVisitSite={props.onVisitSite}
        onContinue={props.onContinue}
        onBack={props.onBack}
      />
    );
  }

  return (
    <ImportUploadStep
      config={config}
      progressSteps={props.progressSteps}
      fileInputRef={props.fileInputRef}
      uploading={props.uploading}
      uploadMsg={props.uploadMsg}
      uploadProgressStep={props.uploadProgressStep}
      isDragging={props.isDragging}
      setIsDragging={props.setIsDragging}
      onUpload={props.onUpload}
      onBack={props.onBack}
      uploadHeaderExtra={props.uploadHeaderExtra}
      uploadOverrides={props.uploadOverrides}
    />
  );
}
