import { useState, useEffect, useRef } from "react";

const API_BASE = "http://localhost:8000";

const GENE_PRESETS = {
  "Lung Adenocarcinoma": { EGFR: 9.2, KRAS: 6.5, ALK: 4.1, TP53: 7.8, MET: 5.3, STK11: 2.1, BRAF: 4.0 },
  "Breast Carcinoma": { BRCA1: 2.1, BRCA2: 3.4, ESR1: 8.5, ERBB2: 8.8, MKI67: 7.1, CCND1: 6.2 },
  "Colorectal Carcinoma": { APC: 2.3, KRAS: 8.1, TP53: 7.2, MLH1: 1.5, BRAF: 6.8, SMAD4: 3.1 },
  "Liver Cancer": { AFP: 9.5, TP53: 8.1, CTNNB1: 7.2, VEGFA: 6.8, TERT: 9.0, MYC: 7.5 },
  "Prostate Cancer": { AR: 9.1, PSA: 8.7, PTEN: 2.3, ERG: 7.8, ETV1: 5.2, SPOP: 3.4 },
};

const CANCER_ICONS = {
  "Breast Carcinoma": "🎗️",
  "Lung Adenocarcinoma": "🫁",
  "Lung Squamous Cell Carcinoma": "🫁",
  "Colorectal Adenocarcinoma": "🔬",
  "Liver Hepatocellular Carcinoma": "🧬",
  "Prostate Adenocarcinoma": "🩺",
};

const CHATBOT_RESPONSES = {
  egfr: "EGFR mutations occur in ~15% of NSCLC, especially in never-smokers. Drugs like Erlotinib and Gefitinib are first-line treatment for EGFR+ lung cancer.",
  brca: "BRCA1/2 mutations increase breast/ovarian cancer risk. PARP inhibitors (Olaparib) are highly effective for BRCA-mutated tumors.",
  her2: "HER2 overexpression occurs in ~20% of breast cancers. Trastuzumab (Herceptin) and Lapatinib target HER2 pathway.",
  kras: "KRAS mutations are common in lung (30%), colon (40%), and pancreatic (90%) cancers. KRAS G12C is now targetable with Sotorasib.",
  immunotherapy: "Immunotherapy (PD-1/PD-L1 inhibitors like Pembrolizumab) is standard-of-care for many cancers. Efficacy depends on PD-L1 expression and tumor mutational burden (TMB).",
  chemotherapy: "Chemotherapy uses cytotoxic drugs to kill rapidly dividing cells. Common regimens: FOLFOX (colorectal), Cisplatin/Gemcitabine (lung). Side effects vary by drug class.",
  staging: "Cancer staging (I–IV) describes disease extent. Stage I = localized; Stage IV = metastatic. Staging guides treatment approach.",
  biopsy: "Biopsy samples tumor tissue for diagnosis. Types include core needle, liquid biopsy. Molecular profiling guides targeted therapy selection.",
  ic50: "IC50 measures drug potency — lower IC50 = more potent. OncoCare Hub uses GDSC2 data with IC50 values for 286 drugs across 969 cancer cell lines.",
  msi: "MSI-H (Microsatellite Instability High) cancers respond well to PD-1 inhibitors regardless of tumor type — Pembrolizumab has tumor-agnostic approval.",
  parp: "PARP inhibitors (Olaparib, Veliparib) exploit synthetic lethality in BRCA-mutated cells. Approved for breast, ovarian, and pancreatic cancers.",
  "side effect": "Side effects vary by drug class. Chemotherapy often causes fatigue, nausea, and immunosuppression. Targeted therapies have more specific toxicities.",
  "clinical trial": "Clinical trials offer cutting-edge therapies. Search clinicaltrials.gov with your cancer type and molecular markers to find eligible trials near you.",
  survival: "Prognosis depends on cancer type, stage, molecular profile, and treatment response. Ask your oncologist for individualized assessment.",
  default: "I'm OncoCare Hub AI, your precision oncology companion. Ask me about biomarkers (EGFR, BRCA, HER2), drug mechanisms, staging, or treatment pathways. You can also run a full analysis using the Patient Analysis tab.",
};

function getChatResponse(msg) {
  const lower = msg.toLowerCase();
  for (const [key, resp] of Object.entries(CHATBOT_RESPONSES)) {
    if (key !== "default" && lower.includes(key)) return resp;
  }
  if (lower.includes("hello") || lower.includes("hi")) return "Hello! I'm OncoCare Hub, your AI oncology assistant. What would you like to know about cancer types, biomarkers, or treatments?";
  if (lower.includes("what") && lower.includes("do")) return CHATBOT_RESPONSES.default;
  return CHATBOT_RESPONSES.default;
}

// ─── Mock API response for demo without backend ───────────────────────────────
function getMockReport(patientData) {
  const { biomarkers = {}, symptoms = [], cancer_type_hint } = patientData;
  const genes = Object.keys(biomarkers);

  let tcga = "TCGA-LUAD";
  let cancer = "Lung Adenocarcinoma";
  let confidence = 87.3;

  if (genes.some(g => ["BRCA1", "BRCA2", "ESR1", "ERBB2"].includes(g.toUpperCase()))) {
    tcga = "TCGA-BRCA"; cancer = "Breast Carcinoma"; confidence = 93.1;
  } else if (genes.some(g => ["APC", "MLH1"].includes(g.toUpperCase()))) {
    tcga = "TCGA-COAD"; cancer = "Colorectal Adenocarcinoma"; confidence = 88.4;
  } else if (genes.some(g => ["AFP", "TERT"].includes(g.toUpperCase()))) {
    tcga = "TCGA-LIHC"; cancer = "Liver Hepatocellular Carcinoma"; confidence = 91.7;
  } else if (genes.some(g => ["AR", "PSA"].includes(g.toUpperCase()))) {
    tcga = "TCGA-PRAD"; cancer = "Prostate Adenocarcinoma"; confidence = 89.2;
  }

  const drugsByType = {
    "TCGA-LUAD": [
      { rank: 1, drug: "Erlotinib", target: "EGFR", pathway: "RTK/RAS", biomarker_basis: "EGFR mutation detected pattern", sensitivity_score: 0.712, mean_ln_ic50: -1.23, mean_auc: 0.689, n_cell_lines: 47 },
      { rank: 2, drug: "Gefitinib", target: "EGFR", pathway: "RTK/RAS", biomarker_basis: "EGFR/HER2 expression", sensitivity_score: 0.681, mean_ln_ic50: -0.91, mean_auc: 0.712, n_cell_lines: 43 },
      { rank: 3, drug: "Trametinib", target: "MEK", pathway: "RTK/RAS", biomarker_basis: "KRAS/BRAF mutation", sensitivity_score: 0.534, mean_ln_ic50: -0.01, mean_auc: 0.809, n_cell_lines: 39 },
      { rank: 4, drug: "Cisplatin", target: "DNA", pathway: "DNA replication", biomarker_basis: "Standard cytotoxic backbone", sensitivity_score: 0.501, mean_ln_ic50: 1.45, mean_auc: 0.732, n_cell_lines: 52 },
      { rank: 5, drug: "Crizotinib", target: "ALK/MET", pathway: "RTK/RAS", biomarker_basis: "ALK rearrangement", sensitivity_score: 0.478, mean_ln_ic50: 2.10, mean_auc: 0.801, n_cell_lines: 35 },
    ],
    "TCGA-BRCA": [
      { rank: 1, drug: "Olaparib", target: "PARP", pathway: "DNA repair", biomarker_basis: "BRCA1/2 mutation pattern", sensitivity_score: 0.734, mean_ln_ic50: -1.89, mean_auc: 0.623, n_cell_lines: 41 },
      { rank: 2, drug: "Lapatinib", target: "HER2", pathway: "RTK/RAS", biomarker_basis: "HER2 amplification", sensitivity_score: 0.698, mean_ln_ic50: -0.77, mean_auc: 0.698, n_cell_lines: 38 },
      { rank: 3, drug: "Tamoxifen", target: "ER", pathway: "Hormone", biomarker_basis: "ER-positive expression", sensitivity_score: 0.645, mean_ln_ic50: 0.45, mean_auc: 0.711, n_cell_lines: 44 },
      { rank: 4, drug: "Cisplatin", target: "DNA", pathway: "DNA replication", biomarker_basis: "BRCA1/2 synthetic lethality", sensitivity_score: 0.612, mean_ln_ic50: 1.23, mean_auc: 0.756, n_cell_lines: 49 },
      { rank: 5, drug: "Palbociclib", target: "CDK4/6", pathway: "Cell cycle", biomarker_basis: "RB1 expression pattern", sensitivity_score: 0.589, mean_ln_ic50: 2.34, mean_auc: 0.823, n_cell_lines: 33 },
    ],
    "TCGA-COAD": [
      { rank: 1, drug: "5-Fluorouracil", target: "TYMS", pathway: "DNA replication", biomarker_basis: "Standard colorectal backbone", sensitivity_score: 0.689, mean_ln_ic50: -0.34, mean_auc: 0.645, n_cell_lines: 55 },
      { rank: 2, drug: "Oxaliplatin", target: "DNA", pathway: "DNA replication", biomarker_basis: "ERCC1 expression pattern", sensitivity_score: 0.651, mean_ln_ic50: 1.12, mean_auc: 0.712, n_cell_lines: 48 },
      { rank: 3, drug: "Cetuximab", target: "EGFR", pathway: "RTK/RAS", biomarker_basis: "RAS wildtype pattern", sensitivity_score: 0.623, mean_ln_ic50: 2.45, mean_auc: 0.789, n_cell_lines: 42 },
      { rank: 4, drug: "Trametinib", target: "MEK", pathway: "RTK/RAS", biomarker_basis: "BRAF V600E mutation", sensitivity_score: 0.534, mean_ln_ic50: 1.89, mean_auc: 0.834, n_cell_lines: 37 },
      { rank: 5, drug: "Vemurafenib", target: "BRAF", pathway: "RTK/RAS", biomarker_basis: "BRAF V600E pattern", sensitivity_score: 0.501, mean_ln_ic50: 2.78, mean_auc: 0.856, n_cell_lines: 31 },
    ],
  };

  const pathways = {
    "TCGA-LUAD": {
      name: "Lung Adenocarcinoma",
      steps: ["CT-guided biopsy + cytology", "Molecular profiling (EGFR, ALK, ROS1, KRAS, PD-L1)", "Staging: PET-CT + brain MRI", "1st-line targeted therapy (Erlotinib if EGFR+) or immunotherapy", "Surgical resection (stage I–IIA) or SBRT", "Concurrent chemoradiation (stage III)", "Maintenance: pembrolizumab if PD-L1 ≥50%", "Surveillance CT every 3–6 months"],
      key_tests: ["EGFR mutation", "ALK FISH", "KRAS G12C", "PD-L1 TPS", "TMB"],
    },
    "TCGA-BRCA": {
      name: "Breast Carcinoma",
      steps: ["Core biopsy + Hormone Receptor Testing (ER/PR/HER2)", "Genomic profiling (Oncotype DX / BRCA1/2)", "Staging: mammography, MRI, PET scan", "Neoadjuvant chemotherapy (if stage II/III)", "Surgical intervention (lumpectomy or mastectomy)", "Radiation therapy (post-surgery)", "Targeted therapy: Trastuzumab (HER2+) or Tamoxifen/AI (ER+)", "Long-term monitoring: annual mammography + labs"],
      key_tests: ["ER/PR status", "HER2 IHC/FISH", "BRCA1/2 germline", "Ki-67 index"],
    },
    "TCGA-COAD": {
      name: "Colorectal Adenocarcinoma",
      steps: ["Colonoscopy + biopsy", "MMR/MSI testing, KRAS/NRAS/BRAF/HER2 profiling", "Staging: CT chest/abdomen/pelvis + CEA", "Neoadjuvant FOLFOX/CAPOX ± bevacizumab", "Surgical resection", "Adjuvant radiation (rectal cancer, stage II–III)", "Targeted: Cetuximab (RAS WT) or Pembrolizumab (MSI-H)", "Surveillance: colonoscopy + CT + CEA every 3–6 months"],
      key_tests: ["MSI/MMR", "KRAS exon 2/3/4", "NRAS", "BRAF V600E", "HER2"],
    },
  };

  const drugs = drugsByType[tcga] || drugsByType["TCGA-LUAD"];
  const pw = pathways[tcga] || pathways["TCGA-LUAD"];

  const differentials = [
    { cancer_name: cancer, probability: confidence },
    { cancer_name: "Lung Adenocarcinoma", probability: 100 - confidence - 4.1 },
    { cancer_name: "Colorectal Adenocarcinoma", probability: 2.8 },
    { cancer_name: "Breast Carcinoma", probability: 1.3 },
  ].filter(d => d.cancer_name !== cancer || true).sort((a, b) => b.probability - a.probability).slice(0, 4);
  differentials[0] = { cancer_name: cancer, probability: confidence };

  const alerts = [];
  if (symptoms.some(s => ["cough", "breathlessness"].includes(s.toLowerCase()))) alerts.push("Respiratory symptoms — pulmonary evaluation recommended");
  if (symptoms.some(s => ["weight loss", "fatigue"].includes(s.toLowerCase()))) alerts.push("Systemic symptoms — nutritional and metabolic assessment");
  if (symptoms.some(s => ["pain", "bone pain"].includes(s.toLowerCase()))) alerts.push("Pain symptoms — consider bone scan for metastasis");
  if (symptoms.some(s => ["jaundice"].includes(s.toLowerCase()))) alerts.push("Hepatic symptoms — liver function panel recommended");

  return {
    cancer_prediction: { predicted: cancer, tcga_code: tcga, confidence_percent: confidence, differential: differentials, genes_matched: genes.length },
    drug_recommendations: drugs,
    treatment_pathway: pw,
    symptom_alerts: alerts,
  };
}

// ─── Components ───────────────────────────────────────────────────────────────

function LoadingDNA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", gap: 16 }}>
      <div style={{ fontSize: 64, animation: "float 3s ease-in-out infinite" }}>🩺</div>
      <p style={{ color: "#D4AF37", fontWeight: 600, fontSize: 16 }}>OncoCare Hub is analyzing your profile...</p>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

function ConfidenceBar({ value, color = "#D4AF37" }) {
  return (
    <div style={{ background: "#E3F2FD", borderRadius: 10, height: 10, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${value}%`, height: "100%", background: `linear-gradient(90deg, ${color}, #FFD700)`, borderRadius: 10, transition: "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }} />
    </div>
  );
}

function DrugCard({ drug, idx }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = drug.sensitivity_score > 0.65 ? "#2E7D32" : drug.sensitivity_score > 0.5 ? "#F9A825" : "#C62828";
  const bgColor = drug.sensitivity_score > 0.65 ? "#E8F5E9" : drug.sensitivity_score > 0.5 ? "#FFFDE7" : "#FFEBEE";

  return (
    <div onClick={() => setExpanded(!expanded)} className="glass-card" style={{ padding: "16px 20px", cursor: "pointer", transition: "all 0.3s", marginBottom: 12, borderLeft: `4px solid ${scoreColor}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: scoreColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 13, flexShrink: 0 }}>{idx}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "#2C3E50", fontSize: 16 }}>{drug.drug}</span>
            <span style={{ fontSize: 12, color: scoreColor, fontWeight: 700, background: bgColor, padding: "4px 10px", borderRadius: 20 }}>Score: {drug.sensitivity_score.toFixed(3)}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "#7F8C8D" }}>Target: <span style={{ color: "#2C3E50", fontWeight: 600 }}>{drug.target}</span></span>
            <span style={{ fontSize: 12, color: "#7F8C8D" }}>Pathway: <span style={{ color: "#2C3E50", fontWeight: 600 }}>{drug.pathway}</span></span>
          </div>
        </div>
        <span style={{ color: "#D4AF37", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="fade-in" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(212, 175, 55, 0.1)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[["LN IC50", drug.mean_ln_ic50.toFixed(2)], ["AUC", drug.mean_auc.toFixed(3)], ["Cell Lines", drug.n_cell_lines]].map(([label, val]) => (
              <div key={label} style={{ background: "#F8F9FA", borderRadius: 12, padding: "10px", textAlign: "center", border: "1px solid #E3F2FD" }}>
                <div style={{ fontSize: 11, color: "#7F8C8D", marginBottom: 2, fontWeight: 600 }}>{label}</div>
                <div style={{ fontFamily: "monospace", color: "#D4AF37", fontSize: 15, fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#E3F2FD", borderLeft: "4px solid #4A90E2", borderRadius: "0 12px 12px 0", padding: "12px", fontSize: 13, color: "#2C3E50" }}>
            <strong>Biomarker basis:</strong> {drug.biomarker_basis}
          </div>
        </div>
      )}
    </div>
  );
}

function Mascot() {
  return (
    <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 10px" }}>
      <div style={{ width: 60, height: 60, background: "linear-gradient(135deg, #E3F2FD, #BBDEFB)", borderRadius: "20px 20px 10px 10px", border: "3px solid #D4AF37", position: "relative", margin: "10px auto" }}>
        {/* Eyes */}
        <div style={{ position: "absolute", top: 15, left: 12, width: 8, height: 8, background: "#2C3E50", borderRadius: "50%", animation: "blink 4s infinite" }} />
        <div style={{ position: "absolute", top: 15, right: 12, width: 8, height: 8, background: "#2C3E50", borderRadius: "50%", animation: "blink 4s infinite" }} />
        {/* Mouth */}
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", width: 20, height: 10, borderBottom: "3px solid #2C3E50", borderRadius: "0 0 10px 10px" }} />
        {/* Antenna */}
        <div style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", width: 4, height: 15, background: "#D4AF37" }} />
        <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, background: "#FFD700", borderRadius: "50%", boxShadow: "0 0 10px #FFD700" }} />
      </div>
      <style>{`
        @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
      `}</style>
    </div>
  );
}

function ChatBot() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hello! I'm your OncoCare assistant 🤖 I'm here to help you understand cancer biomarkers, drug treatments, and oncology pathways. How can I assist you today?" }
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const resp = getChatResponse(userMsg);
      setMessages(m => [...m, { role: "bot", text: resp }]);
      setTyping(false);
    }, 700 + Math.random() * 600);
  };

  const suggestions = ["What is EGFR?", "Immunotherapy basics", "Explain IC50", "BRCA mutations", "MSI-H significance"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 500 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 4px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Mascot />
        {messages.map((m, i) => (
          <div key={i} className="fade-in" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "85%", padding: "14px 18px", borderRadius: m.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
              background: m.role === "user" ? "linear-gradient(135deg, #D4AF37, #B8860B)" : "#fff",
              border: m.role === "bot" ? "1px solid rgba(212, 175, 55, 0.2)" : "none",
              boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              color: m.role === "user" ? "#fff" : "#2C3E50", fontSize: 15, lineHeight: 1.6,
            }}>
              {m.role === "bot" && <span style={{ fontSize: 11, fontWeight: 800, color: "#D4AF37", display: "block", marginBottom: 6, letterSpacing: 1 }}>ONCOCARE ASSISTANT</span>}
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", gap: 6, padding: "12px 16px", background: "#fff", border: "1px solid #E3F2FD", borderRadius: "20px 20px 20px 4px", width: 60 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#D4AF37", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => { setInput(s); }} style={{ background: "#E3F2FD", border: "1px solid #BBDEFB", color: "#1976D2", borderRadius: 20, padding: "6px 14px", fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}>{s}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, background: "#fff", padding: 8, borderRadius: 16, border: "1px solid #E3F2FD", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask your oncology companion..." style={{ flex: 1, background: "transparent", border: "none", padding: "10px 14px", color: "#2C3E50", fontSize: 15, outline: "none" }} />
        <button onClick={send} className="btn-primary" style={{ padding: "10px 20px" }}>Send</button>
      </div>
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} }`}</style>
    </div>
  );
}

function BiomarkerInput({ biomarkers, setBiomarkers }) {
  const [gene, setGene] = useState("");
  const [val, setVal] = useState("");

  const add = () => {
    if (gene && val) {
      setBiomarkers(b => ({ ...b, [gene.toUpperCase()]: parseFloat(val) }));
      setGene(""); setVal("");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input value={gene} onChange={e => setGene(e.target.value)} placeholder="Gene (e.g. EGFR)" style={inputStyle} />
        <input value={val} onChange={e => setVal(e.target.value)} type="number" step="0.1" placeholder="Value (0–15)" style={{ ...inputStyle, width: 140 }} />
        <button onClick={add} className="btn-primary">Add</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(biomarkers).map(([g, v]) => (
          <div key={g} style={{ background: "#E3F2FD", border: "1px solid #BBDEFB", borderRadius: 12, padding: "6px 14px", display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <span style={{ color: "#1976D2", fontWeight: 700 }}>{g}</span>
            <span style={{ color: "#D4AF37", fontWeight: 800 }}>{v}</span>
            <button onClick={() => setBiomarkers(b => { const nb = { ...b }; delete nb[g]; return nb; })} style={{ background: "none", border: "none", color: "#C62828", cursor: "pointer", padding: 0, fontSize: 16, fontWeight: 800 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutSection() {
  const founders = [
    { name: "Apoorva", role: "Co-Founder", icon: "👩‍💻" },
    { name: "Siddhi", role: "Co-Founder", icon: "👩‍🔬" },
    { name: "Jatin", role: "Co-Founder", icon: "👨‍💻" }
  ];

  return (
    <div style={{ padding: "80px 0", textAlign: "center" }}>
      <h2 className="gold-gradient-text" style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>About the Founders</h2>
      <p style={{ color: "#7F8C8D", fontSize: 18, maxWidth: 700, margin: "0 auto 50px", lineHeight: 1.6 }}>
        We are beginner builders in machine learning and web development, but passionate cofounders committed to helping cancer patients through compassionate innovation.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, maxWidth: 900, margin: "0 auto" }}>
        {founders.map(f => (
          <div key={f.name} className="glass-card fade-in" style={{ padding: 32, transition: "transform 0.3s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{f.icon}</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#2C3E50", margin: "0 0 4px 0" }}>{f.name}</h3>
            <p style={{ color: "#D4AF37", fontWeight: 700, margin: 0 }}>{f.role}</p>
            <div style={{ marginTop: 20, height: 2, background: "linear-gradient(90deg, transparent, #D4AF37, transparent)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1, background: "#fff", border: "1px solid #E3F2FD", borderRadius: 12,
  padding: "12px 16px", color: "#2C3E50", fontSize: 15, outline: "none", transition: "all 0.2s",
  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("home");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [symptoms, setSymptoms] = useState([]);
  const [biomarkers, setBiomarkers] = useState({});
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const SYMPTOM_OPTIONS = ["Cough", "Breathlessness", "Weight Loss", "Fatigue", "Bone Pain", "Jaundice", "Breast Lump", "Blood in Stool", "Abdominal Pain", "Night Sweats"];

  const runAnalysis = () => {
    if (Object.keys(biomarkers).length === 0) {
      alert("Please add at least one biomarker/gene expression value.");
      return;
    }
    setLoading(true);
    setReport(null);
    setTab("results");
    setTimeout(() => {
      const r = getMockReport({ name, age: parseInt(age), gender, symptoms, biomarkers });
      setReport(r);
      setLoading(false);
    }, 2200);
  };

  const colors = { bg: "#FAF9F6", card: "rgba(255,255,255,0.7)", border: "rgba(212, 175, 55, 0.2)", accent: "#D4AF37", blue: "#4A90E2", text: "#2C3E50", muted: "#7F8C8D" };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "radial-gradient(circle at 10% 10%, rgba(212, 175, 55, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 90%, rgba(74, 144, 226, 0.05) 0%, transparent 40%)", pointerEvents: "none" }} />

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250, 249, 246, 0.8)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${colors.border}`, padding: "0 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 80 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setTab("home")}>
            <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #D4AF37, #FFD700)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(212, 175, 55, 0.2)" }}>🩺</div>
            <div>
              <span className="gold-gradient-text" style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.5px" }}>OncoCare Hub</span>
              <span style={{ color: colors.muted, fontSize: 10, display: "block", lineHeight: 1, letterSpacing: 1.5, fontWeight: 700, marginTop: 2 }}>PRECISION HEALTHCARE</span>
            </div>
          </div>
          <nav style={{ display: "flex", gap: 8 }}>
            {[["home", "Home"], ["analysis", "Analysis"], ["results", "Results"], ["chat", "AI Assistant"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                background: tab === id ? "rgba(212, 175, 55, 0.1)" : "transparent",
                border: "none",
                color: tab === id ? colors.accent : colors.muted,
                borderRadius: 12, padding: "10px 20px", cursor: "pointer",
                fontSize: 14, fontWeight: 700, transition: "all 0.3s ease"
              }}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 40px 80px" }}>

        {/* HOME TAB */}
        {tab === "home" && (
          <div className="fade-in">
            <div style={{ textAlign: "center", padding: "80px 0 100px" }}>
              <div style={{ display: "inline-block", background: "#E3F2FD", border: "1px solid #BBDEFB", borderRadius: 30, padding: "6px 20px", fontSize: 13, color: "#1976D2", marginBottom: 24, fontWeight: 700, letterSpacing: 0.5 }}>
                ✨ Hackathon Healthcare Prototype
              </div>
              <h1 className="gold-gradient-text" style={{ fontSize: "clamp(48px, 6vw, 72px)", fontWeight: 900, letterSpacing: "-2px", lineHeight: 1.1, marginBottom: 24 }}>
                AI-powered companion<br />for cancer patients
              </h1>
              <p style={{ color: colors.muted, fontSize: 20, maxWidth: 650, margin: "0 auto 48px", lineHeight: 1.6, fontWeight: 500 }}>
                Revolutionizing oncology with precision AI. Get cancer type predictions and evidence-based drug insights from genomic data in seconds.
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                <button onClick={() => setTab("analysis")} className="btn-primary" style={{ fontSize: 17, padding: "16px 40px" }}>Start Analysis →</button>
                <button onClick={() => setTab("chat")} className="btn-secondary" style={{ fontSize: 17, padding: "16px 40px" }}>Talk to AI Assistant</button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 80 }}>
              {[["498+", "Patients", "Training samples"], ["19,938", "Genes", "Expression data"], ["286", "Drugs", "GDSC2 Database"], ["94.8%", "Accuracy", "CV Accuracy"]].map(([val, label, sub]) => (
                <div key={label} className="glass-card fade-in" style={{ padding: "30px", textAlign: "center" }}>
                  <div className="gold-gradient-text" style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-1px" }}>{val}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: colors.text, marginTop: 8 }}>{label}</div>
                  <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, fontWeight: 500 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Features */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 80 }}>
              {[
                ["🎯", "Prediction Engine", "ML model trained on TCGA gene expression data with ~95% accuracy using advanced feature selection."],
                ["💊", "Drug Sensitivity", "Insights from 286 drugs across 969 cell lines, ranked by evidence-based sensitivity scores."],
                ["🗺️", "Care Pathways", "Step-by-step clinical protocols tailored to predicted cancer types and patient biomarkers."],
                ["🤖", "Medical AI Bot", "Friendly approachable AI mascot to answer clinical questions and interpret genomic findings."],
                ["📊", "Precision Reports", "Comprehensive PDF-ready oncology reports with differential diagnoses and clinical alerts."],
                ["🧬", "Genomic Insight", "Deep dive into biomarkers like EGFR, BRCA, and HER2 with expert clinical context."]
              ].map(([icon, title, desc]) => (
                <div key={title} className="glass-card fade-in" style={{ padding: "32px", transition: "transform 0.3s ease" }}>
                  <div style={{ fontSize: 40, marginBottom: 20 }}>{icon}</div>
                  <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12, color: colors.text }}>{title}</h3>
                  <p style={{ color: colors.muted, fontSize: 14, lineHeight: 1.7, fontWeight: 500 }}>{desc}</p>
                </div>
              ))}
            </div>

            {/* About Section */}
            <AboutSection />
          </div>
        )}

        {/* ANALYSIS TAB */}
        {tab === "analysis" && (
          <div className="fade-in" style={{ maxWidth: 850, margin: "0 auto" }}>
            <h2 className="gold-gradient-text" style={{ fontSize: 36, fontWeight: 900, marginBottom: 12 }}>Patient Analysis</h2>
            <p style={{ color: colors.muted, marginBottom: 40, fontSize: 18, fontWeight: 500 }}>Input patient details and genomic data to generate a precision oncology report.</p>

            {/* Patient Info */}
            <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.accent, letterSpacing: 1, marginBottom: 24, textTransform: "uppercase" }}>Patient Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: colors.muted, display: "block", marginBottom: 8, fontWeight: 700 }}>Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: colors.muted, display: "block", marginBottom: 8, fontWeight: 700 }}>Age</label>
                  <input value={age} onChange={e => setAge(e.target.value)} type="number" placeholder="Enter age" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: colors.muted, display: "block", marginBottom: 8, fontWeight: 700 }}>Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", cursor: "pointer" }}>
                    <option value="">Select</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Symptoms */}
            <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.accent, letterSpacing: 1, marginBottom: 24, textTransform: "uppercase" }}>Clinical Symptoms</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {SYMPTOM_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} style={{
                    background: symptoms.includes(s) ? "#D4AF37" : "#fff",
                    border: "1px solid #D4AF37",
                    color: symptoms.includes(s) ? "#fff" : "#D4AF37",
                    borderRadius: 30, padding: "10px 20px", cursor: "pointer",
                    fontSize: 14, fontWeight: 700, transition: "all 0.2s ease"
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Biomarkers */}
            <div className="glass-card" style={{ padding: 32, marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: colors.accent, letterSpacing: 1, textTransform: "uppercase" }}>Genomic Biomarkers</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.keys(GENE_PRESETS).map(preset => (
                    <button key={preset} onClick={() => setBiomarkers(GENE_PRESETS[preset])} style={{ background: "#E3F2FD", border: "1px solid #BBDEFB", color: "#1976D2", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                      {preset.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 14, color: colors.muted, marginBottom: 20, fontWeight: 500 }}>Add gene expression values (0–15 log2 scale). Use presets to load sample profiles.</p>
              <BiomarkerInput biomarkers={biomarkers} setBiomarkers={setBiomarkers} />
            </div>

            <button onClick={runAnalysis} disabled={loading} className="btn-primary" style={{ width: "100%", fontSize: 18, padding: "20px", borderRadius: 16, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Analyzing..." : "Run Precision Analysis →"}
            </button>
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === "results" && (
          <div className="fade-in">
            {loading ? <LoadingDNA /> : !report ? (
              <div style={{ textAlign: "center", padding: "100px 20px" }}>
                <div style={{ fontSize: 64, marginBottom: 24 }}>🔬</div>
                <h3 style={{ fontSize: 24, fontWeight: 800, color: colors.text }}>No Report Generated</h3>
                <p style={{ color: colors.muted, fontSize: 16, marginBottom: 32 }}>Start by entering patient data in the Analysis tab.</p>
                <button onClick={() => setTab("analysis")} className="btn-primary">Go to Analysis</button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 40 }}>
                  <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #E3F2FD, #BBDEFB)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, boxShadow: "0 8px 20px rgba(0,0,0,0.05)", border: "2px solid #D4AF37" }}>
                    {CANCER_ICONS[report.cancer_prediction.predicted] || "🧬"}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: colors.text }}>{name || "Patient"} — Oncology Report</h2>
                    <p style={{ color: colors.muted, margin: "4px 0 0 0", fontSize: 16, fontWeight: 500 }}>Powered by OncoCare Hub Precision ML Engine</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                  {/* Cancer Prediction */}
                  <div className="glass-card" style={{ padding: 32 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.accent, letterSpacing: 1, marginBottom: 24, textTransform: "uppercase" }}>Cancer Prediction</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
                      <div style={{ fontSize: 56 }}>{CANCER_ICONS[report.cancer_prediction.predicted] || "🧬"}</div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1.2, color: colors.text }}>{report.cancer_prediction.predicted}</div>
                        <div className="gold-gradient-text" style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{report.cancer_prediction.confidence_percent.toFixed(1)}%</div>
                        <div style={{ color: colors.muted, fontSize: 13, fontWeight: 600 }}>{report.cancer_prediction.genes_matched} gene(s) analyzed</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: colors.muted, marginBottom: 16, fontWeight: 700 }}>Differential Diagnoses</div>
                      {report.cancer_prediction.differential.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <span style={{ width: 140, fontSize: 13, color: i === 0 ? colors.text : colors.muted, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.cancer_name}</span>
                          <ConfidenceBar value={d.probability} color={i === 0 ? colors.accent : "#4A90E2"} />
                          <span style={{ width: 45, fontSize: 13, fontWeight: 800, color: i === 0 ? colors.accent : colors.muted, textAlign: "right" }}>{d.probability.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Symptom Alerts + Key Tests */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {report.symptom_alerts.length > 0 && (
                      <div style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", borderRadius: 20, padding: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#C62828", letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>Clinical Alerts</h3>
                        {report.symptom_alerts.map((a, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 14, color: "#B71C1C", fontWeight: 600 }}>
                            <span>⚠️</span><span>{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="glass-card" style={{ padding: 24, flex: 1 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.accent, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>Recommended Tests</h3>
                      {report.treatment_pathway.key_tests.map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
                          <span style={{ color: "#2E7D32" }}>✓</span>
                          <span style={{ color: colors.text }}>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Drug Recommendations */}
                <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.accent, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>Evidence-Based Drug Insights</h3>
                  <p style={{ fontSize: 14, color: colors.muted, marginBottom: 24, fontWeight: 500 }}>Ranked by composite sensitivity score (IC50 rank × 0.6 + AUC × 0.4). Data sourced from GDSC2 database.</p>
                  {report.drug_recommendations.map((d, i) => <DrugCard key={d.drug} drug={d} idx={i + 1} />)}
                </div>

                {/* Treatment Pathway */}
                <div className="glass-card" style={{ padding: 32, marginBottom: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.accent, letterSpacing: 1, marginBottom: 24, textTransform: "uppercase" }}>Treatment Care Pathway — {report.treatment_pathway.name}</h3>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: "linear-gradient(to bottom, #D4AF37, #E3F2FD)" }} />
                    {report.treatment_pathway.steps.map((step, i) => (
                      <div key={i} onClick={() => setActiveStep(i)} style={{ display: "flex", gap: 24, marginBottom: 20, cursor: "pointer" }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: "50%",
                          background: i <= activeStep ? "linear-gradient(135deg, #D4AF37, #FFD700)" : "#fff",
                          border: i <= activeStep ? "none" : "2px solid #E3F2FD",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          transition: "all 0.3s ease", fontSize: 14, fontWeight: 800, color: i <= activeStep ? "#fff" : colors.muted,
                          boxShadow: i <= activeStep ? "0 4px 10px rgba(212, 175, 55, 0.3)" : "none"
                        }}>
                          {i + 1}
                        </div>
                        <div style={{
                          background: i === activeStep ? "#FFFDE7" : "transparent",
                          border: i === activeStep ? "1px solid #D4AF37" : "1px solid transparent",
                          borderRadius: 16, padding: "14px 20px", flex: 1, transition: "all 0.3s ease"
                        }}>
                          <span style={{ fontSize: 15, color: i === activeStep ? colors.text : colors.muted, lineHeight: 1.6, fontWeight: i === activeStep ? 700 : 500 }}>{step}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#E3F2FD", border: "1px solid #BBDEFB", borderRadius: 16, padding: "16px 24px", fontSize: 14, color: "#1976D2", lineHeight: 1.6, fontWeight: 600 }}>
                  ⚕️ <strong>Clinical Disclaimer:</strong> This AI report is for research and decision-support purposes. It does not replace professional medical diagnosis. Always consult a board-certified oncologist.
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {tab === "chat" && (
          <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto" }}>
            <h2 className="gold-gradient-text" style={{ fontSize: 36, fontWeight: 900, marginBottom: 12 }}>AI Medical Assistant</h2>
            <p style={{ color: colors.muted, marginBottom: 32, fontSize: 18, fontWeight: 500 }}>Your oncology companion for biomarker insights and treatment guidance.</p>
            <div className="glass-card" style={{ padding: 32, height: 650, display: "flex", flexDirection: "column" }}>
              <ChatBot />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ padding: "60px 40px", textAlign: "center", borderTop: `1px solid ${colors.border}`, background: "rgba(255,255,255,0.5)" }}>
        <p style={{ color: colors.muted, fontSize: 14, fontWeight: 600 }}>© 2026 OncoCare Hub · Compassionate Innovation for Cancer Care</p>
      </footer>
    </div>
  );
}
