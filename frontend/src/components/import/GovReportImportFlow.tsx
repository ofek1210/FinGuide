import type { ReactNode, RefObject } from "react";
import { CheckCircle, ExternalLink, FileSpreadsheet, FileText, PiggyBank, Upload } from "lucide-react";
import { getGovReportImportConfig, type GovReportImportConfig, type ImportFlowDomain } from "../../config/govReportImportConfig";
import { AgentGhostButton, AgentPrimaryButton } from "../agent/AgentButtons";
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

const surfaceCard: React.CSSProperties = {
  background: "var(--surface-card, var(--card))",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--r-card)",
  boxShadow: "var(--shadow-soft)",
  padding: "24px 28px",
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
  const { landing } = config;
  const defaultIcon = config.domain === "pension" ? <PiggyBank size={20} /> : <FileSpreadsheet size={20} />;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 16,
            margin: "0 auto 20px",
            background: "var(--agent-soft, var(--lav-100))",
            border: "1.5px solid var(--agent-ring, var(--lav-200))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
          }}
        >
          {landing.heroEmoji}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(26px, 4vw, 38px)",
            fontWeight: 900,
            color: "var(--text-strong)",
            margin: "0 0 14px",
            letterSpacing: "-0.03em",
          }}
        >
          {landing.title}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-muted)",
            maxWidth: 540,
            margin: "0 auto 32px",
            lineHeight: 1.7,
            fontWeight: 500,
          }}
        >
          {landing.subtitle}
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <AgentPrimaryButton onClick={onImport}>
            {ctaIcon ?? defaultIcon}
            {landing.ctaLabel}
          </AgentPrimaryButton>
          <div style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 600 }}>{landing.ctaSub}</div>
          {onManual ? (
            <button
              type="button"
              onClick={onManual}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              הזן נתונים ידנית במקום זאת
            </button>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
          gap: 16,
          marginBottom: 48,
        }}
      >
        {landing.benefits.map((item) => (
          <div key={item.title} style={{ ...surfaceCard, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-strong)", marginBottom: 6 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {landing.infoCards?.map((card) => (
        <div
          key={card.title}
          style={{
            ...surfaceCard,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            background: "var(--agent-soft, var(--lav-50))",
            border: `1px solid var(--agent-ring, var(--lav-200))`,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 22, flexShrink: 0 }}>{card.emoji}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)", marginBottom: 4 }}>
              {card.title}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{card.desc}</div>
          </div>
        </div>
      ))}

      <div
        style={{
          ...surfaceCard,
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "var(--mint-soft)",
          border: "1px solid var(--mint)",
        }}
      >
        <div style={{ fontSize: 22, flexShrink: 0 }}>🔒</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)", marginBottom: 3 }}>
            {landing.trustNote.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{landing.trustNote.desc}</div>
        </div>
      </div>
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
  const { guide, accentColor } = config;

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
          <div key={i} style={{ ...surfaceCard, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                flexShrink: 0,
                background: "var(--agent-soft, var(--lav-100))",
                border: "1.5px solid var(--agent-ring, var(--lav-200))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 16,
                color: accentColor,
              }}
            >
              {s.num}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 15.5, color: "var(--text-strong)" }}>{s.title}</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 10px", lineHeight: 1.6 }}>{s.desc}</p>
              {s.hasAction ? (
                visitedSite ? (
                  <AgentGhostButton size="sm" onClick={onVisitSite} style={{ color: "var(--mint-ink)", borderColor: "var(--mint)" }}>
                    <CheckCircle size={15} /> {guide.openSiteVisited}
                  </AgentGhostButton>
                ) : (
                  <AgentPrimaryButton size="sm" onClick={onVisitSite}>
                    <ExternalLink size={15} /> {guide.openSiteDefault}
                  </AgentPrimaryButton>
                )
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...surfaceCard,
          background: "var(--agent-soft, var(--lav-50))",
          border: "1px solid var(--agent-ring, var(--lav-200))",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{guide.tip.emoji}</span>
          <div style={{ fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.6 }}>{guide.tip.content}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        {visitedSite ? (
          <AgentPrimaryButton onClick={onContinue}>
            <Upload size={15} />
            {guide.continueVisited}
          </AgentPrimaryButton>
        ) : (
          <AgentGhostButton onClick={onContinue} style={{ color: "var(--text-faint)" }}>
            <Upload size={15} />
            {guide.continueDefault}
          </AgentGhostButton>
        )}
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
}: Omit<
  GovReportImportFlowProps,
  "domain" | "step" | "onImport" | "onManual" | "visitedSite" | "onVisitSite" | "onContinue" | "ctaIcon"
> & { config: GovReportImportConfig }) {
  const { upload, accentColor } = config;
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

      <div
        style={{
          ...surfaceCard,
          background: "var(--agent-soft, var(--lav-50))",
          border: "1px solid var(--agent-ring, var(--lav-200))",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: accentColor, marginBottom: 10 }}>
          {upload.afterUploadTitle}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upload.afterUploadItems.map((item) => (
            <div
              key={item}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-body)" }}
            >
              <span style={{ color: accentColor, flexShrink: 0 }}>✓</span> {item}
            </div>
          ))}
        </div>
      </div>
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
