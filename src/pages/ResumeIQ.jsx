import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import cvsetuaiLogo from "@/assets/cvsetuai_logo.png";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from "recharts";

/* ─────────────────────────────────────────────
   ERROR BOUNDARY — prevents single-component
   crashes from blanking the whole dashboard tab.
───────────────────────────────────────────── */
class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[CVsetuAI] Tab render error:', error, info);
    try { track('dashboard-tab-error', { tab: this.props.tab || 'unknown', message: String(error?.message || error).slice(0, 200) }); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding:'28px 24px', background:'rgba(255,245,240,0.6)', border:'1px solid rgba(184,92,82,0.3)', borderRadius:14, textAlign:'center', fontFamily:"'Jost',sans-serif" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
          <div style={{ fontSize:15, fontWeight:600, color:'#b85c52', marginBottom:6 }}>Couldn't load this section</div>
          <div style={{ fontSize:12, color:'#7a5a3a', marginBottom:14, maxWidth:480, margin:'0 auto 14px' }}>
            {String(this.state.error?.message || 'Unknown error').slice(0, 220)}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); this.props.onReanalyze?.(); }}
            style={{ padding:'8px 18px', borderRadius:20, background:'rgba(176,125,42,0.85)', color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer' }}
          >🔄 Re-analyse Resume</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─────────────────────────────────────────────
   UMAMI ANALYTICS — custom event tracking
   Safe no-op if umami script not yet loaded.
───────────────────────────────────────────── */
function track(event, data) {
  try {
    if (typeof window === 'undefined') return;
    const u = window.umami;
    if (!u) return;
    if (typeof u.track === 'function') {
      data ? u.track(event, data) : u.track(event);
    } else if (typeof u === 'function') {
      data ? u(event, data) : u(event);
    }
  } catch { /* ignore */ }
}

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STREAM_INDUSTRY_ROLE = {
  "MBA (ALL)": {
    "Investment Banking": ["Investment Banking Analyst","Equity Research Analyst"],
    "Private Equity / VC": ["PE Analyst","VC Analyst"],
    "Corporate Finance": ["Financial Analyst","Corporate Finance Analyst","Treasury Analyst"],
    "Banking": ["Credit Risk Analyst","Relationship Manager"],
    "FinTech": ["Product Analyst","Risk Analyst"],
    "Consulting": ["Consultant","Associate Consultant","Business Analyst","Strategy Analyst","Transformation Analyst"],
    "Marketing & Sales": ["Brand Manager","Growth Manager","Performance Marketer","Digital Marketing Specialist","Sales Manager","Key Account Manager"],
    "E-commerce": ["Category Manager","Product Marketing Manager"],
    "Operations & Supply Chain": ["Operations Manager","Supply Chain Analyst","Logistics Manager","Procurement Manager","Warehouse Manager"],
    "Human Resources": ["HR Generalist","HRBP","Talent Acquisition Specialist","L&D Specialist","Compensation & Benefits Analyst"],
    "Product Management": ["Product Manager","Associate Product Manager","Senior Product Manager","Group Product Manager"],
  },
  "Engineering / Technology": {
    "Technology / Product": ["Software Engineer","Backend Developer","Frontend Developer","Full Stack Developer","Product Manager","Associate Product Manager"],
    "Data / AI / ML": ["Data Scientist","Data Analyst","Machine Learning Engineer"],
    "Cloud / DevOps": ["DevOps Engineer","Cloud Engineer"],
    "Cybersecurity": ["Cybersecurity Analyst"],
    "IT Services": ["Software Developer","QA Engineer","SDET"],
  },
  "MBA - Finance": {
    "Investment Banking": ["Investment Banking Analyst"],
    "Asset Management": ["Equity Research Analyst","Wealth Manager"],
    "Corporate Finance": ["Financial Analyst","Corporate Finance Analyst","Treasury Analyst"],
    "Banking": ["Credit Risk Analyst"],
    "FinTech": ["Risk Analyst"],
    "Insurance": ["Risk Analyst"],
  },
  "MBA - Consulting / Strategy": {
    "Consulting": ["Consultant","Associate Consultant","Business Analyst"],
    "Strategy": ["Strategy Analyst","Corporate Strategy Associate"],
    "Public Policy": ["Policy Analyst"],
    "Corporate Strategy": ["Strategy Analyst"],
  },
  "MBA - Marketing / Sales": {
    "FMCG": ["Brand Manager","Sales Manager"],
    "Digital Marketing": ["Digital Marketing Specialist","Performance Marketer","Growth Manager"],
    "E-commerce": ["Category Manager"],
    "Advertising / Media": ["Media Planner","Account Manager"],
    "Consumer Tech": ["Product Marketing Manager"],
  },
  "MBA - Operations / Supply Chain": {
    "Manufacturing": ["Operations Manager"],
    "Logistics": ["Logistics Manager"],
    "Supply Chain": ["Supply Chain Analyst","Procurement Manager"],
    "Retail": ["Inventory Planner","Warehouse Manager"],
  },
  "MBA - HR": {
    "Human Resources": ["HR Generalist","Talent Acquisition Specialist","HRBP","L&D Specialist","Compensation & Benefits Analyst"],
  },
  "MBA - Product Management": {
    "Technology / SaaS": ["Product Manager","Associate Product Manager","Senior Product Manager","Group Product Manager"],
    "E-commerce": ["Product Manager","Associate Product Manager"],
    "FinTech": ["Product Manager","Associate Product Manager"],
    "HealthTech": ["Product Manager"],
    "EdTech": ["Product Manager","Associate Product Manager"],
    "Consumer Tech": ["Product Manager","Senior Product Manager","Group Product Manager"],
    "B2B / Enterprise": ["Product Manager","Senior Product Manager","Group Product Manager"],
    "Platform / Marketplace": ["Product Manager","Senior Product Manager"],
  },
  "Commerce (B.Com / CA / CFA)": {
    "Accounting / Audit": ["Accountant","Auditor","Tax Consultant"],
    "Finance": ["Financial Analyst","Credit Analyst"],
    "Consulting": ["Business Analyst"],
  },
  "Law": {
    "Corporate Law": ["Legal Associate","Corporate Lawyer"],
    "Compliance": ["Compliance Officer"],
    "Legal Consulting": ["Contract Analyst"],
    "Public Policy": ["Policy Analyst"],
  },
  "Science": {
    "Research": ["Research Analyst","Lab Scientist"],
    "Healthcare / Pharma": ["Clinical Research Associate"],
    "Data Science": ["Data Analyst"],
  },
  "Medical / Healthcare": {
    "Hospitals": ["Doctor","Medical Officer"],
    "Healthcare Consulting": ["Healthcare Consultant"],
    "HealthTech": ["Product Manager"],
    "Administration": ["Hospital Administrator"],
  },
  "Design / Creative": {
    "UI / UX": ["UI Designer","UX Designer","Product Designer"],
    "Creative": ["Graphic Designer","Creative Strategist"],
    "Media": ["Visual Designer"],
  },
  "Arts / Humanities": {
    "Content / Media": ["Content Writer","Editor","Journalist"],
    "Policy / Research": ["Policy Analyst","Research Associate"],
    "Education": ["Academic Researcher"],
  },
  "Government / Public Policy": {
    "Government": ["Program Manager"],
    "Think Tanks / NGOs": ["Policy Analyst","Development Consultant"],
    "Consulting": ["Government Consultant"],
  },
};

// Legacy flat arrays kept for backward compat (AI prompts still use industry/role strings)
const INDUSTRIES = [...new Set(Object.values(STREAM_INDUSTRY_ROLE).flatMap(ind => Object.keys(ind)))].sort();
const ROLES = [...new Set(Object.values(STREAM_INDUSTRY_ROLE).flatMap(ind => Object.values(ind).flat()))].sort();

/* ─────────────────────────────────────────────
   DESIGN TOKENS — Classical Light + Glassmorphism
───────────────────────────────────────────── */
const T = {
  // Backgrounds
  bg:        'linear-gradient(145deg, #FDF8F0 0%, #F7EDDA 40%, #EDE3D0 100%)',
  bgSolid:   '#FAF5EC',
  glass:     'rgba(255,255,255,0.62)',
  glass2:    'rgba(255,255,255,0.42)',
  glassDeep: 'rgba(255,255,255,0.80)',
  // Borders
  border:    'rgba(195,165,110,0.30)',
  border2:   'rgba(195,165,110,0.55)',
  borderHard:'rgba(195,165,110,0.75)',
  // Accents
  gold:      '#B07D2A',
  goldLight: '#D4A850',
  goldBg:    'rgba(176,125,42,0.10)',
  sage:      '#4C8A72',
  sageBg:    'rgba(76,138,114,0.10)',
  rose:      '#B85C52',
  roseBg:    'rgba(184,92,82,0.10)',
  blue:      '#4A709C',
  blueBg:    'rgba(74,112,156,0.10)',
  // Text
  text:      '#2A1D08',
  muted:     '#7A6B52',
  dim:       '#B5A48C',
  // Semantic
  ok:        '#4C8A72',
  warn:      '#B07D2A',
  danger:    '#B85C52',
  // Shadows
  shadow:    '0 8px 32px rgba(140,105,50,0.12)',
  shadowLg:  '0 20px 60px rgba(140,105,50,0.18)',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Jost:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #FAF5EC; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: rgba(195,165,110,0.1); }
  ::-webkit-scrollbar-thumb { background: rgba(195,165,110,0.4); border-radius: 3px; }
  ::placeholder { color: #B5A48C !important; }
  select option { background: #FAF5EC; color: #2A1D08; }

  @keyframes fadeUp    { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
  @keyframes floatY    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes pulse     { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.9;transform:scale(1.07)} }
  @keyframes spin      { to { transform: rotate(360deg); } }
  @keyframes shimmerBg { 0%{background-position:200% center} 100%{background-position:-200% center} }
  .btn-create-scratch {
    background: linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(212,168,80,0.18) 25%, rgba(176,125,42,0.25) 50%, rgba(212,168,80,0.18) 75%, rgba(255,255,255,0.55) 100%);
    background-size: 200% 100%;
    animation: shimmerBg 3s ease-in-out infinite;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(195,165,110,0.45);
    border-radius: 10px;
    color: #5A4520;
    font-family: 'Jost', sans-serif;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  .btn-create-scratch:hover {
    background-size: 200% 100%;
    border-color: rgba(176,125,42,0.7);
    color: #2A1D08;
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(176,125,42,0.3);
  }
  @keyframes spinRev   { to { transform: rotate(-360deg); } }
  @keyframes blink     { 0%,100%{opacity:.2} 50%{opacity:1} }
  @keyframes shimmer   { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
  @keyframes orb1      { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-20px) scale(1.08)} }
  @keyframes orb2      { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,30px) scale(1.05)} }
  @keyframes orb3      { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(15px,15px) scale(1.06)} }
  @keyframes progressBar { from{width:0%} to{width:100%} }
  @keyframes dotBounce  { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-12px);opacity:1} }
  @keyframes particleRise { 0%{transform:translateY(0) scale(1);opacity:1} 100%{transform:translateY(-80px) scale(0);opacity:0} }
  @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes typewriter { from{width:0} to{width:100%} }
  @keyframes stepPulse  { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(176,125,42,0.4)} 50%{transform:scale(1.12);box-shadow:0 0 0 8px rgba(176,125,42,0)} }
  @keyframes lineGrow   { from{width:0;opacity:0} to{width:100%;opacity:1} }
  @keyframes wordShimmer { 0%{transform:translateX(-100%)} 60%,100%{transform:translateX(200%)} }
  @keyframes wordBtnPulse { 0%,100%{box-shadow:0 4px 18px rgba(46,91,140,0.40)} 50%{box-shadow:0 4px 26px rgba(46,91,140,0.65),0 0 0 4px rgba(74,134,204,0.18)} }
  @keyframes promptShimmer { 0%{transform:translateX(-100%) skewX(-15deg)} 100%{transform:translateX(300%) skewX(-15deg)} }
  @keyframes promptPulseRing { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.55);opacity:0} }
  @keyframes promptBounceIcon { 0%,100%{transform:translateY(0) rotate(0deg)} 30%{transform:translateY(-3px) rotate(-8deg)} 60%{transform:translateY(-1px) rotate(4deg)} }
  @keyframes checkPop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.2) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
  @keyframes successRipple { 0%{transform:scale(0.8);opacity:1} 100%{transform:scale(2.2);opacity:0} }

  .glass-card {
    background: rgba(255,255,255,0.62);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(195,165,110,0.30);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(140,105,50,0.10), inset 0 1px 0 rgba(255,255,255,0.8);
  }
  .glass-card-deep {
    background: rgba(255,255,255,0.80);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(195,165,110,0.40);
    border-radius: 20px;
    box-shadow: 0 12px 40px rgba(140,105,50,0.14), inset 0 1px 0 rgba(255,255,255,0.9);
  }
  .btn-primary {
    background: linear-gradient(135deg, #B07D2A, #D4A850);
    border: none; border-radius: 12px; color: #fff;
    font-family: 'Jost', sans-serif; font-weight: 600; cursor: pointer;
    box-shadow: 0 6px 24px rgba(176,125,42,0.35);
    transition: all 0.25s ease;
  }
  .btn-primary:hover { transform:translateY(-2px); box-shadow: 0 10px 32px rgba(176,125,42,0.45); }
  .btn-ghost {
    background: rgba(255,255,255,0.55); backdrop-filter:blur(10px);
    border: 1px solid rgba(195,165,110,0.35); border-radius: 10px;
    color: #7A6B52; font-family:'Jost',sans-serif; font-weight:500; cursor:pointer;
    transition: all 0.2s ease;
  }
  .btn-ghost:hover { background:rgba(255,255,255,0.8); border-color:rgba(195,165,110,0.6); color:#2A1D08; }
  .tab-btn { border:none; background:none; cursor:pointer; font-family:'Jost',sans-serif; transition:all .2s; }
  .tab-btn:hover { color: #B07D2A; }
  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hover-lift:hover { transform:translateY(-3px); box-shadow: 0 14px 40px rgba(140,105,50,0.18); }

  /* ── RESPONSIVE — Tablet (≤900px) ───────────────── */
  @media (max-width: 900px) {
    .riq-hero-grid   { grid-template-columns: 1fr !important; }
    .riq-2col        { grid-template-columns: 1fr !important; }
    .riq-3col        { grid-template-columns: 1fr 1fr !important; }
    .riq-4col        { grid-template-columns: 1fr 1fr !important; }
    .riq-stats-strip { grid-template-columns: 1fr 1fr !important; }
    .riq-upload-grid { grid-template-columns: 1fr !important; }
    .riq-recruiter-grid { grid-template-columns: repeat(3,1fr) !important; }
    .riq-jd-grid     { grid-template-columns: 1fr !important; }
    .riq-top3        { grid-template-columns: 1fr 1fr !important; }
    .riq-tabs        { gap: 4px !important; flex-wrap: wrap !important; }
    .riq-tab-btn     { font-size: 12px !important; padding: 7px 11px !important; }
    nav              { padding: 14px 20px !important; }
    .riq-nav-right   { gap: 6px !important; }
    .riq-nav-badge   { display: none !important; }
    .riq-top-bar     { padding: 10px 16px !important; }
  }

  /* ── RESPONSIVE — Mobile (≤600px) ───────────────── */
  @media (max-width: 600px) {
    .riq-hero-title  { font-size: clamp(26px,7vw,42px) !important; }
    .riq-hero-pad    { padding: 48px 18px 36px !important; }
    .riq-section-pad { padding: 0 16px 60px !important; }
    .riq-stats-strip { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .riq-4col        { grid-template-columns: 1fr 1fr !important; }
    .riq-3col        { grid-template-columns: 1fr !important; }
    .riq-2col        { grid-template-columns: 1fr !important; }
    .riq-top3        { grid-template-columns: 1fr !important; }
    .riq-jd-grid     { grid-template-columns: 1fr !important; }
    .riq-recruiter-grid { grid-template-columns: repeat(2,1fr) !important; }
    .riq-feat-grid   { grid-template-columns: 1fr !important; }
    .riq-hero-btns   { flex-direction: column !important; align-items: stretch !important; }
    .riq-hero-btns button { text-align: center !important; }
    .riq-radar-grid  { grid-template-columns: 1fr !important; }
    .riq-lb-grid     { grid-template-columns: 1fr !important; }
    .riq-upload-options { grid-template-columns: 1fr !important; }
    .riq-candidate-bar { flex-wrap: wrap !important; gap: 6px !important; }
    .riq-top-bar     { padding: 8px 12px !important; gap: 6px !important; }
    .riq-top-bar .riq-cand-info { display: none !important; }
    .riq-tabs        { gap: 3px !important; padding: 8px 12px !important; overflow-x: auto !important; flex-wrap: nowrap !important; }
    .riq-tab-btn     { font-size: 11px !important; padding: 6px 9px !important; white-space: nowrap !important; }
    .riq-score-gauge { transform: scale(0.85) !important; transform-origin: center !important; }
    .riq-results-pad { padding: 12px 14px !important; }
    .hover-lift:hover { transform: none !important; }
    .riq-annot-tooltip { width: 300px !important; max-width: 92vw !important; }
    .riq-chat-height { height: 480px !important; }
    nav              { padding: 12px 16px !important; }
    .riq-nav-badge   { display: none !important; }
    .riq-stat-num    { font-size: 18px !important; }
    .riq-page-title  { font-size: clamp(22px,5vw,32px) !important; }
    /* Tighter content top padding on mobile since top bar is shorter */
    [data-riq-content] { padding-top: 104px !important; }
  }

  /* ── Extra small (≤400px) ───────────────────────── */
  @media (max-width: 400px) {
    .riq-tab-btn     { font-size: 10px !important; padding: 5px 7px !important; }
    .riq-stats-strip { grid-template-columns: 1fr 1fr !important; }
    .riq-2col        { grid-template-columns: 1fr !important; }
    .riq-recruiter-grid { grid-template-columns: 1fr 1fr !important; }
  }

  .riq-orb-container { position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden; }
  .riq-grain { position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");opacity:0.6; }
`;



/* ── CSS Singleton ── inject once into <head>, never re-inject on re-renders */
let _cssInjected = false;
function injectGlobalCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const el = document.createElement('style');
  el.setAttribute('data-riq', '1');
  el.textContent = GLOBAL_CSS;
  document.head.appendChild(el);
}
const scoreColor = s => s >= 80 ? T.ok : s >= 60 ? T.warn : T.danger;
const scoreBg    = s => s >= 80 ? T.sageBg : s >= 60 ? T.goldBg : T.roseBg;
const scoreLabel = s => s >= 80 ? 'Excellent' : s >= 70 ? 'Good' : s >= 60 ? 'Fair' : 'Needs Work';

/* Counts every dash/hyphen variant (–, —, ‒, −, etc.) as exactly 1 char,
   matching the same rule used in the AI prompt. */
function effectiveLength(str) {
  return (str || '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .length;
}

/* Returns true for lines that should be hidden from Line-by-Line Analysis:
   education grade/score rows, skill keyword lists, coursework lists, etc. */
function isSkippableSection(section, original) {
  const s   = (section || '').toLowerCase();
  const raw = (original || '').trim();
  if (/key\s*course|coursework|course\s*work/.test(s)) return true;
  if (/skills?/.test(s) && !/work\s*exp|experience/.test(s)) return true;
  if (/education|academic/.test(s)) {
    if (/^\d[\d.\s\/]+(\s*(cgpa|gpa|%|grade|class|honours?))?$/i.test(raw)) return true;
    if (/^\d{4}\s*[-–—]\s*\d{2,4}$/.test(raw)) return true;
  }
  if (/^\d+\.?\d*\s*[\/]\s*\d+\.?\d*$/.test(raw)) return true;
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{4}\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\.?\s*\d{2,4}$/.test(raw)) return true;
  if (raw.length < 60 && (raw.match(/,/g)||[]).length >= 2) {
    const words = raw.split(/[\s,]+/).filter(Boolean);
    if (words.filter(w => w.length <= 15).length / words.length > 0.85 && words.length <= 10) return true;
  }
  return false;
}


/* ── pdf.js lazy loader — loads once, returns cached promise ── */
let _pdfjsPromise = null;
function ensurePdfJs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  if (window.pdfjsLib) { _pdfjsPromise = Promise.resolve(); return _pdfjsPromise; }
  _pdfjsPromise = new Promise((res, rej) => {
    const el = Object.assign(document.createElement('script'), {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      onload: () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        res();
      },
      onerror: rej,
    });
    document.head.appendChild(el);
  });
  return _pdfjsPromise;
}

/* ─────────────────────────────────────────────
   PDF EXTRACTION
───────────────────────────────────────────── */
async function extractPDFText(file) {
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i);
    const ct   = await page.getTextContent();
    out += ct.items.map(x => x.str).join(' ') + '\n';
  }
  return out.trim();
}


/* ── JSON extraction helper — module-level (no re-creation per call) ── */
function extractJSON(str) {
  let s = str.replace(/\`\`\`(?:json)?\n?/g, '').replace(/\n?\`\`\`/g, '').trim();
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('Could not locate JSON in response.');
  return s.slice(start, end + 1);
}

/* ─────────────────────────────────────────────
   AI API — ANALYSIS (via Lovable Cloud Edge Function)
   with Load Balancer: retry, concurrency limit, queue
───────────────────────────────────────────── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/* ── Request Queue & Concurrency Limiter ──────────────────────── */
const MAX_CONCURRENT = 3;          // max simultaneous API calls
const MAX_RETRIES = 3;             // retry on 429 / 5xx / network
const BASE_DELAY_MS = 1500;        // exponential backoff base
let _activeRequests = 0;
const _requestQueue = [];

function _processQueue() {
  while (_requestQueue.length > 0 && _activeRequests < MAX_CONCURRENT) {
    const { resolve, reject, fn } = _requestQueue.shift();
    _activeRequests++;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => { _activeRequests--; _processQueue(); });
  }
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    _requestQueue.push({ resolve, reject, fn });
    _processQueue();
  });
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2min timeout
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) return res;

      // Retry on 429 (rate limit) or 5xx (server error)
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = res.headers.get('retry-after');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[LoadBalancer] ${res.status} — retry ${attempt + 1}/${retries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Non-retryable error
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`API error ${res.status}: ${errText.slice(0, 300)}`);
    } catch (err) {
      if (err.name === 'AbortError') {
        if (attempt < retries) {
          console.warn(`[LoadBalancer] Request timeout — retry ${attempt + 1}/${retries}`);
          await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
          continue;
        }
        throw new Error('Request timed out after multiple retries. Please try again.');
      }
      // Network errors — retry
      if (attempt < retries && !err.message.startsWith('API error')) {
        console.warn(`[LoadBalancer] Network error — retry ${attempt + 1}/${retries}:`, err.message);
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}

async function callClaude(userPrompt, maxTokens = 8192) {
  return enqueue(async () => {
    const res = await fetchWithRetry(`${SUPABASE_URL}/functions/v1/resume-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ prompt: userPrompt, maxTokens })
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    const rawText = d.text || '';
    if (!rawText) throw new Error('Empty response from AI. Please try again.');
    console.log('[CVsetuAI] AI response length:', rawText.length, 'finishReason:', d.finishReason);
    
    // Strip markdown code fences if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();
    
    try { return JSON.parse(extractJSON(cleaned)); }
    catch (parseErr) {
      try {
        const partial = extractJSON(cleaned);
        let depth = 0, arrDepth = 0;
        for (const ch of partial) {
          if (ch === '{') depth++; else if (ch === '}') depth--;
          else if (ch === '[') arrDepth++; else if (ch === ']') arrDepth--;
        }
        return JSON.parse(partial + ']'.repeat(Math.max(0,arrDepth)) + '}'.repeat(Math.max(0,depth)));
      } catch { throw new Error(`JSON parse failed. Detail: ${parseErr.message}. Response preview: ${cleaned.slice(0, 200)}`); }
    }
  });
}

/* ─────────────────────────────────────────────
   PARALLEL ANALYSIS — two concurrent API calls
   Call A (~20s): scores, keywords, issues, meta
   Call B (~40s): exhaustive line-by-line rewrites
─────────────────────────────────────────────*/
async function runAnalysis({ resumeText, jdText, industry, role, stream }) {

  // ── Stream-specific role list for Multi-Role ATS Fit ────────────────────
  // Returns ALL candidate roles so we can score every one and then surface
  // the top 10 by calculated score — never pre-slice before scoring.
  function getStreamRoles(streamKey, industryKey) {
    if (!streamKey || !STREAM_INDUSTRY_ROLE[streamKey]) {
      // No stream: return the full generic 12-role set
      return ['Product Manager','Program Manager','Business Analyst','Consultant','Finance',
              'Marketing','Operations','HR','Data Science','Strategy','General Management','Sales'];
    }
    const streamData = STREAM_INDUSTRY_ROLE[streamKey];
    if (industryKey && streamData[industryKey]) {
      // Industry selected → all roles from the stream (primary industry first for AI prompt ordering)
      const primary = streamData[industryKey];
      const others  = Object.values(streamData).flat();
      return [...new Set([...primary, ...others])]; // ALL roles — top 10 chosen AFTER scoring
    }
    // Stream only → all roles from the stream, deduplicated
    return [...new Set(Object.values(streamData).flat())];
  }
  const STREAM_ROLES = getStreamRoles(stream, industry);
  const resumeOnlyCtx = [
    `=== RESUME ===\n${resumeText.slice(0, 12000)}`,
    stream   ? `\nTarget Stream: ${stream}`     : '',
    industry ? `\nTarget Industry: ${industry}` : '',
    role     ? `\nTarget Role: ${role}`         : '',
  ].join('');

  // ── JS-side keyword hit counter (deterministic, never JD-biased) ──────────
  // Used to post-process and correct AI roleScores that deviate too far from
  // what's actually in the resume text.
  const ROLE_KEYWORD_BANKS = {
    'Product Manager':    ['roadmap','product roadmap','PRD','user story','sprint','backlog','OKR','KPI','DAU','MAU','retention','churn','NPS','CSAT','A/B test','go-to-market','GTM','MVP','product-market fit','stakeholder','wireframe','Figma','Jira','Agile','Scrum','Kanban','prioritisation','user research','persona','funnel','conversion','Mixpanel','Amplitude'],
    'Program Manager':    ['program management','PMO','milestone','deliverable','RAID log','risk register','RACI','workstream','governance','status report','change management','stakeholder management','SLA','SOP','process improvement','MS Project','Asana','post-mortem','lessons learned','business case','vendor management'],
    'Business Analyst':   ['requirements','business requirements','BRD','use case','UAT','process mapping','gap analysis','SWOT','root cause','data analysis','SQL','Excel','pivot table','dashboard','Power BI','Tableau','KPI dashboard','stakeholder interview','Visio','BPMN','change request','impact assessment','benchmarking','feasibility study','workflow automation','ERP','SAP','statistical analysis'],
    'Consultant':         ['engagement','client deliverable','workstream','deck','recommendation','hypothesis','MECE','framework','due diligence','market sizing','benchmarking','operating model','value chain','executive presentation','C-suite','proposal','synthesis','storytelling','financial model','scenario analysis','change management','transformation','restructuring'],
    'Finance':            ['P&L','profit and loss','balance sheet','cash flow','EBITDA','revenue','ROI','DCF','NPV','IRR','valuation','financial modelling','LBO','M&A','budgeting','forecasting','variance analysis','FP&A','audit','IFRS','GAAP','treasury','working capital','credit analysis','equity research','capital markets','cost reduction','financial reporting'],
    'Marketing':          ['brand strategy','campaign','digital marketing','SEO','SEM','PPC','email marketing','CRM','content strategy','social media','lead generation','demand generation','conversion rate','CTR','ROAS','CAC','LTV','market research','segmentation','positioning','GTM','product launch','A/B testing','attribution'],
    'Operations':         ['process improvement','Lean','Six Sigma','DMAIC','SOP','supply chain','logistics','procurement','vendor management','inventory management','ERP','SAP','SLA','KPI','cost reduction','quality management','ISO','compliance','root cause analysis','automation','RPA','workforce planning'],
    'HR':                 ['talent acquisition','recruitment','onboarding','employee experience','HRBP','L&D','performance management','OKR','succession planning','talent management','culture','engagement','DEI','HRIS','Workday','payroll','compensation','employment law','HR analytics','people analytics','employer branding','EVP'],
    'Data Science':       ['Python','R','SQL','machine learning','ML','deep learning','NLP','classification','regression','clustering','XGBoost','TensorFlow','PyTorch','scikit-learn','pandas','NumPy','Spark','Databricks','Snowflake','BigQuery','ETL','feature engineering','MLOps','A/B testing','statistical analysis','Tableau','Power BI','data pipeline','data warehouse'],
    'Strategy':           ['strategic planning','corporate strategy','business strategy','strategic roadmap','market entry','competitive analysis','scenario planning','investment thesis','portfolio strategy','capital allocation','M&A strategy','revenue growth','value creation','operating model','business model','pricing strategy','go-to-market','P&L ownership','board presentation','transformation','digital transformation','OKR','KPI design'],
    'General Management': ['P&L ownership','P&L management','revenue growth','EBITDA','team leadership','general manager','managing director','business unit','cross-functional','operational excellence','strategic planning','board reporting','organisational design','restructuring','transformation','culture change','talent development','C-suite','stakeholder management','risk management','governance','mergers','acquisitions'],
    'Sales':              ['quota','revenue target','ARR','MRR','pipeline','CRM','Salesforce','prospecting','account executive','account management','enterprise sales','SaaS sales','solution selling','MEDDIC','closing','negotiation','proposal','RFP','win rate','conversion rate','customer acquisition','CAC','LTV','upsell','cross-sell','renewal','churn','sales enablement'],
    // ── Stream-specific roles ────────────────────────────────────────────────
    'Investment Banking Analyst': ['M&A','LBO','DCF','valuation','pitch book','financial model','deal','capital markets','IPO','equity','debt','due diligence','investment banking','bulge bracket','syndication','leveraged finance','Bloomberg','FactSet','roadshow','tombstone','fairness opinion'],
    'Equity Research Analyst':    ['equity research','stock','analyst report','earnings','EPS','P/E','target price','valuation','buy/sell/hold','sector analysis','financial model','DCF','Bloomberg','FactSet','investment thesis','industry analysis','company analysis','forecast','revenue model'],
    'PE Analyst':                 ['private equity','LBO','portfolio company','due diligence','value creation','EBITDA','IRR','capital structure','deal flow','investment memo','M&A','operating improvement','exit','fund','management consulting'],
    'VC Analyst':                 ['venture capital','startup','due diligence','term sheet','cap table','portfolio','seed','Series A','SaaS metrics','ARR','MRR','growth','market sizing','investment thesis','pitch deck','founder','deal flow'],
    'Financial Analyst':          ['financial analysis','P&L','budgeting','forecasting','variance analysis','FP&A','financial modelling','Excel','financial reporting','KPI','dashboard','management accounts','cost analysis','ROI','DCF'],
    'Corporate Finance Analyst':  ['corporate finance','capital structure','M&A','treasury','funding','WACC','NPV','IRR','financial modelling','board reporting','investor relations','cash management','debt','equity'],
    'Treasury Analyst':           ['treasury','cash management','liquidity','FX','hedging','derivatives','cash flow','working capital','bank relationships','covenant','debt','funding','interest rate','currency risk'],
    'Credit Risk Analyst':        ['credit risk','credit analysis','credit scoring','loan','default','probability of default','PD','LGD','EAD','Basel','risk rating','credit policy','underwriting','portfolio management','NPL'],
    'Relationship Manager':       ['relationship management','client relationship','portfolio','cross-sell','upsell','business development','banking','NPS','revenue target','account management','KYC','AML','compliance'],
    'Product Analyst':            ['product analytics','funnel','retention','DAU','MAU','cohort','A/B test','data analysis','SQL','Python','Mixpanel','Amplitude','user journey','growth','feature adoption'],
    'Risk Analyst':               ['risk management','risk assessment','risk framework','operational risk','market risk','credit risk','compliance','Basel','regulatory','VaR','stress testing','scenario analysis','risk reporting'],
    'Associate Consultant':       ['consulting','deck','recommendation','MECE','framework','hypothesis','issue tree','client','workstream','analysis','benchmarking','stakeholder','slide','structured thinking'],
    'Strategy Analyst':           ['strategy','strategic planning','competitive analysis','market entry','business case','scenario planning','framework','recommendation','OKR','roadmap','growth strategy','M&A'],
    'Transformation Analyst':     ['transformation','change management','process improvement','digital transformation','operating model','agile','programme management','stakeholder','benefits realisation','workstream'],
    'Brand Manager':              ['brand strategy','brand equity','brand P&L','campaign','consumer insights','ATL','BTL','NPD','launch','market share','positioning','brand guidelines','agency management','GTM'],
    'Growth Manager':             ['growth hacking','user acquisition','CAC','LTV','retention','A/B testing','funnel','conversion','digital marketing','paid acquisition','SEO','referral','viral loop','DAU','MAU'],
    'Performance Marketer':       ['performance marketing','PPC','Google Ads','Meta Ads','ROAS','CTR','CPC','CPM','paid social','programmatic','attribution','conversion rate','A/B testing','campaign optimisation'],
    'Digital Marketing Specialist':['SEO','SEM','content marketing','social media','email marketing','CRM','HubSpot','Google Analytics','campaign','CTR','conversion','engagement','paid media','organic'],
    'Sales Manager':              ['sales management','quota','revenue','pipeline','team leadership','coaching','CRM','Salesforce','territory','account','B2B','enterprise','forecast','win rate','KPI'],
    'Key Account Manager':        ['key account','account management','strategic account','relationship','P&L','cross-sell','upsell','revenue growth','customer success','renewal','contract','negotiation','stakeholder'],
    'Category Manager':           ['category management','assortment','planogram','range','pricing','supplier','negotiation','market share','sell-through','P&L','buying','merchandising','trade terms'],
    'Product Marketing Manager':  ['product marketing','GTM','launch','positioning','messaging','competitive intelligence','sales enablement','demand generation','customer insights','content','pricing'],
    'Operations Manager':         ['operations management','P&L','team leadership','SOP','process improvement','KPI','efficiency','cost reduction','capacity planning','quality','compliance','workforce'],
    'Supply Chain Analyst':       ['supply chain','demand planning','inventory','procurement','logistics','ERP','SAP','S&OP','supplier','lead time','cost optimisation','data analysis'],
    'Logistics Manager':          ['logistics','distribution','last-mile','3PL','warehouse','freight','cost per unit','SLA','carrier management','route optimisation','customs'],
    'Procurement Manager':        ['procurement','sourcing','supplier management','contract negotiation','cost savings','spend analysis','RFQ','tender','vendor','category strategy','SAP Ariba'],
    'Warehouse Manager':          ['warehouse','inventory','WMS','picking','packing','dispatch','SLA','capacity','health and safety','cost','team management','KPI'],
    'HR Generalist':              ['HR generalist','employee relations','onboarding','offboarding','payroll','recruitment','performance management','policy','compliance','HRIS','Workday'],
    'HRBP':                       ['HR business partner','HRBP','organisational design','talent management','employee relations','performance','succession','change management','stakeholder','analytics'],
    'Talent Acquisition Specialist':['talent acquisition','recruitment','sourcing','ATS','LinkedIn','Boolean','pipeline','offer','employer branding','candidate experience','headhunting','assessment'],
    'L&D Specialist':             ['learning and development','L&D','training','e-learning','LMS','curriculum design','facilitation','skills gap','capability building','coaching','onboarding'],
    'Compensation & Benefits Analyst':['compensation','benefits','benchmarking','job evaluation','grading','pay review','total rewards','salary','bonus','equity','benefits administration','analytics'],
    'Software Engineer':          ['Python','Java','JavaScript','TypeScript','React','Node.js','REST API','microservices','SQL','NoSQL','Git','CI/CD','Docker','Kubernetes','AWS','GCP','Azure','system design','code review','Agile','Scrum'],
    'Backend Developer':          ['Python','Java','Go','Node.js','REST API','GraphQL','microservices','SQL','PostgreSQL','Redis','Kafka','Docker','Kubernetes','AWS','GCP','CI/CD','system design','scalability'],
    'Frontend Developer':         ['JavaScript','TypeScript','React','Vue','Angular','HTML','CSS','responsive design','REST API','GraphQL','Git','Webpack','performance optimisation','accessibility','testing'],
    'Full Stack Developer':       ['JavaScript','TypeScript','React','Node.js','Python','REST API','SQL','NoSQL','Docker','AWS','Git','CI/CD','system design','frontend','backend','full stack'],
    'Associate Product Manager':  ['product roadmap','user story','PRD','A/B test','KPI','OKR','Jira','Agile','Scrum','user research','wireframe','Figma','prioritisation','stakeholder','backlog'],
    'Data Scientist':             ['Python','R','SQL','machine learning','deep learning','NLP','statistics','A/B testing','model','feature engineering','Pandas','NumPy','scikit-learn','TensorFlow','data pipeline'],
    'Data Analyst':               ['SQL','Python','Excel','Power BI','Tableau','data visualisation','dashboard','A/B testing','statistical analysis','reporting','KPI','metrics','data cleaning','insight'],
    'Machine Learning Engineer':  ['machine learning','Python','TensorFlow','PyTorch','MLOps','model deployment','feature engineering','deep learning','Kubernetes','Docker','Spark','data pipeline','GPU'],
    'DevOps Engineer':            ['DevOps','CI/CD','Jenkins','GitHub Actions','Docker','Kubernetes','Terraform','AWS','GCP','Azure','infrastructure as code','monitoring','Prometheus','Grafana','Linux'],
    'Cloud Engineer':             ['AWS','GCP','Azure','cloud architecture','Terraform','infrastructure as code','Kubernetes','Docker','networking','security','cost optimisation','migration','microservices'],
    'Cybersecurity Analyst':      ['cybersecurity','SIEM','SOC','threat intelligence','incident response','vulnerability assessment','penetration testing','ISO 27001','NIST','firewall','IDS/IPS','CISSP','CEH'],
    'Software Developer':         ['Java','Python','C++','C#','.NET','REST API','SQL','Git','Agile','unit testing','code review','debugging','object-oriented','design patterns','CI/CD'],
    'QA Engineer':                ['QA','quality assurance','test plan','test case','automation testing','Selenium','Cypress','API testing','regression testing','bug tracking','Jira','Agile','defect'],
    'SDET':                       ['SDET','test automation','Selenium','Python','Java','CI/CD','Jenkins','API testing','performance testing','BDD','TDD','framework','regression','code review'],
    'Accountant':                 ['accounting','bookkeeping','balance sheet','P&L','general ledger','IFRS','GAAP','audit','tax','reconciliation','Tally','SAP','QuickBooks','month-end','financial statements'],
    'Auditor':                    ['audit','internal audit','external audit','risk assessment','controls','IFRS','GAAP','compliance','working papers','findings','management letter','SOX','substantive testing'],
    'Tax Consultant':             ['tax','direct tax','indirect tax','GST','VAT','income tax','transfer pricing','tax planning','compliance','filing','CBDT','tax advisory','tax audit'],
    'Credit Analyst':             ['credit analysis','credit risk','financial statements','ratio analysis','loan','underwriting','credit memo','PD','LGD','portfolio','covenant','default','credit scoring'],
    'Legal Associate':            ['legal research','drafting','contracts','due diligence','litigation','corporate law','compliance','regulatory','court','pleadings','negotiation','client advisory'],
    'Corporate Lawyer':           ['corporate law','M&A','due diligence','contracts','shareholder','regulatory','compliance','board','legal advisory','negotiation','drafting','company law'],
    'Compliance Officer':         ['compliance','regulatory','AML','KYC','GDPR','risk assessment','policy','audit','monitoring','reporting','SEBI','RBI','FCA','training'],
    'Contract Analyst':           ['contract management','drafting','negotiation','review','compliance','risk','SLA','vendor','procurement','legal','CLM','contract lifecycle'],
    'Policy Analyst':             ['policy analysis','research','policy brief','stakeholder','regulatory','government','public policy','impact assessment','advocacy','legislation','data analysis'],
    'Research Analyst':           ['research','analysis','report','methodology','data collection','literature review','quantitative','qualitative','insight','publication','findings','recommendation'],
    'Lab Scientist':              ['laboratory','research','experiment','data collection','analysis','protocol','safety','instrumentation','HPLC','PCR','cell culture','scientific writing'],
    'Clinical Research Associate':['clinical trials','GCP','ICH','protocol','monitoring','site management','data collection','adverse events','regulatory','CRO','FDA','IRB','patient safety'],
    'Doctor':                     ['clinical','diagnosis','treatment','patient care','ward','outpatient','surgery','prescription','medical records','EMR','audit','research','CPD'],
    'Medical Officer':            ['medical officer','clinical','patient management','ward rounds','emergency','protocols','audit','referral','diagnosis','treatment','public health'],
    'Healthcare Consultant':      ['healthcare','clinical','strategy','operations','process improvement','stakeholder','NHS','hospital','patient pathway','data analysis','project management'],
    'Hospital Administrator':     ['hospital administration','operations','budget','staffing','compliance','JCI','NABH','patient experience','quality','KPI','procurement','vendor'],
    'UI Designer':                ['UI design','Figma','Sketch','Adobe XD','wireframe','prototype','visual design','typography','colour','layout','design system','component','responsive'],
    'UX Designer':                ['UX design','user research','usability testing','wireframe','prototype','Figma','user journey','persona','information architecture','A/B testing','accessibility','design thinking'],
    'Product Designer':           ['product design','Figma','UX','UI','user research','prototype','design system','Agile','cross-functional','stakeholder','end-to-end design','accessibility'],
    'Graphic Designer':           ['graphic design','Adobe Illustrator','Photoshop','InDesign','branding','typography','layout','print','digital','campaign','visual identity','colour theory'],
    'Creative Strategist':        ['creative strategy','brand','campaign','ideation','storytelling','content','digital','social media','consumer insight','creative brief','copy','concept'],
    'Visual Designer':            ['visual design','Figma','Adobe Creative Suite','motion graphics','after effects','typography','layout','brand guidelines','digital','print','illustration'],
    'Content Writer':             ['content writing','copywriting','SEO','editorial','blog','article','content strategy','editing','research','tone of voice','CMS','WordPress','audience'],
    'Editor':                     ['editing','proofreading','copy editing','content strategy','editorial calendar','fact-checking','style guide','CMS','publishing','commissioning','subediting'],
    'Journalist':                 ['journalism','reporting','news','feature writing','investigative','sources','deadline','editorial','multimedia','digital','broadcast','press','accuracy'],
    'Research Associate':         ['research','data collection','analysis','literature review','methodology','report','publication','quantitative','qualitative','stakeholder','insight'],
    'Academic Researcher':        ['research','methodology','publication','peer review','data analysis','grant','literature review','conference','thesis','SPSS','R','quantitative','qualitative'],
    'Program Manager':            ['program management','PMO','milestone','deliverable','RAID log','risk register','RACI','workstream','governance','status report','change management','stakeholder management','SLA','SOP','process improvement'],
    'Development Consultant':     ['development','NGO','donor','project management','M&E','stakeholder','community','capacity building','reporting','grant','implementation','impact assessment'],
    'Government Consultant':      ['government','public sector','policy','stakeholder','regulatory','project management','procurement','compliance','strategy','reporting','change management'],
    'Inventory Planner':          ['inventory planning','demand forecasting','stock management','replenishment','ERP','Excel','S&OP','lead time','service level','cost','supplier','data analysis'],
    'Wealth Manager':             ['wealth management','HNI','portfolio','investment advisory','financial planning','asset allocation','equities','fixed income','AUM','client relationship','regulatory'],
    'Corporate Strategy Associate':['corporate strategy','strategic planning','M&A','competitive analysis','market entry','business case','scenario planning','financial model','board presentation','OKR'],
    'Senior Product Manager':     ['roadmap','product strategy','P&L','revenue','OKR','KPI','stakeholder management','cross-functional','go-to-market','GTM','product-market fit','A/B test','experimentation','sprint planning','backlog','PRD','user research','retention','NPS','CSAT','DAU','MAU','churn','conversion','funnel','Figma','Jira','Agile','Scrum','data-driven','Mixpanel','Amplitude','platform','API','integration','product vision','executive presentation','roadmap prioritisation','feature adoption','competitive analysis','pricing strategy','customer segmentation','growth strategy','product analytics','cohort analysis','monetisation'],
    'Group Product Manager':      ['product strategy','product portfolio','P&L ownership','revenue growth','team leadership','product vision','OKR','KPI','go-to-market','GTM','cross-functional leadership','stakeholder management','executive communication','roadmap','strategic planning','competitive analysis','market entry','platform strategy','API strategy','data strategy','A/B testing','experimentation','user research','customer insight','pricing','monetisation','growth','retention','acquisition','product org','hiring','mentoring','product operations','agile transformation','product culture','board presentation','investor communication'],
  };

  const resumeLower = resumeText.toLowerCase();
  function countKeywordHits(roleKey) {
    const bank = ROLE_KEYWORD_BANKS[roleKey] || [];
    return bank.filter(kw => resumeLower.includes(kw.toLowerCase())).length;
  }

  // ── Deterministic keyword & skill extraction from resume text ─────────────
  // These are always computed in JS — never rely on the AI for these fields,
  // since the AI often returns empty arrays when token budget is tight.

  const KEYWORD_BANK = [
    // Strategy & Business
    'revenue growth','market share','P&L','EBITDA','ROI','KPI','OKR','go-to-market','GTM',
    'business strategy','strategic planning','competitive analysis','market sizing','TAM',
    'pricing strategy','operating model','value chain','business model','transformation',
    'cost reduction','cost optimisation','efficiency','productivity','scalability',
    // Operations & Process
    'process improvement','process optimisation','Lean','Six Sigma','SOP','workflow automation',
    'supply chain','procurement','vendor management','stakeholder management','cross-functional',
    'project management','program management','change management','risk management','governance',
    // Marketing & Growth
    'digital marketing','brand strategy','campaign','SEO','SEM','CRM','lead generation',
    'demand generation','conversion rate','customer acquisition','retention','NPS','CSAT',
    'A/B testing','performance marketing','content strategy','social media','product launch',
    // Finance
    'financial modelling','budgeting','forecasting','variance analysis','FP&A','DCF','NPV',
    'IRR','valuation','M&A','due diligence','audit','balance sheet','cash flow','IFRS',
    // Technology
    'Python','SQL','Excel','Power BI','Tableau','data analysis','machine learning','AI',
    'automation','ERP','SAP','Salesforce','Jira','Agile','Scrum','API','dashboard',
    // People & Leadership
    'team leadership','people management','talent development','recruitment','onboarding',
    'performance management','coaching','mentoring','culture','engagement','DEI',
    // Consulting
    'stakeholder','recommendation','framework','MECE','hypothesis','deck','presentation',
    'client management','engagement','proposal','benchmarking','feasibility study',
    // Metrics & Outcomes
    'month-over-month','year-over-year','YoY','MoM','quarterly','annual','growth',
    'increase','decrease','reduce','improve','optimise','deliver','launch','scale',
  ];

  const SKILL_BANK = [
    // Hard / Technical
    'Python','R','SQL','Excel','Power BI','Tableau','PowerPoint','Word','Google Sheets',
    'Jira','Confluence','Asana','Figma','Salesforce','HubSpot','SAP','Oracle','ERP',
    'AWS','GCP','Azure','Machine Learning','Deep Learning','NLP','TensorFlow','PyTorch',
    'Pandas','NumPy','Scikit-learn','Spark','Hadoop','BigQuery','Snowflake','Databricks',
    'HTML','CSS','JavaScript','React','Node.js','Git','Docker','Kubernetes',
    'Google Analytics','Meta Ads','Google Ads','Mailchimp','Marketo',
    // Domain / Functional
    'Financial Modelling','Business Analysis','Data Analysis','Strategic Planning',
    'Market Research','Competitive Analysis','Product Management','Project Management',
    'Program Management','Operations Management','Supply Chain Management',
    'Digital Marketing','Performance Marketing','Brand Strategy','P&L Management',
    'Agile','Scrum','Lean','Six Sigma','Design Thinking','MECE Framework',
    'Stakeholder Management','Change Management','Risk Management','Budgeting','Forecasting',
    'Valuation','DCF','M&A','Due Diligence','FP&A','Cost Optimisation',
    // Certifications & Education markers
    'PMP','MBA','CFA','CPA','ACCA','Google Analytics Certified','AWS Certified',
    'Six Sigma Black Belt','Six Sigma Green Belt','Prince2','PMP Certified',
    // Soft / Behavioural (only if evidenced)
    'Team Leadership','People Management','Cross-functional Leadership',
    'Executive Presentation','Client Management','Mentoring','Coaching',
  ];

  // Extract keywords: check which items from the bank actually appear in the resume
  const jsExtractedKeywords = KEYWORD_BANK.filter(kw =>
    resumeLower.includes(kw.toLowerCase())
  ).slice(0, 30);

  // Extract skills: check which items from the bank appear in the resume
  const jsSkills = SKILL_BANK.filter(skill =>
    resumeLower.includes(skill.toLowerCase())
  ).slice(0, 25);

  // Also scan resume for capitalised proper nouns / tools not in bank (best-effort)
  const properNounPattern = /\b([A-Z][a-zA-Z]{2,}(?:\s[A-Z][a-zA-Z]{2,})?)\b/g;
  const extraTerms = new Set();
  let m;
  const excludeWords = new Set(['The','This','That','With','From','Have','Been','Their','They',
    'When','Where','What','Which','Your','Our','Its','Also','More','Other','Each','All',
    'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
    'January','February','March','April','June','July','August','September','October','November','December']);
  while ((m = properNounPattern.exec(resumeText)) !== null) {
    const term = m[1];
    if (!excludeWords.has(term) && term.length > 2 && !jsExtractedKeywords.map(k=>k.toLowerCase()).includes(term.toLowerCase())) {
      extraTerms.add(term);
    }
  }
  // Add top extra terms to fill out keywords list (up to 30 total)
  const combined = [...jsExtractedKeywords];
  for (const t of extraTerms) {
    if (combined.length >= 28) break;
    if (!combined.map(k=>k.toLowerCase()).includes(t.toLowerCase())) combined.push(t);
  }

  const promptA = `You are an elite ATS scoring engine and senior recruiter. Analyse ONLY the resume below. Return ONLY valid JSON, no markdown.

CRITICAL CALIBRATION — READ BEFORE SCORING:
An AVERAGE resume from a decent college/company should score 65–75 overall.
A GOOD resume with solid experience but lacking quantification/keywords should score 70–80.
A STRONG resume with quantified achievements, role-aligned keywords, clean structure should score 78–88.
ONLY an EXCEPTIONAL resume — perfectly tailored, heavily quantified, zero filler, flawless structure — can score 89+.
Scores above 92 are EXTREMELY RARE (top 2% of all resumes). Scores above 95 are virtually impossible.
If you find yourself scoring above 88, re-examine each dimension critically and apply STRICT interpretation.

ROLE ALIGNMENT IS MANDATORY: The resume MUST be evaluated against the Target Role "${role || 'General'}" in the "${industry || 'General'}" industry within the "${stream || 'General'}" stream.
If the resume lacks direct experience/keywords for this specific role, keywordMatch and experienceRelevance MUST be penalised (cap at 65 if no direct role match evidence).
ALL keyword extraction, scoring dimensions, recommendations, and analysis MUST be contextualised to the selected Stream ("${stream || 'General'}"), Industry ("${industry || 'General'}"), and Role ("${role || 'General'}"). Do NOT provide generic analysis — every insight must reference role-specific expectations.

${resumeOnlyCtx}

════════════════════════════════════════════════════════════
 DIMENSION 1 — KEYWORD MATCH  (weight 0.28)
════════════════════════════════════════════════════════════
Step 1 – Extract every distinct keyword/phrase from the resume (job titles, tools, methodologies, frameworks, metrics, sector terms, soft-skill phrases, certifications, acronyms).
Step 2 – Build the "expected keyword set" for the TARGET role "${role || 'General'}" in the "${industry || 'General'}" industry and "${stream || 'General'}" stream. The expected set should contain 40–50 role-specific power keywords that a recruiter hiring for THIS EXACT ROLE in THIS INDUSTRY would look for. Count a keyword as PRESENT only if it appears verbatim or as an accepted abbreviation.
Step 3 – Compute:
  rawKW  = (presentCount / expectedCount) × 100  capped at 100
  densityBonus = min(8, floor(presentCount / 4))   — reward for keyword density
  genericPenalty = count of generic filler phrases × 2  (filler = "team player", "hard worker", "detail-oriented", "fast learner", "passionate", "dynamic", "results-driven" without a metric, "go-getter", "self-starter", "proactive")
  roleAlignmentPenalty = if resume has < 8 keywords matching the TARGET role's expected bank → subtract 10
  keywordMatch = clamp(rawKW + densityBonus − genericPenalty − roleAlignmentPenalty, 0, 100)
Bands: 85–100 = 35+ role-specific power keywords, near-zero filler; 70–84 = 20–34 keywords; 55–69 = 10–19; below 55 = <10.

════════════════════════════════════════════════════════════
 DIMENSION 2 — RESUME STRUCTURE  (weight 0.12)
════════════════════════════════════════════════════════════
Evaluate each criterion and sum points (max 100):
  Standard section order (Contact→Summary→Exp→Education→Skills→Certs) = 15 pts
  All section headers use standard ATS-readable labels = 10 pts
  Consistent date format throughout (MM/YYYY or Mon YYYY) = 8 pts
  Reverse-chronological order within each section = 8 pts
  No unexplained employment gaps > 6 months = 7 pts
  Contact info complete (name + email + phone + LinkedIn) = 10 pts
  Professional Summary / Objective present = 8 pts
  Bullet points used for experience (not paragraphs) = 10 pts
  Consistent indentation / spacing signals = 7 pts
  Section dividers are text-based not graphic = 7 pts
  Length appropriate (1 page ≤3 yrs exp; 2 pages 4–10 yrs; ≤3 pages 11+ yrs) = 10 pts
Deduct 5 pts per missing mandatory section; deduct 3 pts per inconsistency found.

════════════════════════════════════════════════════════════
 DIMENSION 3 — EXPERIENCE RELEVANCE  (weight 0.18)
════════════════════════════════════════════════════════════
Score each job in the candidate's history (most recent weighted highest) then compute weighted average:
  Direct function + direct industry match = 100
  Direct function + adjacent industry     = 82
  Adjacent function + direct industry     = 75
  Adjacent function + adjacent industry   = 60
  Transferable function / different sector= 42
  Unrelated                               = 20
Recency weights: most recent role = 0.45; second = 0.28; third = 0.17; fourth+ share 0.10.
Progression bonus: add up to 10 pts if titles show clear upward trajectory (IC→Lead→Manager→Director).
Gaps penalty: subtract 4 pts per unexplained gap > 6 months.
experienceRelevance = clamp(weightedAvg + progressionBonus − gapPenalty, 0, 100)

════════════════════════════════════════════════════════════
 DIMENSION 4 — ACHIEVEMENTS  (weight 0.20)
════════════════════════════════════════════════════════════
For every experience bullet, classify it:
  Type A — fully quantified with number + unit + context  (e.g. "grew revenue 34% YoY to $2.1M") = 4 pts
  Type B — partially quantified (number present but no context or comparison)                    = 2 pts
  Type C — action verb + outcome, no number                                                      = 1 pt
  Type D — responsibility description only ("responsible for", "worked on", "helped with")      = 0 pts
score = (sumOfPts / (totalBullets × 4)) × 100
bonuses: +5 if at least one bullet includes a revenue/cost/time-saving metric; +3 if team size mentioned; +2 if industry-recognised award cited.
Deduct 8 if > 30% of bullets are Type D.
achievements = clamp(score + bonuses − penalty, 0, 100)

════════════════════════════════════════════════════════════
 DIMENSION 5 — SKILLS MATCH  (weight 0.12)
════════════════════════════════════════════════════════════
Split skills into three tiers:
  Tier 1 — Hard / Technical skills (weight 0.55): tools, platforms, languages, certifications explicitly named
  Tier 2 — Domain / Functional skills (weight 0.30): industry-specific methodologies, frameworks, processes
  Tier 3 — Soft / Behavioural skills (weight 0.15): only count if backed by a concrete example in the resume
For each tier: score = (matchedSkills / requiredSkillsForRole) × 100  capped at 100.
skillsMatch = (tier1×0.55 + tier2×0.30 + tier3×0.15)

════════════════════════════════════════════════════════════
 DIMENSION 6 — ATS FORMATTING  (weight 0.06)
════════════════════════════════════════════════════════════
Start at 100 and deduct:
  Tables used anywhere:           −22
  Text boxes or graphics:         −18
  Headers / footers with key info:−12
  Multi-column layout:            −15
  Non-standard fonts (inferred):  −8
  Logos, images, icons:           −10
  Fancy bullets (symbols not -/•):−5
  Hyperlinks embedded in text:    −4
  Page border / shading:          −5
  Coloured text (non-black):      −3
  File is not .docx or .pdf:      −8  (cannot determine, assume 0)
atsFormatting = clamp(100 − deductions, 0, 100)

════════════════════════════════════════════════════════════
 DIMENSION 7 — LEADERSHIP SIGNALS  (weight 0.04)
════════════════════════════════════════════════════════════
Evidence scoring:
  Direct people management (team of ≥ 2 reports explicitly stated) = 25 pts per role, max 40
  P&L / budget ownership with figure = 20 pts
  Cross-functional leadership (led initiative across ≥ 2 teams) = 15 pts
  Mentoring / coaching evidence = 10 pts
  Strategic decision-making evidence (board, C-suite exposure) = 10 pts
  External representation (keynote, published, advisory board) = 5 pts
leadershipSignals = clamp(totalPts, 0, 100)

════════════════════════════════════════════════════════════
 OVERALL ATS SCORE  (weighted sum)
════════════════════════════════════════════════════════════
atsScore = round(
  keywordMatch × 0.28 +
  resumeStructure × 0.12 +
  experienceRelevance × 0.18 +
  achievements × 0.20 +
  skillsMatch × 0.12 +
  atsFormatting × 0.06 +
  leadershipSignals × 0.04
)

════════════════════════════════════════════════════════════
 RECRUITER SCORE  (independent holistic assessment)
════════════════════════════════════════════════════════════
Assess five signals independently (each 0–20):
  Narrative clarity & career story coherence                           = 0–20
  Career progression logic & ambition signals                          = 0–20
  Achievement impact & business relevance of metrics                   = 0–20
  Personal brand strength (headline, summary, distinctive positioning) = 0–20
  Overall professional packaging & first-impression quality            = 0–20
recruiterScore = sum of five signals (0–100)

════════════════════════════════════════════════════════════
 MULTI-ROLE FIT SCORES  — extensive anti-bias formula
════════════════════════════════════════════════════════════
Score EVERY role based SOLELY on the resume text above.
CRITICAL ANTI-BIAS RULES:
- The role with the HIGHEST score MUST genuinely be the best match for THIS specific resume
- NEVER assign a high score to a role unless the resume contains substantial evidence for it
- A role with 0-3 keyword matches from its bank CANNOT score above 45 — hard cap
- A role with 4-8 keyword matches CANNOT score above 65 — hard cap
- Only roles with 9+ keyword matches from their bank can score above 66
- All scores MUST be genuinely differentiated based on actual resume content for "${stream || 'General'}" stream roles
- No clustering of scores — spread must reflect true resume signal strength

For EACH of the 12 roles below, apply this EXTENSIVE formula:
  Step 1 — kwHit: Count exact keyword matches (case-insensitive) from that role's bank of 50.
    rawKwScore = (matchCount / 50) × 100
    If matchCount < 4: kwHit = rawKwScore × 0.5  (severe penalty for very few matches)
    Else: kwHit = rawKwScore

  Step 2 — expFit (0–100): How closely do the candidate's past job titles + industries align with THIS role?
    Direct title match (e.g., "Product Manager" for PM role) = 90–100
    Adjacent title (e.g., "Associate PM" or "Business Analyst" for PM role) = 60–80
    Transferable role (e.g., "Consultant" for PM role) = 30–55
    Unrelated title = 0–25
    Weight most recent 2 roles at 0.70, older roles at 0.30

  Step 3 — skillFit (0–100): Do the candidate's listed skills (hard tools, software, certs) match what this role requires?
    Tier 1 (must-have hard skills for the role): each match = 8 pts, max 60 pts
    Tier 2 (nice-to-have domain skills): each match = 4 pts, max 30 pts
    Tier 3 (soft/behavioural, only if evidenced): each = 2 pts, max 10 pts
    skillFit = min(total, 100)

  Step 4 — achFit (0–100): What proportion of the candidate's quantified bullet-point achievements are KPI-relevant for THIS role?
    Each directly relevant quantified achievement = 12 pts
    Each partially relevant achievement = 5 pts
    achFit = min(total, 100)

  Step 5 — seniorityFit (0–100): Does the candidate's seniority level match what this role typically requires?
    Title/YoE matches typical entry point exactly = 80–100
    One level above or below = 50–75
    Two or more levels away = 0–45

  Step 6 — languageDensity (0–100): Beyond keyword hits, how deeply is role-specific language woven through the resume?
    Count unique role-specific phrases (not just single words) in full resume text
    Score = min((uniquePhraseCount / 8) × 100, 100)

  FINAL FORMULA:
  roleScore = round(
    kwHit         × 0.30 +
    expFit        × 0.25 +
    skillFit      × 0.20 +
    achFit        × 0.12 +
    seniorityFit  × 0.08 +
    languageDensity × 0.05
  )
  THEN apply hard caps: if matchCount < 4 → cap at 45; if matchCount 4–8 → cap at 65
  THEN ensure no two roles share identical scores (break ties by ±1 based on secondary evidence)

KEYWORD BANKS (match case-insensitively; partial word match counts for multi-word phrases):

PRODUCT MANAGER (bank of 50):
roadmap, product roadmap, PRD, product requirements, user story, user stories, sprint, backlog, grooming, retrospective, OKR, KPI, DAU, MAU, retention, churn, NPS, CSAT, A/B test, feature flag, go-to-market, GTM, launch, beta, MVP, product-market fit, stakeholder, wireframe, Figma, Jira, Confluence, Agile, Scrum, Kanban, prioritisation, MoSCoW, product vision, discovery, user research, persona, funnel, conversion, monetisation, pricing strategy, API, SDK, cross-functional, product analytics, Mixpanel, Amplitude, growth loop

PROGRAM MANAGER (bank of 50):
program management, PMO, project charter, milestone, deliverable, RAID log, risk register, dependency, escalation, governance, steering committee, status report, RAG, RACI, workstream, resource allocation, capacity planning, budget tracking, WBS, waterfall, Agile, Prince2, PMP, MSP, change management, stakeholder management, comms plan, executive reporting, SLA, SOP, process improvement, issue log, action tracker, MS Project, Smartsheet, Monday.com, Asana, tollgate, post-mortem, lessons learned, benefit realisation, business case, cost-benefit, sign-off, onboarding, vendor management, contract management, programme board, initiative roadmap

BUSINESS ANALYST (bank of 50):
requirements, business requirements, BRD, FRD, functional specification, use case, UAT, user acceptance testing, process mapping, as-is, to-be, gap analysis, SWOT, root cause, fishbone, data analysis, SQL, Excel, pivot table, dashboard, Power BI, Tableau, MIS report, KPI dashboard, stakeholder interview, workshop facilitation, Visio, BPMN, ERD, data flow, system integration, API testing, regression, JIRA, Confluence, Agile BA, change request, impact assessment, traceability matrix, benchmarking, feasibility study, cost-benefit analysis, workflow automation, CRM analysis, ERP, SAP, Salesforce reporting, statistical analysis

CONSULTANT (bank of 50):
engagement, client deliverable, workstream, deck, recommendation, hypothesis, issue tree, MECE, framework, McKinsey, BCG, Bain, Big 4, due diligence, market sizing, TAM, SAM, SOM, competitive landscape, benchmarking, operating model, value chain, Porter's Five Forces, PESTLE, structured thinking, executive presentation, C-suite, board presentation, proposal, scoping, discovery, insight, synthesis, storytelling, data-driven, Excel model, financial model, scenario analysis, sensitivity analysis, project management, client management, billing, utilisation, KPI, implementation, change management, transformation, restructuring, post-merger integration, PMI, ESG, sustainability consulting

FINANCE (bank of 50):
P&L, profit and loss, balance sheet, cash flow, EBITDA, EBIT, revenue, gross margin, net margin, ROI, ROE, ROCE, DCF, discounted cash flow, NPV, IRR, valuation, financial modelling, three-statement model, LBO, M&A, merger, acquisition, due diligence, budgeting, forecasting, variance analysis, FP&A, management accounts, statutory accounts, audit, internal controls, IFRS, GAAP, tax, treasury, working capital, liquidity, covenant, credit analysis, equity research, investment thesis, capital markets, IPO, fundraising, Excel, Bloomberg, FactSet, Power BI, cost reduction, cost optimisation, financial reporting, investor relations, board pack

MARKETING (bank of 50):
brand strategy, brand equity, campaign, digital marketing, performance marketing, SEO, SEM, PPC, Google Ads, Meta Ads, programmatic, email marketing, CRM, Salesforce, HubSpot, content strategy, content marketing, social media, influencer, PR, earned media, paid media, owned media, funnel, TOFU, MOFU, BOFU, lead generation, demand generation, conversion rate, CTR, CPC, CPM, ROAS, CAC, LTV, CLV, retention, loyalty, NPS, market research, consumer insights, segmentation, positioning, GTM, product launch, trade marketing, ATL, BTL, integrated campaign, analytics, A/B testing, growth hacking, viral loop, referral, attribution

OPERATIONS (bank of 50):
process improvement, process optimisation, Lean, Six Sigma, Kaizen, 5S, DMAIC, standard operating procedure, SOP, throughput, cycle time, takt time, OEE, capacity planning, demand planning, supply chain, logistics, procurement, vendor management, inventory management, warehouse, distribution, last-mile, ERP, SAP, Oracle, WMS, TMS, SLA, KPI, cost reduction, waste reduction, efficiency, productivity, quality management, ISO, compliance, root cause analysis, corrective action, CAPA, cross-functional, project management, change management, automation, RPA, BPO, outsourcing, shared services, workforce planning, shift management, yield, fulfilment

HR (bank of 50):
talent acquisition, recruitment, sourcing, headcount, onboarding, employee experience, EX, HRBP, HR business partner, L&D, learning and development, training, coaching, performance management, PIP, OKR, 360 feedback, succession planning, talent management, organisational development, OD, culture, engagement, eNPS, pulse survey, retention, attrition, DEI, diversity, HRIS, Workday, SAP SuccessFactors, payroll, compensation, C&B, benefits, job architecture, job levelling, grading, TUPE, employment law, grievance, disciplinary, mediation, HR analytics, people analytics, workforce planning, change management, transformation, employer branding, EVP, graduate recruitment, internship programme

DATA SCIENCE (bank of 50):
Python, R, SQL, machine learning, ML, deep learning, neural network, NLP, natural language processing, computer vision, classification, regression, clustering, random forest, gradient boosting, XGBoost, LightGBM, TensorFlow, PyTorch, Keras, scikit-learn, pandas, NumPy, Spark, Hadoop, Databricks, Snowflake, BigQuery, data pipeline, ETL, feature engineering, model deployment, MLOps, A/B testing, statistical analysis, hypothesis testing, p-value, confidence interval, time series, forecasting, recommendation system, anomaly detection, data visualisation, Tableau, Power BI, Matplotlib, Seaborn, Jupyter, Git, Docker, AWS, GCP, Azure, data engineering, data warehouse, data lake, business intelligence

STRATEGY (bank of 50):
strategic planning, corporate strategy, business strategy, long-range plan, strategic roadmap, market entry, market expansion, adjacency, new market, competitive analysis, competitive intelligence, Porter, industry analysis, PESTLE, scenario planning, strategic options, investment thesis, portfolio strategy, capital allocation, M&A strategy, inorganic growth, organic growth, revenue growth, value creation, operating model, business model, business model innovation, cost structure, pricing strategy, go-to-market, GTM, product-market fit, P&L ownership, board presentation, CEO support, chief of staff, strategy consulting, McKinsey, BCG, Bain, Big 4, annual planning, OKR, KPI design, strategic initiative, transformation, digital transformation, innovation, horizon planning, war-gaming, stress test

GENERAL MANAGEMENT (bank of 50):
P&L ownership, P&L management, full P&L, revenue growth, EBITDA, cost management, team leadership, people leadership, general manager, GM, MD, managing director, business unit, BU head, country head, CEO, COO, cross-functional, matrix organisation, operational excellence, strategic planning, board reporting, investor relations, fundraising, annual budget, capital expenditure, capex, organisational design, restructuring, turnaround, transformation, culture change, talent development, succession, executive team, C-suite, stakeholder management, regulatory, compliance, risk management, governance, mergers, acquisitions, integration, joint venture, partnership, franchise, market share, growth strategy, customer satisfaction, NPS, shareholder value

SALES (bank of 50):
quota, quota attainment, revenue target, ARR, MRR, ACV, TCV, deal size, pipeline, pipeline management, CRM, Salesforce, HubSpot, prospecting, cold outreach, SDR, BDR, AE, account executive, account management, key account, enterprise sales, SMB, SaaS sales, solution selling, consultative selling, challenger sale, SPIN selling, MEDDIC, BANT, closing, negotiation, objection handling, proposal, RFP, RFQ, demo, discovery call, qualification, forecast, win rate, conversion rate, customer acquisition, CAC, LTV, upsell, cross-sell, renewal, churn, NPS, territory management, commission, incentive, channel sales, partner sales, field sales, inside sales, sales enablement, sales ops

════════════════════════════════════════════════════════════
 IMPORTANT SCORING RULES — STRICT CALIBRATION
════════════════════════════════════════════════════════════
- Every score must be an integer 0–100
- CALIBRATION CHECK: After computing all 7 dimensions, verify atsScore falls in the right band:
    * Average resume from a good school/company → atsScore should be 65–75
    * Good resume but missing quantification or role keywords → 70–80
    * Strong, well-structured, keyword-rich, quantified → 78–88
    * Exceptional (top 2%) → 89–95
    * If atsScore > 88, re-examine and justify EACH dimension being that high
- No two roleScores may have the same value — differentiate based on actual resume content
- All 7 dimension scores must reflect GENUINE analysis of THIS resume for the "${role || 'General'}" role in "${industry || 'General'}" industry, not defaults
- atsScore must equal the weighted formula result above (±1 rounding only)
- ROLE ALIGNMENT: If the resume doesn't demonstrate direct experience in "${role || 'the target role'}", experienceRelevance MUST be ≤ 65 and keywordMatch MUST be ≤ 70
- Do NOT output placeholder or average values — compute from the resume text
- ALL analysis (strengths, weaknesses, atsIssues, recommendations) must reference the specific Stream/Industry/Role context — never generic advice
- If a Job Description is provided: "allMissingJdKeywords" MUST include EVERY single keyword/phrase/skill/tool found in the JD that does NOT appear in the resume — this is a comprehensive exhaustive list, not a sample.
- DATE HANDLING: Today's date is ${new Date().toLocaleDateString('en-US', {month:'long',year:'numeric'})}. ALL dates in the resume (2024, 2025, 2026, etc.) are VALID and NOT future-dated. NEVER flag any date as "future-dated employment" or "future date error". Do NOT penalise or flag dates like "2025", "2026", "Jan'26", "Sept'25 - Jan'26" etc. as issues. Treat all dates in the resume as legitimate and current.
- NEVER include "future-dated" or "future date" in atsIssues — these are false positives caused by model training cutoffs.

════════════════════════════════════════════════════════════
 TOP RECOMMENDATIONS — STRICT RULES (most important output)
════════════════════════════════════════════════════════════
Generate exactly 8 recommendations covering ALL of the following dimensions (at least one rec per dimension where the score is below 80):
  1. Achievements (quantification of bullets)
  2. Keyword Match (specific missing power keywords)
  3. Resume Structure (section order, headers, formatting)
  4. Experience Relevance (role titles, career narrative)
  5. Skills Match (tools, certifications, hard skills)
  6. Leadership Signals (management evidence, P&L, scope)
  7. ATS Formatting (tables, columns, fonts, file issues)
  8. Professional Summary (opening statement strength)

Each recommendation MUST be:
- SPECIFIC to THIS resume — reference actual company names, job titles, bullet text, or section names
- ACTIONABLE — tell the candidate exactly what to change, quoting the actual line if possible
- NEVER generic — forbidden phrases: "Add more metrics", "Improve your summary", "Use action verbs", "Tailor your resume"
- "title": short imperative naming the exact change (e.g. "Quantify the Infosys project delivery bullet with cost saved")
- "what": precise action referencing ACTUAL resume content — quote or name the specific line/section
- "why": which ATS dimension it fixes and the estimated score impact in points
- "impact": "high" / "medium" / "low"
- "effort": "low" / "medium" / "high"
- "example": a concrete rewritten sentence or phrase showing the exact improvement

════════════════════════════════════════════════════════════
 KEYWORD & SKILLS EXTRACTION — HIGH ACCURACY REQUIRED
════════════════════════════════════════════════════════════
Extract the following from the resume text with maximum accuracy and completeness, CONTEXTUALISED to the "${stream || 'General'}" stream, "${industry || 'General'}" industry, and "${role || 'General'}" role:

"extractedKeywords": Extract ALL meaningful keywords/phrases that actually appear in the resume:
- Include: job titles, company names, tools, platforms, methodologies, frameworks, domain terms, metrics, certifications, acronyms, industry-specific terminology
- Include: quantified outcomes (e.g. "30% revenue growth"), strategic terms, functional skills
- PRIORITISE keywords that are relevant to the "${role || 'General'}" role in "${industry || 'General'}" — flag which ones are role-critical vs general
- MINIMUM 20 keywords, ideally 25–30
- Only include what genuinely exists in the resume text — no fabrication

"skills": Extract ALL technical and soft skills explicitly mentioned or clearly demonstrated in the resume:
- Tier 1 Hard Skills: software, tools, programming languages, platforms, certifications relevant to "${role || 'General'}" (e.g. "Python", "Tableau", "PMP", "SQL", "Excel", "Power BI")
- Tier 2 Domain Skills: industry methodologies, frameworks, processes specific to "${industry || 'General'}" (e.g. "Agile", "Six Sigma", "Financial Modelling", "Business Analysis")
- Tier 3 Soft Skills: only include if backed by concrete evidence in the resume (e.g. "Team Leadership" only if they managed a team)
- MINIMUM 12 skills, ideally 15–20
- Only include skills that genuinely appear in the resume

Return ONLY this JSON:
{
  "candidate": {"name":"","email":null,"phone":null,"location":null,"currentRole":"","yearsExp":0},
  "atsScore": 0, "recruiterScore": 0,
  "scores": {"keywordMatch":0,"resumeStructure":0,"experienceRelevance":0,"achievements":0,"skillsMatch":0,"atsFormatting":0,"leadershipSignals":0},
  "roleScores": [
    {"role":"Product Manager","score":0},{"role":"Program Manager","score":0},
    {"role":"Business Analyst","score":0},{"role":"Consultant","score":0},
    {"role":"Finance","score":0},{"role":"Marketing","score":0},
    {"role":"Operations","score":0},{"role":"HR","score":0},
    {"role":"Data Science","score":0},{"role":"Strategy","score":0},
    {"role":"General Management","score":0},{"role":"Sales","score":0}
  ],
  "atsIssues": [
    {"issue":"specific issue from THIS resume","severity":"high","fix":"specific fix"},
    {"issue":"specific issue 2","severity":"medium","fix":"specific fix"},
    {"issue":"specific issue 3","severity":"low","fix":"specific fix"}
  ],
  "strengths": ["strength1","strength2","strength3","strength4"],
  "weaknesses": ["weakness1","weakness2","weakness3"],
  "missingKeywords": [
    {"keyword":"kw1","why":"why it matters","where":"exact section","example":"example sentence"},
    {"keyword":"kw2","why":"","where":"","example":""},
    {"keyword":"kw3","why":"","where":"","example":""},
    {"keyword":"kw4","why":"","where":"","example":""},
    {"keyword":"kw5","why":"","where":"","example":""},
    {"keyword":"kw6","why":"","where":"","example":""},
    {"keyword":"kw7","why":"","where":"","example":""},
    {"keyword":"kw8","why":"","where":"","example":""},
    {"keyword":"kw9","why":"","where":"","example":""},
    {"keyword":"kw10","why":"","where":"","example":""},
    {"keyword":"kw11","why":"","where":"","example":""},
    {"keyword":"kw12","why":"","where":"","example":""},
    {"keyword":"kw13","why":"","where":"","example":""},
    {"keyword":"kw14","why":"","where":"","example":""},
    {"keyword":"kw15","why":"","where":"","example":""}
  ],
  "topRecommendations": [
    {
      "title": "short imperative title e.g. 'Quantify the Infosys cost-saving bullet with exact INR figure'",
      "what": "exact specific action referencing actual resume content — name the section and quote the line",
      "why": "which ATS dimension this fixes and estimated point improvement",
      "impact": "high",
      "effort": "low",
      "example": "concrete rewritten phrase showing the exact improvement",
      "dimension": "Achievements"
    },
    {"title":"","what":"","why":"","impact":"high","effort":"low","example":"","dimension":"Keyword Match"},
    {"title":"","what":"","why":"","impact":"high","effort":"medium","example":"","dimension":"Skills Match"},
    {"title":"","what":"","why":"","impact":"medium","effort":"low","example":"","dimension":"Resume Structure"},
    {"title":"","what":"","why":"","impact":"medium","effort":"medium","example":"","dimension":"Experience Relevance"},
    {"title":"","what":"","why":"","impact":"medium","effort":"low","example":"","dimension":"Leadership Signals"},
    {"title":"","what":"","why":"","impact":"low","effort":"low","example":"","dimension":"ATS Formatting"},
    {"title":"","what":"","why":"","impact":"medium","effort":"medium","example":"","dimension":"Professional Summary"}
  ],
  "skills": ["skill1","skill2","skill3","skill4","skill5","skill6","skill7","skill8","skill9","skill10","skill11","skill12"],
  "extractedKeywords": ["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10","kw11","kw12","kw13","kw14","kw15","kw16","kw17","kw18","kw19","kw20"]
}`;

  // Build the resume lines list with per-line char targets embedded,
  // so the AI knows exactly how long each improved line should be.
  // Extract lines from the resume text for reference (best-effort).
  const resumeLines = resumeText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 30 && l.length < 600);

  const promptB = `You are a world-class resume writer and ATS expert. Rewrite every meaningful line of this resume to be exceptional. Return ONLY valid JSON — no markdown, no code fences.

=== RESUME ===
${resumeText.slice(0, 20000)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REWRITING PHILOSOPHY — apply to every "improved":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Apply STAR framework. Open with a strong action verb: Spearheaded, Drove, Delivered, Orchestrated, Architected, Pioneered, Scaled, Transformed.
• Embed SPECIFICITY: real numbers, team sizes, timelines, tools, outcomes from the original text.
• Show IMPACT: what measurably changed as a direct result.
• Dense language — every word earns its place.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHARACTER WINDOW — STRICT 3%–10% EXPANSION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every dash character (-, –, —, ‒, −) counts as exactly 1 character.
For EACH line you rewrite, the original length is N characters.
Your "improved" text MUST be between ceil(N × 1.03) and ceil(N × 1.10) characters.
  MINIMUM: ceil(N × 1.03) — at least 3% longer than original. NEVER shorter.
  MAXIMUM: ceil(N × 1.10) — at most 10% longer than original. NEVER exceed.

RULES:
• "improved" MUST NOT be identical or near-identical to "original" — every line must be GENUINELY rewritten with different phrasing, not just a word insertion.
• Use a DIFFERENT opening action verb than the original. Restructure the sentence substantially.
• NEVER truncate mid-sentence. A complete sentence within the window is required.
• "improved" must always be a grammatically complete thought.
• If you cannot fit a better version within the window, still rewrite with completely different wording and structure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COVERAGE — MANDATORY COMPLETE PASS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Process the ENTIRE resume top-to-bottom. For EACH section heading found, rewrite EVERY bullet/line under it:
  1. Professional Summary / Objective / Profile
  2. Work Experience — EVERY bullet under EVERY role, every company
  3. Education — meaningful lines (thesis, achievements, relevant coursework descriptions)
  4. Projects — project title+description AND every bullet under each project
  5. Certifications — each cert line
  6. Achievements / Awards / Honours — every bullet
  7. Extra-Curricular / Positions of Responsibility / Volunteer — every bullet
  8. Any other sections present

DO NOT SKIP any section. Process all headings found. Minimum 35 items; target 50+.
"original" = EXACT verbatim text. "improved" = non-empty complete rewrite. NEVER null/"".
"section" = label like "Work Experience – Company Name", "Projects – ProjectName", "Certifications".
"reason" = one crisp strategic sentence.

Return ONLY this JSON:
{
  "lineByLineAnalysis": [
    {"section":"<label>","original":"<verbatim>","improved":"<rewrite>","reason":"<why>"}
  ]
}`;


/* ── line rewrite validation helpers ───────────────────────────── */
function canonicalizeLine(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[–—‒−]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeLine(text) {
  return canonicalizeLine(text).split(' ').filter(Boolean);
}

function jaccardSimilarity(tokensA, tokensB) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (!setA.size && !setB.size) return 1;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function isMeaningfullyDifferentLine(original, candidate) {
  const normOrig = canonicalizeLine(original);
  const normCand = canonicalizeLine(candidate);
  if (!normCand) return false;
  if (normOrig === normCand) return false;

  const origTokens = tokenizeLine(original);
  const candTokens = tokenizeLine(candidate);
  if (!origTokens.length || !candTokens.length) return normOrig !== normCand;

  const sharedPrefix = origTokens.filter((token, idx) => candTokens[idx] === token).length;
  const leadOrig = origTokens.slice(0, 3).join(' ');
  const leadCand = candTokens.slice(0, 3).join(' ');
  const similarity = jaccardSimilarity(origTokens, candTokens);
  const charDelta = Math.abs(normCand.length - normOrig.length);

  if (leadOrig && leadOrig === leadCand) return false;
  if (sharedPrefix >= Math.min(4, origTokens.length, candTokens.length)) return false;
  if (similarity >= 0.9) return false;
  if (similarity >= 0.82 && charDelta <= 6) return false;

  return true;
}

/* ── repairLine: module-level — validates improved line length constraints (3%-10%) ── */
/* Returns the valid improved text, or null if invalid (so caller can trigger regen) */
function repairLine(original, improved, opts = {}) {
  const origLen = effectiveLength(original);
  const minLen  = opts.minLen ?? Math.ceil(origLen * 1.03);
  const maxLen  = opts.maxLen ?? Math.ceil(origLen * 1.10);
  const t = (improved || '').trim();
  if (!t) return null;
  if (!isMeaningfullyDifferentLine(original, t)) return null;
  const tLen = effectiveLength(t);
  if (tLen < minLen) return null;
  if (tLen > maxLen) return null;
  return t;
}

  // promptC — JD match scores, skills, gaps, keywords
  const promptC = jdText ? `You are an expert ATS recruiter. Apply the EXACT formula below to score resume vs JD. Return ONLY valid JSON — no markdown, no code fences.

=== RESUME ===
${resumeText.slice(0, 8000)}

=== JOB DESCRIPTION ===
${jdText.slice(0, 4000)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JD MATCH SCORING FORMULA (use this exactly):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Compute these 5 dimensions then combine:

D1 — JD KEYWORD OVERLAP (weight 0.35):
  Extract all keywords/skills/tools/methodologies from the JD.
  Count how many appear in the resume (case-insensitive exact or accepted abbreviation match).
  jdKwScore = (matchedJdKw / totalJdKw) × 100, cap at 100.
  Apply density bonus: +5 if ≥20 keyword matches; +3 if ≥12.

D2 — ROLE KEYWORD DEPTH (weight 0.20):
  Independently check the resume for role-specific keywords from standard banks for this role type
  (these may NOT be in the JD but signal genuine domain expertise).
  roleKwScore = (roleHits / 30) × 100, cap at 100.
  This rewards candidates with deep domain expertise beyond what the JD explicitly asks for.

D3 — EXPERIENCE RELEVANCE (weight 0.25):
  Score how well the candidate's past roles/industries match the JD's requirements.
  Direct match=90-100, adjacent=65-80, transferable=40-60, unrelated=10-35.

D4 — SKILLS COVERAGE (weight 0.12):
  Hard skills required by JD: each present = 8pts, max 60.
  Soft/domain skills from JD: each present = 4pts, max 40.
  skillsScore = min(total, 100).

D5 — ACHIEVEMENT ALIGNMENT (weight 0.08):
  How many of the candidate's quantified achievements are directly relevant to this JD's KPIs?
  Each relevant quantified achievement = 15pts, cap at 100.

FINAL: percentage = round(D1×0.35 + D2×0.20 + D3×0.25 + D4×0.12 + D5×0.08)
IMPORTANT: Be realistic but not overly harsh. A score above 85 means near-perfect alignment. Average match = 60-72.
Never inflate scores — an 80% is genuinely strong. Scores above 90% are exceptional.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP 15 MISSING JD KEYWORDS — CRITICAL RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each of the 15 entries you MUST provide:
- "keyword": exact phrase from JD that is ABSENT from resume
- "importance": "critical" | "high" | "medium"
- "frequency": how many times it appears in JD (integer)
- "context": explain precisely what this keyword means in the context of THIS JD role — be specific and descriptive (2-3 sentences, no placeholders)
- "where": the exact resume section where this should be added (e.g. "Work Experience – [most recent role]", "Skills section", "Professional Summary")
- "example": write a concrete example bullet/phrase using this keyword that fits THIS candidate's background from the resume — tailor it to their actual experience, not a generic example. Make it immediately usable.

RULES: NEVER use "N/A", "n/a", null, or empty strings for context, where, or example. Every field must have real, specific, tailored content. Rank: critical first (must-have), then high, then medium.

Return ONLY this JSON:
{
  "percentage": <integer 0-100 per formula above>,
  "matchingSkills": [<all skills/tools/experiences present in BOTH resume AND JD>],
  "missingSkills": [<hard skills required by JD but absent from resume>],
  "allMissingJdKeywords": [<every keyword/phrase/tool/methodology in JD not found in resume — exhaustive>],
  "experienceGaps": [<specific experience types JD requires that resume doesn't demonstrate>],
  "recommendation": "<2-3 sentence honest verdict on fit, top strength, and most critical gap>",
  "jdTopMissingKeywords": [
    {"keyword":"<jd phrase>","importance":"critical","frequency":2,"context":"<specific 2-3 sentence explanation of what this means in THIS role>","where":"<exact section>","example":"<tailored bullet using candidate's actual background>"},
    {"keyword":"","importance":"critical","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"critical","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"high","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"high","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"high","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"high","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""},
    {"keyword":"","importance":"medium","frequency":1,"context":"","where":"","example":""}
  ]
}
RULES: Exactly 15 entries in jdTopMissingKeywords. Every field filled — no N/A, no empty strings. All keywords must be from JD and absent from resume.` : null;

  // promptD — dedicated role fit action plan with full token budget
  const promptD = jdText ? `You are an expert career coach specialising in resume-to-JD alignment. Study the resume and job description carefully, then generate a detailed, specific action plan. Return ONLY valid JSON — no markdown, no code fences.

=== RESUME ===
${resumeText.slice(0, 6000)}

=== JOB DESCRIPTION ===
${jdText.slice(0, 2500)}

Generate exactly 8 prioritised action steps the candidate must take to maximise their match for THIS specific role.
Each action MUST reference actual content from the resume and actual requirements from the JD.
NEVER write generic advice like "add metrics" or "tailor your resume".

Return ONLY this JSON:
{
  "roleFitSuggestions": [
    {
      "priority": "high",
      "action": "<exact specific action — name the resume section and the JD requirement it addresses>",
      "why": "<why this matters for THIS specific JD and role>",
      "where": "<exact resume section to edit>",
      "example": "<concrete rewritten bullet or phrase to use>"
    },
    {"priority":"high","action":"<specific action 2>","why":"","where":"","example":""},
    {"priority":"high","action":"<specific action 3>","why":"","where":"","example":""},
    {"priority":"medium","action":"<specific action 4>","why":"","where":"","example":""},
    {"priority":"medium","action":"<specific action 5>","why":"","where":"","example":""},
    {"priority":"medium","action":"<specific action 6>","why":"","where":"","example":""},
    {"priority":"low","action":"<specific action 7>","why":"","where":"","example":""},
    {"priority":"low","action":"<specific action 8>","why":"","where":"","example":""}
  ]
}
RULES: All 8 items must have non-empty "action" fields. High priority = JD explicitly requires it and resume lacks it. Medium = JD mentions it and resume partially covers it. Low = nice-to-have alignment improvement.` : null;

  const [resultA, resultB, resultC, resultD] = await Promise.all([
    callClaude(promptA, 8192),
    callClaude(promptB, 32768),
    promptC ? callClaude(promptC, 8192) : Promise.resolve(null),
    promptD ? callClaude(promptD, 4096) : Promise.resolve(null),
  ]);

  // ── Repair pass ────────────────────────────────────────────────────────────
  const repairedLines = (resultB.lineByLineAnalysis || []).map(item => {
    if (!item.original || !item.improved) return item;
    const repairedImproved = repairLine(item.original, item.improved);
    // If null, mark as needing regen — the LineCard auto-regen will handle it
    return { ...item, improved: repairedImproved || null };
  });

  // ── JS-side Multi-Role ATS score — same 7-dimension formula as overall ATS ─
  // Uses STREAM_ROLES (stream-specific top 10) instead of generic 12.
  // Fully resume-only; never touches jdText.
  // Calibrated to output in same range as overall ATS score so comparison is valid.
  function computeRoleScoreJS(roleKey) {
    const bank = ROLE_KEYWORD_BANKS[roleKey] || [];
    const hits = bank.filter(kw => resumeLower.includes(kw.toLowerCase())).length;
    const bankSize = Math.max(bank.length, 1);

    // D1 — Keyword Match (0.28): same formula as overall ATS keywordMatch dimension
    let kwRaw = (hits / bankSize) * 100;
    // Density bonus same as promptA formula
    kwRaw += Math.min(12, Math.floor(hits / 3));
    if (hits < 4) kwRaw *= 0.65;
    const kwHit = Math.min(kwRaw, 100);

    // D2 — Experience Relevance (0.18): title signals
    const TITLE_MAP = {
      'Product Manager':    ['product manager','product lead','associate pm','apm','product owner','head of product'],
      'Program Manager':    ['program manager','programme manager','pmo','delivery manager','project manager'],
      'Business Analyst':   ['business analyst','systems analyst','functional analyst','data analyst','ba '],
      'Consultant':         ['consultant','associate','advisory','strategy analyst','engagement manager'],
      'Finance':            ['finance','financial analyst','investment analyst','fpa','treasury','equity analyst','ca ','cfa','accountant','banking'],
      'Marketing':          ['marketing','brand manager','growth','digital marketing','campaign','product marketing'],
      'Operations':         ['operations','ops','supply chain','logistics','process','procurement'],
      'HR':                 ['hr ','human resources','talent','people','hrbp','recruiter','l&d','learning'],
      'Data Science':       ['data scientist','data analyst','ml engineer','machine learning','ai engineer','analytics'],
      'Strategy':           ['strategy','strategic','chief of staff','corporate development','planning'],
      'General Management': ['general manager','gm ','managing director','md ','coo','vp ','head of','country head','director'],
      'Sales':              ['sales','account executive','ae ','business development','bd ','revenue'],
      // Stream-specific roles — title signals
      'Investment Banking Analyst': ['investment banking','ib analyst','m&a analyst','capital markets','bulge bracket','investment bank'],
      'Equity Research Analyst':    ['equity research','research analyst','stock analyst','equity analyst','research associate'],
      'PE Analyst':                 ['private equity','pe analyst','buyout','portfolio company','fund','leveraged'],
      'VC Analyst':                 ['venture capital','vc analyst','startup','seed','series a','venture'],
      'Financial Analyst':          ['financial analyst','fp&a','finance analyst','financial planning','management accounts'],
      'Corporate Finance Analyst':  ['corporate finance','m&a','treasury analyst','capital structure','corporate development'],
      'Treasury Analyst':           ['treasury','cash management','fx','liquidity','funding'],
      'Credit Risk Analyst':        ['credit risk','credit analyst','credit scoring','underwriting','loan'],
      'Relationship Manager':       ['relationship manager','rm ','client relationship','banking relationship','portfolio manager'],
      'Product Analyst':            ['product analyst','product analytics','growth analyst','user analytics'],
      'Risk Analyst':               ['risk analyst','risk management','operational risk','market risk','compliance risk'],
      'Associate Consultant':       ['associate consultant','consultant','advisory','strategy consulting','management consulting'],
      'Strategy Analyst':           ['strategy analyst','corporate strategy','strategic planning','strategy associate'],
      'Transformation Analyst':     ['transformation','change management','digital transformation','programme analyst'],
      'Brand Manager':              ['brand manager','brand','marketing manager','product manager','category'],
      'Growth Manager':             ['growth manager','growth hacking','user acquisition','growth marketing'],
      'Performance Marketer':       ['performance marketing','paid media','digital marketing','performance marketer'],
      'Digital Marketing Specialist':['digital marketing','seo','sem','social media','content marketing','marketing specialist'],
      'Sales Manager':              ['sales manager','regional sales','sales lead','team leader','revenue manager'],
      'Key Account Manager':        ['key account','kam ','account manager','strategic account','national account'],
      'Category Manager':           ['category manager','buying','merchandising','range management','category lead'],
      'Product Marketing Manager':  ['product marketing','pmm ','go-to-market','product launch','marketing manager'],
      'Operations Manager':         ['operations manager','head of operations','ops manager','plant manager','site manager'],
      'Supply Chain Analyst':       ['supply chain','supply chain analyst','demand planning','s&op','scm'],
      'Logistics Manager':          ['logistics','distribution','warehouse manager','logistics manager','3pl'],
      'Procurement Manager':        ['procurement','sourcing','purchasing','category manager','supply manager'],
      'Warehouse Manager':          ['warehouse','distribution centre','wms','inventory','logistics'],
      'HR Generalist':              ['hr generalist','human resources','hr officer','people operations','hr executive'],
      'HRBP':                       ['hrbp','hr business partner','people partner','hr partner'],
      'Talent Acquisition Specialist':['talent acquisition','recruiter','recruitment','talent','headhunter'],
      'L&D Specialist':             ['l&d','learning and development','training','organisational development','talent development'],
      'Compensation & Benefits Analyst':['compensation','c&b','total rewards','benefits','reward analyst'],
      'Software Engineer':          ['software engineer','software developer','swe','backend','frontend','full stack'],
      'Backend Developer':          ['backend','java developer','python developer','node.js','api developer'],
      'Frontend Developer':         ['frontend','react developer','ui developer','javascript developer','web developer'],
      'Full Stack Developer':       ['full stack','fullstack','mern','mean','web developer','software engineer'],
      'Associate Product Manager':  ['associate product manager','apm ','product analyst','junior pm','product intern'],
      'Senior Product Manager':     ['senior product manager','lead product manager','sr. pm','product lead','head of product','principal pm'],
      'Group Product Manager':      ['group product manager','gpm','director of product','vp product','head of product','chief product officer','cpo'],
      'Data Scientist':             ['data scientist','ml engineer','ai engineer','machine learning','analytics'],
      'Data Analyst':               ['data analyst','business intelligence','bi analyst','sql analyst','reporting analyst'],
      'Machine Learning Engineer':  ['machine learning engineer','ml engineer','ai engineer','deep learning','mlops'],
      'DevOps Engineer':            ['devops','site reliability','sre ','platform engineer','infrastructure engineer'],
      'Cloud Engineer':             ['cloud engineer','aws engineer','azure engineer','gcp engineer','cloud architect'],
      'Cybersecurity Analyst':      ['cybersecurity','security analyst','soc analyst','information security','cyber'],
      'Software Developer':         ['software developer','developer','programmer','java developer','.net developer'],
      'QA Engineer':                ['qa engineer','quality assurance','test engineer','qa analyst','software tester'],
      'SDET':                       ['sdet','test automation','automation engineer','quality engineer','test developer'],
      'Accountant':                 ['accountant','accounting','finance executive','ca ','cpa','bookkeeping'],
      'Auditor':                    ['auditor','internal audit','external audit','assurance','audit associate'],
      'Tax Consultant':             ['tax consultant','tax advisor','tax manager','taxation','tax executive'],
      'Credit Analyst':             ['credit analyst','credit risk','loan analyst','underwriter','credit officer'],
      'Legal Associate':            ['legal associate','lawyer','solicitor','attorney','legal executive'],
      'Corporate Lawyer':           ['corporate lawyer','corporate counsel','legal counsel','company secretary'],
      'Compliance Officer':         ['compliance officer','compliance manager','regulatory affairs','aml','kyc'],
      'Contract Analyst':           ['contract analyst','contract manager','legal analyst','clm','contract specialist'],
      'Policy Analyst':             ['policy analyst','policy officer','public policy','government relations','regulatory'],
      'Research Analyst':           ['research analyst','analyst','market research','research associate','research officer'],
      'Lab Scientist':              ['scientist','lab','research scientist','laboratory','analyst'],
      'Clinical Research Associate':['clinical research','cra ','clinical trials','gcp','cro','clinical monitor'],
      'Doctor':                     ['doctor','physician','mbbs','md ','registrar','medical officer','clinician'],
      'Medical Officer':            ['medical officer','mo ','doctor','physician','clinical officer'],
      'Healthcare Consultant':      ['healthcare consultant','health consultant','nhs consultant','clinical consultant'],
      'Hospital Administrator':     ['hospital administrator','healthcare administrator','hospital manager','health manager'],
      'UI Designer':                ['ui designer','interface designer','visual designer','ui/ux','figma','sketch'],
      'UX Designer':                ['ux designer','user experience','ux researcher','product designer','ux/ui'],
      'Product Designer':           ['product designer','ux designer','ui designer','design lead','senior designer'],
      'Graphic Designer':           ['graphic designer','designer','visual designer','creative designer','art director'],
      'Creative Strategist':        ['creative strategist','brand strategist','content strategist','creative director'],
      'Visual Designer':            ['visual designer','motion designer','graphic designer','digital designer'],
      'Content Writer':             ['content writer','copywriter','content creator','writer','content specialist'],
      'Editor':                     ['editor','sub-editor','copy editor','editorial','commissioning editor'],
      'Journalist':                 ['journalist','reporter','correspondent','news editor','features writer'],
      'Research Associate':         ['research associate','research analyst','junior researcher','research executive'],
      'Academic Researcher':        ['researcher','phd','postdoc','academic','lecturer','research fellow'],
      'Development Consultant':     ['development consultant','ngo','ingo','programme officer','project officer'],
      'Government Consultant':      ['government consultant','public sector consultant','policy consultant'],
      'Inventory Planner':          ['inventory planner','inventory analyst','demand planner','stock planner'],
      'Wealth Manager':             ['wealth manager','financial advisor','relationship manager','portfolio manager','hni'],
      'Corporate Strategy Associate':['corporate strategy','strategy associate','strategy consultant','strategic analyst'],
    };
    const titleSigs = TITLE_MAP[roleKey] || [];
    let expFit = 30; // higher default — transferable skills baseline
    for (const sig of titleSigs) {
      if (resumeLower.includes(sig)) { expFit = 82; break; }
    }
    if (expFit < 82) {
      const partial = titleSigs.filter(s => resumeLower.includes(s.split(' ')[0]));
      if (partial.length >= 2) expFit = 60;
      else if (partial.length === 1) expFit = 45;
    }

    // D3 — Achievements Quality (0.20): quantified bullets — stricter counting
    const quantPattern = /\d+[\.,]?\d*\s*(%|x|×|cr|lakh|million|billion|k\b|mn|bn|hrs?|days?|weeks?|months?|years?|people|members?|team|users?|clients?|deals?|projects?)/gi;
    const quantHits = (resumeText.match(quantPattern) || []).length;
    // Stricter: need more quant bullets to score high
    const achFit = Math.min(quantHits * 9, 100);

    // D4 — Skills Match (0.12): tool/platform signals per role
    const SKILL_MAP = {
      'Product Manager':    ['figma','jira','agile','scrum','roadmap','a/b test','mixpanel','amplitude','okr'],
      'Program Manager':    ['ms project','asana','smartsheet','prince2','pmp','raci','risk register'],
      'Business Analyst':   ['sql','excel','power bi','tableau','visio','bpmn','uat','requirements','sap'],
      'Consultant':         ['excel','powerpoint','mece','framework','financial model','deck','benchmarking'],
      'Finance':            ['excel','bloomberg','dcf','financial modelling','valuation','p&l','ifrs','gaap'],
      'Marketing':          ['google ads','meta ads','seo','crm','hubspot','email marketing','analytics'],
      'Operations':         ['sap','erp','lean','six sigma','sop','supply chain','tableau','excel'],
      'HR':                 ['workday','hris','excel','powerpoint','people analytics','linkedin'],
      'Data Science':       ['python','sql','r','tensorflow','pytorch','scikit-learn','pandas','spark','git'],
      'Strategy':           ['excel','powerpoint','mece','scenario planning','financial modelling','okr'],
      'General Management': ['p&l','excel','powerpoint','crm','erp','board reporting','budgeting'],
      'Sales':              ['salesforce','hubspot','crm','excel','powerpoint','sales navigator'],
      'Investment Banking Analyst': ['excel','bloomberg','factset','dcf','lbo','pitchbook','financial model','powerpoint'],
      'Equity Research Analyst':    ['bloomberg','factset','excel','financial model','dcf','pitchbook','powerpoint'],
      'PE Analyst':                 ['excel','bloomberg','lbo','dcf','financial model','pitchbook','powerpoint'],
      'VC Analyst':                 ['excel','pitch deck','saas metrics','financial model','crunchbase','linkedin'],
      'Financial Analyst':          ['excel','power bi','sap','oracle','financial modelling','sql','powerpoint'],
      'Corporate Finance Analyst':  ['excel','bloomberg','dcf','financial modelling','sap','powerpoint'],
      'Treasury Analyst':           ['excel','sap','bloomberg','treasury management system','swift','fx'],
      'Credit Risk Analyst':        ['excel','sas','python','sql','credit scoring','risk models','sap'],
      'Relationship Manager':       ['crm','salesforce','excel','powerpoint','bloomberg','kyc tools'],
      'Product Analyst':            ['sql','python','mixpanel','amplitude','google analytics','excel','tableau'],
      'Risk Analyst':               ['excel','sas','python','sql','risk models','regulatory reporting'],
      'Brand Manager':              ['nielsen','kantar','excel','powerpoint','google analytics','meta ads'],
      'Growth Manager':             ['google ads','meta ads','sql','python','a/b testing','mixpanel','amplitude'],
      'Performance Marketer':       ['google ads','meta ads','dv360','programmatic','attribution tools','sql'],
      'Digital Marketing Specialist':['google ads','seo tools','hubspot','mailchimp','google analytics','canva'],
      'Sales Manager':              ['salesforce','crm','excel','powerpoint','sales navigator','hubspot'],
      'Key Account Manager':        ['salesforce','crm','excel','powerpoint','nielsen','trade planning tools'],
      'Category Manager':           ['excel','powerpoint','nielsen','kantar','sap','category management tools'],
      'Product Marketing Manager':  ['excel','powerpoint','crm','salesforce','google analytics','figma'],
      'Operations Manager':         ['erp','sap','excel','lean tools','tableau','power bi','ms project'],
      'Supply Chain Analyst':       ['sap','oracle','excel','power bi','sql','anaplan','kinaxis'],
      'Logistics Manager':          ['wms','sap','excel','tms','routing software','3pl systems'],
      'Procurement Manager':        ['sap ariba','coupa','excel','powerpoint','spend analytics','sourcing tools'],
      'HR Generalist':              ['workday','sap successfactors','excel','hris','linkedin','powerpoint'],
      'HRBP':                       ['workday','excel','powerpoint','people analytics','hris','linkedin'],
      'Talent Acquisition Specialist':['linkedin recruiter','ats','workday','greenhouse','lever','excel'],
      'L&D Specialist':             ['lms','articulate','cornerstone','workday learning','excel','powerpoint'],
      'Software Engineer':          ['python','java','javascript','react','node.js','docker','kubernetes','git','aws'],
      'Backend Developer':          ['python','java','go','node.js','postgresql','redis','docker','kubernetes','aws'],
      'Frontend Developer':         ['javascript','typescript','react','vue','html','css','git','webpack'],
      'Full Stack Developer':       ['javascript','react','node.js','python','sql','docker','git','aws'],
      'Data Scientist':             ['python','sql','tensorflow','pytorch','scikit-learn','pandas','spark','tableau'],
      'Data Analyst':               ['sql','python','excel','power bi','tableau','google analytics'],
      'Machine Learning Engineer':  ['python','tensorflow','pytorch','kubernetes','docker','mlflow','spark','git'],
      'DevOps Engineer':            ['docker','kubernetes','terraform','jenkins','git','aws','gcp','prometheus','grafana'],
      'Cloud Engineer':             ['aws','gcp','azure','terraform','kubernetes','docker','python','networking'],
      'Cybersecurity Analyst':      ['siem','splunk','qradar','python','nessus','wireshark','firewalls','ids/ips'],
      'Software Developer':         ['java','python','c#','.net','sql','git','agile','eclipse','vs code'],
      'QA Engineer':                ['selenium','cypress','jira','postman','python','java','jenkins','testng'],
      'SDET':                       ['selenium','python','java','jenkins','github actions','postman','pytest','testng'],
      'Accountant':                 ['tally','sap','quickbooks','excel','zoho books','xero','myob'],
      'Auditor':                    ['excel','caseware','teammate','erp','sap','oracle','powerpoint'],
      'Tax Consultant':             ['excel','tax software','sap','corptax','powerpoint','onesource'],
      'UI Designer':                ['figma','sketch','adobe xd','invision','zeplin','principle','protopie'],
      'UX Designer':                ['figma','sketch','miro','hotjar','optimal workshop','usertesting','invision'],
      'Product Designer':           ['figma','sketch','adobe xd','miro','protopie','user testing tools'],
      'Graphic Designer':           ['adobe illustrator','photoshop','indesign','figma','canva','after effects'],
      'Data Analyst':               ['sql','python','excel','power bi','tableau','google analytics'],
      'Senior Product Manager':     ['figma','jira','agile','scrum','roadmap','mixpanel','amplitude','a/b test','sql','tableau','power bi','miro','confluence','notion','productboard','pendo','fullstory','google analytics'],
      'Group Product Manager':      ['figma','jira','agile','scrum','roadmap','mixpanel','amplitude','a/b test','sql','tableau','power bi','miro','confluence','notion','productboard','pendo','fullstory','google analytics','okr tools','looker'],
    };
    const skillSigs = SKILL_MAP[roleKey] || [];
    const skillHits2 = skillSigs.filter(s => resumeLower.includes(s)).length;
    const skillFit = Math.min((skillHits2 / Math.max(skillSigs.length, 1)) * 100, 100);

    // D5 — Resume Structure (0.12): stricter structure scoring
    const hasContact = /email|phone|linkedin|@/.test(resumeLower);
    const hasSummary = /summary|objective|profile|about/.test(resumeLower);
    const hasBullets = (resumeText.match(/^[\s]*[-•▸►▪]/m) !== null);
    const hasEducation = /education|degree|university|college|bachelor|master|mba/i.test(resumeLower);
    const hasExperience = /experience|work history|employment/i.test(resumeLower);
    const hasSkillsSection = /skills|technical skills|core competencies/i.test(resumeLower);
    const structFit = (hasContact ? 22 : 5) + (hasSummary ? 18 : 5) + (hasBullets ? 15 : 5)
                    + (hasEducation ? 15 : 5) + (hasExperience ? 18 : 5) + (hasSkillsSection ? 12 : 5);

    // D6 — Leadership Signals (0.04)
    const leaderPhrases = ['managed a team','led a team','managed team of','led team of','head of','supervised','mentored','coached','direct reports','p&l','board','c-suite'];
    const leaderHits2 = leaderPhrases.filter(p => resumeLower.includes(p)).length;
    const leaderFit = Math.min(leaderHits2 * 22 + 15, 100);

    // D7 — ATS Formatting (0.06): detect formatting issues — stricter
    let fmtDeductions = 0;
    if (resumeText.includes('\t')) fmtDeductions += 20;
    if (/[│┃┆┊╎║]/.test(resumeText)) fmtDeductions += 15; // table chars
    if (resumeText.split('\n').some(l => l.length > 200)) fmtDeductions += 10; // very long lines suggest bad format
    const fmtFit = Math.max(100 - fmtDeductions, 55);

    // FINAL: identical weights to overall ATS formula
    const rawScore = Math.round(
      kwHit      * 0.28 +
      expFit     * 0.18 +
      achFit     * 0.20 +
      skillFit   * 0.12 +
      structFit  * 0.12 +
      leaderFit  * 0.04 +
      fmtFit     * 0.06
    );

    // Hard caps based on keyword evidence
    let capped = rawScore;
    if (hits < 4)  capped = Math.min(capped, 45);
    else if (hits < 7)  capped = Math.min(capped, 60);
    else if (hits < 10) capped = Math.min(capped, 72);
    else if (hits < 15) capped = Math.min(capped, 82);

    return Math.max(0, Math.min(100, capped));
  }

  // Score ALL stream roles (no pre-slice), blend JS (75%) + AI (25%, capped)
  const streamRoleScores = STREAM_ROLES.map(roleKey => {
    const jsScore = computeRoleScoreJS(roleKey);
    const aiRs    = (resultA.roleScores || []).find(r => r.role === roleKey);
    const hits    = countKeywordHits(roleKey);
    let aiScore   = aiRs ? aiRs.score : jsScore;
    // Apply strict keyword-based caps to AI scores
    if (hits < 4)  aiScore = Math.min(aiScore, 45);
    else if (hits < 7) aiScore = Math.min(aiScore, 60);
    else if (hits < 10) aiScore = Math.min(aiScore, 72);
    else if (hits < 15) aiScore = Math.min(aiScore, 82);
    const blended = Math.round(jsScore * 0.60 + aiScore * 0.40);
    return { role: roleKey, score: Math.max(0, Math.min(100, blended)) };
  });

  // ── JS-side calibration of AI's overall ATS score ─────────────────────────
  // The AI tends to inflate scores. We compute a JS-side ATS estimate and
  // blend it with the AI score to ground it in reality.
  const selectedRoleKey = role || 'Business Analyst';
  const jsOverallHits = countKeywordHits(selectedRoleKey);
  const roleBank = ROLE_KEYWORD_BANKS[selectedRoleKey] || [];
  const jsOverallKw = Math.min((jsOverallHits / Math.max(roleBank.length, 1)) * 100, 100);
  const quantPatternGlobal = /\d+[\.,]?\d*\s*(%|x|×|cr|lakh|million|billion|k\b|mn|bn|hrs?|days?|weeks?|months?|years?|people|members?|team|users?|clients?|deals?|projects?)/gi;
  const globalQuantHits = (resumeText.match(quantPatternGlobal) || []).length;
  const jsOverallAch = Math.min(globalQuantHits * 12, 100);
  // Relaxed baseline: anchor at 65 instead of 60, give more weight to AI score
  const jsOverallEst = Math.round(jsOverallKw * 0.28 + jsOverallAch * 0.18 + 65 * 0.54);
  
  let calibratedAtsScore = resultA.atsScore || 60;
  // Softer blending: only pull down when AI is significantly above JS estimate
  if (calibratedAtsScore > jsOverallEst + 30) {
    calibratedAtsScore = Math.round(jsOverallEst * 0.25 + calibratedAtsScore * 0.75);
  }
  // Relaxed hard caps (+8-10 pts each tier)
  if (jsOverallHits < 12) calibratedAtsScore = Math.min(calibratedAtsScore, 86);
  if (jsOverallHits < 7)  calibratedAtsScore = Math.min(calibratedAtsScore, 76);
  if (jsOverallHits < 4)  calibratedAtsScore = Math.min(calibratedAtsScore, 62);
  let calibratedRecruiterScore = resultA.recruiterScore || 60;
  if (calibratedRecruiterScore > calibratedAtsScore + 15) {
    calibratedRecruiterScore = calibratedAtsScore + Math.round((calibratedRecruiterScore - calibratedAtsScore) * 0.5);
  }

  // Anchor multi-role scores to the calibrated overall ATS score.
  const selectedRoleEntry = streamRoleScores.find(r => r.role === selectedRoleKey);
  const rawSelectedScore = selectedRoleEntry ? selectedRoleEntry.score : (streamRoleScores[0]?.score || 70);
  const usedScores = new Set();
  // Scale multi-role scores proportionally to calibrated overall score
  // and apply the same relaxed hard caps for consistency
  const scaleFactor_mr = rawSelectedScore > 0 ? calibratedAtsScore / rawSelectedScore : 1;
  const deduped = streamRoleScores
    .sort((a, b) => b.score - a.score)
    .map(rs => {
      let s = Math.round(rs.score * scaleFactor_mr);
      // Apply same relaxed hard caps as overall score
      if (jsOverallHits < 12) s = Math.min(s, 86);
      if (jsOverallHits < 7)  s = Math.min(s, 76);
      if (jsOverallHits < 4)  s = Math.min(s, 62);
      s = Math.max(0, Math.min(100, s));
      // Ensure selected role matches calibratedAtsScore exactly
      if (rs.role === selectedRoleKey) s = calibratedAtsScore;
      while (usedScores.has(s)) s = Math.max(0, s - 1);
      usedScores.add(s);
      return { ...rs, score: s };
    })
    .slice(0, 10);

  // Merge resultC (match data) + resultD (action plan) into a single jdMatch object
  let jdMatch = null;
  if (jdText) {
    const roleFitSuggestions = (resultD?.roleFitSuggestions || []).filter(s => s && s.action);
    if (resultC) {
      jdMatch = { ...resultC, roleFitSuggestions };
    } else {
      jdMatch = {
        percentage: 0, matchingSkills: [], missingSkills: [],
        allMissingJdKeywords: [], experienceGaps: [],
        recommendation: 'JD analysis could not be completed. Please re-analyse.',
        jdTopMissingKeywords: [], roleFitSuggestions,
      };
    }
  }

  // Filter out false-positive "future-dated" ATS issues from AI response
  const filteredAtsIssues = (resultA.atsIssues || []).filter(iss => {
    const text = `${iss.issue || ''} ${iss.fix || ''}`.toLowerCase();
    return !text.includes('future-dated') && !text.includes('future date') && !text.includes('future employment');
  });

  // Align dimension subscores with calibrated ATS score so weighted sum matches
  const rawScores = resultA.scores || {};
  const weights = { keywordMatch: 0.28, achievements: 0.20, experienceRelevance: 0.18, resumeStructure: 0.12, skillsMatch: 0.12, atsFormatting: 0.06, leadershipSignals: 0.04 };
  const rawWeightedSum = Object.entries(weights).reduce((s, [k, w]) => s + (rawScores[k] || 60) * w, 0);
  const scaleFactor = rawWeightedSum > 0 ? calibratedAtsScore / rawWeightedSum : 1;
  const calibratedScores = {};
  for (const [k, w] of Object.entries(weights)) {
    calibratedScores[k] = Math.max(0, Math.min(100, Math.round((rawScores[k] || 60) * scaleFactor)));
  }
  // Verify: adjust rounding so weighted sum matches calibratedAtsScore exactly
  const newWeightedSum = Math.round(Object.entries(weights).reduce((s, [k, w]) => s + calibratedScores[k] * w, 0));
  if (newWeightedSum !== calibratedAtsScore) {
    // Adjust the highest-weight dimension to compensate
    const diff = calibratedAtsScore - newWeightedSum;
    calibratedScores.keywordMatch = Math.max(0, Math.min(100, calibratedScores.keywordMatch + Math.round(diff / 0.28)));
  }

  const merged = {
    ...resultA,
    scores: calibratedScores,
    atsScore: calibratedAtsScore,
    recruiterScore: calibratedRecruiterScore,
    atsIssues: filteredAtsIssues,
    roleScores: deduped,
    lineByLineAnalysis: repairedLines,
    hasJD: !!jdText,
    jdMatch,
    stream, industry, role,
    // Always use JS-extracted values if AI returned empty/placeholder arrays
    extractedKeywords: (resultA.extractedKeywords?.filter(k => k && !k.startsWith('kw')).length >= 5)
      ? resultA.extractedKeywords
      : combined.length > 0 ? combined : jsExtractedKeywords,
    skills: (resultA.skills?.filter(s => s && !s.startsWith('skill')).length >= 5)
      ? resultA.skills
      : jsSkills.length > 0 ? jsSkills : [],
  };
  return merged;
}
/* ─────────────────────────────────────────────
   AI API — CHAT (via Lovable Cloud Edge Function)
───────────────────────────────────────────── */
async function sendChat(history, ctx) {
  const systemPrompt = `You are CVsetuAI Coach, an expert career advisor. Resume context: ATS Score ${ctx.atsScore}/100. Issues: ${ctx.weaknesses?.join(', ')}. Strengths: ${ctx.strengths?.slice(0,2).join(', ')}. FORMAT your replies using: ## for main section headings, ### for sub-headings, - for bullet points, **text** for bold key terms, and numbered lists (1. 2. 3.) for action steps. Use colourful structured sections. Be specific, actionable, and concise. Max 4 sections.`;
  return enqueue(async () => {
    const res = await fetchWithRetry(`${SUPABASE_URL}/functions/v1/resume-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ messages: history, systemPrompt })
    });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    return d.text;
  });
}

/* ─────────────────────────────────────────────
   SVG SCORE GAUGE
───────────────────────────────────────────── */
const ScoreGauge = memo(function ScoreGauge({ score, size = 180 }) {
  const R  = Math.round(size * 0.37);
  const cx = size / 2, cy = size / 2;
  const C2 = 2 * Math.PI * R;
  const arc    = C2 * 0.75;
  const filled = (Math.max(0, Math.min(score, 100)) / 100) * arc;
  const col    = scoreColor(score);
  const fs1    = size * 0.19, fs2 = size * 0.073;

  return (
    <svg width={size} height={Math.round(size * 0.87)}
         viewBox={`0 0 ${size} ${Math.round(size * 0.87)}`}
         style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <filter id={`glow-${score}`}>
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id={`arcGrad-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={col} stopOpacity="0.6"/>
          <stop offset="100%" stopColor={col}/>
        </linearGradient>
      </defs>
      {/* track */}
      <circle cx={cx} cy={cy} r={R} fill="none"
        stroke="rgba(195,165,110,0.2)" strokeWidth={size * 0.072} strokeLinecap="round"
        strokeDasharray={`${arc} ${C2 - arc}`}
        transform={`rotate(135 ${cx} ${cy})`} />
      {/* score arc */}
      <circle cx={cx} cy={cy} r={R} fill="none"
        stroke={col} strokeWidth={size * 0.072} strokeLinecap="round"
        strokeDasharray={`${filled} ${C2 - filled}`}
        transform={`rotate(135 ${cx} ${cy})`}
        filter={`url(#glow-${score})`} />
      {/* number */}
      <text x={cx} y={cy + fs1 * 0.38} textAnchor="middle"
        fill="#2A1D08" fontSize={fs1} fontWeight="700"
        fontFamily="'Playfair Display', serif">{score}</text>
      {/* label */}
      <text x={cx} y={cy + fs1 * 0.38 + fs2 * 2} textAnchor="middle"
        fill={col} fontSize={fs2} fontWeight="600"
        fontFamily="'Jost', sans-serif" letterSpacing="1.5">
        {scoreLabel(score).toUpperCase()}
      </text>
      <text x={cx} y={cy + fs1 * 0.38 + fs2 * 3.6} textAnchor="middle"
        fill={T.muted} fontSize={fs2 * 0.85}
        fontFamily="'Jost', sans-serif" letterSpacing="0.5">ATS SCORE</text>
    </svg>
  );
});

/* ─────────────────────────────────────────────
   AMBIENT BACKGROUND ORBS
───────────────────────────────────────────── */
const BgOrbs = memo(function BgOrbs() {
  return (
    <div className="riq-orb-container">
      {/* Grain texture */}
      <div className="riq-grain" />
      <div style={{ position:'absolute',width:700,height:700,borderRadius:'50%',background:'radial-gradient(circle, rgba(212,168,80,0.22) 0%, transparent 65%)',top:-200,right:-100,animation:'orb1 14s ease-in-out infinite' }} />
      <div style={{ position:'absolute',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle, rgba(76,138,114,0.14) 0%, transparent 65%)',bottom:-100,left:-80,animation:'orb2 18s ease-in-out infinite 4s' }} />
      <div style={{ position:'absolute',width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle, rgba(184,92,82,0.10) 0%, transparent 65%)',top:'35%',left:'30%',animation:'orb3 22s ease-in-out infinite 8s' }} />
      <div style={{ position:'absolute',width:300,height:300,borderRadius:'50%',background:'radial-gradient(circle, rgba(176,125,42,0.12) 0%, transparent 65%)',bottom:'20%',right:'20%',animation:'orb1 16s ease-in-out infinite 2s' }} />
    </div>
  );
});

/* ─────────────────────────────────────────────
   SHARED UI PRIMITIVES
───────────────────────────────────────────── */
const GlassCard = memo(function GlassCard({ children, style, deep }) {
  return (
    <div className={deep ? 'glass-card-deep hover-lift' : 'glass-card hover-lift'}
         style={{ padding: 24, ...style }}>
      {children}
    </div>
  );
});

const SectionHead = memo(function SectionHead({ icon, title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily:"'Playfair Display', serif", fontWeight: 700, fontSize: 17, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}{title}
      </div>
      {sub && <p style={{ fontSize: 13, color: T.muted, margin: '5px 0 0', lineHeight: 1.5, fontFamily:"'Jost',sans-serif" }}>{sub}</p>}
    </div>
  );
});

const ScoreBar = memo(function ScoreBar({ label, score, weight }) {
  const col = scoreColor(score);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems:'center' }}>
        <span style={{ fontSize: 13, color: T.text, fontFamily:"'Jost',sans-serif" }}>{label}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {weight && <span style={{ fontSize: 11, color: T.muted, background: 'rgba(195,165,110,0.15)', border:'1px solid rgba(195,165,110,0.3)', padding: '1px 8px', borderRadius: 20, fontFamily:"'Jost',sans-serif" }}>{weight}</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: col, minWidth: 28, textAlign: 'right', fontFamily:"'Playfair Display',serif" }}>{score}</span>
        </div>
      </div>
      <div style={{ height: 7, background: 'rgba(195,165,110,0.2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(90deg, ${col}99, ${col})`, borderRadius: 4, transition:'width 0.8s ease' }} />
      </div>
    </div>
  );
});

const Pill = memo(function Pill({ children, type = 'default', small }) {
  const map = {
    ok:      { bg: T.sageBg, border: `rgba(76,138,114,0.3)`,  color: T.ok     },
    warn:    { bg: T.goldBg, border: `rgba(176,125,42,0.3)`,  color: T.warn   },
    danger:  { bg: T.roseBg, border: `rgba(184,92,82,0.3)`,   color: T.danger },
    blue:    { bg: T.blueBg, border: `rgba(74,112,156,0.3)`,  color: T.blue   },
    default: { bg: 'rgba(195,165,110,0.12)', border:'rgba(195,165,110,0.3)', color: T.muted },
  };
  const c = map[type] || map.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '2px 9px' : '4px 12px',
      borderRadius: 20, fontSize: small ? 11 : 12, fontWeight: 500,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      margin: '2px 3px', fontFamily:"'Jost',sans-serif",
    }}>{children}</span>
  );
});


/* ── LandingScreen static data ── */
const LANDING_FEATURES = [
    { icon: '🎯', t: 'ATS Score Engine',     d: 'Simulate 7-factor ATS scoring used by Fortune 500 companies with keyword density, formatting, and structure checks.' },
    { icon: '🔑', t: 'Keyword Intelligence', d: 'Find missing keywords across 50+ role-specific libraries mapped to your target industry.' },
    { icon: '✒️', t: 'AI Resume Rewriter',   d: 'Transform weak bullets into impact-driven achievement statements with quantified results.' },
    { icon: '📊', t: 'Multi-Role Fit',       d: 'Discover which of 10+ roles your resume best matches with percentage-based scoring.' },
    { icon: '🤖', t: 'AI Career Coach',      d: 'Ask anything — get instant expert career guidance powered by advanced AI models.' },
    { icon: '📋', t: 'JD Match Engine',      d: 'Upload any job description and see exact skills gap analysis with actionable fixes.' },
    { icon: '📝', t: 'Line-by-Line Analysis',d: 'Every bullet point reviewed and rewritten for maximum ATS impact and recruiter appeal.' },
    { icon: '🏗️', t: 'Resume Builder',       d: 'Create a professional resume from scratch with 4 ATS-optimized templates.' },
    { icon: '📈', t: 'Priority Action Plan', d: 'Get a ranked list of high-impact fixes sorted by effort vs. score improvement.' },
];

const HOW_IT_WORKS = [
  { step:'01', title:'Upload Resume', desc:'Drop your PDF resume — we extract every detail in seconds.', icon:'📄' },
  { step:'02', title:'Select Your Target', desc:'Pick your stream, industry, and dream role for precision analysis.', icon:'🎯' },
  { step:'03', title:'Get Intelligence Report', desc:'Receive a 15-module ATS report with scores, rewrites, and action plans.', icon:'📊' },
];

const TESTIMONIALS = [
  { name:'Aarav K.', role:'MBA Finance', text:'Went from 62 to 89 ATS score in one session. Got interview calls from 3 top banks within a week.', rating:5 },
  { name:'Priya M.', role:'Product Manager', text:'The line-by-line rewrite feature is incredible. Every bullet became an achievement statement.', rating:5 },
  { name:'Rahul S.', role:'Consultant', text:'Multi-role fit showed me I was a better match for Strategy than Operations. Changed my entire approach.', rating:5 },
  { name:'Sneha D.', role:'Data Analyst', text:'The keyword intelligence found 12 missing keywords. My resume went from ignored to shortlisted.', rating:5 },
];

const FAQ_DATA = [
  { q:'How accurate is the ATS scoring?', a:'Our 7-factor scoring engine simulates the exact algorithms used by top ATS systems like Workday, Taleo, and Greenhouse. It checks keyword density, formatting, quantification, structure, and more — achieving 95%+ accuracy against real ATS filters.' },
  { q:'Is my resume data secure?', a:'Your resume is processed in real-time and never stored on our servers. All analysis happens through encrypted connections and data is discarded after your session ends.' },
  { q:'Which industries and roles are supported?', a:'We support 12+ streams including MBA, Engineering, Law, Medicine, Design, and more — covering 80+ specific roles across 50+ industries with role-specific keyword libraries.' },
  { q:'Can I use this for multiple resumes?', a:'Yes! You can analyze as many resumes as you want. Each analysis is independent and gives you a fresh, comprehensive report.' },
  { q:'How does the AI Resume Rewriter work?', a:'Our AI analyzes each bullet point for impact, specificity, and ATS compatibility. It rewrites weak statements into quantified achievement bullets while keeping your original meaning — ensuring improved lines are 3-10% longer than originals for added detail.' },
];

/* ─────────────────────────────────────────────
   LANDING SCREEN
───────────────────────────────────────────── */
function ScrollReveal({ children, delay = 0, direction = 'up', style = {} }) {
  const ref = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const transforms = { up: 'translateY(40px)', down: 'translateY(-40px)', left: 'translateX(40px)', right: 'translateX(-40px)' };
  return (
    <div ref={ref} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translate(0,0)' : (transforms[direction] || transforms.up),
      transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>
      {children}
    </div>
  );
}

function LandingScreen({ onStart, onCreateResume }) {
  const [openFaq, setOpenFaq] = React.useState(null);

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: "'Jost', sans-serif", overflowX: 'hidden', position:'relative' }}>
      <BgOrbs />

      {/* ── Nav ── */}
      <nav style={{ position:'fixed',top:0,left:0,right:0,zIndex:50,display:'flex',justifyContent:'space-between',alignItems:'center', padding:'18px 40px', borderBottom:`1px solid rgba(195,165,110,0.25)`, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', background:'rgba(253,248,240,0.85)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <img src={cvsetuaiLogo} alt="CVsetuAI" style={{ height:40, objectFit:'contain' }} />
        </div>
        <div className="riq-nav-right" style={{ display:'flex',gap:8,alignItems:'center' }}>
          <span className="riq-nav-badge" style={{ fontSize:12,color:T.muted,padding:'5px 14px', background:'rgba(255,255,255,0.55)', backdropFilter:'blur(10px)', border:`1px solid rgba(195,165,110,0.3)`,borderRadius:20, letterSpacing:'0.8px', fontFamily:"'Jost',sans-serif" }}>AI · FREE · INSTANT</span>
          <button className="btn-ghost" onClick={()=>{ track('cta-create-resume', { location: 'nav' }); onCreateResume(); }} style={{ padding:'9px 20px', fontSize:13, display:'flex',alignItems:'center',gap:6 }}>
            ✨ Create Resume
          </button>
          <button className="btn-primary" onClick={()=>{ track('cta-analyze-resume', { location: 'nav' }); onStart(); }} style={{ padding:'9px 22px', fontSize:13 }}>
            Analyze Resume →
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="riq-hero-pad" style={{ position:'relative',zIndex:1,textAlign:'center',padding:'130px 40px 60px', animation:'fadeUp .9s ease-out' }}>
        <div style={{ display:'inline-flex',alignItems:'center',gap:8, background:'rgba(255,255,255,0.55)', backdropFilter:'blur(12px)', border:`1px solid rgba(176,125,42,0.25)`, borderRadius:24, padding:'7px 18px', marginBottom:28, fontSize:12, color:T.gold, letterSpacing:'0.8px' }}>
          ✦ &nbsp; Trusted by students &amp; consultants
        </div>
        <h1 className="riq-hero-title" style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(36px,5.5vw,68px)', fontWeight:800, lineHeight:1.1, letterSpacing:'-1.5px', marginBottom:22, color:T.text }}>
          Beat ATS Filters &amp;<br />
          <em style={{ fontStyle:'italic', background:`linear-gradient(130deg,${T.gold},${T.goldLight})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Get Shortlisted</em>
        </h1>
        <p style={{ fontSize:17,color:T.muted,maxWidth:560,margin:'0 auto 44px',lineHeight:1.7,fontWeight:400 }}>
          Upload your resume and receive the deepest AI-powered ATS intelligence report — 15 analysis modules, line-by-line rewrites, and a priority action plan to land interviews at top firms.
        </p>
        <div className="riq-hero-btns" style={{ display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap' }}>
          <button className="btn-primary" onClick={()=>{ track('cta-analyze-resume', { location: 'hero' }); onStart(); }} style={{
            padding:'15px 36px', fontSize:16,
            display:'flex',alignItems:'center',gap:9,
            animation:'floatY 3.5s ease-in-out infinite',
          }}>⚡ Analyze My Resume</button>
          <button className="btn-create-scratch" onClick={()=>{ track('cta-create-resume', { location: 'hero' }); onCreateResume(); }} style={{ padding:'15px 30px', fontSize:15, display:'flex',alignItems:'center',gap:8 }}>
            ✨ Create Resume from Scratch
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="riq-stats-hero" style={{ position:'relative',zIndex:1,display:'flex',justifyContent:'center',gap:48,padding:'0 24px 80px',flexWrap:'wrap' }}>
        {[['15+','Analysis Modules'],['50K+','Keywords Library'],['95%','ATS Accuracy'],['~15s','Analysis Time'],['12+','Streams Covered'],['80+','Roles Mapped']].map(([v,l],i) => (
          <div key={l} style={{ textAlign:'center',animation:`fadeUp .6s ease-out ${i*.1+0.3}s both` }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:T.gold }}>{v}</div>
            <div style={{ fontSize:12,color:T.muted,marginTop:5,letterSpacing:'0.8px' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── How It Works ── */}
      <ScrollReveal>
      <div style={{ position:'relative',zIndex:1,maxWidth:900,margin:'0 auto',padding:'0 40px 90px' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",textAlign:'center',fontSize:32,fontWeight:700,marginBottom:8,color:T.text }}>How It Works</h2>
        <p style={{ textAlign:'center',color:T.muted,fontSize:14,marginBottom:50,fontFamily:"'Jost',sans-serif" }}>Three simple steps to a winning resume</p>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:24, position:'relative' }} className="riq-3col">
          {/* Connecting line */}
          <div className="riq-nav-badge" style={{ position:'absolute',top:45,left:'16%',right:'16%',height:2, background:`linear-gradient(90deg,${T.gold},${T.goldLight},${T.gold})`,opacity:0.3,zIndex:0 }} />
          {HOW_IT_WORKS.map((s,i) => (
            <div key={i} className="glass-card" style={{ padding:'32px 24px',textAlign:'center',position:'relative',zIndex:1,animation:`fadeUp .6s ease-out ${i*0.15}s both` }}>
              <div style={{ width:56,height:56,borderRadius:'50%',background:`linear-gradient(135deg,${T.gold},${T.goldLight})`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 18px',fontSize:24,color:'#fff',fontWeight:700,boxShadow:'0 6px 20px rgba(176,125,42,0.3)',animation:`stepPulse 2.5s ease-in-out ${i*0.4}s infinite` }}>
                {s.icon}
              </div>
              <div style={{ fontSize:11,color:T.gold,fontWeight:700,letterSpacing:'2px',marginBottom:8 }}>STEP {s.step}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:18,marginBottom:8,color:T.text }}>{s.title}</div>
              <div style={{ fontSize:13,color:T.muted,lineHeight:1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      </ScrollReveal>

      {/* ── Features ── */}
      <ScrollReveal delay={0.05}>
      <div className="riq-section-pad" style={{ position:'relative',zIndex:1,maxWidth:1040,margin:'0 auto',padding:'0 40px 90px' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",textAlign:'center',fontSize:32,fontWeight:700,marginBottom:8,color:T.text }}>Everything You Need to Get Shortlisted</h2>
        <p style={{ textAlign:'center',color:T.muted,fontSize:14,marginBottom:44,fontFamily:"'Jost',sans-serif" }}>15 intelligent modules working together to maximise your chances.</p>
        <div className="riq-feat-grid" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:18 }}>
          {LANDING_FEATURES.map((f,i) => (
            <div key={i} className="glass-card hover-lift" style={{
              padding:'28px 24px',
              animation:`fadeUp .6s ease-out ${i*.07}s both`,
            }}>
              <div style={{ fontSize:32,marginBottom:14 }}>{f.icon}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:17,marginBottom:8,color:T.text }}>{f.t}</div>
              <div style={{ fontSize:13,color:T.muted,lineHeight:1.65,fontFamily:"'Jost',sans-serif" }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      </ScrollReveal>

      {/* ── What Makes Us Different ── */}
      <ScrollReveal delay={0.05}>
      <div style={{ position:'relative',zIndex:1,maxWidth:900,margin:'0 auto',padding:'0 40px 90px' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",textAlign:'center',fontSize:32,fontWeight:700,marginBottom:8,color:T.text }}>Why CVsetuAI?</h2>
        <p style={{ textAlign:'center',color:T.muted,fontSize:14,marginBottom:44,fontFamily:"'Jost',sans-serif" }}>Built different from generic resume checkers</p>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }} className="riq-2col">
          {[
            { icon:'🎓', title:'Stream-Specific Analysis', desc:'Not generic — tailored to MBA, Engineering, Law, Medical, Design & 8 more streams with role-specific keyword libraries.' },
            { icon:'🔬', title:'Deep Line-by-Line Review', desc:'Every single bullet point gets analyzed and rewritten. No surface-level tips — actionable rewrites you can copy-paste.' },
            { icon:'⚖️', title:'Strict But Fair Scoring', desc:'Our calibrated scoring reflects reality. Average resumes score 65-75, not inflated 90+ scores that give false confidence.' },
            { icon:'🗺️', title:'Multi-Role Career Mapping', desc:'See your fit across 10+ roles in your stream. Discover unexpected career paths where your skills shine.' },
          ].map((item, i) => (
            <div key={i} className="glass-card-deep" style={{ padding:'28px 24px', animation:`fadeUp .6s ease-out ${i*0.1}s both` }}>
              <div style={{ fontSize:28,marginBottom:12 }}>{item.icon}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:17,marginBottom:8,color:T.text }}>{item.title}</div>
              <div style={{ fontSize:13,color:T.muted,lineHeight:1.65 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      </ScrollReveal>

      {/* ── Testimonials ── */}
      <ScrollReveal delay={0.05}>
      <div style={{ position:'relative',zIndex:1,maxWidth:1040,margin:'0 auto',padding:'0 40px 90px' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",textAlign:'center',fontSize:32,fontWeight:700,marginBottom:8,color:T.text }}>What Users Say</h2>
        <p style={{ textAlign:'center',color:T.muted,fontSize:14,marginBottom:44,fontFamily:"'Jost',sans-serif" }}>Real results from real job seekers</p>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16 }} className="riq-4col">
          {TESTIMONIALS.map((t,i) => (
            <div key={i} className="glass-card hover-lift" style={{ padding:'24px 20px', animation:`fadeUp .6s ease-out ${i*0.1}s both` }}>
              <div style={{ marginBottom:14,color:T.gold,fontSize:14,letterSpacing:2 }}>{'★'.repeat(t.rating)}</div>
              <p style={{ fontSize:13,color:T.text,lineHeight:1.7,marginBottom:18,fontStyle:'italic' }}>"{t.text}"</p>
              <div style={{ borderTop:`1px solid rgba(195,165,110,0.25)`,paddingTop:12 }}>
                <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:14,color:T.text }}>{t.name}</div>
                <div style={{ fontSize:11,color:T.muted,marginTop:2 }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </ScrollReveal>

      {/* ── FAQ ── */}
      <ScrollReveal delay={0.05}>
      <div style={{ position:'relative',zIndex:1,maxWidth:720,margin:'0 auto',padding:'0 40px 90px' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",textAlign:'center',fontSize:32,fontWeight:700,marginBottom:8,color:T.text }}>Frequently Asked Questions</h2>
        <p style={{ textAlign:'center',color:T.muted,fontSize:14,marginBottom:40,fontFamily:"'Jost',sans-serif" }}>Everything you need to know</p>
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {FAQ_DATA.map((faq,i) => (
            <div key={i} className="glass-card" style={{ overflow:'hidden',cursor:'pointer',transition:'all 0.2s' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div style={{ padding:'18px 22px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <span style={{ fontWeight:600,fontSize:14,color:T.text,fontFamily:"'Jost',sans-serif" }}>{faq.q}</span>
                <span style={{ color:T.gold,fontSize:18,transition:'transform 0.2s',transform:openFaq===i?'rotate(45deg)':'rotate(0deg)',flexShrink:0,marginLeft:12 }}>+</span>
              </div>
              {openFaq === i && (
                <div style={{ padding:'0 22px 18px',fontSize:13,color:T.muted,lineHeight:1.7,animation:'fadeIn 0.25s ease-out' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      </ScrollReveal>

      {/* ── CTA Strip ── */}
      <ScrollReveal delay={0.05}>
      <div style={{ position:'relative',zIndex:1,textAlign:'center',padding:'60px 40px', background:'rgba(255,255,255,0.40)', backdropFilter:'blur(20px)', borderTop:`1px solid rgba(195,165,110,0.25)` }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,marginBottom:12,color:T.text }}>Ready to Beat the ATS?</h2>
        <p style={{ color:T.muted,marginBottom:30,fontSize:15,fontFamily:"'Jost',sans-serif",maxWidth:480,margin:'0 auto 30px' }}>Upload your PDF in seconds. Get your full intelligence report instantly — completely free.</p>
        <div style={{ display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap' }}>
          <button className="btn-primary" onClick={()=>{ track('cta-analyze-resume', { location: 'footer' }); onStart(); }} style={{ padding:'15px 38px', fontSize:16 }}>
            Get Free ATS Report →
          </button>
          <button className="btn-ghost" onClick={()=>{ track('cta-create-resume', { location: 'footer' }); onCreateResume(); }} style={{ padding:'15px 30px', fontSize:15 }}>
            ✨ Build Resume from Scratch
          </button>
        </div>
      </div>
      </ScrollReveal>

      {/* ── Footer ── */}
      <div style={{ position:'relative',zIndex:1,textAlign:'center',padding:'28px 40px',borderTop:`1px solid rgba(195,165,110,0.2)`,background:'rgba(253,248,240,0.6)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:8 }}>
          <img src={cvsetuaiLogo} alt="CVsetuAI" style={{ height:30, objectFit:'contain' }} />
        </div>
        <p style={{ fontSize:11,color:T.dim }}>AI-Powered ATS Intelligence · Built for Job Seekers</p>
      </div>
    </div>
  );
}


/* ── UploadScreen static styles ── */
const UPLOAD_INPUT_STYLE = {
  width:'100%',padding:'11px 16px',
  background:'rgba(255,255,255,0.55)',
  backdropFilter:'blur(10px)',
  border:'1px solid rgba(195,165,110,0.35)',
  borderRadius:11,color:'#2A1D08',fontSize:14,cursor:'pointer',outline:'none',
  fontFamily:"'Jost',sans-serif",
};
const UPLOAD_LABEL_STYLE = {
  fontSize:12,fontWeight:600,color:'#7A6B52',textTransform:'uppercase',
  letterSpacing:'1px',display:'block',marginBottom:9,fontFamily:"'Jost',sans-serif",
};
function uploadDropZone(active) {
  return {
    border: '2px dashed ' + (active ? '#B07D2A' : 'rgba(195,165,110,0.4)'),
    borderRadius: 14, padding: '32px 22px', textAlign: 'center', cursor: 'pointer',
    background: active ? 'rgba(176,125,42,0.06)' : 'rgba(255,255,255,0.45)',
    backdropFilter: 'blur(12px)', transition: 'all .2s',
  };
}

/* ─────────────────────────────────────────────
   UPLOAD SCREEN
───────────────────────────────────────────── */
function UploadScreen({ onBack, onAnalyze }) {
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile,     setJdFile]     = useState(null);
  const [stream,     setStream]     = useState('');
  const [industry,   setIndustry]   = useState('');
  const [role,       setRole]       = useState('');
  const [dragR,      setDragR]      = useState(false);
  const [dragJ,      setDragJ]      = useState(false);
  const rRef = useRef(), jRef = useRef();

  // Derived options based on selections
  const industryOptions = stream ? Object.keys(STREAM_INDUSTRY_ROLE[stream] || {}) : [];
  const roleOptions = useMemo(() => {
    if (!stream) return [];
    const streamData = STREAM_INDUSTRY_ROLE[stream] || {};
    if (industry && streamData[industry]) return streamData[industry];
    // No industry selected → all roles for the stream (deduplicated, sorted)
    return [...new Set(Object.values(streamData).flat())].sort();
  }, [stream, industry]);

  const onStreamChange = (val) => { setStream(val); setIndustry(''); setRole(''); track('stream-selected', { stream: val }); };
  const onIndustryChange = (val) => { setIndustry(val); setRole(''); track('industry-selected', { industry: val, stream }); };
  const onRoleChange = (val) => { setRole(val); track('role-selected', { role: val, industry, stream }); };

  const onDrop = useCallback((e, setter, setDrag, kind) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer?.files[0] ?? e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { alert('Please upload a PDF file.'); track('upload-rejected', { kind, reason: 'not-pdf' }); return; }
    if (f.size > 5 * 1024 * 1024)    { alert('File too large. Max 5 MB.'); track('upload-rejected', { kind, reason: 'too-large' }); return; }
    setter(f);
    track(kind === 'jd' ? 'jd-uploaded' : 'resume-uploaded', { sizeKB: Math.round(f.size/1024) });
  }, []);

  const selectStyle = (disabled) => ({
    ...UPLOAD_INPUT_STYLE,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity 0.2s',
  });

  return (
    <div style={{ background:T.bg, minHeight:'100vh', color:T.text, fontFamily:"'Jost', sans-serif", position:'relative' }}>
      <BgOrbs />

      {/* Header */}
      <div style={{ position:'relative',zIndex:10,display:'flex',alignItems:'center',gap:12,padding:'16px 30px',borderBottom:`1px solid rgba(195,165,110,0.25)`,background:'rgba(253,248,240,0.75)',backdropFilter:'blur(20px)' }}>
        <button className="btn-ghost" onClick={onBack} style={{ padding:'7px 14px', fontSize:13 }}>← Back</button>
        <div style={{ display:'flex',alignItems:'center',gap:9,marginLeft:6 }}>
          <img src={cvsetuaiLogo} alt="CVsetuAI" style={{ height:32, objectFit:'contain' }} />
        </div>
      </div>

      <div style={{ position:'relative',zIndex:1,maxWidth:760,margin:'0 auto',padding:'44px 24px' }}>
        <div style={{ textAlign:'center',marginBottom:36,animation:'fadeUp .7s ease-out' }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,marginBottom:9,color:T.text }}>Upload Your Resume</h1>
          <p style={{ color:T.muted,fontSize:14 }}>PDF only · Max 5 MB · Max 3 pages · Deep analysis in ~15 seconds</p>
        </div>

        <div style={{ display:'grid',gap:20,animation:'fadeUp .7s ease-out .1s both' }}>

          {/* ── STREAM selector (required) ── */}
          <div>
            <label style={UPLOAD_LABEL_STYLE}>
              Your Stream / Background <span style={{color:T.rose}}>*</span>
            </label>
            <select style={selectStyle(false)} value={stream} onChange={e=>onStreamChange(e.target.value)}>
              <option value="">— Select your stream —</option>
              {Object.keys(STREAM_INDUSTRY_ROLE).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            {!stream && (
              <div style={{ marginTop:7, fontSize:12, color:T.gold, fontFamily:"'Jost',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
                👉 Selecting your stream unlocks tailored ATS scoring, role fit analysis & JD matching
              </div>
            )}
            {stream && (
              <div style={{ marginTop:7, fontSize:12, color:T.ok, fontFamily:"'Jost',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
                ✓ Stream set — your analysis will be optimised for <strong>{stream}</strong> roles
              </div>
            )}
          </div>

          {/* ── Resume drop ── */}
          <div>
            <label style={UPLOAD_LABEL_STYLE}>Resume PDF <span style={{color:T.rose}}>*</span></label>
            <div style={uploadDropZone(dragR)}
              onDragOver={e=>{e.preventDefault();setDragR(true)}}
              onDragLeave={()=>setDragR(false)}
              onDrop={e=>onDrop(e,setResumeFile,setDragR,'resume')}
              onClick={()=>rRef.current?.click()}>
              <input ref={rRef} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>onDrop(e,setResumeFile,setDragR,'resume')} />
              {resumeFile ? (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:13}}>
                  <span style={{fontSize:28}}>📄</span>
                  <div style={{textAlign:'left'}}>
                    <div style={{fontWeight:600,fontSize:14,color:T.text}}>{resumeFile.name}</div>
                    <div style={{fontSize:12,color:T.muted,marginTop:2}}>{(resumeFile.size/1024).toFixed(0)} KB · PDF</div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();setResumeFile(null)}} style={{marginLeft:'auto',background:T.roseBg,border:`1px solid rgba(184,92,82,0.3)`,borderRadius:8,color:T.danger,cursor:'pointer',padding:'5px 12px',fontSize:12}}>✕ Remove</button>
                </div>
              ) : (
                <>
                  <div style={{fontSize:38,marginBottom:11}}>📤</div>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:5,color:T.text}}>Drop your resume here</div>
                  <div style={{fontSize:13,color:T.muted}}>or click to browse · PDF only</div>
                </>
              )}
            </div>
          </div>

          {/* ── JD drop ── */}
          <div>
            <label style={UPLOAD_LABEL_STYLE}>Job Description PDF <span style={{textTransform:'none',fontWeight:400,letterSpacing:0,color:T.dim}}>(optional — enables JD Match %)</span></label>
            <div style={{...uploadDropZone(dragJ),padding:'20px'}}
              onDragOver={e=>{e.preventDefault();setDragJ(true)}}
              onDragLeave={()=>setDragJ(false)}
              onDrop={e=>onDrop(e,setJdFile,setDragJ,'jd')}
              onClick={()=>jRef.current?.click()}>
              <input ref={jRef} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>onDrop(e,setJdFile,setDragJ,'jd')} />
              {jdFile ? (
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <span style={{fontSize:22}}>📋</span>
                  <div><div style={{fontWeight:600,fontSize:13,color:T.text}}>{jdFile.name}</div><div style={{fontSize:12,color:T.muted}}>{(jdFile.size/1024).toFixed(0)} KB</div></div>
                  <button onClick={e=>{e.stopPropagation();setJdFile(null)}} style={{marginLeft:'auto',background:T.roseBg,border:`1px solid rgba(184,92,82,0.3)`,borderRadius:7,color:T.danger,cursor:'pointer',padding:'4px 11px',fontSize:12}}>✕</button>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <span style={{fontSize:24}}>📋</span>
                  <div style={{textAlign:'left'}}>
                    <div style={{fontWeight:500,fontSize:13,color:T.text}}>Upload Job Description</div>
                    <div style={{fontSize:12,color:T.muted}}>Get a JD Match % + skills gap analysis</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Industry + Role (dynamic, stream-dependent) ── */}
          <div className="riq-upload-options" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div>
              <label style={UPLOAD_LABEL_STYLE}>
                Target Industry <span style={{textTransform:'none',fontWeight:400,letterSpacing:0,color:T.dim}}>(opt)</span>
              </label>
              <select
                style={selectStyle(!stream)}
                value={industry}
                onChange={e=>onIndustryChange(e.target.value)}
                disabled={!stream}>
                <option value="">{stream ? 'All Industries' : '— Select stream first —'}</option>
                {industryOptions.map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label style={UPLOAD_LABEL_STYLE}>
                Target Role <span style={{textTransform:'none',fontWeight:400,letterSpacing:0,color:T.dim}}>(opt)</span>
              </label>
              <select
                style={selectStyle(!stream)}
                value={role}
                onChange={e=>onRoleChange(e.target.value)}
                disabled={!stream}>
                <option value="">{stream ? 'All Roles' : '— Select stream first —'}</option>
                {roleOptions.map(x=><option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          {stream && (
            <div style={{ marginTop:-10, fontSize:12, color:T.muted, fontFamily:"'Jost',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
              👉 Your selections help tailor your resume for specific roles and improve ATS accuracy
            </div>
          )}

          {/* ── Privacy ── */}
          <div className="glass-card" style={{padding:'13px 18px',fontSize:13,color:T.muted,display:'flex',gap:10,alignItems:'flex-start'}}>
            <span>🔒</span>
            <span>Your resume is processed in real-time and never stored. All data is deleted immediately after analysis.</span>
          </div>

          {/* ── CTA ── */}
          <button disabled={!resumeFile || !stream} onClick={()=>{ track('analyze-clicked', { stream, industry: industry||'(any)', role: role||'(any)', hasJD: !!jdFile }); onAnalyze({resumeFile,jdFile,industry,role,stream}); }}
            className={resumeFile && stream ? 'btn-primary' : ''}
            style={{
              width:'100%', padding:'16px',
              background: resumeFile && stream ? undefined : 'rgba(195,165,110,0.15)',
              border: resumeFile && stream ? undefined : `1px solid rgba(195,165,110,0.2)`,
              borderRadius:12, color: resumeFile && stream ? 'white' : T.dim,
              fontWeight:700, fontSize:15, cursor: resumeFile && stream ? 'pointer' : 'not-allowed',
              transition:'all .3s', fontFamily:"'Jost',sans-serif",
          }}>
            {!resumeFile ? 'Upload a resume PDF to continue' : !stream ? 'Select your stream to continue' : '⚡ Run Full ATS Intelligence Analysis →'}
          </button>
        </div>
      </div>
    </div>
  );
}



/* ── AnalyzingScreen static data ── */
const ANALYZING_TIPS = [
  '💡 Tip: Resumes with 5–8 quantified achievements score 40% higher on ATS',
  '💡 Tip: Using the same keywords as the job description boosts match rate by 60%',
  '💡 Tip: One-page resumes get 40% more recruiter callbacks at 0–5 yrs experience',
  '💡 Tip: Action verbs like "Spearheaded", "Drove", "Scaled" outperform "Helped" or "Worked on"',
  '💡 Tip: ATS systems reject 75% of resumes before a human ever sees them',
];

/* ─────────────────────────────────────────────
   ANALYZING SCREEN
───────────────────────────────────────────── */
function AnalyzingScreen({ progress }) {
  // ── Randomised step timings: base ± 3% jitter, seeded once on mount ──
  const [steps] = useState(() => {
    const jitter = (base) => +(base * (1 + (Math.random() * 0.06 - 0.03))).toFixed(1);
    return [
      { label: 'Extracting resume content & structure',    doneAt: jitter(3.5),  duration: 3.5  },
      { label: 'Running ATS keyword & skills analysis',    doneAt: jitter(8.5),  duration: 5    },
      { label: 'Scoring 7 ATS dimensions',                 doneAt: jitter(16),   duration: 7.5  },
      { label: 'Calculating multi-role fit scores',        doneAt: jitter(28.5), duration: 12.5 },
      { label: 'Detecting formatting & ATS blockers',      doneAt: jitter(34.5), duration: 6    },
      { label: 'Rewriting every line across all sections', doneAt: jitter(48.5), duration: 14   },
      { label: 'Finalising intelligence report',           doneAt: 9999         },
    ];
  });

  // ── TOTAL TIMER BUDGET: 2 min 30 sec = 150s ──
  // Countdown always starts at 150s and ticks down regardless of step.
  // Last step: bar crawls 88→99% over the remaining budget, then snaps to 100 when API done.
  const TOTAL_BUDGET = 150; // seconds

  // ── Self-managed elapsed time (100ms ticks) ──
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => +(e + 0.1).toFixed(1)), 100);
    return () => clearInterval(iv);
  }, []);

  // ── Countdown always based on TOTAL_BUDGET, never freezes ──
  const remaining    = Math.max(0, TOTAL_BUDGET - elapsed);
  const countdownMins = Math.floor(remaining / 60);
  const countdownSecs = Math.ceil(remaining % 60);

  // ── Progress %: piecewise for steps 0-5, then slow crawl 88→99 for last step ──
  const getTimerPct = (e) => {
    const milestones = [0, ...steps.slice(0,-1).map(s => s.doneAt)];
    const pctStops   = [0, 2, 19, 36, 52, 68, 88];
    // Piecewise through steps 0-5
    for (let i = 1; i < milestones.length; i++) {
      if (e <= milestones[i]) {
        const frac = (e - milestones[i-1]) / (milestones[i] - milestones[i-1]);
        return pctStops[i-1] + frac * (pctStops[i] - pctStops[i-1]);
      }
    }
    // Last step: slow crawl from 88 → 99 over remaining budget (steps[5].doneAt → TOTAL_BUDGET)
    const lastStepStart = steps[steps.length - 2].doneAt;
    const crawlDuration = TOTAL_BUDGET - lastStepStart; // seconds available for crawl
    const crawlElapsed  = Math.min(e - lastStepStart, crawlDuration);
    const crawlPct      = 88 + (crawlElapsed / crawlDuration) * 11; // 88 → 99
    return Math.min(crawlPct, 99);
  };

  // Snap to 100 only when API signals done, otherwise use timer-driven %
  const displayPct = progress >= 100 ? 100 : Math.max(getTimerPct(elapsed), progress);

  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * ANALYZING_TIPS.length));
  useEffect(() => {
    const iv = setInterval(() => setTipIdx(i => (i + 1) % ANALYZING_TIPS.length), 7000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ background:T.bg, minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:T.text, fontFamily:"'Jost', sans-serif", padding:32, position:'relative' }}>
      <BgOrbs />
      <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',alignItems:'center',maxWidth:480,width:'100%' }}>
        {/* Animated Brain/DNA loader */}
        <div style={{ position:'relative', width:100, height:100, marginBottom:28 }}>
          {/* Outer pulsing ring */}
          <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`2px solid rgba(176,125,42,0.18)`, animation:'pulse 2s ease-in-out infinite' }} />
          {/* Rotating arc 1 */}
          <svg style={{ position:'absolute', inset:0, animation:'spin 2s linear infinite' }} width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(176,125,42,0.12)" strokeWidth="3"/>
            <circle cx="50" cy="50" r="44" fill="none" stroke={T.gold} strokeWidth="3" strokeLinecap="round"
              strokeDasharray="55 221" strokeDashoffset="0"/>
          </svg>
          {/* Counter-rotating arc 2 */}
          <svg style={{ position:'absolute', inset:6, animation:'spin 3s linear infinite reverse' }} width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(76,138,114,0.15)" strokeWidth="2.5"/>
            <circle cx="44" cy="44" r="36" fill="none" stroke={T.sage} strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="38 188" strokeDashoffset="0"/>
          </svg>
          {/* Inner rotating arc 3 */}
          <svg style={{ position:'absolute', inset:14, animation:'spin 1.5s linear infinite' }} width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(74,112,156,0.12)" strokeWidth="2"/>
            <circle cx="36" cy="36" r="28" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round"
              strokeDasharray="22 154" strokeDashoffset="0"/>
          </svg>
          {/* Center icon */}
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:36, height:36, background:'linear-gradient(135deg,#B07D2A,#D4A850)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, boxShadow:'0 0 18px rgba(176,125,42,0.45)', animation:'pulse 2s ease-in-out infinite' }}>⚡</div>
          </div>
          {/* Orbiting dots */}
          {[0,1,2].map(i => (
            <div key={i} style={{
              position:'absolute', top:'50%', left:'50%',
              width:7, height:7, borderRadius:'50%',
              background: [T.gold, T.sage, T.blue][i],
              boxShadow: `0 0 8px ${[T.gold, T.sage, T.blue][i]}`,
              transform: `rotate(${i*120}deg) translateX(44px) translateY(-50%)`,
              animation: `spin ${2+i*0.4}s linear infinite`,
              transformOrigin: '0 0',
            }} />
          ))}
        </div>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,marginBottom:8,textAlign:'center',color:T.text }}>Analysing Your Resume</h2>
        <p style={{ color:T.muted,marginBottom:12,textAlign:'center',fontSize:14 }}>Building your intelligence report, please wait…</p>
        <div style={{ background:'rgba(176,125,42,0.08)',border:`1px solid rgba(176,125,42,0.2)`,borderRadius:10,padding:'10px 18px',marginBottom:32,textAlign:'center',fontSize:13,color:T.muted,fontFamily:"'Jost',sans-serif" }}>{ANALYZING_TIPS[tipIdx]}</div>

        {/* Progress bar */}
        <div style={{ width:'100%',marginBottom:28 }}>
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8,alignItems:'center' }}>
            <span style={{fontSize:13,color:T.muted}}>Analysis progress</span>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              {displayPct < 100 && (
                <span style={{ fontSize:11,color:T.dim,fontFamily:"'Jost',sans-serif" }}>
                  {remaining > 0
                    ? `~${countdownMins}:${String(countdownSecs).padStart(2,'0')} left`
                    : 'Finalising…'}
                </span>
              )}
              <span style={{fontSize:15,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif",minWidth:40,textAlign:'right'}}>{Math.round(displayPct)}%</span>
            </div>
          </div>
          <div style={{ height:10,background:'rgba(195,165,110,0.2)',borderRadius:5,overflow:'hidden',position:'relative' }}>
            <div style={{ width:`${displayPct}%`,height:'100%',background:`linear-gradient(90deg,${T.gold},${T.goldLight})`,borderRadius:5,transition:'width 0.35s ease',position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',top:0,left:0,right:0,bottom:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)',animation:'shimmer 1.8s infinite' }} />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="glass-card" style={{ width:'100%',padding:'18px 22px' }}>
          {steps.map((s, i) => {
            const done   = s.doneAt < 9999 ? elapsed >= s.doneAt : progress >= 100;
            // active = previous step done, this one not yet
            const prevDone = i === 0 ? true : (steps[i-1].doneAt < 9999 ? elapsed >= steps[i-1].doneAt : progress >= 100);
            const active = prevDone && !done;
            return (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:12,
                marginBottom: i < steps.length - 1 ? 14 : 0,
                opacity: done || active ? 1 : 0.28,
                transition: 'opacity 0.6s ease',
              }}>
                {/* Step icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  transition: 'all 0.5s ease',
                  background: done
                    ? 'linear-gradient(135deg,#4C8A72,#5EA882)'
                    : active
                      ? 'rgba(176,125,42,0.15)'
                      : 'rgba(195,165,110,0.08)',
                  border: `2px solid ${done ? 'transparent' : active ? T.gold : 'rgba(195,165,110,0.25)'}`,
                  boxShadow: done
                    ? '0 0 12px rgba(76,138,114,0.4)'
                    : active
                      ? '0 0 10px rgba(176,125,42,0.3)'
                      : 'none',
                  color: done ? 'white' : active ? T.gold : T.dim,
                }}>
                  {done
                    ? '✓'
                    : active
                      ? <span style={{ display:'inline-block', animation:'blink 0.9s ease-in-out infinite' }}>●</span>
                      : i + 1
                  }
                </div>

                {/* Label + timing info */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: done || active ? 500 : 400,
                    color: done ? T.ok : active ? T.text : T.muted,
                    transition: 'color 0.5s',
                    fontFamily: "'Jost',sans-serif",
                  }}>{s.label}</div>
                  {done && (
                    <div style={{ fontSize:10, color:T.ok, marginTop:2, fontFamily:"'Jost',sans-serif", animation:'fadeIn 0.4s ease' }}>
                      {s.doneAt < 9999 ? `✓ Completed in ${s.duration}s` : '✓ Completed'}
                    </div>
                  )}
                  {active && (
                    <div style={{ fontSize:10, color:T.gold, marginTop:2, fontFamily:"'Jost',sans-serif" }}>
                      Processing…
                    </div>
                  )}
                </div>

                {/* Right side: done tick or spinner */}
                {done && (
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'rgba(76,138,114,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:T.ok, flexShrink:0 }}>✓</div>
                )}
                {active && (
                  <div style={{ width:16, height:16, border:`2px solid rgba(176,125,42,0.25)`, borderTop:`2px solid ${T.gold}`, borderRadius:'50%', animation:'spin 0.9s linear infinite', flexShrink:0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────
   PDF TEXT GROUPING HELPERS
───────────────────────────────────────────── */
function groupItemsIntoLines(items) {
  const yMap = {};
  for (const item of items) {
    const yKey = Math.round(item.y / 4) * 4;
    if (!yMap[yKey]) yMap[yKey] = [];
    yMap[yKey].push(item);
  }
  return Object.entries(yMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([yKey, lineItems]) => {
      const sorted = lineItems.sort((a, b) => a.x - b.x);
      return { y: Number(yKey), items: sorted, text: sorted.map(i => i.text).join(' ') };
    });
}

function findTextLine(target, lines, pageWidth) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = norm(target).split(' ').filter(w => w.length > 3).slice(0, 7);
  if (!words.length) return null;
  let best = null, bestScore = 0;
  for (const line of lines) {
    const lineNorm = norm(line.text);
    const matches  = words.filter(w => lineNorm.includes(w)).length;
    const score    = matches / words.length;
    if (score > bestScore) { bestScore = score; best = line; }
  }
  if (bestScore < 0.38 || !best) return null;
  const { items } = best;

  // Exact text-item bounding box
  const x    = Math.min(...items.map(i => i.x));
  const maxX = Math.max(...items.map(i => i.x + Math.max(i.width || 0, 4)));

  // Dominant font size (median across items on this line)
  const fontSizes = items.map(i => i.fontSize).filter(Boolean).sort((a, b) => a - b);
  const fontSize  = fontSizes[Math.floor(fontSizes.length / 2)] || 12;

  // Font weight from font name
  const fontWeight = items[0]?.fontWeight || 'normal';

  // Store the precise baseline y, ascent/descent so we can erase exactly one line
  // PDF baseline is best.y; ascent ≈ fontSize*0.85, descent ≈ fontSize*0.2
  const ascent  = Math.ceil(fontSize * 0.88);
  const descent = Math.ceil(fontSize * 0.22);

  return {
    x,
    y:          best.y,               // exact baseline (alphabetic)
    textTop:    best.y - ascent,      // top of glyph box
    textBottom: best.y + descent,     // bottom of glyph box
    width:      Math.min(maxX - x, pageWidth - x - 2),
    lineHeight: fontSize,
    fontSize,
    fontWeight,
    pageWidth,
    // Right edge of the page content area (used for full-width erase)
    rightEdge:  pageWidth - 6,
  };
}

/* ─────────────────────────────────────────────
   ANNOTATION TOOLTIP COMPONENT
───────────────────────────────────────────── */
function AnnotTooltip({ annot, mousePos, isApplied, isLocked, onApply, onClose }) {
  const TW = 400;
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let left = mousePos.x + 18;
  let top  = mousePos.y - 24;
  // Flip left if too close to right edge
  if (left + TW > vw - 16) left = mousePos.x - TW - 18;
  // Keep inside vertical bounds
  if (top + 380 > vh - 12) top = vh - 392;
  if (top < 10) top = 10;
  if (left < 10) left = 10;

  return (
    <div
      className="riq-annot-tooltip"
      style={{
        position:'fixed', left, top, width:TW, zIndex:9999,
        pointerEvents:'auto',
        animation:'fadeIn 0.14s ease-out',
        background: isLocked ? '#FFFDF7' : '#FDF8F0',
        backdropFilter:'none',
        WebkitBackdropFilter:'none',
        borderRadius:20,
        border: isLocked ? `2px solid rgba(74,112,156,0.65)` : `1.5px solid rgba(195,165,110,0.55)`,
        boxShadow: isLocked
          ? '0 20px 60px rgba(74,112,156,0.30), 0 4px 16px rgba(0,0,0,0.12)'
          : '0 16px 48px rgba(140,105,50,0.28), 0 4px 16px rgba(0,0,0,0.10)',
      }}
      onMouseLeave={() => { if (!isLocked) onClose(); }}
    >
      <div style={{ padding:'16px 18px' }}>
        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:isApplied ? T.ok : isLocked ? T.blue : T.danger, display:'inline-block', flexShrink:0 }} />
          <span style={{ fontSize:11, fontWeight:700, color:isApplied ? T.ok : isLocked ? T.blue : T.danger, textTransform:'uppercase', letterSpacing:'0.8px', fontFamily:"'Jost',sans-serif" }}>
            {isApplied ? 'Fix Applied ✓' : isLocked ? '📌 Selected — Apply Fix Below' : '⚡ Improvement Found'}
          </span>
          {annot.section && (
            <span style={{ fontSize:10, color:T.blue, background:T.blueBg, border:`1px solid rgba(74,112,156,0.25)`, borderRadius:20, padding:'2px 8px', fontFamily:"'Jost',sans-serif", marginLeft:'auto' }}>
              {annot.section}
            </span>
          )}
          <button onClick={onClose} style={{ marginLeft: annot.section ? 4 : 'auto', background:'none', border:'none', cursor:'pointer', fontSize:14, color:T.dim, padding:'0 2px', lineHeight:1 }}>✕</button>
        </div>

        {/* Original */}
        <div style={{ background:T.roseBg, border:'1px solid rgba(184,92,82,0.20)', borderRadius:10, padding:'9px 12px', marginBottom:9 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.danger, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4, fontFamily:"'Jost',sans-serif" }}>✗ Original</div>
          <div style={{ fontSize:12, color:T.text, lineHeight:1.6, fontFamily:"'Jost',sans-serif" }}>{annot.original}</div>
        </div>

        {/* Improved */}
        <div style={{ background:T.sageBg, border:'1px solid rgba(76,138,114,0.20)', borderRadius:10, padding:'9px 12px', marginBottom:9 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.ok, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4, fontFamily:"'Jost',sans-serif" }}>✓ Suggested Rewrite</div>
          <div style={{ fontSize:12, color:T.text, lineHeight:1.6, fontFamily:"'Jost',sans-serif", fontStyle:'italic' }}>{annot.improved}</div>
        </div>

        {/* Reason */}
        <div style={{ fontSize:12, color:T.muted, lineHeight:1.5, marginBottom:12, fontFamily:"'Jost',sans-serif", padding:'0 2px' }}>💡 {annot.reason}</div>

        {/* CTA */}
        {isApplied ? (
          <div style={{ textAlign:'center', padding:'10px', background:T.sageBg, border:'1px solid rgba(76,138,114,0.25)', borderRadius:10, fontSize:13, color:T.ok, fontFamily:"'Jost',sans-serif", fontWeight:600 }}>
            ✓ Fix Applied — included in download
          </div>
        ) : (
          <button className="btn-primary" onClick={() => onApply(annot.id)}
            style={{ width:'100%', padding:'11px', fontSize:13, letterSpacing:'0.3px', fontFamily:"'Jost',sans-serif" }}>
            ✓ Apply This Fix
          </button>
        )}
        {!isApplied && !isLocked && (
          <p style={{ textAlign:'center', fontSize:10, color:T.dim, marginTop:7, fontFamily:"'Jost',sans-serif" }}>Click the line to pin this panel</p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LINE ITEM CARD
   • Displays the batch result immediately — no auto-retry on mount.
   • Manual "Regenerate" button available if user wants a fresh rewrite.
   • Single on-demand regeneration only, no loops.
───────────────────────────────────────────── */
function LineItemCard({ item }) {
  const origEffLen = effectiveLength(item.original);
  const minChars   = Math.ceil(origEffLen * 1.03); // minimum 3% increase
  const maxChars   = Math.ceil(origEffLen * 1.10); // maximum 10% increase

  // Tier thresholds for display colour coding
  const getTier = (len) => {
    if (len < minChars)                            return { n:'<3%', color: T.danger }; // too short
    if (len <= Math.ceil(origEffLen * 1.05))       return { n:'3-5%', color: T.ok };
    if (len <= Math.ceil(origEffLen * 1.07))       return { n:'5-7%', color: T.ok };
    if (len <= maxChars)                           return { n:'7-10%', color: T.warn };
    return { n:'>10%', color: T.danger };
  };

  /* Validation — enforce 3%-10% window and reject near-identical lines */
  function validateImproved(raw, limits = {}) {
    return repairLine(item.original, raw, {
      minLen: limits.minLen ?? minChars,
      maxLen: limits.maxLen ?? maxChars,
    });
  }

  const validatedInitial = validateImproved(item.improved);
  const [improvedState, setImprovedState] = useState(validatedInitial);
  const [reasonState,   setReasonState]   = useState(item.reason || '');
  const needsAutoRegen = useRef(!validatedInitial);
  const regenAttempts  = useRef(0);

  // Auto-regenerate if initial improved was invalid/identical — retry up to 3 times
  useEffect(() => {
    if (needsAutoRegen.current && regenAttempts.current < 3) {
      needsAutoRegen.current = false;
      regenerate(0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [generating,    setGenerating]    = useState(false);
  // charBias: cumulative ±1% steps controlled by A↓ / A↑ buttons
  // 0 = default (3%-10%), negative = tighter toward 3%, positive = toward 10%
  const [charBias, setCharBias] = useState(0);

  // Clamp charBias: -3 to +3 (3% window slides within 3%-10%)
  const biasMin = -3;
  const biasMax =  3;

  // Compute target window based on charBias
  function getTargetWindow(bias) {
    // Default (0) → [ceil(origEffLen*1.03), ceil(origEffLen*1.10)]
    // Each step shifts the window center by ~1%
    const centerMult = 1.065 + bias * 0.01; // center of 3%-10% = 6.5%
    const lowerMult = Math.max(1.03, centerMult - 0.035);
    const upperMult = Math.min(1.10, centerMult + 0.035);
    return {
      min: Math.ceil(origEffLen * lowerMult),
      max: Math.ceil(origEffLen * upperMult),
      targetMax: upperMult,
    };
  }

  async function regenerate(bias = charBias, attempt = 0) {
    if (generating) return;
    setGenerating(true);
    const { min, max } = getTargetWindow(bias);
    const maxRetries = 4;
    const bannedLead = tokenizeLine(item.original).slice(0, 3).join(' ');
    let lastCandidate = null;
    let lastReason = '';

    for (let i = attempt; i < maxRetries; i++) {
      const retryDirective = i === 0
        ? 'This is the first rewrite attempt.'
        : `Retry ${i}: the previous output was rejected for being too similar or violating constraints. Change the opening phrasing and sentence structure more aggressively while preserving facts.`;
      try {
        const result = await callClaude(
          `You are a world-class resume writer. Rewrite this resume line to be SUBSTANTIALLY BETTER — not cosmetically similar.
Return ONLY valid JSON: {"improved":"...","reason":"..."}

Section: ${item.section || 'Resume'}
Original (${origEffLen} chars): "${item.original}"

${retryDirective}
CRITICAL RULES:
- Your rewrite MUST be MEANINGFULLY DIFFERENT from the original.
- Use a DIFFERENT opening action verb than the original uses.
- Do NOT begin with the same first 3 meaningful words as the original${bannedLead ? ` (forbidden opening: "${bannedLead}")` : ''}.
- Restructure the sentence — do not just insert, append, or lightly swap a few words.
- Preserve factual meaning, tools, metrics, and outcomes already present. Zero fabrication.
- Increase specificity, clarity, and impact while keeping the line fully ATS-friendly.

CHARACTER TARGET: Between ${min} and ${max} characters (${Math.round((min / origEffLen - 1) * 100)}%–${Math.round((max / origEffLen - 1) * 100)}% longer than original).
Every dash variant (-, –, —, ‒, −) = 1 character.
MINIMUM: ${min} chars. MAXIMUM: ${max} chars.
NEVER truncate mid-word or mid-sentence. Must be a complete grammatical thought.

QUALITY RULES:
• Start with a strong past-tense action verb DIFFERENT from the original's first verb
• Keep the rewrite factually grounded in the original line only
• "reason" = one sentence explaining what was strategically improved — no mention of character counts
• If the output is too similar to the original, the system will reject it automatically.`, 800
        );
        lastCandidate = validateImproved(result.improved, { minLen: min, maxLen: max });
        lastReason = (result.reason || '').trim();
        if (lastCandidate) {
          setImprovedState(lastCandidate);
          setReasonState(lastReason || 'Rewritten with stronger action verb, clearer structure, and sharper impact.');
          break;
        }
      } catch {
        // continue to next retry
      }
    }

    if (!lastCandidate && improvedState) {
      setReasonState('Could not generate a distinct enough rewrite yet — please try again.');
    }

    regenAttempts.current++;
    setGenerating(false);
  }

  function handleBiasDown() {
    const newBias = Math.max(biasMin, charBias - 1);
    setCharBias(newBias);
    regenerate(newBias);
  }
  function handleBiasUp() {
    const newBias = Math.min(biasMax, charBias + 1);
    setCharBias(newBias);
    regenerate(newBias);
  }

  const cleanReason = reasonState
    .replace(/,?\s*(within|under|at|meeting|keeping|respects?|stays? within|matches?)\s+\d+%?\s*(char(acter)?s?|limit|constraint)[^,.]*/gi, '')
    .replace(/,?\s*\d+%?\s*(char(acter)?s?)\s*(constraint|limit|rule|max)[^,.]*/gi, '')
    .replace(/\(\d+\s*char[^)]*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[,;]+\s*/, '');

  const isIdentical = !improvedState || (improvedState.replace(/\s+/g,' ').trim().toLowerCase() === item.original.replace(/\s+/g,' ').trim().toLowerCase());
  const displayText = generating ? '⏳ Generating improved version…' : (improvedState || '⚠️ Regenerating — improved version pending…');
   const displayEff  = effectiveLength(displayText);
  const tier        = getTier(displayEff);

  const btnBase = {
    display:'flex', alignItems:'center', justifyContent:'center',
    height:22, borderRadius:6, cursor: generating ? 'not-allowed' : 'pointer',
    fontSize:10, fontFamily:"'Jost',sans-serif",
    border:'1px solid rgba(195,165,110,0.35)',
    background:'none', transition:'all .15s',
    opacity: generating ? 0.5 : 1,
    color: T.muted, padding:'0 6px', gap:2, whiteSpace:'nowrap',
  };

  return (
    <div style={{ marginBottom:14, background:'rgba(255,255,255,0.55)', borderRadius:14, overflow:'hidden', border:'1px solid rgba(195,165,110,0.25)' }}>
      <div className="riq-lb-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>

        {/* ── Original ── */}
        <div style={{ padding:'15px 18px', borderRight:'1px solid rgba(195,165,110,0.2)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9 }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.danger, textTransform:'uppercase', letterSpacing:'0.8px' }}>✗ Original</div>
            <span style={{ fontSize:10, color:T.dim, fontFamily:"'Jost',sans-serif" }}>{origEffLen} chars</span>
          </div>
          <div style={{ fontSize:13, color:T.muted, lineHeight:1.65 }}>{item.original}</div>
        </div>

        {/* ── Improved ── */}
        <div style={{ padding:'15px 18px', background:'rgba(255,255,255,0.35)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9, flexWrap:'wrap', gap:4 }}>
            <div style={{ fontSize:10, fontWeight:700, color:T.ok, textTransform:'uppercase', letterSpacing:'0.8px' }}>✓ Improved</div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              {/* A↓ button — regenerate shorter (-2%) */}
              <button
                onClick={handleBiasDown}
                disabled={generating || charBias <= biasMin}
                title="Regenerate shorter (−2% chars)"
                style={{ ...btnBase, opacity: (generating || charBias <= biasMin) ? 0.38 : 1 }}
                onMouseEnter={e => { if (!generating && charBias > biasMin) { e.currentTarget.style.borderColor='rgba(176,125,42,0.6)'; e.currentTarget.style.color=T.gold; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(195,165,110,0.35)'; e.currentTarget.style.color=T.muted; }}
              >
                <span style={{ fontSize:11, fontWeight:700, fontFamily:'serif' }}>A</span>
                <span style={{ fontSize:9 }}>↓</span>
              </button>

              {/* char count pill */}
              <span style={{ fontSize:10, color:T.dim, fontFamily:"'Jost',sans-serif", background:'rgba(195,165,110,0.1)', border:'1px solid rgba(195,165,110,0.22)', borderRadius:10, padding:'1px 7px', minWidth:54, textAlign:'center' }}>
                {generating ? '…' : `${displayEff} chr`}
              </span>

              {/* A↑ button — regenerate longer (+2%) */}
              <button
                onClick={handleBiasUp}
                disabled={generating || charBias >= biasMax}
                title="Regenerate longer (+2% chars)"
                style={{ ...btnBase, opacity: (generating || charBias >= biasMax) ? 0.38 : 1 }}
                onMouseEnter={e => { if (!generating && charBias < biasMax) { e.currentTarget.style.borderColor='rgba(176,125,42,0.6)'; e.currentTarget.style.color=T.gold; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(195,165,110,0.35)'; e.currentTarget.style.color=T.muted; }}
              >
                <span style={{ fontSize:11, fontWeight:700, fontFamily:'serif' }}>A</span>
                <span style={{ fontSize:9 }}>↑</span>
              </button>

              {/* regenerate button removed */}
            </div>
          </div>
          {generating ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0' }}>
              <div style={{ width:14, height:14, border:`2px solid rgba(195,165,110,0.2)`, borderTop:`2px solid ${T.gold}`, borderRadius:'50%', animation:'spin 1s linear infinite', flexShrink:0 }} />
              <span style={{ fontSize:12, color:T.muted, fontFamily:"'Jost',sans-serif", fontStyle:'italic' }}>Rewriting…</span>
            </div>
          ) : (
            <div style={{ fontSize:13, color:T.text, lineHeight:1.65 }}>{displayText}</div>
          )}
        </div>

      </div>
      {cleanReason && !generating && (
        <div style={{ padding:'9px 18px', background:T.goldBg, borderTop:'1px solid rgba(176,125,42,0.15)' }}>
          <span style={{ fontSize:12, color:T.gold }}>💡 {cleanReason}</span>
        </div>
      )}
    </div>
  );
}
/* ─────────────────────────────────────────────
   SECTION GROUP — section header + refresh all button + line cards
───────────────────────────────────────────── */
function SectionGroup({ section, initialItems, icon }) {
  const [items, setItems]       = useState(initialItems);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress]    = useState(0); // 0-100

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    setProgress(0);

    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      const origLen = effectiveLength(item.original);
      try {
        const result = await callClaude(
          `You are a world-class resume writer. Rewrite this resume line to be exceptional.
Return ONLY valid JSON: {"improved":"...","reason":"..."}

Section: ${item.section || 'Resume'}
Original (${origLen} chars): "${item.original}"

CHARACTER TARGET: Write a rewrite between ${Math.ceil(origLen*1.03)} and ${Math.ceil(origLen*1.10)} characters (3%–10% longer than original).
N = ${origLen}.
MINIMUM: ${Math.ceil(origLen*1.03)} chars — at least 3% longer.
MAXIMUM: ${Math.ceil(origLen*1.10)} chars — at most 10% longer.
The improved text MUST NOT be identical to the original.
NEVER truncate mid-sentence or produce a fragment.

QUALITY:
• Strong past-tense action verb (Spearheaded, Drove, Delivered, Orchestrated…)
• Real numbers, tools, outcomes from original — zero fabrication.
• "reason" = one sentence on strategic improvement — no character count mention.`, 700
        );
        const improved = repairLine(item.original, (result.improved || '').trim());
        const reason   = (result.reason || '').trim();
        if (improved) {
          updated[i] = { ...item, improved, reason };
        }
      } catch { /* keep original item on error */ }

      setProgress(Math.round(((i + 1) / updated.length) * 100));
      // Small yield so React can re-render the progress bar
      await new Promise(r => setTimeout(r, 0));
    }

    setItems([...updated]);
    setRefreshing(false);
    setProgress(0);
  }

  return (
    <div style={{ marginBottom:28 }}>
      {/* Section header row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, paddingBottom:8, borderBottom:`1px solid rgba(195,165,110,0.2)` }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:14, color:T.text, flex:1 }}>{section}</span>
        <span style={{ fontSize:11, color:T.muted, background:'rgba(195,165,110,0.12)', border:`1px solid rgba(195,165,110,0.25)`, padding:'2px 8px', borderRadius:20, fontFamily:"'Jost',sans-serif" }}>
          {items.length} line{items.length !== 1 ? 's' : ''}
        </span>
        {/* Refresh all button */}
        <button
          onClick={refreshAll}
          disabled={refreshing}
          title="Rewrite all lines in this section"
          style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'4px 11px', borderRadius:20,
            background: refreshing ? 'rgba(195,165,110,0.10)' : 'rgba(255,255,255,0.7)',
            border:`1px solid rgba(195,165,110,${refreshing ? '0.2' : '0.45'})`,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize:11, fontWeight:600, color: refreshing ? T.dim : T.gold,
            fontFamily:"'Jost',sans-serif", transition:'all .15s',
            opacity: refreshing ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.background='rgba(176,125,42,0.10)'; e.currentTarget.style.borderColor='rgba(176,125,42,0.65)'; }}}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor='rgba(195,165,110,0.45)'; }}
        >
          {refreshing
            ? <><span style={{ display:'inline-block', animation:'spin 0.9s linear infinite', fontSize:11 }}>⟳</span> {progress}%</>
            : <><span style={{ fontSize:11 }}>⟳</span> Refresh all</>}
        </button>
      </div>

      {/* Progress bar — only visible while refreshing */}
      {refreshing && (
        <div style={{ height:3, background:'rgba(195,165,110,0.15)', borderRadius:2, marginBottom:12, overflow:'hidden' }}>
          <div style={{ width:`${progress}%`, height:'100%', background:`linear-gradient(90deg,${T.gold},${T.goldLight})`, borderRadius:2, transition:'width 0.3s ease' }} />
        </div>
      )}

      {/* Line cards — key on improved so card re-renders when refreshed.
          Filter out items missing original text — they'd cause NaN math in LineItemCard. */}
      {items.filter(it => it && typeof it.original === 'string' && it.original.trim().length > 0).map((item, i) => (
        <LineItemCard key={`${i}-${(item.improved||'').slice(0,20)}`} item={item} />
      ))}
    </div>
  );
}


function AnnotatedPDFViewer({ resumeFile, results }) {
  const [pageData,     setPageData]     = useState([]);
  const [annotations,  setAnnotations]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState('');
  const [activeAnnot,  setActiveAnnot]  = useState(null);
  const [lockedAnnotId,setLockedAnnotId]= useState(null);
  const [mousePos,     setMousePos]     = useState({ x: 0, y: 0 });
  const [lockedPos,    setLockedPos]    = useState({ x: 0, y: 0 });
  const [appliedFixes, setAppliedFixes] = useState(new Set());
  const [downloading,  setDownloading]  = useState(false);
  const [showFmtMenu,  setShowFmtMenu]  = useState(false);
  // Tracks the base canvas (with all applied text rewrites painted in) per page
  const baseCanvasRef = useRef({});   // pi → canvas element

  useEffect(() => { loadAndAnnotate(); }, [resumeFile, results]);

  async function loadAndAnnotate() {
    if (!resumeFile || !results) return;
    try {
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = Object.assign(document.createElement('script'), {
            src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            onload: res, onerror: rej,
          });
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const buf  = await resumeFile.arrayBuffer();
      const pdf  = await window.pdfjsLib.getDocument({ data: buf }).promise;
      const pages = [];

      for (let i = 1; i <= Math.min(pdf.numPages, 4); i++) {
        const page     = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas   = document.createElement('canvas');
        canvas.width   = viewport.width;
        canvas.height  = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const tc = await page.getTextContent();
        const textItems = tc.items
          .filter(it => it.str.trim())
          .map(it => {
            const [a, b, c, d, e, f] = it.transform;
            const [vx, vy] = viewport.convertToViewportPoint(e, f);
            const fontSize  = Math.abs(d) * viewport.scale;
            const textWidth = Math.abs(it.width) * viewport.scale;
            // Detect bold from font name (e.g. "Arial-BoldMT", "Helvetica-Bold")
            const fontName  = (it.fontName || '').toLowerCase();
            const fontWeight = (fontName.includes('bold') || fontName.includes('heavy') || fontName.includes('black')) ? 'bold' : 'normal';
            return { text: it.str, x: vx, y: vy, width: textWidth, fontSize: Math.max(8, fontSize), fontWeight };
          });

        pages.push({
          imageUrl: canvas.toDataURL('image/png', 0.92),
          canvas,
          textItems,
          width:  viewport.width,
          height: viewport.height,
        });
      }

      setPageData(pages);
      // Clone each page canvas into baseCanvasRef — we paint rewrites over clones
      pages.forEach((pg, pi) => {
        const clone = document.createElement('canvas');
        clone.width  = pg.canvas.width;
        clone.height = pg.canvas.height;
        clone.getContext('2d').drawImage(pg.canvas, 0, 0);
        baseCanvasRef.current[pi] = clone;
      });

      const annots = [];
      let uid = 0;
      for (const item of (results.lineByLineAnalysis || [])) {
        for (let pi = 0; pi < pages.length; pi++) {
          const lines = groupItemsIntoLines(pages[pi].textItems);
          const pos   = findTextLine(item.original, lines, pages[pi].width);
          if (pos) {
            annots.push({ id: uid++, page: pi, ...pos, original: item.original, improved: item.improved, reason: item.reason });
            break;
          }
        }
      }
      setAnnotations(annots);
    } catch (err) {
      setLoadError(err.message || 'Failed to render PDF');
    }
    setLoading(false);
  }

  function handleHover(e, ann) {
    setActiveAnnot(ann);
    setMousePos({ x: e.clientX, y: e.clientY });
  }
  function handleMouseLeave(ann) {
    // Only hide if not locked on this annotation
    if (lockedAnnotId !== ann.id) setActiveAnnot(null);
  }
  function handleClick(e, ann) {
    e.stopPropagation();
    if (lockedAnnotId === ann.id) {
      // Click same line again → unlock
      setLockedAnnotId(null);
      setActiveAnnot(null);
    } else {
      setLockedAnnotId(ann.id);
      setActiveAnnot(ann);
      setLockedPos({ x: e.clientX, y: e.clientY });  // freeze here
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  }
  function applyFix(id) {
    const ann = annotations.find(a => a.id === id);
    if (!ann) { setAppliedFixes(prev => new Set([...prev, id])); return; }

    const pg   = pageData[ann.page];
    const base = baseCanvasRef.current[ann.page];
    if (!pg || !base) { setAppliedFixes(prev => new Set([...prev, id])); return; }

    const ctx = base.getContext('2d');
    const fs  = ann.fontSize || ann.lineHeight || 12;
    const fw  = ann.fontWeight || 'normal';

    // ── 1. Determine the exact erase rectangle ─────────────────────────────
    // Use stored textTop/textBottom for precision. Add 1px breathing room each side.
    const eraseTop    = Math.max(0, (ann.textTop    ?? (ann.y - Math.ceil(fs * 0.88))) - 1);
    const eraseBottom = Math.min(pg.height, (ann.textBottom ?? (ann.y + Math.ceil(fs * 0.22))) + 1);
    const eraseHeight = eraseBottom - eraseTop;

    // Erase from the text's left x all the way to the right edge of the page
    // This covers table cells, bullet continuations, and any overflow
    const eraseLeft  = Math.max(0, ann.x - 2);
    const eraseRight = ann.rightEdge || (pg.width - 4);
    const eraseWidth = eraseRight - eraseLeft;

    // ── 2. Sample background colour — scan a horizontal strip above the text ─
    // Sample multiple pixels across the erase zone and pick the most common light colour
    let bgR = 255, bgG = 255, bgB = 255;
    try {
      // Sample at the vertical midpoint of the erase zone, several x positions
      const sampleY = Math.round(eraseTop + eraseHeight * 0.5);
      const samples = [];
      for (let sx = eraseLeft + 2; sx < eraseRight - 2; sx += Math.max(1, Math.round(eraseWidth / 12))) {
        const px = ctx.getImageData(Math.min(sx, pg.width - 1), Math.min(sampleY, pg.height - 1), 1, 1).data;
        const lum = 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
        if (lum > 180) samples.push([px[0], px[1], px[2]]); // only light pixels = background
      }
      if (samples.length > 0) {
        bgR = Math.round(samples.reduce((s, p) => s + p[0], 0) / samples.length);
        bgG = Math.round(samples.reduce((s, p) => s + p[1], 0) / samples.length);
        bgB = Math.round(samples.reduce((s, p) => s + p[2], 0) / samples.length);
      }
    } catch (_) {}

    // ── 3. Erase the original line completely ─────────────────────────────
    ctx.save();
    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(eraseLeft, eraseTop, eraseWidth, eraseHeight);

    // ── 4. Determine text colour — sample original text pixels before erasure ─
    // Already erased, so use a heuristic: if bg is light, text is dark
    const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
    const textColor = bgLum > 160 ? '#1a1a1a' : '#ffffff';

    // ── 5. Measure and scale improved text to fit exactly one line ────────────
    // Set font first so measureText is accurate
    ctx.font = `${fw} ${fs}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = 'alphabetic';

    const availableWidth = eraseWidth - 6; // small margin each side
    let measuredWidth = ctx.measureText(ann.improved).width;
    let renderFontSize = fs;

    // If text is wider than available, scale font down proportionally (max 15% reduction)
    if (measuredWidth > availableWidth) {
      renderFontSize = Math.max(fs * 0.85, fs * (availableWidth / measuredWidth));
      ctx.font = `${fw} ${renderFontSize}px Arial, Helvetica, sans-serif`;
      measuredWidth = ctx.measureText(ann.improved).width;
    }

    // ── 6. Paint the improved text at the exact baseline position ────────────
    ctx.fillStyle = textColor;
    // Render at ann.y (the exact PDF baseline) — this matches where original text sat
    ctx.fillText(ann.improved, ann.x, ann.y, availableWidth);

    // ── 7. Thin green left-bar marker (3px, full line height) ────────────────
    ctx.fillStyle = 'rgba(76,138,114,0.90)';
    ctx.fillRect(Math.max(0, eraseLeft - 3), eraseTop, 3, eraseHeight);

    ctx.restore();

    // ── 8. Flush the updated canvas to the page image ─────────────────────
    const newUrl = base.toDataURL('image/png', 0.96);
    setPageData(prev => prev.map((p, i) =>
      i === ann.page ? { ...p, imageUrl: newUrl, canvas: base } : p
    ));

    setAppliedFixes(prev => new Set([...prev, id]));
    setLockedAnnotId(null);
    setActiveAnnot(null);
  }
  function closeTooltip() {
    setLockedAnnotId(null);
    setActiveAnnot(null);
  }

  async function handleDownload(format = 'pdf') {
    setDownloading(true);
    setShowFmtMenu(false);
    try {
      if (format === 'pdf') {
        // ── PDF export ──────────────────────────────────────────
        // Load jsPDF if not already loaded
        if (!window.jspdf && !window.jsPDF) {
          await new Promise((res, rej) => {
            const s = Object.assign(document.createElement('script'), {
              src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
              onload: res, onerror: rej,
            });
            document.head.appendChild(s);
          });
        }

        // jsPDF UMD exposes itself as window.jspdf.jsPDF
        const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDFCtor) throw new Error('jsPDF failed to load. Please try again.');

        const first = pageData[0];
        if (!first) throw new Error('No page data available.');

        const doc = new jsPDFCtor({
          orientation: first.width > first.height ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [first.width * 0.75, first.height * 0.75],
          compress: true,
        });

        for (let pi = 0; pi < pageData.length; pi++) {
          if (pi > 0) doc.addPage([pageData[pi].width * 0.75, pageData[pi].height * 0.75]);
          const pg = pageData[pi];

          // pg.canvas already has all applied rewrites painted in.
          // Only need to draw remaining (unapplied) issue markers on a fresh offscreen copy.
          const offscreen = document.createElement('canvas');
          offscreen.width  = pg.width;
          offscreen.height = pg.height;
          const ctx2d = offscreen.getContext('2d');
          ctx2d.drawImage(pg.canvas, 0, 0);  // includes any painted rewrites

          // Add red markers only for unapplied annotations
          for (const ann of annotations.filter(a => a.page === pi && !appliedFixes.has(a.id))) {
            ctx2d.save();
            ctx2d.fillStyle = 'rgba(192,57,43,0.08)';
            ctx2d.fillRect(ann.x-2, ann.y-ann.lineHeight-2, ann.width+4, ann.lineHeight+6);
            ctx2d.fillStyle = '#C0392B';
            ctx2d.fillRect(ann.x-5, ann.y-ann.lineHeight-2, 4, ann.lineHeight+8);
            ctx2d.strokeStyle = '#C0392B'; ctx2d.lineWidth = 2.5; ctx2d.setLineDash([6,3]);
            ctx2d.beginPath();
            ctx2d.moveTo(ann.x, ann.y+5); ctx2d.lineTo(ann.x+ann.width, ann.y+5);
            ctx2d.stroke(); ctx2d.setLineDash([]);
            ctx2d.fillStyle = '#C0392B';
            ctx2d.font = `600 ${Math.max(9,Math.round(ann.lineHeight*0.65))}px Arial,sans-serif`;
            ctx2d.fillText('⚡ Improve', ann.x, ann.y-ann.lineHeight-5);
            ctx2d.restore();
          }

          const imgData = offscreen.toDataURL('image/jpeg', 0.88);
          doc.addImage(imgData, 'JPEG', 0, 0, pg.width*0.75, pg.height*0.75);
        }

        // Legend page
        const legendW = first.width * 0.75;
        doc.addPage([legendW, 200]);
        doc.setFillColor(253, 248, 240);
        doc.rect(0, 0, legendW, 200, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(176, 125, 42);
        doc.text('CVsetuAI — Annotated Resume', 24, 30);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(122, 107, 82);
        doc.text(
          `Issues flagged: ${annotations.length}  |  Fixes applied: ${appliedFixes.size}  |  Remaining: ${annotations.length - appliedFixes.size}`,
          24, 52
        );
        doc.setFillColor(192, 57, 43);
        doc.rect(24, 72, 16, 8, 'F');
        doc.setTextColor(80, 60, 20);
        doc.text('Red = Needs improvement — hover in app for suggested rewrite', 46, 80);
        doc.setFillColor(76, 138, 114);
        doc.rect(24, 92, 16, 8, 'F');
        doc.text('Green = Fix applied', 46, 100);

        doc.save('CVsetuAI_Annotated_Resume.pdf');

      } else {
        // ── Word (.doc) export ─────────────────────────────────
        const now = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
        const appliedList  = annotations.filter(a => appliedFixes.has(a.id));
        const pendingList  = annotations.filter(a => !appliedFixes.has(a.id));

        const esc = (str) => (str||'')
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        const rowsHtml = (list, color) => list.map((ann, i) => `
          <tr>
            <td style="padding:6pt 8pt;border:1pt solid #ddd;font-size:10pt;color:#555;">${i+1}</td>
            <td style="padding:6pt 8pt;border:1pt solid #ddd;font-size:10pt;">${esc(ann.section || 'General')}</td>
            <td style="padding:6pt 8pt;border:1pt solid #ddd;font-size:10pt;color:${color};">${esc(ann.original || '')}</td>
            <td style="padding:6pt 8pt;border:1pt solid #ddd;font-size:10pt;color:#2A6B3C;font-style:italic;">${esc(ann.improved || '')}</td>
            <td style="padding:6pt 8pt;border:1pt solid #ddd;font-size:9pt;color:#777;">${esc((ann.reason||'').replace(/,?\s*\(\d+\s*char[^)]*\)/gi,'').trim())}</td>
          </tr>`).join('');

        // Score summary rows
        const scores = pageData[0]?.scores || results?.scores || {};
        const atsScore = pageData[0]?.atsScore || results?.atsScore || 0;
        const scoreRows = [
          ['Keyword Match', scores.keywordMatch ?? '—', '28%'],
          ['Achievements', scores.achievements ?? '—', '20%'],
          ['Experience Relevance', scores.experienceRelevance ?? '—', '18%'],
          ['Resume Structure', scores.resumeStructure ?? '—', '12%'],
          ['Skills Match', scores.skillsMatch ?? '—', '12%'],
          ['ATS Formatting', scores.atsFormatting ?? '—', '6%'],
          ['Leadership Signals', scores.leadershipSignals ?? '—', '4%'],
        ].map(([dim, score, wt]) => `
          <tr>
            <td style="padding:5pt 8pt;border:1pt solid #e8dcc8;font-size:10pt;">${dim}</td>
            <td style="padding:5pt 8pt;border:1pt solid #e8dcc8;font-size:10pt;font-weight:bold;color:#B07D2A;">${score}/100</td>
            <td style="padding:5pt 8pt;border:1pt solid #e8dcc8;font-size:9pt;color:#888;">${wt}</td>
          </tr>`).join('');

        const roleRows = (results?.roleScores || []).slice(0,10).map((r,i) => `
          <tr>
            <td style="padding:4pt 8pt;border:1pt solid #e8dcc8;font-size:9.5pt;">${i+1}. ${esc(r.role)}</td>
            <td style="padding:4pt 8pt;border:1pt solid #e8dcc8;font-size:9.5pt;font-weight:bold;color:#B07D2A;">${r.score}/100</td>
          </tr>`).join('');

        const recRows = (results?.topRecommendations || []).map((rec,i) => `
          <tr>
            <td style="padding:5pt 8pt;border:1pt solid #e8dcc8;font-size:9.5pt;color:#555;">${i+1}</td>
            <td style="padding:5pt 8pt;border:1pt solid #e8dcc8;font-size:9.5pt;font-weight:bold;">${esc(rec.title||rec.what||'')}</td>
            <td style="padding:5pt 8pt;border:1pt solid #e8dcc8;font-size:9pt;color:#777;">${esc(rec.what||rec.why||'')}</td>
            <td style="padding:5pt 8pt;border:1pt solid #e8dcc8;font-size:9pt;color:#B07D2A;font-style:italic;">${esc(rec.example||'')}</td>
          </tr>`).join('');

        const htmlDoc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>CVsetuAI Annotated Resume</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm 2.5cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  h1 { font-size: 20pt; color: #B07D2A; margin-bottom: 4pt; }
  h2 { font-size: 14pt; color: #2A1D08; margin: 18pt 0 6pt; border-bottom: 1.5pt solid #D4A850; padding-bottom: 4pt; }
  h3 { font-size: 12pt; color: #4C8A72; margin: 12pt 0 4pt; }
  p  { margin: 4pt 0; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
  th { background: #B07D2A; color: white; padding: 6pt 8pt; font-size: 10pt; text-align: left; }
  td { vertical-align: top; }
  .meta { font-size: 9pt; color: #888; }
  .stat-box { display: inline-block; border: 1pt solid #D4A850; border-radius: 4pt; padding: 4pt 10pt; margin: 4pt; background: #FDF8F0; }
  .score-big { font-size: 28pt; font-weight: bold; color: #B07D2A; }
</style>
</head>
<body>
  <h1>&#9889; CVsetuAI — Full Analysis Report</h1>
  <p class="meta">Generated: ${now} &nbsp;|&nbsp; Powered by Claude AI</p>
  <hr style="border:none;border-top:1pt solid #D4A850;margin:10pt 0;"/>

  <h2>Overall ATS Score</h2>
  <p><span class="score-big">${atsScore}</span><span style="font-size:14pt;color:#888;">/100 — ${atsScore >= 80 ? 'Excellent' : atsScore >= 70 ? 'Good' : atsScore >= 60 ? 'Fair' : 'Needs Work'}</span></p>
  <p>
    <span class="stat-box">ATS Score: <strong style="color:#B07D2A">${atsScore}/100</strong></span>
    <span class="stat-box">Issues Flagged: <strong style="color:#B85C52">${annotations.length}</strong></span>
    <span class="stat-box">Fixes Applied: <strong style="color:#4C8A72">${appliedFixes.size}</strong></span>
    <span class="stat-box">Remaining: <strong style="color:#B85C52">${pendingList.length}</strong></span>
  </p>

  <h2>ATS Dimension Scores</h2>
  <table>
    <tr><th style="width:40%">Dimension</th><th style="width:25%">Score</th><th style="width:35%">Weight</th></tr>
    ${scoreRows}
  </table>

  ${roleRows ? `
  <h2>Multi-Role ATS Fit (Top 10)</h2>
  <table>
    <tr><th style="width:70%">Role</th><th style="width:30%">Fit Score</th></tr>
    ${roleRows}
  </table>` : ''}

  ${recRows ? `
  <h2>Top Recommendations</h2>
  <table>
    <tr><th style="width:4%">#</th><th style="width:28%">Action</th><th style="width:40%">Why It Matters</th><th style="width:28%">Example</th></tr>
    ${recRows}
  </table>` : ''}

  ${appliedList.length > 0 ? `
  <h2>Applied Fixes (${appliedList.length})</h2>
  <table>
    <tr>
      <th style="width:4%">#</th><th style="width:16%">Section</th>
      <th style="width:28%">Original</th><th style="width:28%">Improved</th><th style="width:24%">Why Better</th>
    </tr>
    ${rowsHtml(appliedList, '#B85C52')}
  </table>` : ''}

  ${pendingList.length > 0 ? `
  <h2>Pending Improvements (${pendingList.length})</h2>
  <table>
    <tr>
      <th style="width:4%">#</th><th style="width:16%">Section</th>
      <th style="width:28%">Original</th><th style="width:28%">Suggested Rewrite</th><th style="width:24%">Why Better</th>
    </tr>
    ${rowsHtml(pendingList, '#B85C52')}
  </table>` : ''}

  <h2>How to Use This Document</h2>
  <p>1. Review <strong>Pending Improvements</strong> above — copy each Suggested Rewrite into your resume.</p>
  <p>2. The <strong>Why Better</strong> column explains the strategic reasoning for each change.</p>
  <p>3. After applying changes, re-upload to CVsetuAI to see your new ATS score.</p>
  <p style="margin-top:16pt;font-size:9pt;color:#aaa;">Generated by CVsetuAI powered by Claude AI. All suggestions are AI-generated — review before use.</p>
</body></html>`;

        const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), {
          href: url,
          download: 'CVsetuAI_Annotated_Resume.doc',
          style: 'display:none',
        });
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); if (a.parentNode) document.body.removeChild(a); }, 2000);
      }
    } catch (err) {
      alert(`Download failed: ${err.message}\n\nPlease try again or use the other format.`);
      console.error('Download error:', err);
    }
    setDownloading(false);
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:64 }}>
      <div style={{ width:48,height:48,border:`3px solid rgba(195,165,110,0.2)`,borderTop:`3px solid ${T.gold}`,borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 20px' }} />
      <p style={{ color:T.muted,fontFamily:"'Jost',sans-serif",fontSize:14 }}>Rendering your resume for annotation…</p>
      <p style={{ color:T.dim,fontFamily:"'Jost',sans-serif",fontSize:12,marginTop:6 }}>Analysing text positions to locate issues</p>
    </div>
  );

  if (loadError) return (
    <GlassCard><div style={{ color:T.danger,fontSize:14,fontFamily:"'Jost',sans-serif" }}>⚠ Could not render PDF: {loadError}</div></GlassCard>
  );

  const issueCount = annotations.filter(a => !appliedFixes.has(a.id)).length;

  return (
    <div onMouseMove={e => { if (activeAnnot && !lockedAnnotId) setMousePos({ x: e.clientX, y: e.clientY }); }} onClick={() => setShowFmtMenu(false)}>
      {/* ── Controls bar ── */}
      <GlassCard deep style={{ marginBottom:20, padding:'14px 20px' }}>
        {/* Row 1: status badges + hint */}
        <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:12 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 14px',background:T.roseBg,border:`1px solid rgba(184,92,82,0.28)`,borderRadius:20 }}>
            <span style={{ width:8,height:8,borderRadius:'50%',background:T.danger,display:'inline-block' }} />
            <span style={{ fontSize:13,color:T.danger,fontWeight:600,fontFamily:"'Jost',sans-serif" }}>{issueCount} Issue{issueCount !== 1 ? 's' : ''} Detected</span>
          </div>
          {appliedFixes.size > 0 && (
            <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 14px',background:T.sageBg,border:`1px solid rgba(76,138,114,0.28)`,borderRadius:20 }}>
              <span style={{ width:8,height:8,borderRadius:'50%',background:T.ok,display:'inline-block' }} />
              <span style={{ fontSize:13,color:T.ok,fontWeight:600,fontFamily:"'Jost',sans-serif" }}>{appliedFixes.size} Fix{appliedFixes.size !== 1 ? 'es' : ''} Applied</span>
            </div>
          )}
          <span style={{ fontSize:12,color:T.muted,fontFamily:"'Jost',sans-serif" }}>
            <span style={{color:T.danger}}>Hover</span> to preview · <span style={{color:T.blue}}>Click</span> to pin &amp; apply
          </span>
        </div>

        {/* Download buttons removed from document page */}
      </GlassCard>

      {/* ── PDF Pages ── */}
      <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
        {pageData.map((pg, pi) => {
          const pageAnnots = annotations.filter(a => a.page === pi);
          return (
            <GlassCard key={pi} style={{ padding:'16px 18px' }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                <span style={{ fontSize:11,color:T.muted,fontFamily:"'Jost',sans-serif",letterSpacing:'0.8px',textTransform:'uppercase' }}>Page {pi + 1} of {pageData.length}</span>
                {pageAnnots.length > 0 && (
                  <span style={{ fontSize:12,color:T.danger,fontFamily:"'Jost',sans-serif" }}>
                    {pageAnnots.filter(a => !appliedFixes.has(a.id)).length} issue{pageAnnots.filter(a => !appliedFixes.has(a.id)).length !== 1 ? 's' : ''} on this page
                  </span>
                )}
              </div>

              {/* Page image + annotation hotspots */}
              <div style={{ position:'relative', display:'block', lineHeight:0 }}>
                <img src={pg.imageUrl} alt={`Page ${pi+1}`}
                  style={{ width:'100%',display:'block',borderRadius:8,border:`1px solid rgba(195,165,110,0.22)`,boxShadow:'0 4px 20px rgba(140,105,50,0.10)' }} />

                {/* SVG overlay for red underlines */}
                <svg
                  viewBox={`0 0 ${pg.width} ${pg.height}`}
                  style={{ position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',overflow:'visible' }}>
                  <defs>
                    <filter id="redGlow">
                      <feGaussianBlur stdDeviation="1.5" result="blur"/>
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  {pageAnnots.map(ann => {
                    const applied   = appliedFixes.has(ann.id);
                    const isSelected = lockedAnnotId === ann.id;
                    // Applied fixes are now rendered directly on the canvas image — skip SVG overlay
                    if (applied) return null;
                    return (
                      <g key={ann.id}>
                        {/* Highlight bg — blue if selected, red if unselected */}
                        <rect x={ann.x - 3} y={ann.y - ann.lineHeight - 2} width={ann.width + 6} height={ann.lineHeight + 6}
                          fill={isSelected ? "rgba(74,112,156,0.14)" : "rgba(184,92,82,0.07)"} rx="3" />
                        {/* Dashed underline */}
                        <line x1={ann.x} y1={ann.y + 4} x2={ann.x + ann.width} y2={ann.y + 4}
                          stroke={isSelected ? "#4A709C" : "#C0392B"} strokeWidth={isSelected ? 2.8 : 2.2}
                          strokeDasharray={isSelected ? "7 3" : "5 3"} filter="url(#redGlow)" />
                        {/* Left bracket */}
                        <rect x={ann.x - 5} y={ann.y - ann.lineHeight - 2} width="4" height={ann.lineHeight + 8}
                          fill={isSelected ? "#4A709C" : "#C0392B"} rx="2" opacity={isSelected ? 1 : 0.7} />
                        {/* Click indicator badge when selected */}
                        {isSelected && (
                          <g>
                            <rect x={ann.x + ann.width + 6} y={ann.y - ann.lineHeight - 2} width={38} height={14}
                              fill="#4A709C" rx="7" />
                            <text x={ann.x + ann.width + 10} y={ann.y - ann.lineHeight + 8}
                              fontSize="9" fill="white" fontFamily="Jost, sans-serif" fontWeight="700">SELECTED</text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Clickable interaction hotspots */}
                {pageAnnots.map(ann => {
                  const xPct = (ann.x / pg.width) * 100;
                  const yPct = ((ann.y - ann.lineHeight - 2) / pg.height) * 100;
                  const wPct = (ann.width / pg.width) * 100;
                  const hPct = ((ann.lineHeight + 8) / pg.height) * 100;
                  const isSel = lockedAnnotId === ann.id;
                  const isApp = appliedFixes.has(ann.id);
                  // Applied fixes: non-interactive (text is painted directly on canvas)
                  if (isApp) return null;
                  return (
                    <div key={ann.id}
                      onMouseEnter={e => handleHover(e, ann)}
                      onMouseLeave={() => handleMouseLeave(ann)}
                      onClick={e => handleClick(e, ann)}
                      title="Hover to preview · Click to pin & apply fix"
                      style={{
                        position:'absolute',
                        left:`${xPct}%`, top:`${yPct}%`,
                        width:`${Math.min(wPct + 0.5, 94)}%`,
                        height:`${Math.max(hPct, 1.2)}%`,
                        cursor: 'pointer',
                        zIndex: 10,
                        outline: isSel ? '2px solid rgba(74,112,156,0.6)' : 'none',
                        borderRadius: 3,
                        transition: 'outline 0.15s',
                      }}
                    />
                  );
                })}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* ── Unified hover+click tooltip ── */}
      {activeAnnot && (
        <AnnotTooltip
          annot={activeAnnot}
          mousePos={lockedAnnotId === activeAnnot.id ? lockedPos : mousePos}
          isApplied={appliedFixes.has(activeAnnot.id)}
          isLocked={lockedAnnotId === activeAnnot.id}
          onApply={applyFix}
          onClose={closeTooltip}
        />
      )}
    </div>
  );
}


/* ─────────────────────────────────────────────
   CHAT MESSAGE RICH RENDERER
   Converts **bold**, ## headings, bullet lines → styled JSX
───────────────────────────────────────────── */
const CHAT_COLORS = ['#B07D2A','#4C8A72','#4A709C','#B85C52','#7B5EA7'];

const ChatMessage = memo(function ChatMessage({ content, role }) {
  if (role === 'user') {
    return (
      <div style={{ fontSize:13, lineHeight:1.65, color:'white', fontFamily:"'Jost',sans-serif" }}>
        {content}
      </div>
    );
  }

  // Parse assistant message into structured blocks
  const blocks = [];
  const lines = content.split('\n');
  let colorIdx = 0;

  lines.forEach((line, i) => {
    const raw = line.trim();
    if (!raw) { blocks.push({ type:'spacer' }); return; }

    // ## Heading
    if (raw.startsWith('## ')) {
      const text = raw.replace(/^## /, '').replace(/\*\*/g, '');
      blocks.push({ type:'h2', text, color: CHAT_COLORS[colorIdx++ % CHAT_COLORS.length] });
      return;
    }
    // ### Sub-heading
    if (raw.startsWith('### ')) {
      const text = raw.replace(/^### /, '').replace(/\*\*/g, '');
      blocks.push({ type:'h3', text, color: CHAT_COLORS[colorIdx++ % CHAT_COLORS.length] });
      return;
    }
    // Bullet
    if (raw.startsWith('- ') || raw.startsWith('• ') || raw.startsWith('* ')) {
      const text = raw.replace(/^[-•*] /, '');
      blocks.push({ type:'bullet', text });
      return;
    }
    // Numbered list
    if (/^\d+\./.test(raw)) {
      const text = raw.replace(/^\d+\.\s*/, '');
      const num  = raw.match(/^(\d+)/)[1];
      blocks.push({ type:'numbered', text, num });
      return;
    }
    // Plain paragraph
    blocks.push({ type:'para', text: raw });
  });

  // Helper to inline-bold text: **word** → <strong>
  function inlineBold(text) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((p, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ fontWeight:700, color:T.text }}>{p}</strong>
        : <span key={i}>{p}</span>
    );
  }

  return (
    <div style={{ fontSize:13, lineHeight:1.7, fontFamily:"'Jost',sans-serif", color:T.text }}>
      {blocks.map((b, i) => {
        if (b.type === 'spacer') return <div key={i} style={{ height:6 }} />;

        if (b.type === 'h2') return (
          <div key={i} style={{
            fontFamily:"'Playfair Display',serif",
            fontWeight:700, fontSize:15,
            color: b.color,
            marginTop:14, marginBottom:6,
            paddingBottom:4,
            borderBottom:`2px solid ${b.color}33`,
            display:'flex', alignItems:'center', gap:7,
          }}>
            <span style={{ width:4, height:16, background:b.color, borderRadius:2, display:'inline-block', flexShrink:0 }} />
            {b.text}
          </div>
        );

        if (b.type === 'h3') return (
          <div key={i} style={{
            fontWeight:700, fontSize:13,
            color: b.color,
            marginTop:10, marginBottom:4,
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{ fontSize:10, color:b.color }}>◆</span>
            {b.text}
          </div>
        );

        if (b.type === 'bullet') return (
          <div key={i} style={{
            display:'flex', gap:8, marginBottom:5, alignItems:'flex-start',
            padding:'5px 10px',
            background:'rgba(176,125,42,0.05)',
            borderRadius:7,
            borderLeft:`3px solid rgba(176,125,42,0.35)`,
          }}>
            <span style={{ color:T.gold, flexShrink:0, fontSize:14, marginTop:1 }}>›</span>
            <span>{inlineBold(b.text)}</span>
          </div>
        );

        if (b.type === 'numbered') return (
          <div key={i} style={{
            display:'flex', gap:10, marginBottom:5, alignItems:'flex-start',
            padding:'5px 10px',
            background:'rgba(74,112,156,0.05)',
            borderRadius:7,
          }}>
            <span style={{
              minWidth:22, height:22, background:'linear-gradient(135deg,#4A709C,#6B94C4)',
              borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700, color:'white', flexShrink:0
            }}>{b.num}</span>
            <span style={{ paddingTop:2 }}>{inlineBold(b.text)}</span>
          </div>
        );

        // para
        return (
          <div key={i} style={{ marginBottom:4 }}>
            {inlineBold(b.text)}
          </div>
        );
      })}
    </div>
  );
});

/* ─────────────────────────────────────────────
   RESULTS DASHBOARD
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   SUMMARY REFRESH CARD
   Shows AI-written summary with one-click refresh
   that synthesises ALL improved bullets into a new
   elite version using Claude.
───────────────────────────────────────────── */

function ResultsDashboard({ results, resumeFile, onBack, onReanalyze }) {
  const [tab, setTab] = useState('Overview');
  const [history, setHistory] = useState([
    { role:'assistant', content:`## 👋 Welcome to CVsetuAI Coach\n\nYour **ATS Score** is ${results.atsScore}/100 — **${scoreLabel(results.atsScore)}**.\n\n### What I can help you with\n- Improve specific bullet points or sections\n- Identify the best roles for your profile\n- Add missing keywords to boost your score\n- Get an actionable step-by-step improvement plan\n\nAsk me anything about your resume!` }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEnd = useRef();
  const TABS = ['Overview','Scores','Keywords','Analysis','Your Resume','AI Coach','PDF Report', ...(results.hasJD ? ['JD Match'] : [])];
  const contentRef = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [history]);

  // Scroll to top of content area on every tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [tab]);

  // Fire once when the dashboard first opens after analysis completes
  useEffect(() => {
    track('analysis-completed', {
      atsScore: results?.atsScore,
      hasJD: !!results?.hasJD,
      jdMatchPct: results?.jdMatch?.percentage ?? null,
    });
    track('dashboard-tab-view', { tab: 'Overview', initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TIME-ON-TAB tracking ────────────────────────────────────
  // Emits `dashboard-tab-time` when the user leaves a tab (or unmounts/hides).
  // Only counts active foreground time (pauses on tab hidden).
  useEffect(() => {
    let activeStart = Date.now();
    let accumulated = 0;
    const onVisibility = () => {
      if (document.hidden) {
        accumulated += Date.now() - activeStart;
      } else {
        activeStart = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (!document.hidden) accumulated += Date.now() - activeStart;
      const seconds = Math.round(accumulated / 1000);
      // Ignore ultra-short flips (<2s) to reduce noise from quick tab scans
      if (seconds >= 2) {
        track('dashboard-tab-time', { tab, seconds });
      }
    };
  }, [tab]);

  // ── SCROLL-DEPTH tracking (per tab) ─────────────────────────
  // Emits `dashboard-scroll-depth` once per band (25/50/75/100) per tab visit.
  useEffect(() => {
    const reached = new Set();
    let ticking = false;
    const measure = () => {
      ticking = false;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const viewport = window.innerHeight || doc.clientHeight;
      const total = Math.max(doc.scrollHeight, doc.offsetHeight) - viewport;
      if (total <= 0) return;
      const pct = Math.min(100, Math.round((scrollTop / total) * 100));
      [25, 50, 75, 100].forEach(band => {
        if (pct >= band && !reached.has(band)) {
          reached.add(band);
          track('dashboard-scroll-depth', { tab, depth: band });
        }
      });
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };
    // Initial measurement (short tabs may already be 100% visible)
    const initial = setTimeout(measure, 350);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      clearTimeout(initial);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [tab]);

  const handleChat = useCallback(async () => {
    const msg = chatInput.trim(); if (!msg || chatLoading) return;
    track('coach-message-sent', { length: msg.length });
    setChatInput('');
    const next = [...history, { role:'user', content:msg }];
    setHistory(next);
    setChatLoading(true);
    try {
      const apiMsgs = next
        .filter(m => !(m.role==='assistant' && m.content.startsWith('👋')))
        .map(m => ({ role:m.role, content:m.content }));
      const firstUser = apiMsgs.findIndex(m => m.role==='user');
      const msgs = firstUser >= 0 ? apiMsgs.slice(firstUser) : apiMsgs;
      if (!msgs.length) return;
      const resp = await sendChat(msgs, results);
      setHistory(h => [...h, { role:'assistant', content:resp }]);
      track('coach-reply-received');
    } catch(err) {
      setHistory(h => [...h, { role:'assistant', content:'Sorry, I encountered an error. Please try again.' }]);
      track('coach-error');
    }
    setChatLoading(false);
  }, [chatInput, chatLoading, history, results]);

  const RADAR_DATA = useMemo(() => [
    { s:'Keywords',    v:results.scores.keywordMatch },
    { s:'Structure',   v:results.scores.resumeStructure },
    { s:'Experience',  v:results.scores.experienceRelevance },
    { s:'Achievements',v:results.scores.achievements },
    { s:'Skills',      v:results.scores.skillsMatch },
    { s:'Formatting',  v:results.scores.atsFormatting },
    { s:'Leadership',  v:results.scores.leadershipSignals },
  ], [results.scores]);

  const CAT_SCORES = useMemo(() => [
    { label:'Keyword Match',        score:results.scores.keywordMatch,       weight:'28%' },
    { label:'Achievements',         score:results.scores.achievements,       weight:'20%' },
    { label:'Experience Relevance', score:results.scores.experienceRelevance,weight:'18%' },
    { label:'Resume Structure',     score:results.scores.resumeStructure,    weight:'12%' },
    { label:'Skills Match',         score:results.scores.skillsMatch,        weight:'12%' },
    { label:'ATS Formatting',       score:results.scores.atsFormatting,      weight:'6%'  },
    { label:'Leadership Signals',   score:results.scores.leadershipSignals,  weight:'4%'  },
  ], [results.scores]);

  const tooltipStyle = useMemo(() => ({ background:'rgba(253,248,240,0.95)', backdropFilter:'blur(12px)', border:'1px solid rgba(195,165,110,0.3)', borderRadius:10, color:T.text, fontSize:13, boxShadow:'0 8px 24px rgba(140,105,50,0.12)' }), []);

  const lbaStats = useMemo(() => {
    const items = results.lineByLineAnalysis || [];
    const sections = [...new Set(items.map(i => i.section || 'General'))];
    const workItems = items.filter(i => (i.section||'').toLowerCase().includes('experience') || (i.section||'').toLowerCase().includes('work'));
    return { items, sections, workItems, otherItems: items.length - workItems.length };
  }, [results.lineByLineAnalysis]);

  return (
    <div style={{ background:T.bg, minHeight:'100vh', color:T.text, fontFamily:"'Jost', sans-serif", position:'relative' }}>
      <BgOrbs />

      {/* ── Fixed top bar ── */}
      <div className="riq-top-bar" style={{ position:'fixed',top:0,left:0,right:0,zIndex:200,display:'flex',alignItems:'center',gap:10,padding:'12px 22px',borderBottom:`1px solid rgba(195,165,110,0.25)`,background:'rgba(253,248,240,0.92)',backdropFilter:'blur(24px)',WebkitBackdropFilter:'blur(24px)' }}>
        <button className="btn-ghost" onClick={onBack} style={{ padding:'6px 12px', fontSize:12 }}>← Back</button>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginLeft:4 }}>
          <img src={cvsetuaiLogo} alt="CVsetuAI" style={{ height:28, objectFit:'contain' }} />
        </div>
        <div className="riq-cand-info" style={{ flex:1,marginLeft:10 }}>
          <div style={{ fontWeight:600,fontSize:14,color:T.text }}>{results.candidate?.name || 'Resume Analysis'}</div>
          <div style={{ fontSize:11,color:T.muted,fontFamily:"'Jost',sans-serif" }}>{results.candidate?.currentRole}{results.candidate?.yearsExp ? ` · ${results.candidate.yearsExp} yrs exp` : ''}{results.candidate?.location ? ` · ${results.candidate.location}` : ''}</div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6, background:scoreBg(results.atsScore), border:`1px solid ${scoreColor(results.atsScore)}40`, borderRadius:20, padding:'5px 14px', backdropFilter:'blur(8px)' }}>
            <span style={{ fontSize:16,fontWeight:700,color:scoreColor(results.atsScore),fontFamily:"'Playfair Display',serif" }}>{results.atsScore}</span>
            <span style={{ fontSize:11,color:T.muted }}>/ 100</span>
          </div>
          <button className="btn-ghost" onClick={()=>{ track('dashboard-reanalyse'); onReanalyze(); }} style={{ padding:'7px 13px',fontSize:12 }}>🔄 Re-analyse</button>
        </div>
      </div>

      {/* ── Tab bar — fixed below top bar ── */}
      <div style={{ position:'fixed',top:54,left:0,right:0,zIndex:190,display:'flex',gap:0,borderBottom:`1px solid rgba(195,165,110,0.22)`,background:'rgba(253,248,240,0.88)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',overflowX:'auto',padding:'0 18px',WebkitOverflowScrolling:'touch' }} className="riq-tabs-wrap">
        {TABS.map(t => (
          <button key={t} className="tab-btn riq-tab-btn" onClick={()=>{ track('dashboard-tab-view', { tab: t }); setTab(t); }} style={{
            padding:'12px 16px', color: tab===t ? T.gold : T.muted,
            fontWeight: tab===t ? 600 : 400, fontSize:13, flexShrink:0,
            borderBottom:`2px solid ${tab===t ? T.gold : 'transparent'}`,
            background: tab===t ? 'rgba(176,125,42,0.06)' : 'none',
          }}>{t}</button>
        ))}
      </div>

      {/* ── Content — padded to clear fixed top bar (54px) + tab bar (~44px) ── */}
      <div data-riq-content style={{ position:'relative',zIndex:1,maxWidth:980,margin:'0 auto',padding:'24px 18px 48px',paddingTop:'118px' }}>

        {/* ════════ OVERVIEW ════════ */}
        {tab === 'Overview' && (
          <TabErrorBoundary tab="Overview" onReanalyze={onReanalyze}>
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
            {/* Quick stats strip */}
            <div className="riq-stats-strip" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                { icon:'✒️', label:'Lines Analysed',     value: lbaStats.items.length,     color: T.gold },
                { icon:'📂', label:'Sections Covered',   value: lbaStats.sections.length,  color: T.blue },
                { icon:'💼', label:'Experience Lines',   value: lbaStats.workItems.length, color: T.sage },
                { icon:'📄', label:'Other Section Lines',value: lbaStats.otherItems,       color: T.rose },
              ].map(({ icon, label, value, color }) => (
                <div key={label} style={{ background:'rgba(255,255,255,0.55)', backdropFilter:'blur(12px)', border:`1px solid rgba(195,165,110,0.25)`, borderRadius:14, padding:'14px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:22, color }}>{value}</div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:3, fontFamily:"'Jost',sans-serif" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Hero row — gauge + recruiter score */}
            <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
              <GlassCard deep style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'28px 32px',minWidth:200 }}>
                <div className="riq-score-gauge"><ScoreGauge score={results.atsScore} size={170} /></div>
                <div style={{ marginTop:14,textAlign:'center' }}>
                  <div style={{ fontSize:12,color:T.muted,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6 }}>Recruiter Score</div>
                  <div style={{ display:'flex',gap:10,alignItems:'center',justifyContent:'center' }}>
                    <div style={{ fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:scoreColor(results.recruiterScore) }}>{results.recruiterScore}</div>
                    <div style={{ fontSize:12,color:T.muted }}>/100</div>
                  </div>
                </div>
              </GlassCard>
              {/* Quick dimension scores as compact chips */}
              <GlassCard style={{ flex:1, minWidth:280 }}>
                <SectionHead icon="⚡" title="Quick Score Summary" sub="See the Scores tab for full radar and breakdown." />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Keyword Match',   score:results.scores?.keywordMatch,        weight:'28%' },
                    { label:'Achievements',    score:results.scores?.achievements,        weight:'20%' },
                    { label:'Experience',      score:results.scores?.experienceRelevance, weight:'18%' },
                    { label:'Structure',       score:results.scores?.resumeStructure,     weight:'12%' },
                    { label:'Skills Match',    score:results.scores?.skillsMatch,         weight:'12%' },
                    { label:'Formatting',      score:results.scores?.atsFormatting,       weight:'6%'  },
                  ].map(({ label, score, weight }) => {
                    const col = scoreColor(score || 0);
                    return (
                      <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 11px', background:'rgba(255,255,255,0.5)', border:`1px solid rgba(195,165,110,0.2)`, borderRadius:10 }}>
                        <div>
                          <div style={{ fontSize:12, color:T.text, fontFamily:"'Jost',sans-serif", fontWeight:500 }}>{label}</div>
                          <div style={{ fontSize:10, color:T.muted, fontFamily:"'Jost',sans-serif" }}>{weight} weight</div>
                        </div>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:20, color:col }}>{score ?? '—'}</div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* JD Match — compact banner in Overview (between scores and action plan) */}
            {results.hasJD && results.jdMatch && (
              <div
                onClick={() => setTab('JD Match')}
                style={{ cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14,
                  padding:'16px 22px', borderRadius:16,
                  background:`linear-gradient(135deg, ${scoreBg(results.jdMatch.percentage)}, rgba(255,255,255,0.55))`,
                  border:`1.5px solid ${scoreColor(results.jdMatch.percentage)}44`,
                  backdropFilter:'blur(12px)', boxShadow:'0 4px 18px rgba(140,105,50,0.10)',
                  transition:'box-shadow .2s, transform .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 30px rgba(140,105,50,0.18)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 18px rgba(140,105,50,0.10)'; }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ textAlign:'center', minWidth:70 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:38, fontWeight:800, color:scoreColor(results.jdMatch.percentage), lineHeight:1 }}>
                      {results.jdMatch.percentage}%
                    </div>
                    <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.6px', marginTop:3, fontFamily:"'Jost',sans-serif", textTransform:'uppercase' }}>JD Match</div>
                  </div>
                  <div style={{ width:1, height:44, background:'rgba(195,165,110,0.3)' }} />
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:15, color:T.text, marginBottom:4 }}>Job Description Analysis Ready</div>
                    <div style={{ fontSize:12, color:T.muted, fontFamily:"'Jost',sans-serif" }}>
                      {results.jdMatch.matchingSkills?.length || 0} skills matched · {results.jdMatch.missingSkills?.length || 0} skills missing · {results.jdMatch.roleFitSuggestions?.length || 0} action steps
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:scoreColor(results.jdMatch.percentage), fontWeight:600, fontFamily:"'Jost',sans-serif", flexShrink:0 }}>
                  View Full JD Analysis →
                </div>
              </div>
            )}

            {/* ── Top Recommendations — rich point-wise cards ── */}
            <GlassCard deep>
              <SectionHead icon="🎯" title="Priority Action Plan"
                sub={`${(results.topRecommendations || []).filter(r => r && (typeof r === 'string' || r.title)).length} specific actions to boost your ATS score — one per scoring dimension.`} />
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {(results.topRecommendations || []).filter(r => r && (typeof r !== 'object' || r.title)).map((rec, i) => {
                  const isObj  = rec && typeof rec === 'object';
                  const title  = isObj ? rec.title     : `Recommendation ${i+1}`;
                  const what   = isObj ? rec.what      : rec;
                  const why    = isObj ? rec.why       : '';
                  const example= isObj ? rec.example   : '';
                  const impact = isObj ? (rec.impact || 'medium') : 'medium';
                  const effort = isObj ? (rec.effort || 'medium') : 'medium';
                  const dim    = isObj ? (rec.dimension || '') : '';

                  const impactMeta = {
                    high:   { color:T.danger, bg:T.roseBg,  border:'rgba(184,92,82,0.28)',  label:'High Impact'   },
                    medium: { color:T.warn,   bg:T.goldBg,  border:'rgba(176,125,42,0.28)', label:'Medium Impact' },
                    low:    { color:T.blue,   bg:T.blueBg,  border:'rgba(74,112,156,0.25)', label:'Low Impact'    },
                  }[impact] || { color:T.warn, bg:T.goldBg, border:'rgba(176,125,42,0.28)', label:'Medium Impact' };

                  const effortMeta = {
                    low:    { color:T.ok,   label:'Quick Win'   },
                    medium: { color:T.warn, label:'Some Effort' },
                    high:   { color:T.rose, label:'High Effort' },
                  }[effort] || { color:T.warn, label:'Some Effort' };

                  const dimIcons = {
                    'Achievements':'📈','Keyword Match':'🔑','Skills Match':'⚙️',
                    'Resume Structure':'📋','Experience Relevance':'💼',
                    'Leadership Signals':'👑','ATS Formatting':'🖥️','Professional Summary':'✍️',
                  };

                  return (
                    <div key={i} style={{ borderRadius:14, overflow:'hidden', border:`1.5px solid ${impactMeta.border}`, background:impactMeta.bg }}>
                      {/* Header */}
                      <div style={{ padding:'13px 16px 11px', display:'flex', gap:12, alignItems:'flex-start' }}>
                        <div style={{ flexShrink:0, width:26, height:26, borderRadius:'50%', background:impactMeta.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, marginTop:1, fontFamily:"'Playfair Display',serif" }}>{i+1}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:14, color:T.text, lineHeight:1.4, marginBottom:6 }}>{title}</div>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            <span style={{ fontSize:10, fontWeight:700, color:impactMeta.color, background:'rgba(255,255,255,0.6)', border:`1px solid ${impactMeta.border}`, borderRadius:20, padding:'2px 9px', fontFamily:"'Jost',sans-serif" }}>
                              ● {impactMeta.label}
                            </span>
                            <span style={{ fontSize:10, fontWeight:600, color:effortMeta.color, background:'rgba(255,255,255,0.5)', border:`1px solid ${effortMeta.color}44`, borderRadius:20, padding:'2px 9px', fontFamily:"'Jost',sans-serif" }}>
                              ⏱ {effortMeta.label}
                            </span>
                            {dim && (
                              <span style={{ fontSize:10, fontWeight:600, color:T.muted, background:'rgba(255,255,255,0.55)', border:'1px solid rgba(195,165,110,0.3)', borderRadius:20, padding:'2px 9px', fontFamily:"'Jost',sans-serif" }}>
                                {dimIcons[dim] || '📌'} {dim}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Detail rows */}
                      <div style={{ borderTop:`1px solid ${impactMeta.border}` }}>
                        {what && (
                          <div style={{ padding:'10px 16px', borderBottom:(why||example)?`1px solid ${impactMeta.border}`:'none', display:'flex', gap:10 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:impactMeta.color, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:"'Jost',sans-serif", flexShrink:0, marginTop:1, minWidth:64 }}>Do this</span>
                            <span style={{ fontSize:13, color:T.text, lineHeight:1.6, fontFamily:"'Jost',sans-serif" }}>{what}</span>
                          </div>
                        )}
                        {why && (
                          <div style={{ padding:'10px 16px', borderBottom:example?`1px solid ${impactMeta.border}`:'none', display:'flex', gap:10, background:'rgba(255,255,255,0.28)' }}>
                            <span style={{ fontSize:11, fontWeight:700, color:impactMeta.color, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:"'Jost',sans-serif", flexShrink:0, marginTop:1, minWidth:64 }}>Why</span>
                            <span style={{ fontSize:12, color:T.muted, lineHeight:1.6, fontFamily:"'Jost',sans-serif" }}>{why}</span>
                          </div>
                        )}
                        {example && (
                          <div style={{ padding:'10px 16px', display:'flex', gap:10, background:'rgba(255,255,255,0.45)' }}>
                            <span style={{ fontSize:11, fontWeight:700, color:impactMeta.color, textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:"'Jost',sans-serif", flexShrink:0, marginTop:1, minWidth:64 }}>Example</span>
                            <span style={{ fontSize:12, color:T.text, lineHeight:1.6, fontStyle:'italic', fontFamily:"'Jost',sans-serif" }}>"{example}"</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>



            <div className="riq-2col" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
              <GlassCard>
                <SectionHead icon="💪" title="Strengths" />
                {results.strengths?.map((s,i)=>(
                  <div key={i} style={{ display:'flex',gap:10,marginBottom:11,alignItems:'flex-start' }}>
                    <span style={{ color:T.ok,flexShrink:0,marginTop:2,fontSize:13 }}>✓</span>
                    <span style={{ fontSize:13,color:T.text,lineHeight:1.55 }}>{s}</span>
                  </div>
                ))}
              </GlassCard>
              <GlassCard>
                <SectionHead icon="⚡" title="Areas to Improve" />
                {results.weaknesses?.map((w,i)=>(
                  <div key={i} style={{ display:'flex',gap:10,marginBottom:11,alignItems:'flex-start' }}>
                    <span style={{ color:T.warn,flexShrink:0,marginTop:2 }}>△</span>
                    <span style={{ fontSize:13,color:T.text,lineHeight:1.55 }}>{w}</span>
                  </div>
                ))}
              </GlassCard>
            </div>

            {/* ATS Issues */}
            {results.atsIssues?.length > 0 && (
              <GlassCard>
                <SectionHead icon="🚨" title="ATS Formatting Issues" sub="Fix these to prevent automatic rejection by ATS software." />
                {results.atsIssues.map((iss,i) => (
                  <div key={i} style={{ display:'flex',gap:14,padding:'13px 0',borderBottom: i<results.atsIssues.length-1 ? `1px solid rgba(195,165,110,0.2)` : 'none',alignItems:'flex-start' }}>
                    <Pill type={iss.severity==='high'?'danger':iss.severity==='medium'?'warn':'ok'} small>{iss.severity.toUpperCase()}</Pill>
                    <div>
                      <div style={{ fontWeight:600,fontSize:13,marginBottom:4,color:T.text }}>{iss.issue}</div>
                      <div style={{ fontSize:12,color:T.muted }}>💡 {iss.fix}</div>
                    </div>
                  </div>
                ))}
              </GlassCard>
            )}
          </div>
          </TabErrorBoundary>
        )}

        {/* ════════ SCORES ════════ */}
        {tab === 'Scores' && (
          <TabErrorBoundary tab="Scores" onReanalyze={onReanalyze}>
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
            <div className="riq-radar-grid riq-2col" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
              <GlassCard>
                <SectionHead icon="📡" title="ATS Score Radar" sub="7-category breakdown across all scoring dimensions." />
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={RADAR_DATA}>
                    <PolarGrid stroke="rgba(195,165,110,0.25)" />
                    <PolarAngleAxis dataKey="s" tick={{ fill:T.muted, fontSize:12, fontFamily:"'Jost',sans-serif" }} />
                    <Radar dataKey="v" stroke={T.gold} fill={T.gold} fillOpacity={0.15} strokeWidth={2} dot={{ r:3, fill:T.gold }} />
                  </RadarChart>
                </ResponsiveContainer>
              </GlassCard>
              <GlassCard>
                <SectionHead icon="📊" title="Category Breakdown" sub="Weighted scores for each ATS factor." />
                {CAT_SCORES.map(({label,score,weight})=>(
                  <ScoreBar key={label} label={label} score={score} weight={weight} />
                ))}
              </GlassCard>
            </div>

            {/* Recruiter score grid */}
            <GlassCard>
              <SectionHead icon="👔" title="Recruiter Appeal Score" sub="Simulates how a human recruiter evaluates your resume on 6 signals." />
              <div className="riq-recruiter-grid" style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14 }}>
                {[
                  {label:'Overall',       score:results.recruiterScore},
                  {label:'Impact Metrics',score:results.scores.achievements},
                  {label:'Leadership',    score:results.scores.leadershipSignals},
                  {label:'Keyword Fit',   score:results.scores.keywordMatch},
                  {label:'Structure',     score:results.scores.resumeStructure},
                  {label:'Skills',        score:results.scores.skillsMatch},
                ].map(({label,score})=>{
                  const col = scoreColor(score);
                  return (
                    <div key={label} style={{ background:scoreBg(score),border:`1px solid ${col}28`,borderRadius:14,padding:'16px 12px',textAlign:'center',backdropFilter:'blur(8px)' }}>
                      <div style={{ fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:col,lineHeight:1 }}>{score}</div>
                      <div style={{ fontSize:11,color:T.muted,marginTop:7,fontFamily:"'Jost',sans-serif" }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Role Fit Chart */}
            <GlassCard>
              <SectionHead icon="🎯" title="Multi-Role ATS Fit" sub="Rank-ordered fit across 12 career tracks — green = strongest match, red = weakest." />
              {(() => {
                const sorted = [...results.roleScores].sort((a,b) => b.score - a.score);
                const n = sorted.length;
                // Rank-based color: index 0 (highest) → green, index n-1 (lowest) → red
                // Interpolate HSL: H=120 (green) down to H=0 (red)
                const rankColor = (idx) => {
                  const h = Math.round(120 - (idx / Math.max(n - 1, 1)) * 120);
                  const s = 65, l = idx === 0 ? 38 : idx === n-1 ? 42 : 44;
                  return `hsl(${h},${s}%,${l}%)`;
                };
                const rankBg = (idx) => {
                  const h = Math.round(120 - (idx / Math.max(n - 1, 1)) * 120);
                  return `hsla(${h},60%,92%,0.85)`;
                };
                return (
                  <div>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={sorted} layout="vertical" margin={{left:14,right:54,top:4,bottom:4}}>
                        <XAxis type="number" domain={[0,100]} tick={{ fill:T.muted, fontSize:11, fontFamily:"'Jost',sans-serif" }} tickLine={false} axisLine={{ stroke:'rgba(195,165,110,0.2)' }} />
                        <YAxis type="category" dataKey="role" tick={{ fill:T.text, fontSize:12, fontFamily:"'Jost',sans-serif" }} width={128} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ ...tooltipStyle, minWidth:180 }}
                          formatter={(val, name, props) => {
                            const idx = sorted.findIndex(r => r.role === props.payload.role);
                            const medal = idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : '';
                            return [`${val}/100${medal}`, 'Role Fit Score'];
                          }}
                          labelStyle={{ fontFamily:"'Playfair Display',serif", fontWeight:700, color:T.text, marginBottom:4 }}
                        />
                        <Bar dataKey="score" radius={[0,7,7,0]}
                          label={{ position:'right', fill:T.muted, fontSize:11, fontFamily:"'Jost',sans-serif", fontWeight:600, formatter:v=>`${v}` }}>
                          {sorted.map((e, idx) => (
                            <Cell key={idx} fill={rankColor(idx)} opacity={0.88} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {/* Legend strip */}
                    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:20, marginTop:10, flexWrap:'wrap' }}>
                      {[{label:'Best Match', color:'hsl(120,65%,38%)'},{label:'Strong Fit','color':'hsl(80,65%,42%)'},{label:'Moderate','color':'hsl(45,65%,44%)'},{label:'Low Fit','color':'hsl(20,65%,44%)'},{label:'Weakest','color':'hsl(0,65%,42%)'}].map(({label,color})=>(
                        <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:12, height:12, borderRadius:3, background:color, display:'inline-block', flexShrink:0 }} />
                          <span style={{ fontSize:11, color:T.muted, fontFamily:"'Jost',sans-serif" }}>{label}</span>
                        </div>
                      ))}
                    </div>
                    {/* Top 3 callout cards */}
                    <div className="riq-top3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:14 }}>
                      {sorted.slice(0,3).map((r,idx)=>(
                        <div key={r.role} style={{ background:rankBg(idx), border:`1px solid ${rankColor(idx)}44`, borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
                          <div style={{ fontSize:18, marginBottom:4 }}>{idx===0?'🥇':idx===1?'🥈':'🥉'}</div>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:13, color:T.text, marginBottom:3 }}>{r.role}</div>
                          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, color:rankColor(idx) }}>{r.score}</div>
                          <div style={{ fontSize:10, color:T.muted, marginTop:2, fontFamily:"'Jost',sans-serif" }}>/ 100</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </GlassCard>
          </div>
          </TabErrorBoundary>
        )}

        {/* ════════ KEYWORDS ════════ */}
        {tab === 'Keywords' && (
          <TabErrorBoundary tab="Keywords" onReanalyze={onReanalyze}>
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>

            {/* ── JD Top Missing Keywords — only shown when JD uploaded ── */}
            {results.hasJD && results.jdMatch?.jdTopMissingKeywords?.length > 0 && (
              <GlassCard deep>
                <SectionHead icon="🎯" title="Top JD Keywords Missing From Your Resume"
                  sub={`These ${results.jdMatch.jdTopMissingKeywords.length} keywords are directly from the job description ranked by importance. Adding them will significantly boost your JD match score.`} />
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {results.jdMatch.jdTopMissingKeywords.map((kw, i) => {
                    const impColor = kw.importance === 'critical' ? T.danger : kw.importance === 'high' ? T.warn : T.blue;
                    const impBg    = kw.importance === 'critical' ? T.roseBg : kw.importance === 'high' ? T.goldBg : T.blueBg;
                    const impBorder= kw.importance === 'critical' ? 'rgba(184,92,82,0.28)' : kw.importance === 'high' ? 'rgba(176,125,42,0.28)' : 'rgba(74,112,156,0.25)';
                    return (
                      <div key={i} style={{ borderRadius:12, overflow:'hidden', border:`1.5px solid ${impBorder}`, background:impBg }}>
                        <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ flexShrink:0, width:22, height:22, borderRadius:'50%', background:impColor, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>{i+1}</div>
                          <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:14, color:T.text, flex:1 }}>"{kw.keyword}"</span>
                          <span style={{ fontSize:10, fontWeight:700, color:impColor, background:'rgba(255,255,255,0.6)', border:`1px solid ${impBorder}`, borderRadius:20, padding:'2px 10px', fontFamily:"'Jost',sans-serif", textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>
                            {kw.importance}
                          </span>
                          {kw.frequency > 1 && (
                            <span style={{ fontSize:10, color:T.muted, background:'rgba(255,255,255,0.5)', border:'1px solid rgba(195,165,110,0.25)', borderRadius:20, padding:'2px 8px', fontFamily:"'Jost',sans-serif", flexShrink:0 }}>
                              ×{kw.frequency} in JD
                            </span>
                          )}
                        </div>
                        {(kw.context || kw.where || kw.example) && (
                          <div style={{ borderTop:`1px solid ${impBorder}`, display:'grid', gridTemplateColumns: kw.example ? '1fr 1fr' : '1fr', gap:0 }}>
                            {(kw.context || kw.where) && (
                              <div style={{ padding:'8px 14px', borderRight: kw.example ? `1px solid ${impBorder}` : 'none' }}>
                                {kw.context && <div style={{ fontSize:12, color:T.text, lineHeight:1.5, fontFamily:"'Jost',sans-serif", marginBottom: kw.where ? 4 : 0 }}>{kw.context}</div>}
                                {kw.where && <div style={{ fontSize:11, color:T.muted, fontFamily:"'Jost',sans-serif" }}>📍 Add to: {kw.where}</div>}
                              </div>
                            )}
                            {kw.example && (
                              <div style={{ padding:'8px 14px', background:'rgba(255,255,255,0.35)' }}>
                                <div style={{ fontSize:10, fontWeight:700, color:impColor, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4, fontFamily:"'Jost',sans-serif" }}>Example</div>
                                <div style={{ fontSize:12, color:T.text, lineHeight:1.5, fontStyle:'italic', fontFamily:"'Jost',sans-serif" }}>"{kw.example}"</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(176,125,42,0.07)', border:'1px solid rgba(176,125,42,0.2)', borderRadius:10, fontSize:12, color:T.muted, fontFamily:"'Jost',sans-serif" }}>
                  💡 <strong>Pro tip:</strong> Focus on "critical" keywords first — they appear most frequently in the JD and carry the highest ATS weight. Add them naturally into your bullet points; never fabricate experience.
                </div>
              </GlassCard>
            )}

            <GlassCard>
              <SectionHead icon="🔑" title="Missing Power Keywords" sub="Add these role-specific keywords to dramatically improve your ATS hit rate." />
              <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                {results.missingKeywords?.filter(kw => kw.keyword).map((kw,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.5)',border:`1px solid rgba(195,165,110,0.25)`,borderRadius:14,padding:'16px 18px',backdropFilter:'blur(8px)' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
                      <span style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:15,color:T.gold }}>"{kw.keyword}"</span>
                      <Pill type="danger" small>Missing</Pill>
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10 }}>
                      <div style={{ background:T.goldBg,border:`1px solid rgba(176,125,42,0.2)`,borderRadius:9,padding:'9px 12px' }}>
                        <div style={{ fontSize:10,fontWeight:700,color:T.gold,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:5 }}>Why it matters</div>
                        <div style={{ fontSize:12,color:T.text,lineHeight:1.5 }}>{kw.why}</div>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.55)',border:`1px solid rgba(195,165,110,0.2)`,borderRadius:9,padding:'9px 12px' }}>
                        <div style={{ fontSize:10,fontWeight:700,color:T.blue,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:5 }}>Where to add</div>
                        <div style={{ fontSize:12,color:T.text,lineHeight:1.5 }}>{kw.where}</div>
                      </div>
                    </div>
                    {kw.example && (
                      <div style={{ background:T.sageBg,border:`1px solid rgba(76,138,114,0.2)`,borderRadius:9,padding:'9px 12px' }}>
                        <div style={{ fontSize:10,fontWeight:700,color:T.ok,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:5 }}>Example sentence</div>
                        <div style={{ fontSize:12,color:T.text,lineHeight:1.55,fontStyle:'italic' }}>"{kw.example}"</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>

            <div className="riq-2col" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
              <GlassCard>
                <SectionHead icon="✅" title="Keywords Found" sub={`${results.extractedKeywords?.length || 0} power keywords detected in your resume.`} />
                <div style={{ display:'flex',flexWrap:'wrap' }}>
                  {(results.extractedKeywords || []).map((kw,i)=><Pill key={i} type="ok">✓ {kw}</Pill>)}
                  {(!results.extractedKeywords || results.extractedKeywords.length === 0) && (
                    <span style={{ fontSize:13, color:T.muted, fontFamily:"'Jost',sans-serif" }}>No keywords extracted yet.</span>
                  )}
                </div>
              </GlassCard>
              <GlassCard>
                <SectionHead icon="⚙️" title="Skills Detected" sub={`${results.skills?.length || 0} skills identified across hard, domain, and soft skill tiers.`} />
                <div style={{ display:'flex',flexWrap:'wrap' }}>
                  {(results.skills || []).map((s,i)=><Pill key={i} type="blue">{s}</Pill>)}
                  {(!results.skills || results.skills.length === 0) && (
                    <span style={{ fontSize:13, color:T.muted, fontFamily:"'Jost',sans-serif" }}>No skills extracted yet.</span>
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* ════════ ANALYSIS ════════ */}
        {tab === 'Analysis' && (
          <TabErrorBoundary tab="Analysis" onReanalyze={onReanalyze}>
            <div style={{ display:'flex',flexDirection:'column',gap:20 }}>

              <GlassCard>
                <SectionHead icon="✒️" title="Line-by-Line Resume Analysis" sub={`Every line across all resume sections rewritten for maximum ATS impact and recruiter appeal. ${results.lineByLineAnalysis?.length || 0} items analysed.`} />
                {(() => {
                  const allItemsRaw = results.lineByLineAnalysis || [];
                  // Defensive: drop items that are not objects or have no usable original text
                  const allItems = allItemsRaw.filter(it => it && typeof it === 'object' && typeof it.original === 'string' && it.original.trim().length > 0);
                  // Filter out education-grade, skills-list, coursework lines
                  const items = allItems.filter(item => !isSkippableSection(item.section, item.original));

                  if (items.length === 0) {
                    return (
                      <div style={{ padding:'24px 20px', textAlign:'center', fontFamily:"'Jost',sans-serif" }}>
                        <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
                        <div style={{ fontSize:14, color:T.text, marginBottom:6, fontWeight:600 }}>No line-by-line items available</div>
                        <div style={{ fontSize:12, color:T.muted, marginBottom:14 }}>The AI couldn't extract individual lines from this resume. Please re-analyse.</div>
                        <button onClick={()=>{ track('analysis-empty-reanalyse'); onReanalyze(); }} style={{ padding:'8px 18px', borderRadius:20, background:T.gold, color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer' }}>🔄 Re-analyse</button>
                      </div>
                    );
                  }

                  const groups = {};
                  items.forEach(item => {
                    const sec = item.section || 'General';
                    if (!groups[sec]) groups[sec] = [];
                    groups[sec].push(item);
                  });
                  const getSectionIcon = (sec) => {
                    const s = sec.toLowerCase();
                    if (s.includes('summary')) return '📝';
                    if (s.includes('skill')) return '⚙️';
                    if (s.includes('education')) return '🎓';
                    if (s.includes('project')) return '🚀';
                    if (s.includes('certif')) return '🏅';
                    if (s.includes('award') || s.includes('honour') || s.includes('honor')) return '🏆';
                    if (s.includes('extra') || s.includes('activity') || s.includes('volunteer')) return '🌟';
                    if (s.includes('work') || s.includes('experience') || s.includes('employment')) return '💼';
                    return '📄';
                  };
                  const skipped = allItems.length - items.length;
                  return (
                    <>
                      {skipped > 0 && (
                        <div style={{ fontSize:12, color:T.muted, fontFamily:"'Jost',sans-serif", marginBottom:14, padding:'8px 14px', background:'rgba(195,165,110,0.08)', border:'1px solid rgba(195,165,110,0.2)', borderRadius:10 }}>
                          ℹ️ {skipped} line{skipped !== 1 ? 's' : ''} skipped (education grades, skills lists, coursework — not meaningful to rewrite)
                        </div>
                      )}
                      {Object.entries(groups).map(([section, sectionItems]) => (
                        <SectionGroup
                          key={section}
                          section={section}
                          initialItems={sectionItems}
                          icon={getSectionIcon(section)}
                        />
                      ))}
                    </>
                  );
                })()}
              </GlassCard>
            </div>
          </TabErrorBoundary>
        )}


        {/* ════════ YOUR RESUME ════════ */}
        {tab === 'Your Resume' && (
          <TabErrorBoundary tab="Your Resume" onReanalyze={onReanalyze}>
            <AnnotatedPDFViewer resumeFile={resumeFile} results={results} />
          </TabErrorBoundary>
        )}

        {/* ════════ JD MATCH ════════ */}
        {tab === 'JD Match' && results.hasJD && results.jdMatch && (
          <TabErrorBoundary tab="JD Match" onReanalyze={onReanalyze}>
            {(() => {
          const jd = results.jdMatch;
          const pct = jd.percentage || 0;
          const pColor = scoreColor(pct);
          const pLabel = pct >= 80 ? 'Strong Match' : pct >= 65 ? 'Good Match' : pct >= 50 ? 'Moderate Match' : 'Low Match';
          const priorityMeta = {
            high:   { color: T.danger, bg: T.roseBg,  border:'rgba(184,92,82,0.30)',  icon:'🔴', label:'HIGH PRIORITY' },
            medium: { color: T.warn,   bg: T.goldBg,  border:'rgba(176,125,42,0.30)', icon:'🟡', label:'MEDIUM PRIORITY' },
            low:    { color: T.blue,   bg: T.blueBg,  border:'rgba(74,112,156,0.25)', icon:'🔵', label:'LOW PRIORITY' },
          };
          const suggestions = jd.roleFitSuggestions || [];
          const highItems   = suggestions.filter(s => s.priority === 'high');
          const medItems    = suggestions.filter(s => s.priority === 'medium');
          const lowItems    = suggestions.filter(s => s.priority === 'low');

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* ── Score Hero ── */}
              <GlassCard deep style={{ padding:'28px 32px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:28, flexWrap:'wrap' }}>
                  {/* Big score ring */}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <svg width={140} height={140} viewBox="0 0 140 140">
                      <circle cx={70} cy={70} r={54} fill="none" stroke="rgba(195,165,110,0.18)" strokeWidth={13} />
                      <circle cx={70} cy={70} r={54} fill="none" stroke={pColor} strokeWidth={13} strokeLinecap="round"
                        strokeDasharray={`${2*Math.PI*54*pct/100} ${2*Math.PI*54*(1-pct/100)}`}
                        transform="rotate(-90 70 70)"
                        style={{ filter:`drop-shadow(0 0 6px ${pColor}66)` }} />
                      <text x={70} y={65} textAnchor="middle" fill={pColor} fontSize={30} fontWeight={800} fontFamily="'Playfair Display',serif">{pct}%</text>
                      <text x={70} y={83} textAnchor="middle" fill={T.muted} fontSize={11} fontFamily="'Jost',sans-serif" letterSpacing="0.5">JD MATCH</text>
                    </svg>
                  </div>
                  {/* Verdict + progress */}
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:22, color:T.text, marginBottom:6 }}>{pLabel}</div>
                    <div style={{ height:10, background:'rgba(195,165,110,0.18)', borderRadius:5, overflow:'hidden', marginBottom:12, maxWidth:340 }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${pColor}88,${pColor})`, borderRadius:5, transition:'width 1s ease' }} />
                    </div>
                    {jd.recommendation && (
                      <div style={{ fontSize:13, color:T.text, lineHeight:1.6, padding:'10px 14px', background:T.goldBg, border:`1px solid rgba(176,125,42,0.22)`, borderRadius:10, maxWidth:420, fontFamily:"'Jost',sans-serif" }}>
                        💡 {jd.recommendation}
                      </div>
                    )}
                  </div>
                  {/* Quick stats */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10, flexShrink:0 }}>
                    {[
                      { label:'Skills Matched',   value:jd.matchingSkills?.length || 0,       color:T.ok     },
                      { label:'Skills Missing',   value:jd.missingSkills?.length || 0,         color:T.danger },
                      { label:'Keywords to Add',  value:jd.allMissingJdKeywords?.length || 0,  color:T.warn   },
                      { label:'Action Steps',     value:suggestions.length,                    color:T.blue   },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'6px 12px', background:'rgba(255,255,255,0.5)', border:`1px solid rgba(195,165,110,0.2)`, borderRadius:9 }}>
                        <span style={{ fontSize:12, color:T.muted, fontFamily:"'Jost',sans-serif" }}>{label}</span>
                        <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:17, color }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>

              {/* ── Role Fit Action Plan ── directly below the score ── */}
              <GlassCard deep>
                <SectionHead icon="🎯" title="Your Role Fit Action Plan"
                  sub={`${suggestions.length} prioritised steps to maximise your match for this specific role.`} />

                {[
                  { items: highItems,  ...priorityMeta.high   },
                  { items: medItems,   ...priorityMeta.medium },
                  { items: lowItems,   ...priorityMeta.low    },
                ].filter(g => g.items.length > 0).map(({ items, color, bg, border, icon, label }) => (
                  <div key={label} style={{ marginBottom:22 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:8, borderBottom:`1px solid rgba(195,165,110,0.18)` }}>
                      <span style={{ fontSize:13 }}>{icon}</span>
                      <span style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'1px', fontFamily:"'Jost',sans-serif" }}>{label}</span>
                      <span style={{ fontSize:11, color:T.muted, fontFamily:"'Jost',sans-serif", marginLeft:4 }}>{items.length} step{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      {items.filter(s => s.action).map((s, i) => (
                        <div key={i} style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:14, overflow:'hidden' }}>
                          <div style={{ padding:'13px 16px 10px', display:'flex', gap:11, alignItems:'flex-start' }}>
                            <div style={{ flexShrink:0, width:22, height:22, borderRadius:'50%', background:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, marginTop:1 }}>{i+1}</div>
                            <div style={{ fontFamily:"'Jost',sans-serif", fontWeight:600, fontSize:13, color:T.text, lineHeight:1.5 }}>{s.action}</div>
                          </div>
                          <div style={{ borderTop:`1px solid ${border}`, display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
                            {s.why && (
                              <div style={{ padding:'9px 14px', borderRight:`1px solid ${border}` }}>
                                <div style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4, fontFamily:"'Jost',sans-serif" }}>Why it matters</div>
                                <div style={{ fontSize:12, color:T.text, lineHeight:1.5, fontFamily:"'Jost',sans-serif" }}>{s.why}</div>
                              </div>
                            )}
                            {s.where && (
                              <div style={{ padding:'9px 14px' }}>
                                <div style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4, fontFamily:"'Jost',sans-serif" }}>Where to add it</div>
                                <div style={{ fontSize:12, color:T.text, lineHeight:1.5, fontFamily:"'Jost',sans-serif" }}>{s.where}</div>
                              </div>
                            )}
                          </div>
                          {s.example && (
                            <div style={{ padding:'9px 16px', borderTop:`1px solid ${border}`, background:'rgba(255,255,255,0.45)' }}>
                              <div style={{ fontSize:10, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4, fontFamily:"'Jost',sans-serif" }}>Example</div>
                              <div style={{ fontSize:12, color:T.muted, lineHeight:1.55, fontStyle:'italic', fontFamily:"'Jost',sans-serif" }}>"{s.example}"</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </GlassCard>

              {/* ── Matching vs Missing Skills ── */}
              <div className="riq-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <GlassCard>
                  <SectionHead icon="✅" title="Skills You Already Have" sub="These required skills from the JD are present in your resume." />
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {jd.matchingSkills?.length
                      ? jd.matchingSkills.map((s,i) => <Pill key={i} type="ok">✓ {s}</Pill>)
                      : <span style={{ fontSize:13, color:T.muted, fontFamily:"'Jost',sans-serif" }}>None detected</span>}
                  </div>
                </GlassCard>
                <GlassCard>
                  <SectionHead icon="⚠️" title="Critical Skills Gap" sub="Skills explicitly required by the JD that are missing from your resume." />
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {jd.missingSkills?.length
                      ? jd.missingSkills.map((s,i) => <Pill key={i} type="danger">✗ {s}</Pill>)
                      : <span style={{ fontSize:13, color:T.muted, fontFamily:"'Jost',sans-serif" }}>None — great skills coverage!</span>}
                  </div>
                </GlassCard>
              </div>

              {/* ── Experience Gaps ── */}
              {jd.experienceGaps?.length > 0 && (
                <GlassCard>
                  <SectionHead icon="📉" title="Experience Gaps" sub="Specific experience the JD requires that isn't evident in your resume." />
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {jd.experienceGaps.map((gap, i) => (
                      <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'11px 14px', background:'rgba(255,255,255,0.48)', border:`1px solid rgba(195,165,110,0.22)`, borderRadius:11 }}>
                        <span style={{ color:T.warn, flexShrink:0, fontSize:14, marginTop:1 }}>△</span>
                        <span style={{ fontSize:13, color:T.text, lineHeight:1.55, fontFamily:"'Jost',sans-serif" }}>{gap}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* ── All Missing JD Keywords ── */}
              {jd.allMissingJdKeywords?.length > 0 && (
                <GlassCard>
                  <SectionHead icon="🔑" title="All Missing JD Keywords"
                    sub={`${jd.allMissingJdKeywords.length} keywords/phrases from the JD not found in your resume. Add the most relevant ones naturally into your bullet points and skills section.`} />
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                    {jd.allMissingJdKeywords.map((kw, i) => (
                      <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 13px', borderRadius:20, fontSize:12, fontWeight:600, background:'rgba(184,92,82,0.09)', border:'1.5px solid rgba(184,92,82,0.32)', color:T.danger, fontFamily:"'Jost',sans-serif" }}>
                        <span style={{ fontSize:9, opacity:0.7 }}>✗</span> {kw}
                      </span>
                    ))}
                  </div>
                  <div style={{ padding:'10px 14px', background:'rgba(176,125,42,0.07)', border:'1px solid rgba(176,125,42,0.2)', borderRadius:10, fontSize:12, color:T.muted, fontFamily:"'Jost',sans-serif" }}>
                    💡 <strong>Pro tip:</strong> Focus on the top 8–12 keywords most relevant to your actual experience. Never fabricate — only include keywords that genuinely reflect your background.
                  </div>
                </GlassCard>
              )}

            </div>
          );
        })()}
          </TabErrorBoundary>
        )}

        {/* ════════ AI COACH ════════ */}
        {tab === 'AI Coach' && (
          <TabErrorBoundary tab="AI Coach" onReanalyze={onReanalyze}>
          <div className="glass-card-deep riq-chat-height" style={{ padding:0,overflow:'hidden',height:590,display:'flex',flexDirection:'column' }}>
            {/* Header */}
            <div style={{ padding:'16px 20px',borderBottom:`1px solid rgba(195,165,110,0.22)`,display:'flex',gap:13,alignItems:'center',background:'rgba(255,255,255,0.55)' }}>
              <div style={{ width:40,height:40,background:'linear-gradient(135deg,#B07D2A,#D4A850)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:'0 4px 14px rgba(176,125,42,0.3)' }}>🤖</div>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:15,color:T.text }}>CVsetuAI Coach</div>
                <div style={{ fontSize:12,color:T.ok }}>● Online</div>
              </div>
            </div>

            {/* Suggested prompts */}
            <div style={{ padding:'10px 18px',borderBottom:`1px solid rgba(195,165,110,0.18)`,display:'flex',gap:7,flexWrap:'wrap',background:'rgba(255,255,255,0.35)' }}>
              {['How do I improve my ATS score?','Which role fits me best?','Rewrite my top 3 bullet points','What keywords should I add first?'].map(q=>(
                <button key={q} onClick={()=>setChatInput(q)} style={{ padding:'5px 12px',background:'rgba(255,255,255,0.6)',backdropFilter:'blur(8px)',border:`1px solid rgba(176,125,42,0.25)`,borderRadius:20,color:T.gold,fontSize:12,cursor:'pointer',fontFamily:"'Jost',sans-serif",transition:'all .15s' }}>{q}</button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex:1,overflowY:'auto',padding:'16px 18px',display:'flex',flexDirection:'column',gap:13,background:'rgba(253,248,240,0.3)' }}>
              {history.map((m,i)=>(
                <div key={i} style={{ display:'flex',gap:9,alignItems:'flex-start',justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
                  {m.role==='assistant' && (
                    <div style={{ width:32,height:32,background:'linear-gradient(135deg,#B07D2A,#D4A850)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0 }}>🤖</div>
                  )}
                  <div style={{
                    maxWidth:'78%', padding:'12px 15px',
                    borderRadius: m.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role==='user' ? 'linear-gradient(135deg,#B07D2A,#D4A850)' : 'rgba(255,255,255,0.72)',
                    backdropFilter: 'blur(12px)',
                    border: m.role==='assistant' ? `1px solid rgba(195,165,110,0.3)` : 'none',
                    boxShadow: '0 2px 12px rgba(140,105,50,0.08)',
                  }}>
                    <ChatMessage content={m.content} role={m.role} />
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display:'flex',gap:9,alignItems:'flex-start' }}>
                  <div style={{ width:32,height:32,background:'linear-gradient(135deg,#B07D2A,#D4A850)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15 }}>🤖</div>
                  <div style={{ padding:'14px 18px',background:'rgba(255,255,255,0.72)',backdropFilter:'blur(12px)',border:`1px solid rgba(195,165,110,0.3)`,borderRadius:'14px 14px 14px 4px',display:'flex',gap:5,alignItems:'center' }}>
                    {[0,.2,.4].map((d,i)=>(
                      <div key={i} style={{ width:7,height:7,borderRadius:'50%',background:`rgba(176,125,42,0.5)`,animation:`blink 1.2s ${d}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {/* Input */}
            <div style={{ padding:'13px 18px',borderTop:`1px solid rgba(195,165,110,0.2)`,display:'flex',gap:9,background:'rgba(255,255,255,0.55)',backdropFilter:'blur(12px)' }}>
              <input
                value={chatInput}
                onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&handleChat()}
                placeholder="Ask about your resume, career, or how to improve..."
                style={{ flex:1,background:'rgba(255,255,255,0.65)',backdropFilter:'blur(8px)',border:`1px solid rgba(195,165,110,0.3)`,borderRadius:11,padding:'10px 14px',color:T.text,fontSize:13,outline:'none',fontFamily:"'Jost',sans-serif" }}
              />
              <button onClick={handleChat} disabled={!chatInput.trim()||chatLoading}
                className={chatInput.trim() ? 'btn-primary' : ''}
                style={{
                  padding:'10px 18px',
                  background: chatInput.trim() ? undefined : 'rgba(195,165,110,0.15)',
                  border: chatInput.trim() ? undefined : `1px solid rgba(195,165,110,0.2)`,
                  borderRadius:11, color: chatInput.trim() ? 'white' : T.dim,
                  cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                  fontSize:13, fontWeight:600, fontFamily:"'Jost',sans-serif",
              }}>Send →</button>
            </div>
          </div>
          </TabErrorBoundary>
        )}

        {/* ════════ PDF REPORT ════════ */}
        {tab === 'PDF Report' && (
          <TabErrorBoundary tab="PDF Report" onReanalyze={onReanalyze}>
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <GlassCard deep>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
                <div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:800, fontSize:22, color:T.text, marginBottom:6 }}>
                    📊 Full Analysis PDF Report
                  </div>
                  <div style={{ fontSize:13, color:T.muted, lineHeight:1.6, fontFamily:"'Jost',sans-serif" }}>
                    Download a complete, richly-formatted PDF with all scores, charts, analysis, line-by-line rewrites and recommendations — ready to share or review offline.
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={async () => {
                    // Build and download a comprehensive colored HTML-based PDF report
                    const now2 = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
                    const esc2 = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                    const sc = results.scores || {};
                    const roleScoreRows = (results.roleScores||[]).slice(0,10).map((r,i)=>{
                      const pct = r.score;
                      const hue = Math.round(120 - (i/(Math.max((results.roleScores||[]).length-1,1)))*120);
                      const col = `hsl(${hue},60%,38%)`;
                      const bg  = `hsl(${hue},60%,95%)`;
                      return `<tr style="background:${i%2===0?'#fdf8f0':'#fff'}">
                        <td style="padding:7px 12px;font-size:11px;font-weight:600">${i===0?'🥇':i===1?'🥈':i===2?'🥉':''} ${esc2(r.role)}</td>
                        <td style="padding:7px 12px;">
                          <div style="display:flex;align-items:center;gap:10px">
                            <div style="flex:1;background:#e8e0d0;border-radius:6px;height:10px;overflow:hidden">
                              <div style="width:${pct}%;height:100%;background:${col};border-radius:6px"></div>
                            </div>
                            <span style="font-weight:800;color:${col};min-width:36px;font-size:13px">${pct}</span>
                          </div>
                        </td>
                      </tr>`;
                    }).join('');
                    const dimRows = [
                      ['Keyword Match','28%',sc.keywordMatch??0],
                      ['Achievements','20%',sc.achievements??0],
                      ['Experience Relevance','18%',sc.experienceRelevance??0],
                      ['Resume Structure','12%',sc.resumeStructure??0],
                      ['Skills Match','12%',sc.skillsMatch??0],
                      ['ATS Formatting','6%',sc.atsFormatting??0],
                      ['Leadership Signals','4%',sc.leadershipSignals??0],
                    ].map(([label,wt,score])=>{
                      const col = score>=80?'#4C8A72':score>=60?'#B07D2A':'#B85C52';
                      return `<tr>
                        <td style="padding:8px 14px;font-size:12px;font-weight:600;border-bottom:1px solid #f0e8d8">${label}</td>
                        <td style="padding:8px 14px;font-size:11px;color:#9a8a70;border-bottom:1px solid #f0e8d8">${wt}</td>
                        <td style="padding:8px 14px;border-bottom:1px solid #f0e8d8">
                          <div style="display:flex;align-items:center;gap:10px">
                            <div style="flex:1;background:#e8e0d0;border-radius:6px;height:10px;overflow:hidden">
                              <div style="width:${score}%;height:100%;background:${col};border-radius:6px"></div>
                            </div>
                            <span style="font-weight:800;color:${col};min-width:36px;font-size:14px">${score}</span>
                          </div>
                        </td>
                      </tr>`;
                    }).join('');
                    const recRows2 = (results.topRecommendations||[]).map((rec,i)=>{
                      const ic = rec.impact==='high'?'#B85C52':rec.impact==='medium'?'#B07D2A':'#4C8A72';
                      const ib = rec.impact==='high'?'rgba(184,92,82,0.08)':rec.impact==='medium'?'rgba(176,125,42,0.08)':'rgba(76,138,114,0.08)';
                      return `<div style="margin-bottom:14px;padding:14px 16px;background:${ib};border-left:4px solid ${ic};border-radius:0 10px 10px 0">
                        <div style="font-weight:700;font-size:13px;margin-bottom:5px">${i+1}. ${esc2(rec.title||rec.what||'')}</div>
                        <div style="font-size:11.5px;color:#5a4a30;margin-bottom:6px">${esc2(rec.what||rec.why||'')}</div>
                        ${rec.example?`<div style="font-size:11px;font-style:italic;color:#4C8A72;background:rgba(76,138,114,0.07);padding:6px 10px;border-radius:6px">✏ ${esc2(rec.example)}</div>`:''}
                      </div>`;
                    }).join('');
                    const lbaRows = (results.lineByLineAnalysis||[]).slice(0,40).map((item,i)=>`
                      <tr style="background:${i%2===0?'#fdf8f0':'#fff'}">
                        <td style="padding:6px 10px;font-size:10px;color:#9a8a70;border-bottom:1px solid #f0e8d8;white-space:nowrap">${esc2(item.section||'')}</td>
                        <td style="padding:6px 10px;font-size:10.5px;color:#B85C52;border-bottom:1px solid #f0e8d8">${esc2(item.original||'')}</td>
                        <td style="padding:6px 10px;font-size:10.5px;color:#2A6B3C;font-style:italic;border-bottom:1px solid #f0e8d8">${esc2(item.improved||'')}</td>
                        <td style="padding:6px 10px;font-size:10px;color:#7a6a50;border-bottom:1px solid #f0e8d8">${esc2(item.reason||'')}</td>
                      </tr>`).join('');
                    const kwHtml = (results.extractedKeywords||[]).map(k=>`<span style="display:inline-block;margin:3px;padding:4px 10px;background:rgba(76,138,114,0.12);border:1px solid rgba(76,138,114,0.3);border-radius:20px;font-size:11px;color:#4C8A72">✓ ${esc2(k)}</span>`).join('');
                    const mkHtml = (results.missingKeywords||[]).map(k=>`<span style="display:inline-block;margin:3px;padding:4px 10px;background:rgba(184,92,82,0.08);border:1px solid rgba(184,92,82,0.3);border-radius:20px;font-size:11px;color:#B85C52">✗ ${esc2(k.keyword||k)}</span>`).join('');
                    const atsCol = results.atsScore>=80?'#4C8A72':results.atsScore>=60?'#B07D2A':'#B85C52';
                    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>CVsetuAI Full Analysis Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Jost:wght@400;500;600;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Jost',Arial,sans-serif; background:#FDF8F0; color:#2A1D08; line-height:1.6; }
  .page { max-width:900px; margin:0 auto; padding:40px 40px; }
  .header { background:linear-gradient(135deg,#2A1D08,#4a3520); color:#fff; padding:40px; border-radius:16px; margin-bottom:32px; }
  .header h1 { font-family:'Playfair Display',serif; font-size:32px; font-weight:800; margin-bottom:8px; }
  .header p { font-size:14px; opacity:0.75; }
  .score-hero { display:flex; align-items:center; gap:24px; margin-top:20px; }
  .score-circle { width:90px;height:90px;border-radius:50%;background:${atsCol};display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 24px ${atsCol}66; }
  .score-num { font-size:30px;font-weight:800;color:#fff;font-family:'Playfair Display',serif;line-height:1; }
  .score-lbl { font-size:10px;color:rgba(255,255,255,0.8);margin-top:2px; }
  .section { background:#fff; border-radius:14px; padding:28px 32px; margin-bottom:24px; box-shadow:0 4px 20px rgba(140,105,50,0.08); border:1px solid rgba(195,165,110,0.2); }
  .section-title { font-family:'Playfair Display',serif; font-size:20px; font-weight:700; color:#2A1D08; margin-bottom:18px; padding-bottom:10px; border-bottom:2px solid rgba(176,125,42,0.25); display:flex; align-items:center; gap:9px; }
  table { width:100%; border-collapse:collapse; }
  th { background:linear-gradient(135deg,#B07D2A,#D4A850); color:#fff; padding:10px 14px; font-size:11.5px; font-weight:600; text-align:left; }
  .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
  @media print { body{background:#fff} .page{padding:20px} .section{box-shadow:none;border:1px solid #ddd} }
</style></head><body><div class="page">
  <div class="header">
    <h1>⚡ CVsetuAI — Full Analysis Report</h1>
    <p>Generated ${now2} · Powered by Claude AI · Complete Intelligence Report</p>
    <div class="score-hero">
      <div class="score-circle"><div class="score-num">${results.atsScore}</div><div class="score-lbl">ATS SCORE</div></div>
      <div>
        <div style="font-size:22px;font-weight:700;color:#fff;font-family:'Playfair Display',serif">${results.atsScore>=80?'Excellent':results.atsScore>=70?'Good':results.atsScore>=60?'Fair':'Needs Work'} Profile</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px">${results.candidate?.name||''} ${results.candidate?.currentRole?'· '+results.candidate.currentRole:''}</div>
        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
          ${[['ATS Score',results.atsScore,'#D4A850'],['Recruiter Score',results.recruiterScore,'#5EA882']].map(([l,v,c])=>`<span style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:4px 14px;font-size:12px;color:#fff">${l}: <strong>${v}/100</strong></span>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📊 ATS Dimension Breakdown</div>
    <table><tr><th>Dimension</th><th>Weight</th><th style="min-width:240px">Score</th></tr>${dimRows}</table>
  </div>

  <div class="section">
    <div class="section-title">🎯 Multi-Role ATS Fit</div>
    <p style="font-size:12px;color:#9a8a70;margin-bottom:14px">Scores calibrated using the same 7-dimension formula as the overall ATS score — direct comparison is valid.</p>
    <table><tr><th style="width:55%">Role</th><th style="width:45%">Fit Score</th></tr>${roleScoreRows}</table>
  </div>

  <div class="section">
    <div class="section-title">⚡ Top Recommendations</div>
    ${recRows2||'<p style="color:#9a8a70;font-size:13px">No recommendations available.</p>'}
  </div>

  <div class="section">
    <div class="section-title">✒️ Line-by-Line Analysis (Top 40)</div>
    <p style="font-size:12px;color:#9a8a70;margin-bottom:14px">Every line rewritten using STAR framework with maximum ATS impact.</p>
    <table>
      <tr><th style="width:18%">Section</th><th style="width:28%">Original</th><th style="width:28%">Improved</th><th style="width:26%">Why Better</th></tr>
      ${lbaRows}
    </table>
  </div>

  <div class="section">
    <div class="section-title">🔑 Keywords Found</div>
    <div style="margin-bottom:8px">${kwHtml||'<span style="color:#9a8a70;font-size:13px">No keywords extracted.</span>'}</div>
  </div>

  ${mkHtml ? `<div class="section">
    <div class="section-title">❌ Missing Power Keywords</div>
    <div>${mkHtml}</div>
  </div>` : ''}

  <div style="text-align:center;padding:24px;font-size:11px;color:#b5a48c">
    Generated by CVsetuAI · Powered by Claude AI · ${now2}
  </div>
</div></body></html>`;
                    const blob = new Blob([html], { type:'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const win = window.open(url, '_blank');
                    if (win) {
                      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 800);
                    } else {
                      const a = document.createElement('a');
                      a.href = url; a.download = 'CVsetuAI_Full_Report.html';
                      document.body.appendChild(a); a.click();
                      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
                    }
                  }}
                  style={{ padding:'13px 28px', fontSize:14, whiteSpace:'nowrap', flexShrink:0 }}
                >
                  📥 Download PDF Report
                </button>
              </div>
            </GlassCard>

            {/* Preview summary cards */}
            <div className="riq-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <GlassCard>
                <SectionHead icon="📊" title="Report Includes" />
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    ['📈','Overall ATS Score with colour gauge'],
                    ['⚡','7 Dimension score bars with weights'],
                    ['🎯','Multi-Role Fit chart (top 10)'],
                    ['📋','All Top Recommendations'],
                    ['✒️','Line-by-line analysis (top 40 rewrites)'],
                    ['🔑','Keywords found & missing'],
                    ['📌','Strengths & weaknesses summary'],
                  ].map(([icon, label]) => (
                    <div key={label} style={{ display:'flex', gap:10, alignItems:'center', fontSize:13, color:T.text, fontFamily:"'Jost',sans-serif" }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
              <GlassCard>
                <SectionHead icon="💡" title="How to Use" />
                <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13, color:T.muted, fontFamily:"'Jost',sans-serif", lineHeight:1.6 }}>
                  <p>1. Click <strong style={{ color:T.gold }}>Download PDF Report</strong> — it opens in a new tab.</p>
                  <p>2. Use your browser's <strong>Print → Save as PDF</strong> to save it with full colours and formatting.</p>
                  <p>3. Share with career coaches, mentors, or keep as a baseline before your next re-analysis.</p>
                  <p>4. After improving your resume, re-analyse to generate an updated report and compare your progress.</p>
                </div>
              </GlassCard>
            </div>
          </div>
          </TabErrorBoundary>
        )}

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════════
   RESUME BUILDER SYSTEM — Complete Professional Resume Creation
   Streams → Templates → Info Input → AI Generation → Preview + Download
═══════════════════════════════════════════════════════════════════════════ */

/* ── Stream Definitions ── */
const RESUME_STREAMS = [
  { id:'engineering', label:'Engineering / IT',    icon:'⚙️', color:'#1a73e8', bg:'rgba(26,115,232,0.10)', desc:'B.Tech, BE, MCA, CS, ECE, Mechanical, Civil & all engineering disciplines' },
  { id:'medical',     label:'Medical (MBBS/BDS)',  icon:'🩺', color:'#00897b', bg:'rgba(0,137,123,0.10)',  desc:'MBBS, BDS, BAMS, Nursing, Clinical Research & Medical PG applicants' },
  { id:'mba',         label:'MBA / Management',   icon:'📊', color:'#c0392b', bg:'rgba(192,57,43,0.10)',   desc:'MBA, PGDM, BBA, Consulting, Strategy, Marketing, Finance, Operations' },
  { id:'law',         label:'Law (LLB / LLM)',    icon:'⚖️', color:'#7d6608', bg:'rgba(125,102,8,0.10)',   desc:'LLB, LLM, Bar Enrollment, Litigation, Corporate Law, Judicial Services' },
  { id:'ca_finance',  label:'CA / Finance',       icon:'💰', color:'#1e8449', bg:'rgba(30,132,73,0.10)',   desc:'Chartered Accountant, CMA, ACCA, Banking, Investment Banking, Audit & Tax' },
  { id:'arts',        label:'Arts & Humanities',  icon:'🎭', color:'#7b1fa2', bg:'rgba(123,31,162,0.10)', desc:'BA, MA, Journalism, Media, NGO, Social Work, Psychology, Cultural Sectors' },
  { id:'commerce',    label:'Commerce / BBA',     icon:'🏪', color:'#d35400', bg:'rgba(211,84,0,0.10)',   desc:'BCom, MCom, BBA, Sales, Marketing, HR, Retail & Operations Management' },
  { id:'government',  label:'Government / UPSC',  icon:'🏛️', color:'#2c3e50', bg:'rgba(44,62,80,0.10)',  desc:'IAS/IPS, PSU, Bank Exams, Defense, SSC, Teaching, Railway & Police' },
];

/* ── 5 Templates per Stream — India-specific, industry-accurate ── */
const RESUME_TEMPLATES = {

  // ── ENGINEERING / IT ──────────────────────────────────────────────────────
  // Indian IT: Naukri/LinkedIn dominates; ATS-first; projects & skills lead
  engineering: [
    {
      id:'eng_naukri', name:'Naukri Standard',
      desc:'Classic single-column accepted by TCS, Infosys, Wipro, Accenture — ATS-optimised for Naukri.com uploads',
      layout:'classic', accent:'#1565c0', accentLight:'#e3f2fd', accentDark:'#0d47a1',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'experience',label:'Work Experience',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'skills',label:'Technical Skills',visible:true},
        {key:'projects',label:'Projects',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'achievements',label:'Achievements',visible:true},
        {key:'extraCurricular',label:'Extra-Curricular Activities',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'eng_iit', name:'IIT / NIT Format',
      desc:'Projects-first, GPA & rank prominent — preferred by IIT, NIT, BITS graduates applying to core & product roles',
      layout:'academic', accent:'#b71c1c', accentLight:'#ffebee', accentDark:'#7f0000',
      selectedSections: [
        {key:'summary',label:'Profile Summary',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'projects',label:'Projects & Research',visible:true},
        {key:'experience',label:'Internships & Work Experience',visible:true},
        {key:'skills',label:'Technical Skills',visible:true},
        {key:'achievements',label:'Positions of Responsibility & Awards',visible:true},
        {key:'certifications',label:'Certifications & Courses',visible:true},
        {key:'extraCurricular',label:'Extra-Curricular',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'eng_product', name:'Product / Startup',
      desc:'Two-column sidebar — skills & tools on left, experience on right. Ideal for FAANG, unicorn startups & PM roles',
      layout:'two-column', accent:'#00796b', accentLight:'#e0f2f1', accentDark:'#004d40',
      selectedSections: [
        {key:'summary',label:'Profile Summary',visible:true,column:'main'},
        {key:'experience',label:'Work Experience',visible:true,column:'main'},
        {key:'projects',label:'Projects',visible:true,column:'main'},
        {key:'education',label:'Education',visible:true,column:'main'},
        {key:'extraCurricular',label:'Activities',visible:true,column:'main'},
        {key:'skills',label:'Technical Skills',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'Tools & Platforms',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages',visible:true,column:'sidebar'},
        {key:'certifications',label:'Certifications',visible:true,column:'sidebar'},
        {key:'achievements',label:'Achievements',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Info',visible:true,column:'sidebar'},
      ],
    },
    {
      id:'eng_minimal', name:'Global Tech / FAANG',
      desc:'Ultra-clean minimal format — ATS-safe, no borders, works for Google, Microsoft, Amazon India applications',
      layout:'minimal', accent:'#37474f', accentLight:'#eceff1', accentDark:'#263238',
      selectedSections: [
        {key:'experience',label:'Experience',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'skills',label:'Skills',visible:true},
        {key:'projects',label:'Projects',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'achievements',label:'Achievements',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'eng_senior', name:'Senior Engineer / Lead',
      desc:'Bold header, leadership-forward — for 5+ year professionals, Tech Leads, Architects & Engineering Managers',
      layout:'bold', accent:'#4527a0', accentLight:'#ede7f6', accentDark:'#1a0072',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'experience',label:'Work Experience',visible:true},
        {key:'skills',label:'Core Competencies',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'projects',label:'Key Projects',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'achievements',label:'Awards & Recognition',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
  ],

  // ── MEDICAL ──────────────────────────────────────────────────────────────
  // Indian medical: MCI/NMC format; rotations & clinical skills are primary
  medical: [
    {
      id:'med_clinical', name:'MCI / Hospital Standard',
      desc:'NMC-aligned single-column — accepted by AIIMS, Apollo, Fortis & all major Indian hospitals for MBBS applications',
      layout:'classic', accent:'#00695c', accentLight:'#e0f2f1', accentDark:'#003d33',
      selectedSections: [
        {key:'summary',label:'Professional Profile',visible:true},
        {key:'education',label:'Medical Qualifications',visible:true},
        {key:'experience',label:'Clinical Rotations & Internships',visible:true},
        {key:'skills',label:'Clinical Skills & Competencies',visible:true},
        {key:'achievements',label:'Awards & Academic Distinctions',visible:true},
        {key:'certifications',label:'Certifications & CME',visible:true},
        {key:'extraCurricular',label:'Medical Society & Volunteer',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'med_pg', name:'PG Entrance / NEET-PG',
      desc:'NEET rank, subject scores & clinical rotations prominent — optimised for MD/MS, DNB & PG entrance applications',
      layout:'academic', accent:'#1565c0', accentLight:'#e3f2fd', accentDark:'#0d47a1',
      selectedSections: [
        {key:'education',label:'Academic Background & Scores',visible:true},
        {key:'summary',label:'Career Objective',visible:true},
        {key:'experience',label:'Clinical Rotations',visible:true},
        {key:'skills',label:'Clinical Skills',visible:true},
        {key:'achievements',label:'Ranks, Awards & Publications',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'extraCurricular',label:'Medical Conferences & Workshops',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'med_hospital', name:'Senior Resident / Specialist',
      desc:'Bold format for experienced doctors — Consultant, Senior Resident & Specialist hospital applications',
      layout:'bold', accent:'#b71c1c', accentLight:'#ffebee', accentDark:'#7f0000',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'experience',label:'Clinical Experience',visible:true},
        {key:'education',label:'Medical Education & Training',visible:true},
        {key:'skills',label:'Specialisation & Procedures',visible:true},
        {key:'achievements',label:'Research & Publications',visible:true},
        {key:'certifications',label:'Fellowships & Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'med_research', name:'Research & Academic Medicine',
      desc:'Publications, research grants & teaching — for MD/PhD, ICMR fellows & academic hospital faculty',
      layout:'minimal', accent:'#2e7d32', accentLight:'#e8f5e9', accentDark:'#1b5e20',
      selectedSections: [
        {key:'summary',label:'Research Profile',visible:true},
        {key:'experience',label:'Research & Clinical Experience',visible:true},
        {key:'education',label:'Education & Training',visible:true},
        {key:'achievements',label:'Publications & Presentations',visible:true},
        {key:'certifications',label:'Grants & Fellowships',visible:true},
        {key:'skills',label:'Research & Clinical Skills',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'med_intl', name:'International / USMLE Track',
      desc:'ECFMG-compatible two-column — for USMLE Steps, UK PLAB & international residency program applications',
      layout:'two-column', accent:'#283593', accentLight:'#e8eaf6', accentDark:'#1a237e',
      selectedSections: [
        {key:'summary',label:'Professional Statement',visible:true,column:'main'},
        {key:'experience',label:'Clinical Experience',visible:true,column:'main'},
        {key:'education',label:'Medical Training',visible:true,column:'main'},
        {key:'achievements',label:'Research & Publications',visible:true,column:'main'},
        {key:'extraCurricular',label:'Volunteer & Global Health',visible:true,column:'main'},
        {key:'skills',label:'Clinical Skills',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'Medical Tools & Software',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages',visible:true,column:'sidebar'},
        {key:'certifications',label:'Exam Scores & Certs',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Details',visible:true,column:'sidebar'},
      ],
    },
  ],

  // ── MBA / MANAGEMENT ─────────────────────────────────────────────────────
  // Indian MBA: IIM/ISB format; metrics-heavy; one page strictly
  mba: [
    {
      id:'mba_iim', name:'IIM / ISB One-Pager',
      desc:'Standard one-page format used by IIM-A/B/C, ISB & top B-school graduates — achievement & metric centric',
      layout:'classic', accent:'#880e4f', accentLight:'#fce4ec', accentDark:'#560027',
      selectedSections: [
        {key:'education',label:'Education',visible:true},
        {key:'experience',label:'Work Experience',visible:true},
        {key:'projects',label:'Projects & Consulting',visible:true},
        {key:'skills',label:'Skills & Certifications',visible:true},
        {key:'achievements',label:'Achievements & Leadership',visible:true},
        {key:'extraCurricular',label:'Extra-Curricular & Positions',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'mba_consult', name:'Consulting Elite',
      desc:'McKinsey / BCG / Bain / Big 4 style — structured STAR bullets, clean two-column, metric-heavy',
      layout:'two-column', accent:'#1565c0', accentLight:'#e3f2fd', accentDark:'#0d47a1',
      selectedSections: [
        {key:'summary',label:'Profile Summary',visible:true,column:'main'},
        {key:'experience',label:'Work Experience',visible:true,column:'main'},
        {key:'education',label:'Education',visible:true,column:'main'},
        {key:'projects',label:'Consulting Projects',visible:true,column:'main'},
        {key:'extraCurricular',label:'Leadership & Activities',visible:true,column:'main'},
        {key:'skills',label:'Core Skills',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'Tools & Platforms',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages',visible:true,column:'sidebar'},
        {key:'certifications',label:'Certifications',visible:true,column:'sidebar'},
        {key:'achievements',label:'Awards & Honours',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Details',visible:true,column:'sidebar'},
      ],
    },
    {
      id:'mba_finance', name:'Finance / Investment Banking',
      desc:'Deal experience, financial modelling & valuation forward — for IB, PE, VC & corporate finance roles',
      layout:'bold', accent:'#1b5e20', accentLight:'#e8f5e9', accentDark:'#003300',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'experience',label:'Work Experience & Deal Experience',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'skills',label:'Financial Skills & Tools',visible:true},
        {key:'projects',label:'Key Projects & Models',visible:true},
        {key:'certifications',label:'Certifications (CFA, FRM)',visible:true},
        {key:'achievements',label:'Awards & Competitions',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'mba_marketing', name:'Marketing / Brand Management',
      desc:'Campaign metrics, brand P&L & digital KPIs — for FMCG, e-commerce, D2C brand & growth marketing roles',
      layout:'minimal', accent:'#e65100', accentLight:'#fff3e0', accentDark:'#bf360c',
      selectedSections: [
        {key:'summary',label:'Profile',visible:true},
        {key:'experience',label:'Experience',visible:true},
        {key:'skills',label:'Marketing Skills & Tools',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'projects',label:'Campaigns & Projects',visible:true},
        {key:'achievements',label:'Awards & Case Competition',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'mba_genman', name:'General Management / Strategy',
      desc:'P&L ownership, cross-functional leadership & strategy — for GM, COO, VP Operations & strategy roles',
      layout:'academic', accent:'#4a148c', accentLight:'#f3e5f5', accentDark:'#12005e',
      selectedSections: [
        {key:'summary',label:'Executive Profile',visible:true},
        {key:'experience',label:'Professional Experience',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'skills',label:'Leadership & Management Skills',visible:true},
        {key:'achievements',label:'Impact & Recognition',visible:true},
        {key:'projects',label:'Strategic Initiatives',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
  ],

  // ── LAW ───────────────────────────────────────────────────────────────────
  // Indian law: Bar Council norms; court experience & publications matter
  law: [
    {
      id:'law_bar', name:'Bar Council Standard',
      desc:'Traditional single-column aligned with Bar Council of India enrolment norms — for fresh LLB & LLM graduates',
      layout:'classic', accent:'#37474f', accentLight:'#eceff1', accentDark:'#263238',
      selectedSections: [
        {key:'summary',label:'Career Objective',visible:true},
        {key:'education',label:'Legal Education',visible:true},
        {key:'experience',label:'Internships & Court Experience',visible:true},
        {key:'skills',label:'Legal Skills & Areas of Practice',visible:true},
        {key:'achievements',label:'Moot Courts & Competitions',visible:true},
        {key:'certifications',label:'Bar Enrollment & Certifications',visible:true},
        {key:'extraCurricular',label:'Law Review & Activities',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'law_litig', name:'Litigation Track',
      desc:'Court appearances, case wins & district court experience — for civil, criminal & high court litigation lawyers',
      layout:'academic', accent:'#4e342e', accentLight:'#efebe9', accentDark:'#3e2723',
      selectedSections: [
        {key:'summary',label:'Advocate Profile',visible:true},
        {key:'experience',label:'Court Experience & Cases',visible:true},
        {key:'education',label:'Legal Education',visible:true},
        {key:'skills',label:'Areas of Practice',visible:true},
        {key:'achievements',label:'Notable Cases & Awards',visible:true},
        {key:'certifications',label:'Bar Enrollment & Licenses',visible:true},
        {key:'extraCurricular',label:'Bar Association Activities',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'law_corp', name:'Corporate & Transactional Law',
      desc:'M&A, contracts, SEBI compliance — for law firm associates, in-house counsel & corporate secretarial roles',
      layout:'two-column', accent:'#1b5e20', accentLight:'#e8f5e9', accentDark:'#003300',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true,column:'main'},
        {key:'experience',label:'Work Experience & Deals',visible:true,column:'main'},
        {key:'education',label:'Education',visible:true,column:'main'},
        {key:'projects',label:'Key Transactions',visible:true,column:'main'},
        {key:'extraCurricular',label:'Publications & Research',visible:true,column:'main'},
        {key:'skills',label:'Practice Areas',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'Legal Tools & Software',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages',visible:true,column:'sidebar'},
        {key:'certifications',label:'Certifications',visible:true,column:'sidebar'},
        {key:'achievements',label:'Awards',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Details',visible:true,column:'sidebar'},
      ],
    },
    {
      id:'law_judicial', name:'Judiciary / UPSC Law',
      desc:'For PCS-J, HJS & all India judicial service exams — academic credentials, publications & NCC/NSS sections',
      layout:'minimal', accent:'#1a237e', accentLight:'#e8eaf6', accentDark:'#000051',
      selectedSections: [
        {key:'education',label:'Legal & Academic Qualifications',visible:true},
        {key:'summary',label:'Statement of Purpose',visible:true},
        {key:'experience',label:'Judicial Training & Internships',visible:true},
        {key:'achievements',label:'Academic Distinctions & Publications',visible:true},
        {key:'skills',label:'Legal Research Skills',visible:true},
        {key:'certifications',label:'Courses & Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'law_fresher', name:'Junior Associate / Fresher',
      desc:'Entry-level law graduate — moot courts, clinics, internships & law school rank for tier-1 law firm applications',
      layout:'bold', accent:'#880e4f', accentLight:'#fce4ec', accentDark:'#560027',
      selectedSections: [
        {key:'education',label:'Education & Academic Record',visible:true},
        {key:'experience',label:'Internships & Clerkships',visible:true},
        {key:'achievements',label:'Moot Courts, Competitions & Awards',visible:true},
        {key:'skills',label:'Legal Skills',visible:true},
        {key:'certifications',label:'Certifications & Courses',visible:true},
        {key:'extraCurricular',label:'Law Journal & Activities',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
  ],

  // ── CA / FINANCE ─────────────────────────────────────────────────────────
  // Indian CA: ICAI format; articleship & exam rank are critical signals
  ca_finance: [
    {
      id:'ca_icai', name:'ICAI / CA Standard',
      desc:'Official CA/CMA format — articleship firm, exam rank, attempt details & Big 4 internships prominent',
      layout:'classic', accent:'#1a237e', accentLight:'#e8eaf6', accentDark:'#000051',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'education',label:'Professional Qualifications (CA/CMA)',visible:true},
        {key:'experience',label:'Articleship & Work Experience',visible:true},
        {key:'skills',label:'Technical & Accounting Skills',visible:true},
        {key:'achievements',label:'ICAI Rank & Awards',visible:true},
        {key:'certifications',label:'Certifications & Courses',visible:true},
        {key:'extraCurricular',label:'Activities',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'ca_ib', name:'Investment Banking / IB',
      desc:'Deal sheet, financial modelling & valuation heavy — for IB, PE, M&A, VC analyst & associate roles',
      layout:'bold', accent:'#004d40', accentLight:'#e0f2f1', accentDark:'#00251a',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'experience',label:'Investment Banking & Deal Experience',visible:true},
        {key:'education',label:'Education & Qualifications',visible:true},
        {key:'skills',label:'Financial Modelling & Technical Skills',visible:true},
        {key:'projects',label:'Key Transactions & Models',visible:true},
        {key:'certifications',label:'CFA / FRM / NISM Certifications',visible:true},
        {key:'achievements',label:'Awards & Competitions',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'ca_big4', name:'Big 4 / MNC Audit & Advisory',
      desc:'Two-column for Deloitte, EY, PwC, KPMG — audit, risk advisory, tax & consulting applications',
      layout:'two-column', accent:'#1565c0', accentLight:'#e3f2fd', accentDark:'#0d47a1',
      selectedSections: [
        {key:'summary',label:'Profile Summary',visible:true,column:'main'},
        {key:'experience',label:'Work Experience',visible:true,column:'main'},
        {key:'education',label:'Education',visible:true,column:'main'},
        {key:'projects',label:'Key Engagements',visible:true,column:'main'},
        {key:'extraCurricular',label:'Activities',visible:true,column:'main'},
        {key:'skills',label:'Technical Skills',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'Tools & Software',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages',visible:true,column:'sidebar'},
        {key:'certifications',label:'Certifications',visible:true,column:'sidebar'},
        {key:'achievements',label:'Achievements',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Details',visible:true,column:'sidebar'},
      ],
    },
    {
      id:'ca_fintech', name:'Fintech / Startup Finance',
      desc:'Clean minimal format for CFO track in startups, fintech, NBFC & scale-up finance roles',
      layout:'minimal', accent:'#00695c', accentLight:'#e0f2f1', accentDark:'#003d33',
      selectedSections: [
        {key:'summary',label:'Profile',visible:true},
        {key:'experience',label:'Experience',visible:true},
        {key:'skills',label:'Finance & Technical Skills',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'achievements',label:'Achievements',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'ca_senior', name:'CFO / Finance Leadership',
      desc:'Senior finance leader format — VP Finance, CFO, Financial Controller & Head of Finance applications',
      layout:'academic', accent:'#4a148c', accentLight:'#f3e5f5', accentDark:'#12005e',
      selectedSections: [
        {key:'summary',label:'Executive Profile',visible:true},
        {key:'experience',label:'Leadership Experience',visible:true},
        {key:'education',label:'Education & Qualifications',visible:true},
        {key:'skills',label:'Core Competencies',visible:true},
        {key:'achievements',label:'Key Achievements & Impact',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
  ],

  // ── ARTS & HUMANITIES ─────────────────────────────────────────────────────
  // Indian arts: diverse — journalism, academia, NGO, cultural sectors
  arts: [
    {
      id:'arts_media', name:'Journalism & Media',
      desc:'Portfolio-ready for journalists, editors, content creators, TV anchors & digital media professionals',
      layout:'bold', accent:'#6a1b9a', accentLight:'#f3e5f5', accentDark:'#38006b',
      selectedSections: [
        {key:'summary',label:'Editorial Profile',visible:true},
        {key:'experience',label:'Work Experience & Bylines',visible:true},
        {key:'skills',label:'Editorial & Technical Skills',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'projects',label:'Major Stories & Portfolio',visible:true},
        {key:'achievements',label:'Awards & Recognition',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'arts_academic', name:'University / Academic CV',
      desc:'Full academic CV — research, publications, teaching experience & conference presentations',
      layout:'academic', accent:'#1565c0', accentLight:'#e3f2fd', accentDark:'#0d47a1',
      selectedSections: [
        {key:'summary',label:'Research Profile',visible:true},
        {key:'education',label:'Academic Qualifications',visible:true},
        {key:'experience',label:'Teaching & Research Experience',visible:true},
        {key:'projects',label:'Research Projects & Grants',visible:true},
        {key:'achievements',label:'Publications & Conferences',visible:true},
        {key:'skills',label:'Research Methods & Languages',visible:true},
        {key:'certifications',label:'Fellowships & Awards',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'arts_ngo', name:'NGO / Development Sector',
      desc:'Impact metrics & stakeholder engagement — for development sector, UNDP, UNICEF, INGOs & social enterprises',
      layout:'two-column', accent:'#2e7d32', accentLight:'#e8f5e9', accentDark:'#1b5e20',
      selectedSections: [
        {key:'summary',label:'Professional Profile',visible:true,column:'main'},
        {key:'experience',label:'Programme Experience',visible:true,column:'main'},
        {key:'education',label:'Education',visible:true,column:'main'},
        {key:'projects',label:'Projects & Field Work',visible:true,column:'main'},
        {key:'extraCurricular',label:'Volunteer & Community Work',visible:true,column:'main'},
        {key:'skills',label:'Skills & Languages',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'Tools & Platforms',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages',visible:true,column:'sidebar'},
        {key:'certifications',label:'Certifications & Training',visible:true,column:'sidebar'},
        {key:'achievements',label:'Awards & Publications',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Details',visible:true,column:'sidebar'},
      ],
    },
    {
      id:'arts_psych', name:'Psychology / Social Work',
      desc:'Clinical placement, counselling hours & assessment tools — for clinical psychologists, counsellors & social workers',
      layout:'classic', accent:'#00838f', accentLight:'#e0f7fa', accentDark:'#005b6e',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'education',label:'Educational Qualifications',visible:true},
        {key:'experience',label:'Clinical Placements & Work',visible:true},
        {key:'skills',label:'Therapeutic & Assessment Skills',visible:true},
        {key:'certifications',label:'Certifications & Supervision',visible:true},
        {key:'achievements',label:'Research & Publications',visible:true},
        {key:'extraCurricular',label:'Workshops & Conferences',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'arts_policy', name:'Public Policy / Think Tank',
      desc:'Policy research, data analysis & government stakeholder work — for think tanks, NITI Aayog & policy institutes',
      layout:'minimal', accent:'#263238', accentLight:'#eceff1', accentDark:'#000a12',
      selectedSections: [
        {key:'summary',label:'Profile',visible:true},
        {key:'experience',label:'Research & Policy Experience',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'projects',label:'Policy Papers & Research',visible:true},
        {key:'skills',label:'Research & Analytical Skills',visible:true},
        {key:'achievements',label:'Publications & Presentations',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
  ],

  // ── COMMERCE / BBA ────────────────────────────────────────────────────────
  // Indian commerce: BCom/MCom/BBA pathways — sales, banking, HR, retail
  commerce: [
    {
      id:'com_sales', name:'Sales & Business Development',
      desc:'Revenue targets, pipeline metrics & client acquisition — for sales, BD & key account manager roles',
      layout:'bold', accent:'#bf360c', accentLight:'#fbe9e7', accentDark:'#870000',
      selectedSections: [
        {key:'summary',label:'Sales Profile',visible:true},
        {key:'experience',label:'Sales Experience & Achievements',visible:true},
        {key:'skills',label:'Sales & CRM Skills',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'achievements',label:'Targets Achieved & Awards',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'com_banking', name:'Banking & BFSI',
      desc:'IBPS / SBI PO / Clerk standard — banking exams, private sector bank & NBFC job applications',
      layout:'classic', accent:'#0d47a1', accentLight:'#e3f2fd', accentDark:'#002171',
      selectedSections: [
        {key:'summary',label:'Professional Summary',visible:true},
        {key:'education',label:'Education & Qualifying Exams',visible:true},
        {key:'experience',label:'Work Experience',visible:true},
        {key:'skills',label:'Banking & Financial Skills',visible:true},
        {key:'certifications',label:'NISM / JAIIB / CAIIB / Certs',visible:true},
        {key:'achievements',label:'Awards & Achievements',visible:true},
        {key:'extraCurricular',label:'Activities & NCC/NSS',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'com_hr', name:'Human Resources',
      desc:'HRBP, recruitment, L&D & talent management — for HR generalist, HR executive & people ops roles',
      layout:'two-column', accent:'#6a1b9a', accentLight:'#f3e5f5', accentDark:'#38006b',
      selectedSections: [
        {key:'summary',label:'HR Profile',visible:true,column:'main'},
        {key:'experience',label:'HR Experience',visible:true,column:'main'},
        {key:'education',label:'Education',visible:true,column:'main'},
        {key:'projects',label:'HR Projects & Initiatives',visible:true,column:'main'},
        {key:'extraCurricular',label:'Volunteer & Activities',visible:true,column:'main'},
        {key:'skills',label:'HR & Technical Skills',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'HR Tools & Platforms',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages',visible:true,column:'sidebar'},
        {key:'certifications',label:'Certifications (SHRM, HRCI)',visible:true,column:'sidebar'},
        {key:'achievements',label:'Achievements',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Details',visible:true,column:'sidebar'},
      ],
    },
    {
      id:'com_retail', name:'Retail & E-Commerce',
      desc:'Store operations, visual merchandising, GMV & inventory management for retail, e-commerce & D2C brands',
      layout:'minimal', accent:'#e65100', accentLight:'#fff3e0', accentDark:'#bf360c',
      selectedSections: [
        {key:'summary',label:'Profile',visible:true},
        {key:'experience',label:'Experience',visible:true},
        {key:'skills',label:'Retail & Operations Skills',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'achievements',label:'Achievements & Metrics',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'com_ops', name:'Operations & Supply Chain',
      desc:'Lean / Six Sigma, logistics, procurement & SCM — for operations executive, SCM & warehouse management roles',
      layout:'academic', accent:'#4e342e', accentLight:'#efebe9', accentDark:'#3e2723',
      selectedSections: [
        {key:'summary',label:'Operations Profile',visible:true},
        {key:'experience',label:'Professional Experience',visible:true},
        {key:'skills',label:'Operations & SCM Skills',visible:true},
        {key:'education',label:'Education',visible:true},
        {key:'certifications',label:'Lean / Six Sigma / Certs',visible:true},
        {key:'achievements',label:'Process Improvements & Awards',visible:true},
        {key:'projects',label:'Key Projects',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
  ],

  // ── GOVERNMENT / UPSC ─────────────────────────────────────────────────────
  // Indian government: UPSC/SSC norms; achievements, NCC, sports are vital
  government: [
    {
      id:'gov_upsc', name:'UPSC / Civil Services',
      desc:'IAS/IPS/IFS format — optional subjects, academic distinctions, NCC/NSS & social work sections prominent',
      layout:'academic', accent:'#1a237e', accentLight:'#e8eaf6', accentDark:'#000051',
      selectedSections: [
        {key:'education',label:'Academic Qualifications',visible:true},
        {key:'summary',label:'Profile',visible:true},
        {key:'achievements',label:'Academic Distinctions & Awards',visible:true},
        {key:'experience',label:'Work & Internship Experience',visible:true},
        {key:'extraCurricular',label:'NCC / NSS / Sports & Social Work',visible:true},
        {key:'skills',label:'Languages & Competencies',visible:true},
        {key:'certifications',label:'Training & Certifications',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'gov_psu', name:'PSU / GATE Technical',
      desc:'BHEL, ONGC, NTPC, SAIL standard — GATE score, technical domain skills & project experience prominent',
      layout:'classic', accent:'#1b5e20', accentLight:'#e8f5e9', accentDark:'#003300',
      selectedSections: [
        {key:'education',label:'Education & GATE Score',visible:true},
        {key:'summary',label:'Professional Objective',visible:true},
        {key:'experience',label:'Work & Internship Experience',visible:true},
        {key:'skills',label:'Technical Skills & Domain Knowledge',visible:true},
        {key:'projects',label:'Projects',visible:true},
        {key:'achievements',label:'Academic Achievements',visible:true},
        {key:'certifications',label:'Certifications',visible:true},
        {key:'extraCurricular',label:'Extra-Curricular',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'gov_banking', name:'Bank PO / IBPS / SBI',
      desc:'IBPS PO, SBI PO & Clerk format — reasoning ability, financial awareness & interview-ready presentation',
      layout:'two-column', accent:'#006064', accentLight:'#e0f7fa', accentDark:'#00363a',
      selectedSections: [
        {key:'summary',label:'Career Objective',visible:true,column:'main'},
        {key:'education',label:'Education & Exam Scores',visible:true,column:'main'},
        {key:'experience',label:'Work Experience',visible:true,column:'main'},
        {key:'projects',label:'Projects & Internships',visible:true,column:'main'},
        {key:'extraCurricular',label:'Activities & NCC/NSS',visible:true,column:'main'},
        {key:'skills',label:'Banking & Computer Skills',visible:true,column:'sidebar'},
        {key:'skills_tools',label:'Software & Tools',visible:true,column:'sidebar'},
        {key:'skills_soft',label:'Soft Skills',visible:true,column:'sidebar'},
        {key:'skills_languages',label:'Languages Known',visible:true,column:'sidebar'},
        {key:'certifications',label:'JAIIB / NISM / Certs',visible:true,column:'sidebar'},
        {key:'achievements',label:'Awards & Sports',visible:true,column:'sidebar'},
        {key:'personalDetails',label:'Personal Details',visible:true,column:'sidebar'},
      ],
    },
    {
      id:'gov_teaching', name:'Teaching / UGC-NET',
      desc:'School & college teaching — UGC-NET qualification, research publications & teaching portfolio',
      layout:'minimal', accent:'#4527a0', accentLight:'#ede7f6', accentDark:'#1a0072',
      selectedSections: [
        {key:'summary',label:'Teaching Profile',visible:true},
        {key:'education',label:'Qualifications & NET/SET',visible:true},
        {key:'experience',label:'Teaching Experience',visible:true},
        {key:'achievements',label:'Research & Publications',visible:true},
        {key:'skills',label:'Subject Expertise & Skills',visible:true},
        {key:'certifications',label:'Training & Development',visible:true},
        {key:'extraCurricular',label:'Curriculum & Co-curricular',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
    {
      id:'gov_defense', name:'Defense / NDA / CDS',
      desc:'Military service application — physical fitness, NCC, sports achievements & patriotism section',
      layout:'bold', accent:'#1b5e20', accentLight:'#e8f5e9', accentDark:'#003300',
      selectedSections: [
        {key:'summary',label:'Candidate Profile',visible:true},
        {key:'education',label:'Education & Academic Record',visible:true},
        {key:'achievements',label:'NCC, Sports & Physical Achievements',visible:true},
        {key:'skills',label:'Skills & Languages',visible:true},
        {key:'extraCurricular',label:'Leadership & Community Service',visible:true},
        {key:'experience',label:'Work & Internship Experience',visible:true},
        {key:'certifications',label:'Certifications & Training',visible:true},
        {key:'personalDetails',label:'Personal Details',visible:true},
      ],
    },
  ],
};

/* ─────────────────────────────────────────────────────────────
   GENERATE RESUME FROM CLAUDE API
──────────────────────────────────────────────────────────────── */
async function generateResumeFromClaude(rawInfo, streamId, template, customInstructions = '', pageMode = 'multi') {
  const stream = RESUME_STREAMS.find(s => s.id === streamId);
  const streamLabel = stream?.label || streamId;

  const isTwoColLayout = template?.layout === 'two-column';

  const singlePageRules = pageMode === 'single' ? (isTwoColLayout ? `

SINGLE-PAGE STRICT MODE — TWO-COLUMN LAYOUT. MANDATORY.

━━━ CHARACTER COUNT LAW — NON-NEGOTIABLE ━━━
The MAIN COLUMN is ~60% of page width. Each bullet line holds approximately 100–120 characters.
EVERY experience, project, achievement, and extra-curricular bullet MUST be between 100 and 120 characters.
Count EVERY character including spaces, punctuation, symbols (₹, %, +, —).

MANDATORY PROCESS FOR EVERY BULLET:
Step 1 — Write STAR bullet: [Action Verb] + [Scope] + [Action] + [Quantified Result]
Step 2 — Aim for exactly 110 characters (midpoint of 100–120 range)
Step 3 — If < 100: add a metric, tool, team size, or outcome detail
Step 4 — If > 120: compress — "in order to"→"to", remove filler, abbreviate numbers

VERIFIED TWO-COLUMN EXAMPLES (main column ~60% width):
✓ 105 chars: "Built analytics dashboard for 50K+ merchants, boosting retention by 12% using Python & SQL"
✓ 112 chars: "Analysed 2M+ customer records to identify churn drivers, reducing attrition by 8% in Q3 2023"
✓ 118 chars: "Led cross-functional team of 8 engineers to deliver product 3 weeks ahead of schedule with zero defects"
✗ TOO SHORT (< 100): "Worked on analytics dashboard" — FORBIDDEN
✗ TOO LONG (> 120): "Spearheaded end-to-end development of seller analytics dashboard for 50K+ merchants on Flipkart platform" — FORBIDDEN

━━━ CONTENT LIMITS — TWO COLUMN (fill A4 page precisely) ━━━
• Profile Summary: exactly 2 sentences, each 100–115 characters
• Experience: MAX 4 bullets per role — each EXACTLY 100–120 characters
• Projects: MAX 2 projects, MAX 3 bullets each — each 100–120 characters
• Achievements: MAX 4 items — each 85–105 characters
• Certifications: MAX 4 items (short, one line each)
• Extra-curricular: MAX 3 items — each 85–105 characters
• Skills (SIDEBAR): MAX 8 technical, MAX 6 tools, languages list — use bullet list format
• EVERY section filled — content must reach bottom of the A4 page` : `

SINGLE-PAGE STRICT MODE — SINGLE COLUMN LAYOUT. MANDATORY.

━━━ CHARACTER COUNT LAW — NON-NEGOTIABLE ━━━
The full page width is used. Each bullet line holds approximately 120–130 characters.
EVERY experience, project, achievement, and extra-curricular bullet MUST be between 120 and 130 characters.
Count EVERY character including spaces, punctuation, symbols (₹, %, +, —).

MANDATORY PROCESS FOR EVERY BULLET:
Step 1 — Write the full STAR bullet: [Action Verb] + [Scope] + [Action] + [Quantified Result]
Step 2 — Count characters mentally or estimate: aim for 125 characters
Step 3 — If too SHORT (< 120): add more detail — tool name, team size, timeline, metric, city
Step 4 — If too LONG (> 130): compress — "in order to"→"to", remove filler, shorten numbers

VERIFIED SINGLE-COLUMN EXAMPLES:
✓ 126 chars: "Spearheaded seller analytics dashboard for 50K+ merchants, boosting retention by 12% through data-driven UX improvements"
✓ 129 chars: "Analysed 2M+ telecom customer records to identify churn drivers, reducing attrition by 8% via predictive segmentation model"
✗ TOO SHORT (< 120): "Worked on analytics dashboard improving retention" — FORBIDDEN
✗ TOO LONG (> 130): "Spearheaded the end-to-end development of a seller analytics dashboard serving 50,000+ merchants on Flipkart, boosting retention by 12%" — FORBIDDEN

━━━ CONTENT LIMITS — SINGLE COLUMN (fill A4 page precisely) ━━━
• Profile Summary: exactly 2 sentences, each 120–130 characters
• Experience: MAX 5 bullets per role — each EXACTLY 120–130 characters
• Projects: MAX 3 projects, MAX 3 bullets each — each EXACTLY 120–130 characters
• Achievements: MAX 5 items — each 110–125 characters
• Certifications: MAX 4 items (short, no char limit)
• Extra-curricular: MAX 3 items — each 110–125 characters
• Skills: MAX 10 technical, MAX 8 tools, include soft skills row
• EVERY section must be filled — no blank space at page bottom`) : `

CONTENT VOLUME: Generate content that fills ~85-90% of an A4 page per page. Bullets max 1.5 lines. Limit experience to 3 bullets/role, projects to 2 bullets/project. Profile summary max 3 sentences.`;

  const systemPrompt = `You are the world's #1 professional resume writer specializing in Indian professional resumes for ${streamLabel} candidates. 
Transform raw unstructured information into a perfectly structured, professional resume.

STAR FRAMEWORK MANDATORY — Apply to ALL experience & project bullets:
Format: [Strong Past-Tense Action Verb] + [Scale/Scope Context] + [Specific Actions Taken] + [Quantified Result/Impact]
✓ EXCELLENT: "Spearheaded migration of 500K+ user database to AWS Aurora, reducing query latency by 67% and cutting infrastructure costs by ₹18L annually"
✓ EXCELLENT: "Led cross-functional team of 12 across 3 cities to launch mobile app in 90 days — achieved 4.8★ rating with 50K downloads in Month 1"
✗ BAD: "Worked on database migration" | "Helped with app launch" | "Assisted team" 

CRITICAL RULES:
1. NEVER fabricate numbers — if user didn't provide metrics, use qualitative impact or percentage ranges
2. Every bullet MUST start with a different, powerful action verb — never repeat verbs
3. Profile Summary: 3-4 sentences, ultra-specific to ${streamLabel} field, include key strengths & career intent
4. Include ALL information given — zero omission
5. DOB, nationality & language proficiency in personal details (Indian standard)
6. Skills must be real based on what user mentioned only
${singlePageRules}
7. EDUCATION: Provide complete data for each entry — degree, institution, location, year, score, AND honors/specialization fields — these will be rendered as a structured table with 5 columns.
8. CUSTOM SECTIONS: If the user has added custom section headings (listed in the instructions below), generate real, relevant STAR-framework bullet content for each one based on the user's background. NEVER leave a custom section empty or write "Content added at generation time." — always write actual bullets.

Return ONLY valid JSON, no markdown, no code fences, no commentary.`;

  const userPrompt = `Stream: ${streamLabel}
Template Style: ${template.name} (${template.layout || 'classic'} layout)
${customInstructions ? `\nCUSTOM STRUCTURE INSTRUCTIONS (follow these precisely for section order, headings and layout):\n${customInstructions}\n` : ''}
USER'S RAW INFORMATION (extract and structure everything from this):
${rawInfo}

Return this EXACT JSON structure (empty string/array if info not available — never skip a field):

{
  "personalInfo": {
    "name": "Full Name",
    "email": "email@domain.com",
    "phone": "+91 XXXXX XXXXX",
    "location": "City, State",
    "linkedin": "linkedin.com/in/username",
    "github": "github.com/username",
    "website": ""
  },
  "profileSummary": "Powerful 3-4 sentence professional summary for ${streamLabel} tailored to the user's background. Include years of experience, key technical/domain competencies, top 2-3 achievements, and clear career objective.",
  "education": [
    {
      "degree": "B.Tech Computer Science",
      "institution": "Full Institution Name",
      "location": "City",
      "year": "2018 – 2022",
      "score": "8.9 CGPA",
      "honors": "Dean's Merit List"
    }
  ],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City",
      "duration": "Jun 2022 – Present",
      "bullets": [
        "STAR bullet 1 — action verb + scope + actions + quantified result",
        "STAR bullet 2 — different action verb + context + impact"
      ]
    }
  ],
  "skills": {
    "technical": ["Python", "Java", "React", "SQL"],
    "tools": ["AWS", "Docker", "Kubernetes", "Jira"],
    "soft": ["Team Leadership", "Problem Solving", "Stakeholder Management"],
    "languages": ["English (Fluent)", "Hindi (Native)"]
  },
  "projects": [
    {
      "name": "Project Name",
      "tech": "React, Node.js, MongoDB",
      "duration": "Jan 2022 – Mar 2022",
      "bullets": [
        "STAR bullet describing project scope, technical approach & measurable impact"
      ],
      "link": "github.com/username/project"
    }
  ],
  "achievements": [
    "AIR 156 in JEE Advanced 2018 — Top 0.1% of 1.2M candidates",
    "Winner, Smart India Hackathon 2021 — Competed against 500+ teams nationally"
  ],
  "certifications": [
    "AWS Certified Solutions Architect – Associate (2023)",
    "Google Cloud Professional Data Engineer (2022)"
  ],
  "extraCurricular": [
    "Technical Secretary, ACM Student Chapter, IIT Delhi (2020–2022)",
    "Captain, Inter-College Cricket Team — Led team to regional finals"
  ],
  "personalDetails": {
    "dob": "15 March 2000",
    "nationality": "Indian",
    "languages": ["English", "Hindi", "Telugu"]
  },
  "customSections": [
    {
      "key": "custom_section_key_here",
      "label": "Section Heading Exactly As Specified",
      "bullets": [
        "STAR bullet 1 — real content relevant to user's background and this section topic",
        "STAR bullet 2 — different action verb + specific achievement + quantified result"
      ]
    }
  ]
}`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  return await callClaude(fullPrompt, 32768);
}

/* ─────────────────────────────────────────────────────────────
   DOWNLOAD UTILITIES
──────────────────────────────────────────────────────────────── */
async function downloadResumeAsPDF(elementId, candidateName) {
  track('resume-download', { format: 'pdf' });
  if (!window.html2pdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load PDF library. Please try again.'));
      document.head.appendChild(script);
    });
  }
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Resume element not found.');
  await window.html2pdf().set({
    margin: 0,
    filename: `${(candidateName || 'Resume').replace(/\s+/g, '_')}_Resume.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2.5, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(element).save();
}

/* ─────────────────────────────────────────────────────────────
   WORD DOWNLOAD — native DOCX text (no image), styled per template
   Faithfully mirrors each layout: Classic, Two-Column, Minimal,
   Bold (gradient header), Academic — using OOXML paragraph/table XML.
──────────────────────────────────────────────────────────────── */
async function downloadResumeAsWord(data, tmpl, sections, pageMode = 'multi') {
  track('resume-download', { format: 'docx', template: tmpl?.id || tmpl?.name || 'unknown' });
  if (!data) throw new Error('No resume data available.');

  // ── Load JSZip ──────────────────────────────────────────────
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const isSingle = pageMode === 'single';

  // Page geometry — defined early so all layout builders can reference them
  const PAGE_W   = 11906;
  const MARGIN   = 500;    // 500 twips left & right — same both sides
  const BODY_W   = PAGE_W - MARGIN * 2;  // 10906 twips usable body width
  const PAGE_H   = 16838;
  const MARGIN_V = 500;

  const layout    = tmpl?.layout || 'classic';
  const accent    = (tmpl?.accent    || '#1a73e8').replace('#','');
  const accentDark= (tmpl?.accentDark|| '#0d47a1').replace('#','');
  const accentLight=(tmpl?.accentLight||'#e8f0fe').replace('#','');
  const p         = data.personalInfo || {};

  // Helper: escape XML special chars
  const X = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // Helper: hex color → OOXML 6-char (no #)
  const C = hex => hex.replace('#','').padEnd(6,'0').slice(0,6).toUpperCase();
  const AC = C('#'+accent);
  const ADC= C('#'+accentDark);

  // All markdown already stripped from data — just emit a plain run
  function mdRuns(text, baseSz = 18, baseColor = '1A1A1A') {
    return `<w:r><w:rPr><w:sz w:val="${baseSz}"/><w:szCs w:val="${baseSz}"/><w:color w:val="${baseColor}"/></w:rPr><w:t xml:space="preserve">${X(text||'')}</w:t></w:r>`;
  }

  // ── Paragraph builders ──────────────────────────────────────

  // Generic paragraph
  function para(content, opts = {}) {
    const { jc='left', spBefore=0, spAfter=40, shade, bdr } = opts;
    const shadeXml = shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${C(shade)}"/>` : '';
    const bdrXml   = bdr   ? `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="${C(bdr)}"/></w:pBdr>` : '';
    // Bold layout uses zero page margins — all body paragraphs need explicit indent
    const indXml   = layout === 'bold' ? `<w:ind w:left="${MARGIN}" w:right="${MARGIN}"/>` : '';
    return `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:before="${spBefore}" w:after="${spAfter}"/>${shadeXml}${bdrXml}${indXml}</w:pPr>${content}</w:p>`;
  }

  // Single styled run
  function run(text, opts = {}) {
    const { bold=false, italic=false, sz=18, color='1A1A1A', font, underline=false } = opts;
    const fontXml = font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>` : '';
    const ulXml   = underline ? '<w:u w:val="single"/>' : '';
    return `<w:r><w:rPr>${fontXml}${bold?'<w:b/>':''}${italic?'<w:i/>':''}${ulXml}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:color w:val="${color}"/></w:rPr><w:t xml:space="preserve">${X(text)}</w:t></w:r>`;
  }

  // Tab stop run (right-aligned date)
  function runTab() { return `<w:r><w:tab/></w:r>`; }

  // Section heading — style varies per layout
  function sectionHeading(label, layout) {
    const spB = isSingle ? 80  : (layout === 'minimal' || layout === 'academic' ? 160 : 140);
    const spA = isSingle ? 16  : (layout === 'bold' ? 40 : 30);
    const sz  = isSingle ? 17  : (layout === 'bold' ? 19 : layout === 'academic' ? 18 : layout === 'minimal' ? 16 : 17);
    if (layout === 'minimal') {
      return para(run(label.toUpperCase(), { sz, color: '666666', bold: true }), { spBefore: spB, spAfter: spA, bdr: 'DDDDDD' });
    } else if (layout === 'bold') {
      return para(run(label.toUpperCase(), { sz, color: AC, bold: true }), { spBefore: spB, spAfter: spA, bdr: AC });
    } else if (layout === 'academic') {
      return para(run(label.toUpperCase(), { sz, color: ADC, bold: true }), { spBefore: spB, spAfter: spA, bdr: AC });
    } else {
      return para(run(label.toUpperCase(), { sz, color: ADC, bold: true }), { spBefore: spB, spAfter: spA, bdr: AC });
    }
  }

  // Sidebar heading (two-column only)
  function sideHeading(label) {
    return `<w:p><w:pPr><w:ind w:left="0" w:right="0"/><w:spacing w:before="${isSingle ? 60 : 120}" w:after="${isSingle ? 10 : 20}"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${AC}"/></w:pBdr></w:pPr>${run(label.toUpperCase(), { sz: isSingle ? 14 : 15, color: ADC, bold: true })}</w:p>`;
  }

  // Sidebar paragraph — resets indent to 0 so tcMar is the sole left-margin control
  function sidePara(content, spAfter = 18) {
    return `<w:p><w:pPr><w:ind w:left="0" w:right="0"/><w:spacing w:before="0" w:after="${spAfter}"/></w:pPr>${content}</w:p>`;
  }

  // Bullet paragraph
  function bullet(text, opts = {}) {
    const { indent = 360, sz = isSingle ? 17 : 18, color = '2d2d2d' } = opts;
    const spAfter = isSingle ? 16 : 30;
    const bulletRun = `<w:r><w:rPr><w:color w:val="${AC}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t>&#x25B8; </w:t></w:r>`;
    // Bold layout: shift indent by MARGIN so bullet aligns with body content
    const indLeft  = layout === 'bold' ? MARGIN + indent : indent;
    const indHang  = 200;
    return `<w:p><w:pPr><w:ind w:left="${indLeft}" w:hanging="${indHang}"/><w:spacing w:before="0" w:after="${spAfter}"/></w:pPr>${bulletRun}${mdRuns(text, sz, color)}</w:p>`;
  }

  // Tab-stop paragraph (title + right-aligned date)
  // Two-column main col (new wider): ~8384 − left(220) − right(140) = ~8024 twips usable
  // Full-width layouts: BODY_W = 10906 (bold uses para indent so effective = 10906 - 500*2 = 9906)
  const DATE_TAB = layout === 'two-column' ? 7800 : (layout === 'bold' ? 9200 - MARGIN : 9200);

  function jobHeader(title, company, location, duration) {
    const compStr = company ? ` — ${company}${location ? ', ' + location : ''}` : '';
    const tabs = `<w:tabs><w:tab w:val="right" w:pos="${DATE_TAB}"/></w:tabs>`;
    const spB = isSingle ? 40 : 80; const spA = isSingle ? 10 : 20;
    const sz = isSingle ? 19 : 21; const cSz = isSingle ? 18 : 20;
    const indXml = layout === 'bold' ? `<w:ind w:left="${MARGIN}" w:right="${MARGIN}"/>` : '';
    return `<w:p><w:pPr><w:spacing w:before="${spB}" w:after="${spA}"/>${tabs}${indXml}</w:pPr>${run(title, { bold: true, sz, color: '111111' })}${run(compStr, { sz: cSz, color: '333333' })}${runTab()}${run(duration||'', { sz: 17, color: AC, bold: true })}</w:p>`;
  }

  function projHeader(name, tech, duration) {
    const techStr = tech ? ` | ${tech}` : '';
    const tabs = `<w:tabs><w:tab w:val="right" w:pos="${DATE_TAB}"/></w:tabs>`;
    const spB = isSingle ? 40 : 80; const spA = isSingle ? 10 : 20;
    const sz = isSingle ? 19 : 21;
    const indXml = layout === 'bold' ? `<w:ind w:left="${MARGIN}" w:right="${MARGIN}"/>` : '';
    return `<w:p><w:pPr><w:spacing w:before="${spB}" w:after="${spA}"/>${tabs}${indXml}</w:pPr>${run(name, { bold: true, sz, color: '111111' })}${run(techStr, { sz: 17, color: '555555', italic: true })}${runTab()}${run(duration||'', { sz: 17, color: '888888' })}</w:p>`;
  }

  // Education table as DOCX table
  // Width is layout-aware: in two-column the table lives inside the main column cell,
  // so it must fit the main column width (72% of body − inner cell margins).
  // All other layouts use the full body width.
  const EDU_TABLE_W = layout === 'two-column'
    ? Math.round((PAGE_W - MARGIN) * 0.735) - 360   // main col of new wider 2-col layout minus cell margins
    : 10906;                             // full body width for classic/bold/minimal/academic

  function educationTable() {
    if (!data.education?.length) return '';

    // Read column visibility flags from the saved template settings
    const hideSpec  = tmpl?.hideSpecialization === true;
    const hideScore = tmpl?.hideScore          === true;

    // Header: sz 18 = 9pt | Rows: sz 17 = 8.5pt
    const EDU_SZ = 18;  // header columns
    const ROW_SZ = 17;  // row cells = 8.5pt

    // Base proportions: Degree 28% | Institution 28% | Year 10% | Score 14% | Honors 20%
    const FULL_W = EDU_TABLE_W;
    const allCols = [
      { label: 'Qualification / Degree', dataKey: 'degree',  pct: 28 },
      { label: 'Institution',            dataKey: 'inst',    pct: 28 },
      { label: 'Year',                   dataKey: 'year',    pct: 10 },
      { label: 'Score / CGPA',           dataKey: 'score',   pct: 14, hide: hideScore },
      { label: 'Specialization / Honors',dataKey: 'honors',  pct: 20, hide: hideSpec  },
    ];
    const visCols = allCols.filter(c => !c.hide);

    // Redistribute hidden column percentages proportionally to visible columns
    const hiddenPct  = allCols.filter(c => c.hide).reduce((s, c) => s + c.pct, 0);
    const visPctSum  = visCols.reduce((s, c) => s + c.pct, 0);
    // Compute twip widths that sum to exactly FULL_W
    const rawWidths  = visCols.map(c => (c.pct + hiddenPct * (c.pct / visPctSum)) * FULL_W / 100);
    const floorW     = rawWidths.map(w => Math.floor(w));
    const remainder  = FULL_W - floorW.reduce((a, b) => a + b, 0);
    const largestIdx = rawWidths.indexOf(Math.max(...rawWidths));
    const colWidths  = floorW.map((w, i) => i === largestIdx ? w + remainder : w);

    const headRow = `<w:tr>
      ${visCols.map((col, i) => `
      <w:tc><w:tcPr><w:tcW w:w="${colWidths[i]}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${C('#'+accentLight)}"/></w:tcPr>
        <w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>${run(col.label.toUpperCase(),{bold:true,sz:EDU_SZ,color:ADC})}</w:p>
      </w:tc>`).join('')}
    </w:tr>`;

    const rows = data.education.map((e, idx) => {
      const altShade = idx%2===1 ? `<w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>` : '';
      const cellBorder = `<w:tcBorders><w:bottom w:val="single" w:sz="4" w:color="${AC}"/></w:tcBorders>`;
      // Strip "CGPA"/"GPA" suffix from score value
      const cleanScore = (e.score||'—').replace(/\s*(cgpa|gpa)\s*$/i,'').trim();
      // Strip leading "Specialization:" or "Specialisation:" from honors
      const cleanHonors = (e.honors||'—').replace(/^(speciali[sz]ation\s*:?\s*)/i,'').trim() || '—';
      const cellData = {
        degree:  run(e.degree||'—',{bold:true,sz:ROW_SZ}),
        inst:    run((e.institution||'—')+(e.location?`, ${e.location}`:''),{sz:ROW_SZ,color:'333333'}),
        year:    run(e.year||'—',{sz:ROW_SZ,color:AC,bold:true}),
        score:   run(cleanScore,{sz:ROW_SZ,color:'444444',bold:!!e.score}),
        honors:  run(cleanHonors,{sz:ROW_SZ,color:'555555'}),
      };
      return `<w:tr>${visCols.map((col, i) =>
        `<w:tc><w:tcPr><w:tcW w:w="${colWidths[i]}" w:type="dxa"/>${altShade}${cellBorder}</w:tcPr>
          <w:p><w:pPr><w:spacing w:before="18" w:after="18"/></w:pPr>${cellData[col.dataKey]}</w:p></w:tc>`
      ).join('')}</w:tr>`;
    }).join('');

    const gridCols = colWidths.map(w=>`<w:gridCol w:w="${w}"/>`).join('');
    // For bold layout: page margins are 0, so indent the table by MARGIN to align with body content
    const tblIndXml = layout === 'bold' ? `<w:tblInd w:w="${MARGIN}" w:type="dxa"/>` : '';
    return `<w:tbl><w:tblPr>
      <w:tblW w:w="${FULL_W}" w:type="dxa"/>
      ${tblIndXml}
      <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>
      <w:tblLook w:val="0000"/></w:tblPr>
      <w:tblGrid>${gridCols}</w:tblGrid>
      ${headRow}${rows}
    </w:tbl>`;
  }

  // ── Per-section content block ──────────────────────────────
  function renderSection(key, label) {
    switch(key) {
      case 'summary':
        if (!data.profileSummary) return '';
        if (layout === 'minimal') {
          return sectionHeading(label,'minimal') + para(run(data.profileSummary,{sz: 18,color:'333333',italic:true,font:'Georgia'}),{spBefore:20,spAfter:40});
        } else if (layout === 'two-column') {
          // Summary gets a shaded box in two-column
          return para(run(data.profileSummary,{sz: 18,color:'2d2d2d'}),{spBefore:40,spAfter:60,shade:'#'+accentLight});
        }
        return sectionHeading(label,layout) + para(run(data.profileSummary,{sz: 18,color:'2d2d2d'}),{spBefore:20,spAfter:40});

      case 'education':
        if (!data.education?.length) return '';
        return sectionHeading(label,layout) + educationTable();

      case 'experience':
        if (!data.experience?.length) return '';
        return sectionHeading(label,layout) + data.experience.map(exp =>
          jobHeader(exp.title,exp.company,exp.location,exp.duration) +
          (exp.bullets||[]).map(b => bullet(b)).join('')
        ).join('');

      case 'projects':
        if (!data.projects?.length) return '';
        return sectionHeading(label,layout) + data.projects.map(proj =>
          projHeader(proj.name,proj.tech,proj.duration) +
          (proj.link ? para(run(proj.link,{sz:18,color:AC}),{spBefore:0,spAfter:20}) : '') +
          (proj.bullets||[]).map(b => bullet(b)).join('')
        ).join('');

      case 'skills': {
        const sk = data.skills || {};
        if (!sk.technical?.length && !sk.tools?.length) return '';
        // Only render sub-groups here if they don't have their own explicit section key
        const hasToolsKey = activeSections.some(s => s.key === 'skills_tools');
        const hasSoftKey  = activeSections.some(s => s.key === 'skills_soft');
        const hasLangKey  = activeSections.some(s => s.key === 'skills_languages');
        let rows = '';
        if (sk.technical?.length) rows += para(`${run('Technical: ',{bold:true,sz:18})}${run(sk.technical.join(', '),{sz:18,color:'333333'})}`,{spBefore:20,spAfter:20});
        if (!hasToolsKey && sk.tools?.length) rows += para(`${run('Tools: ',{bold:true,sz:18})}${run(sk.tools.join(', '),{sz:18,color:'333333'})}`,{spBefore:0,spAfter:20});
        if (!hasSoftKey  && sk.soft?.length)  rows += para(`${run('Soft Skills: ',{bold:true,sz:18})}${run(sk.soft.join(', '),{sz:18,color:'333333'})}`,{spBefore:0,spAfter:20});
        if (!hasLangKey  && sk.languages?.length) rows += para(`${run('Languages: ',{bold:true,sz:18})}${run(sk.languages.join(', '),{sz:18,color:'333333'})}`,{spBefore:0,spAfter:20});
        if (!rows) return '';
        return sectionHeading(label,layout) + rows;
      }

      case 'skills_tools': {
        const tools = data.skills?.tools || [];
        if (!tools.length) return '';
        return sectionHeading(label,layout) + tools.map(b => bullet(b)).join('');
      }

      case 'skills_soft': {
        const soft = data.skills?.soft || [];
        if (!soft.length) return '';
        return sectionHeading(label,layout) + soft.map(b => bullet(b)).join('');
      }

      case 'skills_languages': {
        const langs = data.skills?.languages || [];
        if (!langs.length) return '';
        return sectionHeading(label,layout) + langs.map(b => bullet(b)).join('');
      }

      case 'achievements':
        if (!data.achievements?.length) return '';
        return sectionHeading(label,layout) + data.achievements.map(b => bullet(b)).join('');

      case 'certifications':
        if (!data.certifications?.length) return '';
        return sectionHeading(label,layout) + data.certifications.map(b => bullet(b)).join('');

      case 'extraCurricular':
        if (!data.extraCurricular?.length) return '';
        return sectionHeading(label,layout) + data.extraCurricular.map(b => bullet(b)).join('');

      case 'personalDetails': {
        const pd = data.personalDetails || {};
        if (!pd.dob && !pd.nationality) return '';
        // Body width = BODY_W = 10906 twips, split into 3 equal columns
        const pdW = Math.round(BODY_W / 3); // 3635 twips each
        const cell = (label, val) => val ? `
          <w:tc><w:tcPr><w:tcW w:w="${pdW}" w:type="dxa"/>
            <w:tcBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/></w:tcBorders>
          </w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>
            ${run(label,{bold:true,sz:isSingle?18:20,color:'111111'})}${run(val,{sz:isSingle?18:20,color:'333333'})}
          </w:p></w:tc>` : `<w:tc><w:tcPr><w:tcW w:w="${pdW}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`;
        const dobCell  = cell('Date of Birth: ', pd.dob);
        const natCell  = cell('Nationality: ', pd.nationality);
        const langCell = cell('Languages Known: ', pd.languages?.length ? pd.languages.join(', ') : null);
        // Bold layout: page margins are 0, use tblInd to align with body indent
        const tblIndXml = layout === 'bold' ? `<w:tblInd w:w="${MARGIN}" w:type="dxa"/>` : '';
        const pdTable = `<w:tbl><w:tblPr>
          <w:tblW w:w="${pdW*3}" w:type="dxa"/>
          ${tblIndXml}
          <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>
        </w:tblPr>
        <w:tblGrid><w:gridCol w:w="${pdW}"/><w:gridCol w:w="${pdW}"/><w:gridCol w:w="${pdW}"/></w:tblGrid>
        <w:tr>${dobCell}${natCell}${langCell}</w:tr></w:tbl>`;
        return sectionHeading(label,layout) + pdTable;
      }

      default: {
        const cs = data.customSections?.find(s => s.key === key);
        if (!cs?.bullets?.length) return '';
        return sectionHeading(label,layout) + cs.bullets.map(b => bullet(b)).join('');
      }
    }
  }

  // ── Ordered visible sections ────────────────────────────────
  const FALLBACK_SECTIONS = {
    classic:     [{key:'summary',label:'Professional Summary'},{key:'education',label:'Education'},{key:'experience',label:'Work Experience'},{key:'projects',label:'Projects'},{key:'skills',label:'Technical Skills'},{key:'achievements',label:'Achievements & Awards'},{key:'certifications',label:'Certifications'},{key:'extraCurricular',label:'Extra-Curricular Activities'},{key:'personalDetails',label:'Personal Details'}],
    'two-column':[{key:'summary',label:'Profile Summary',column:'main'},{key:'experience',label:'Work Experience',column:'main'},{key:'education',label:'Education',column:'main'},{key:'projects',label:'Projects',column:'main'},{key:'extraCurricular',label:'Extra-Curricular Activities',column:'main'},{key:'skills',label:'Technical Skills',column:'sidebar'},{key:'skills_tools',label:'Tools & Platforms',column:'sidebar'},{key:'skills_soft',label:'Soft Skills',column:'sidebar'},{key:'skills_languages',label:'Languages',column:'sidebar'},{key:'certifications',label:'Certifications',column:'sidebar'},{key:'achievements',label:'Achievements',column:'sidebar'},{key:'personalDetails',label:'Personal Details',column:'sidebar'}],
    minimal:     [{key:'summary',label:'Profile'},{key:'experience',label:'Experience'},{key:'education',label:'Education'},{key:'projects',label:'Projects'},{key:'skills',label:'Skills'},{key:'achievements',label:'Achievements'},{key:'certifications',label:'Certifications'},{key:'extraCurricular',label:'Extra-Curricular'},{key:'personalDetails',label:'Personal Details'}],
    bold:        [{key:'summary',label:'Professional Summary'},{key:'experience',label:'Work Experience'},{key:'education',label:'Education'},{key:'projects',label:'Projects'},{key:'skills',label:'Skills'},{key:'achievements',label:'Achievements & Awards'},{key:'certifications',label:'Certifications'},{key:'extraCurricular',label:'Extra-Curricular Activities'},{key:'personalDetails',label:'Personal Details'}],
    academic:    [{key:'summary',label:'Profile Summary'},{key:'education',label:'Academic Background'},{key:'experience',label:'Professional Experience'},{key:'projects',label:'Research / Projects'},{key:'skills',label:'Skills & Competencies'},{key:'achievements',label:'Awards & Achievements'},{key:'certifications',label:'Certifications & Courses'},{key:'extraCurricular',label:'Positions of Responsibility & Activities'},{key:'personalDetails',label:'Personal Information'}],
  };
  const activeSections = (sections || FALLBACK_SECTIONS[layout] || FALLBACK_SECTIONS.classic)
    .filter(s => s.visible !== false && !s.deleted);

  // ── Build document body paragraphs ─────────────────────────
  let body = '';

  // Contact parts
  const contactParts = [p.email, p.phone, p.location, p.linkedin, p.github].filter(Boolean);

  // ── BOLD LAYOUT: full-bleed dark header using a page-wide table ─
  // A negative-indent paragraph does not reliably bleed in all Word versions.
  // Instead we use a 1-row table with negative left/right indent to span
  // the full page including margins, with the dark accent fill on the cell.
  if (layout === 'bold') {
    const nameSz = isSingle ? 38 : 46;
    const contactSz = isSingle ? 16 : 18;

    // With page margins = 0 for bold layout:
    //   - No tblInd needed — table starts at x=0 (page left edge) by default
    //   - tblW = PAGE_W = 11906 → covers full page width, exact right edge
    //   - Cell left/right padding = MARGIN = 500 → text starts at x=500,
    //     same as body paragraphs which use w:ind left=MARGIN below
    const headerW       = PAGE_W;   // 11906 twips — full A4 width, no offset needed
    const cellPadLR     = MARGIN;   // 500 twips — matches body indent
    const cellPadTop    = isSingle ? 160 : 220;
    const cellPadBottom = isSingle ? 120 : 180;

    const headerTable = `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${headerW}" w:type="dxa"/>
        <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="${cellPadTop}" w:type="dxa"/>
          <w:left w:w="${cellPadLR}" w:type="dxa"/>
          <w:bottom w:w="${cellPadBottom}" w:type="dxa"/>
          <w:right w:w="${cellPadLR}" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tblGrid><w:gridCol w:w="${headerW}"/></w:tblGrid>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${headerW}" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="${C('#'+accentDark)}"/>
          </w:tcPr>
          <w:p><w:pPr><w:spacing w:before="0" w:after="16"/></w:pPr>${run(p.name || 'Your Name', { bold: true, sz: nameSz, color: 'FFFFFF' })}</w:p>
          <w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>${run([p.email, p.phone, p.location, p.linkedin, p.github, p.website].filter(Boolean).join('   |   '), { sz: contactSz, color: 'E0E0E0' })}</w:p>
        </w:tc>
      </w:tr>
    </w:tbl>`;
    body += headerTable;
    // Spacer paragraph (also indented) so section headings don't crowd the header
    body += `<w:p><w:pPr><w:ind w:left="${MARGIN}" w:right="${MARGIN}"/><w:spacing w:before="0" w:after="60"/></w:pPr></w:p>`;
    activeSections.forEach(sec => { body += renderSection(sec.key, sec.label); });

  // ── TWO-COLUMN LAYOUT: sidebar rendered first as a table ───
  } else if (layout === 'two-column') {
    const sidebarSecs = activeSections.filter(s => s.column === 'sidebar');
    const mainSecs    = activeSections.filter(s => s.column !== 'sidebar');

    // Build sidebar content string — name & contact go HERE at the top of the sidebar
    let sideContent = '';

    // ── Name block at top of sidebar — flush to top (spBefore=0) ─
    const nameSize = isSingle ? 22 : 26;
    sideContent += sidePara(run(p.name || 'Your Name', { bold: true, sz: nameSize, color: ADC }), isSingle ? 20 : 36);
    // Contact details — one per line inside the narrow sidebar
    const allContact = [p.email, p.phone, p.location, p.linkedin, p.github, p.website].filter(Boolean);
    allContact.forEach(c => {
      sideContent += sidePara(run(c, { sz: 16, color: '444444' }), 14);
    });
    // Thin separator below name block
    sideContent += `<w:p><w:pPr><w:ind w:left="0" w:right="0"/><w:spacing w:before="0" w:after="${isSingle ? 40 : 60}"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${AC}"/></w:pBdr></w:pPr></w:p>`;
    // Pre-compute which sub-skill keys are explicitly listed as separate sidebar sections
    const hasToolsSec   = sidebarSecs.some(s => s.key === 'skills_tools');
    const hasSoftSec    = sidebarSecs.some(s => s.key === 'skills_soft');
    const hasLangSec    = sidebarSecs.some(s => s.key === 'skills_languages');

    sidebarSecs.forEach(sec => {
      switch(sec.key) {
        case 'skills': {
          const sk = data.skills||{};
          if (sk.technical?.length) { sideContent += sideHeading(sec.label); sk.technical.forEach(s => { sideContent += sidePara(run('▸ '+s,{sz:18,color:'333333'}), 18); }); }
          // Only render sub-groups if they don't have their own explicit section key
          if (!hasToolsSec && sk.tools?.length)     { sideContent += sideHeading('Tools & Platforms'); sk.tools.forEach(s => { sideContent += sidePara(run('▸ '+s,{sz:18,color:'333333'}), 18); }); }
          if (!hasSoftSec  && sk.soft?.length)      { sideContent += sideHeading('Soft Skills');       sk.soft.forEach(s  => { sideContent += sidePara(run('▸ '+s,{sz:18,color:'333333'}), 18); }); }
          if (!hasLangSec  && sk.languages?.length) { sideContent += sideHeading('Languages');         sk.languages.forEach(s => { sideContent += sidePara(run('▸ '+s,{sz:18,color:'333333'}), 18); }); }
          break;
        }
        case 'skills_tools':
          if (data.skills?.tools?.length) { sideContent += sideHeading(sec.label); data.skills.tools.forEach(s => { sideContent += sidePara(run('▸ '+s,{sz:18,color:'333333'}), 18); }); }
          break;
        case 'skills_soft':
          if (data.skills?.soft?.length) { sideContent += sideHeading(sec.label); data.skills.soft.forEach(s => { sideContent += sidePara(run('▸ '+s,{sz:18,color:'333333'}), 18); }); }
          break;
        case 'skills_languages':
          if (data.skills?.languages?.length) { sideContent += sideHeading(sec.label); data.skills.languages.forEach(s => { sideContent += sidePara(run('▸ '+s,{sz:18,color:'333333'}), 18); }); }
          break;
        case 'certifications':
          if (data.certifications?.length) { sideContent += sideHeading(sec.label); data.certifications.forEach(b => { sideContent += sidePara(run(b,{sz:18,color:'333333'}), 22); }); }
          break;
        case 'achievements':
          if (data.achievements?.length) { sideContent += sideHeading(sec.label); data.achievements.forEach(b => { sideContent += sidePara(run('▸ '+b,{sz:18,color:'333333'}), 22); }); }
          break;
        case 'personalDetails': {
          const pd = data.personalDetails||{};
          if (pd.dob||pd.nationality) {
            sideContent += sideHeading(sec.label);
            if (pd.dob)         sideContent += sidePara(`${run('DOB: ',{bold:true,sz:18})}${run(pd.dob,{sz:18,color:'333333'})}`, 18);
            if (pd.nationality) sideContent += sidePara(`${run('Nationality: ',{bold:true,sz:18})}${run(pd.nationality,{sz:18,color:'333333'})}`, 18);
            if (pd.languages?.length) sideContent += sidePara(`${run('Languages: ',{bold:true,sz:18})}${run(pd.languages.join(', '),{sz:18,color:'333333'})}`, 18);
          }
          break;
        }
        default: {
          const cs = data.customSections?.find(s=>s.key===sec.key);
          if (cs?.bullets?.length) { sideContent += sideHeading(sec.label); cs.bullets.forEach(b=>{ sideContent += sidePara(run('▸ '+b,{sz:18,color:'333333'}), 18); }); }
        }
      }
    });

    // Build main content string
    let mainContent = '';
    mainSecs.forEach(sec => { mainContent += renderSection(sec.key, sec.label); });

    // Two-column table: sidebar flush to left+top page edges, main column to right margin.
    // Page margins for two-column: top=0, left=0, right=MARGIN, bottom=MARGIN_V.
    // Table width = PAGE_W - MARGIN (right margin only) = 11406 twips.
    // tblInd = 0 explicitly prevents Word auto-indenting from the left margin.
    const BODY_W_2COL = PAGE_W - MARGIN; // 11406 twips
    const sideW = Math.round(BODY_W_2COL * 0.265); // ~3022 twips sidebar
    const mainW = BODY_W_2COL - sideW;              // ~8384 twips main
    const rowH  = PAGE_H - MARGIN_V;               // 16338 twips (full height minus bottom margin)
    // Sidebar internal padding: small top+left gives the visual breathing room seen in preview
    // while the background color still bleeds to the physical page edge.
    const SIDE_PAD  = 180; // top/right/bottom ≈3mm
    const SIDE_LEFT = 400; // left ≈7mm — clear comfortable margin from left page edge
    body += `<w:tbl><w:tblPr>
        <w:tblW w:w="${BODY_W_2COL}" w:type="dxa"/>
        <w:tblInd w:w="0" w:type="dxa"/>
        <w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="single" w:sz="8" w:color="${AC}"/></w:tblBorders>
      </w:tblPr>
      <w:tblGrid><w:gridCol w:w="${sideW}"/><w:gridCol w:w="${mainW}"/></w:tblGrid>
      <w:tr>
        <w:trPr><w:trHeight w:val="${rowH}" w:hRule="atLeast"/></w:trPr>
        <w:tc><w:tcPr>
          <w:tcW w:w="${sideW}" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${C('#'+accentLight)}"/>
          <w:vAlign w:val="top"/>
          <w:tcMar>
            <w:top w:w="${SIDE_PAD}" w:type="dxa"/>
            <w:left w:w="${SIDE_LEFT}" w:type="dxa"/>
            <w:bottom w:w="${SIDE_PAD}" w:type="dxa"/>
            <w:right w:w="${SIDE_PAD}" w:type="dxa"/>
          </w:tcMar>
        </w:tcPr>
          ${sideContent || '<w:p/>'}
        </w:tc>
        <w:tc><w:tcPr>
          <w:tcW w:w="${mainW}" w:type="dxa"/>
          <w:vAlign w:val="top"/>
          <w:tcMar>
            <w:top w:w="${SIDE_PAD}" w:type="dxa"/>
            <w:left w:w="200" w:type="dxa"/>
            <w:bottom w:w="${SIDE_PAD}" w:type="dxa"/>
            <w:right w:w="${SIDE_PAD}" w:type="dxa"/>
          </w:tcMar>
        </w:tcPr>
          ${mainContent || '<w:p/>'}
        </w:tc>
      </w:tr>
    </w:tbl>`;

  // ── MINIMAL LAYOUT ─────────────────────────────────────────
  } else if (layout === 'minimal') {
    body += para(run(p.name || 'Your Name', { sz: 42, color: '111111', font: 'Georgia' }), { spBefore: 0, spAfter: 60 });
    const cp = [p.email, p.phone, p.location].filter(Boolean);
    const wp = [p.linkedin, p.github, p.website].filter(Boolean);
    if (cp.length) body += para(run(cp.join('   ·   '), { sz: 20, color: '666666' }), { spBefore: 0, spAfter: 20 });
    if (wp.length) body += para(run(wp.join('   ·   '), { sz: 20, color: AC }), { spBefore: 0, spAfter: 80 });
    activeSections.forEach(sec => { body += renderSection(sec.key, sec.label); });

  // ── ACADEMIC LAYOUT ────────────────────────────────────────
  } else if (layout === 'academic') {
    body += para(run(p.name || 'Your Name', { bold: true, sz: 42, color: ADC }), { jc: 'center', spBefore: 0, spAfter: 40 });
    body += para(run(contactParts.join('  •  '), { sz: 20, color: '444444' }), { jc: 'center', spBefore: 0, spAfter: 100, bdr: AC });
    activeSections.forEach(sec => { body += renderSection(sec.key, sec.label); });
    // Declaration footer
    body += para(run('I hereby declare that all the information provided above is true to the best of my knowledge and belief.', { sz: 23, color: 'CCCCCC', italic: true }), { jc: 'center', spBefore: 200, spAfter: 0 });

  // ── CLASSIC LAYOUT (default) ───────────────────────────────
  } else {
    // Centered name + contact line + divider
    body += para(run(p.name || 'Your Name', { bold: true, sz: 42, color: ADC }), { jc: 'center', spBefore: 0, spAfter: 40 });
    body += para(run(contactParts.join('  •  '), { sz: 20, color: '555555' }), { jc: 'center', spBefore: 0, spAfter: 80, bdr: AC });
    activeSections.forEach(sec => { body += renderSection(sec.key, sec.label); });
  }

  // ── Assemble DOCX XML ──────────────────────────────────────
  // Margins: 500 twips (≈8.8mm) — matches the tight visual template margins.
  // Left = Right always (no imbalance). Constants defined at top of function.

  // Add page-fill anchor at document end — an invisible paragraph with exact
  // spacing to push content to the last line of A4. Only in single-page mode.
  if (isSingle) {
    // Calculate remaining space: Word will add this spacing before the final para.
    // This creates visual density — content appears to fill the full page.
    body += `<w:p><w:pPr>
      <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
      <w:jc w:val="left"/>
    </w:pPr><w:r><w:rPr><w:sz w:val="8"/><w:color w:val="FFFFFF"/></w:rPr><w:t> </w:t></w:r></w:p>`;
  }

  // Bold layout: zero all margins for full-bleed header.
  // Two-column layout: zero top and left margins so sidebar fills flush to page edges.
  // All other layouts: standard MARGIN_V / MARGIN margins.
  const topMargin   = (layout === 'bold' || layout === 'two-column') ? 0 : MARGIN_V;
  const leftMargin  = (layout === 'bold' || layout === 'two-column') ? 0 : MARGIN;
  const rightMargin = layout === 'bold' ? 0 : MARGIN;
  const margins = `w:top="${topMargin}" w:right="${rightMargin}" w:bottom="${MARGIN_V}" w:left="${leftMargin}" w:header="200" w:footer="200" w:gutter="0"`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  mc:Ignorable="w14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>
  <w:pgMar ${margins}/>
</w:sectPr>
</w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const lineSpacing = isSingle ? '240' : '276';

  // Minimal styles.xml (Normal style)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:sz w:val="${isSingle ? '18' : '20'}"/><w:szCs w:val="${isSingle ? '18' : '20'}"/>
      <w:color w:val="1A1A1A"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:before="0" w:after="${isSingle ? '20' : '40'}" w:line="${lineSpacing}" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:before="0" w:after="${isSingle ? '20' : '40'}"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${isSingle ? '18' : '20'}"/><w:szCs w:val="${isSingle ? '18' : '20'}"/></w:rPr>
  </w:style>
</w:styles>`;

  const zip = new window.JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', wordRelsXml);
  zip.file('word/styles.xml', stylesXml);

  const docxBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  const name = (p.name || 'Resume').replace(/\s+/g, '_');
  const url  = URL.createObjectURL(docxBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}_Resume.docx`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 1000);
}

/* ─────────────────────────────────────────────────────────────
   TEMPLATE LAYOUT PREVIEW SVGs (mini schematic for selection UI)
──────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   LIVE TEMPLATE PREVIEW — renders actual template at mini scale
──────────────────────────────────────────────────────────────── */
/* ── Per-stream sample data for live template previews ── */
const STREAM_PREVIEW_DATA = {
  engineering: {
    personalInfo: { name: 'Arjun Mehta', email: 'arjun@email.com', phone: '+91 98765 43210', location: 'Bangalore', linkedin: 'linkedin.com/in/arjunmehta', github: 'github.com/arjunmehta' },
    profileSummary: 'Results-driven Software Engineer with 3+ years building scalable backend systems at Google India. Led microservices migration reducing latency by 40% for 50M+ users. Passionate about clean architecture and high-impact products.',
    education: [
      { degree: 'B.Tech Computer Science', institution: 'IIT Bombay', location: 'Mumbai', year: '2019–2023', score: '8.9 CGPA', honors: 'Dept. Rank 2' },
      { degree: 'Class XII (CBSE)', institution: 'DPS R.K. Puram', location: 'Delhi', year: '2019', score: '96.4%', honors: '' },
    ],
    experience: [
      { title: 'Software Engineer', company: 'Google India', location: 'Bangalore', duration: 'Jul 2023 – Present', bullets: ['Built recommendation engine improving CTR by **23%** across **50M+** daily users', 'Led **4-engineer** team delivering features 2 weeks ahead of schedule'] },
      { title: 'Engineering Intern', company: 'Zomato', location: 'Gurugram', duration: 'May–Jul 2022', bullets: ['Built real-time order tracking with React & WebSocket, reducing support tickets by **18%**'] },
    ],
    skills: { technical: ['Python', 'Java', 'Go', 'React', 'Node.js'], tools: ['AWS', 'Docker', 'Kubernetes', 'PostgreSQL'], soft: ['System Design', 'Problem Solving'], languages: ['English (Fluent)', 'Hindi (Native)'] },
    projects: [{ name: 'SmartCampus App', tech: 'React Native, Firebase, ML', duration: '2022', bullets: ['Campus navigation app for 5000+ students; Won Smart India Hackathon 2022'], link: '' }],
    achievements: ['AIR 487 in JEE Advanced 2019 — Top 0.04% of 1.2M candidates', 'Google India Scholarship 2022 — Top 50 students nationally'],
    certifications: ['AWS Solutions Architect – Associate (2023)', 'Google Cloud Professional Data Engineer (2022)'],
    publications: [],
    extraCurricular: ['Technical Secretary, Student Council — organized 12 technical events for 800+ students'],
    personalDetails: { dob: '12 Jan 2001', nationality: 'Indian', languages: ['English', 'Hindi', 'Kannada'] },
  },
  medical: {
    personalInfo: { name: 'Dr. Sneha Iyer', email: 'sneha.iyer@email.com', phone: '+91 99001 23456', location: 'Chennai', linkedin: 'linkedin.com/in/snehaiyer' },
    profileSummary: 'MBBS graduate with distinction from AIIMS Delhi seeking postgraduate residency in Internal Medicine. Completed 1-year internship across OPD, ICU and Surgery with strong clinical acumen. Published 2 research papers in indexed journals on infectious disease management.',
    education: [
      { degree: 'MBBS', institution: 'AIIMS New Delhi', location: 'New Delhi', year: '2018–2023', score: '78% (Distinction)', honors: 'University Gold Medal' },
      { degree: 'Class XII (CBSE)', institution: 'Kendriya Vidyalaya No. 1', location: 'Chennai', year: '2018', score: '97.4%', honors: '' },
    ],
    experience: [
      { title: 'Intern Physician', company: 'AIIMS Delhi', location: 'New Delhi', duration: 'Aug 2023 – Jul 2024', bullets: ['Managed **40+ patients** daily across Medicine, Surgery & Paediatrics OPD rotations', 'Assisted in **120+ surgical procedures** including appendectomy, hernia repair & laparoscopy', 'Rotated through ICU — monitored critically ill patients, administered IV drugs & ABG analysis'] },
      { title: 'Clinical Research Intern', company: 'ICMR', location: 'New Delhi', duration: 'May–Jul 2022', bullets: ['Collected & analysed data for TB drug resistance study across 3 Delhi hospitals (**n=250**)'] },
    ],
    skills: { technical: ['Clinical Diagnosis', 'ECG Interpretation', 'Suturing & Minor Surgery', 'ABG Analysis', 'IV Cannulation'], tools: ['SPSS', 'EHR (Epic)', 'PubMed', 'Zotero'], soft: ['Patient Communication', 'Emergency Response', 'Team Collaboration'], languages: ['English', 'Hindi', 'Tamil'] },
    projects: [
      { name: 'Community Health Survey — Rural Tamil Nadu', tech: 'Field Study, SPSS', duration: '2022', bullets: ['Screened **500+ residents** for hypertension & diabetes; presented findings at State Health Conference'], link: '' },
    ],
    achievements: ['AIIMS MBBS University Gold Medal 2023', 'NEET UG 2018 — AIR 312 (Top 0.03% of 1.5M candidates)', '2 Research papers published in PubMed-indexed journals'],
    certifications: ['BLS & ACLS Certified (AHA 2023)', 'Diploma in Diabetology — RSSDI (2024)', 'Certificate in Research Methodology — AIIMS (2022)'],
    publications: ['Iyer S. et al. "Antimicrobial resistance patterns in ICU-acquired infections". Indian J Med Res. 2023', 'Iyer S. et al. "Prevalence of type-2 DM in rural Tamil Nadu". JAPI. 2022'],
    extraCurricular: ['NSS Coordinator — organised 4 rural health camps screening 800+ villagers', 'Captain, Inter-AIIMS cricket team 2021–22'],
    personalDetails: { dob: '5 Mar 2001', nationality: 'Indian', languages: ['English', 'Hindi', 'Tamil'] },
  },
  mba: {
    personalInfo: { name: 'Rohan Kapoor', email: 'rohan.kapoor@email.com', phone: '+91 98112 34567', location: 'Mumbai', linkedin: 'linkedin.com/in/rohankapoor' },
    profileSummary: 'MBA (Finance & Strategy) from IIM Ahmedabad with 4 years of pre-MBA experience at McKinsey & Deloitte. Proven track record in M&A advisory, market entry strategy and P&L ownership. Seeking leadership roles in strategy or investment banking.',
    education: [
      { degree: 'MBA — Finance & Strategy', institution: 'IIM Ahmedabad', location: 'Ahmedabad', year: '2022–2024', score: '3.8/4.0 GPA', honors: 'Dean\'s List' },
      { degree: 'B.Com (Hons)', institution: 'SRCC, Delhi University', location: 'Delhi', year: '2015–2018', score: '91.3%', honors: 'University Rank 3' },
    ],
    experience: [
      { title: 'Strategy Consultant', company: 'McKinsey & Company', location: 'Mumbai', duration: 'Jul 2024 – Present', bullets: ['Led **₹850Cr market entry** strategy for FMCG client expanding into Tier-2 cities — identified **3 whitespace** opportunities', 'Built financial models for **M&A due diligence** on 2 deals totalling **$120M** in transaction value', 'Managed team of **3 analysts** across 6-week engagement; delivered final deck to CEO & CFO'] },
      { title: 'Business Analyst', company: 'Deloitte Consulting', location: 'Bangalore', duration: 'Jul 2018 – Jul 2022', bullets: ['Drove **22% cost reduction** for telecom client by redesigning vendor procurement process', 'Developed go-to-market plan for SaaS product launch; achieved **₹12Cr ARR** in Year 1'] },
    ],
    skills: { technical: ['Financial Modelling', 'DCF & LBO Valuation', 'Market Sizing', 'Strategic Planning', 'P&L Management'], tools: ['Excel', 'PowerPoint', 'Tableau', 'SQL', 'Bloomberg'], soft: ['Executive Communication', 'Stakeholder Management', 'Team Leadership'], languages: ['English (Fluent)', 'Hindi (Native)', 'French (Basic)'] },
    projects: [{ name: 'Turnaround Strategy — Retail Chain', tech: 'Case Competition, IIM-A', duration: '2023', bullets: ['Won IIM-A Consulting Challenge 2023 — proposed ₹200Cr cost-restructuring plan for failing retail chain'], link: '' }],
    achievements: ['Winner — IIM-A Consulting Challenge 2023 (National)', 'CAT 2021 — 99.7 percentile (AIR ~200)', 'Best Paper Award — Finance Conference, IIM-A 2023'],
    certifications: ['CFA Level II Candidate (2024)', 'Google Analytics Certified (2023)', 'Financial Modelling & Valuation Analyst (FMVA) — CFI (2022)'],
    publications: [],
    extraCurricular: ['Consulting Club Head, IIM-A — led **8 workshops** for 200+ students & placed **14 members** at top firms', 'Marathon runner — completed Mumbai & Delhi full marathons 2022–23'],
    personalDetails: { dob: '14 Aug 1997', nationality: 'Indian', languages: ['English', 'Hindi', 'French'] },
  },
  law: {
    personalInfo: { name: 'Priya Nair', email: 'priya.nair@email.com', phone: '+91 97654 32109', location: 'New Delhi', linkedin: 'linkedin.com/in/priyanair' },
    profileSummary: 'B.A. LLB (Hons) graduate from NLSIU Bangalore with a specialisation in Corporate & Commercial Law. Completed clerkship at the Supreme Court of India under Justice A.K. Singh. Strong research background with publications in peer-reviewed law journals and moot court victories at national level.',
    education: [
      { degree: 'B.A. LLB (Hons)', institution: 'NLSIU Bangalore', location: 'Bangalore', year: '2018–2023', score: '8.1/9 CGPA', honors: 'Corporate Law Specialisation' },
      { degree: 'Class XII (CBSE)', institution: 'Carmel Convent School', location: 'Kochi', year: '2018', score: '94.2%', honors: '' },
    ],
    experience: [
      { title: 'Associate', company: 'AZB & Partners', location: 'New Delhi', duration: 'Aug 2023 – Present', bullets: ['Drafted **20+ transactional documents** including SPAs, SHA & term sheets for M&A and PE transactions', 'Advised on regulatory compliance for **3 foreign direct investment** matters under FEMA & SEBI regulations', 'Conducted due diligence for **₹450Cr acquisition** — reviewed 300+ documents across 8 legal workstreams'] },
      { title: 'Law Clerk', company: 'Supreme Court of India', location: 'New Delhi', duration: 'Jun–Dec 2022', bullets: ['Drafted bench memos & case summaries for **40+ constitutional matters** before the Hon\'ble Justice', 'Researched comparative law positions for landmark **right-to-privacy** and **data protection** hearings'] },
    ],
    skills: { technical: ['Corporate Law', 'M&A & PE Transactions', 'SEBI & FEMA Compliance', 'Contract Drafting', 'Constitutional Law'], tools: ['Manupatra', 'SCC Online', 'Westlaw', 'LexisNexis', 'MS Word (Track Changes)'], soft: ['Legal Research', 'Client Advisory', 'Oral Argumentation'], languages: ['English (Fluent)', 'Hindi', 'Malayalam'] },
    projects: [{ name: 'Data Protection Bill — Comparative Study', tech: 'Research Paper, NLSIU', duration: '2022', bullets: ['Published analysis comparing India\'s DPDP Act with EU GDPR — cited by 2 legal practitioners in submissions'], link: '' }],
    achievements: ['1st Place — NLSIU National Moot Court Competition 2022', 'Best Researcher — Jessup International Law Moot 2021 (National Rounds)', 'Recipient — Bar Council of India Scholarship 2020'],
    certifications: ['Certificate in Corporate Law Practice — ICSI (2023)', 'Arbitration & Mediation Training — ICADR Delhi (2022)', 'Enrolled Advocate — Bar Council of Delhi (2023)'],
    publications: ['Nair P. "Data Sovereignty and Cross-Border Transfers under India\'s DPDP Act". NLU Law Review. 2023', 'Nair P. "Judicial Review of Arbitral Awards in India". IJIL. 2022'],
    extraCurricular: ['Editor-in-Chief, NLSIU Law Review 2022–23', 'Legal Aid Volunteer — provided free consultation to **200+ underprivileged clients** via campus clinic'],
    personalDetails: { dob: '3 Nov 2000', nationality: 'Indian', languages: ['English', 'Hindi', 'Malayalam'] },
  },
  ca_finance: {
    personalInfo: { name: 'Vikram Sinha', email: 'vikram.sinha@email.com', phone: '+91 98234 56789', location: 'Mumbai', linkedin: 'linkedin.com/in/vikramsinha' },
    profileSummary: 'Qualified Chartered Accountant (All-India Rank 38) with 5 years of experience in Big-4 audit, forensic accounting and investment banking. Deep expertise in IFRS, Ind AS, statutory audits and financial due diligence. Currently leading cross-border M&A advisory at KPMG Mumbai.',
    education: [
      { degree: 'Chartered Accountant (CA Final)', institution: 'ICAI', location: 'All India', year: '2022', score: '72% (AIR 38)', honors: 'All-India Rank 38' },
      { degree: 'B.Com (Hons)', institution: 'St. Xavier\'s College', location: 'Mumbai', year: '2015–2018', score: '89.6%', honors: 'University Rank 1' },
    ],
    experience: [
      { title: 'Senior Associate — Transaction Advisory', company: 'KPMG India', location: 'Mumbai', duration: 'Apr 2022 – Present', bullets: ['Led financial due diligence on **8 M&A transactions** totalling **₹1,200Cr** in deal value', 'Identified **₹45Cr** in off-balance sheet liabilities during cross-border acquisition QofE exercise', 'Managed team of **4 associates** across 3 concurrent engagements; delivered zero-miss on client deadlines'] },
      { title: 'Article Assistant', company: 'Deloitte Haskins & Sells', location: 'Mumbai', duration: 'Jul 2019 – Mar 2022', bullets: ['Conducted statutory audits for **15+ listed companies** under SEBI LODR — total assets **>₹5,000Cr**', 'Performed forensic investigation uncovering **₹8Cr** vendor fraud; presented findings to Audit Committee'] },
    ],
    skills: { technical: ['IFRS & Ind AS', 'Statutory Audit', 'Financial Due Diligence', 'Forensic Accounting', 'DCF & LBO Modelling'], tools: ['Tally ERP', 'SAP FICO', 'Excel (Advanced)', 'Power BI', 'Bloomberg Terminal'], soft: ['Client Management', 'Risk Assessment', 'Executive Reporting'], languages: ['English (Fluent)', 'Hindi (Native)'] },
    projects: [{ name: 'NBFC Valuation — IPO Readiness', tech: 'Excel, Bloomberg', duration: '2023', bullets: ['Built integrated 3-statement financial model for ₹300Cr NBFC ahead of planned IPO; model adopted by CFO office'], link: '' }],
    achievements: ['ICAI CA Final — All India Rank 38 (May 2022)', 'ICAI Best Article — Mumbai Regional Award 2021', 'CMA (ICMAI) — Top 10 nationally (2020)'],
    certifications: ['Chartered Accountant — ICAI (2022)', 'CFA Level III Candidate (2024)', 'Certificate in IFRS — ACCA (2023)', 'Certified Fraud Examiner (CFE) — ACFE (2023)'],
    publications: [],
    extraCurricular: ['ICAI Students\' Association Treasurer — managed ₹12L annual budget for 400-member chapter', 'Volunteer financial literacy educator — trained 300+ underprivileged youth on banking basics'],
    personalDetails: { dob: '22 Sep 1997', nationality: 'Indian', languages: ['English', 'Hindi', 'Gujarati'] },
  },
  arts: {
    personalInfo: { name: 'Anjali Desai', email: 'anjali.desai@email.com', phone: '+91 96543 21098', location: 'Delhi', linkedin: 'linkedin.com/in/anjalidesai' },
    profileSummary: 'MA Psychology graduate from Delhi University with specialisation in Counselling and Community Mental Health. 2+ years of experience in NGO programme management and psychosocial support. Strong research background with field studies in rural mental health — passionate about accessible community wellbeing.',
    education: [
      { degree: 'MA Psychology', institution: 'University of Delhi', location: 'Delhi', year: '2020–2022', score: '82.4% (1st Division)', honors: 'Counselling Specialisation' },
      { degree: 'BA (Hons) Psychology', institution: 'Lady Shri Ram College', location: 'Delhi', year: '2017–2020', score: '87.2%', honors: 'College Rank 2' },
    ],
    experience: [
      { title: 'Programme Officer — Mental Health', company: 'iCall / TISS Mumbai', location: 'Mumbai / Remote', duration: 'Aug 2022 – Present', bullets: ['Provided **400+ hours** of individual counselling to students, professionals and survivors of domestic violence', 'Designed and delivered mental health workshops reaching **1,200+ youth** across 6 Delhi colleges', 'Trained **25 peer counsellors** using CBT and motivational interviewing frameworks'] },
      { title: 'Research Intern', company: 'NIMHANS', location: 'Bangalore', duration: 'May–Jul 2021', bullets: ['Assisted in longitudinal study on adolescent anxiety (*n = 180*); conducted structured interviews & data coding'] },
    ],
    skills: { technical: ['Cognitive Behavioural Therapy (CBT)', 'Psychosocial Assessment', 'Programme Design & Evaluation', 'Community Outreach', 'Qualitative Research'], tools: ['SPSS', 'NVivo', 'Google Forms', 'Canva', 'Zoom'], soft: ['Empathy & Active Listening', 'Conflict Resolution', 'Report Writing'], languages: ['English', 'Hindi', 'Gujarati'] },
    projects: [{ name: 'Rural Mental Health Needs Assessment — Rajasthan', tech: 'Field Research, SPSS', duration: '2021', bullets: ['Surveyed **350 households** across 4 villages; presented policy brief to District Health Officer on service gaps'], link: '' }],
    achievements: ['UGC NET — Psychology Qualified (June 2022)', 'Best Dissertation Award — DU Psychology Dept. 2022', 'iCall Counsellor of the Year 2023'],
    certifications: ['Certificate in Counselling Skills — British Association for Counselling (BACP) (2023)', 'Mental Health First Aid Trainer — MHFA England (2022)', 'Google Data Analytics Certificate (2021)'],
    publications: ['Desai A. "Perceived Social Support and Academic Stress in Delhi University Students". Psych. Research J. 2022'],
    extraCurricular: ['Founder — Mindspace Collective (Student mental health peer support group, 200+ members)', 'Volunteer Tutor — Teach For India Fellow, 2019–20'],
    personalDetails: { dob: '17 Jul 1999', nationality: 'Indian', languages: ['English', 'Hindi', 'Gujarati'] },
  },
  commerce: {
    personalInfo: { name: 'Karan Malhotra', email: 'karan.malhotra@email.com', phone: '+91 95432 10987', location: 'Delhi', linkedin: 'linkedin.com/in/karanmalhotra' },
    profileSummary: 'BBA graduate from Symbiosis Pune with 2+ years in retail operations and e-commerce category management. Drove 18% GMV growth at Myntra through data-driven merchandising and vendor development. Skilled in supply chain optimization, sales analytics and cross-functional team coordination.',
    education: [
      { degree: 'BBA — Marketing & Operations', institution: 'Symbiosis International University', location: 'Pune', year: '2019–2022', score: '8.4/10 CGPA', honors: 'Marketing Specialisation' },
      { degree: 'Class XII (CBSE)', institution: 'Modern School', location: 'New Delhi', year: '2019', score: '91.8%', honors: '' },
    ],
    experience: [
      { title: 'Category Manager — Men\'s Apparel', company: 'Myntra (Flipkart Group)', location: 'Bangalore', duration: 'Jul 2022 – Present', bullets: ['Grew men\'s apparel GMV by **18% YoY** to **₹85Cr** through optimised pricing, promotions and assortment', 'Onboarded **35 new brands** and negotiated improved margin terms saving **₹4.2Cr** annually', 'Collaborated with marketing & tech teams to launch **6 sale events** each exceeding ₹10Cr daily revenue'] },
      { title: 'Operations Intern', company: 'Reliance Retail', location: 'Mumbai', duration: 'May–Jul 2021', bullets: ['Streamlined stock replenishment process for 12-store cluster, reducing out-of-stock incidents by **27%**'] },
    ],
    skills: { technical: ['Category Management', 'GMV & Margin Optimisation', 'Vendor Development', 'Retail Analytics', 'Supply Chain Coordination'], tools: ['Excel', 'SQL', 'Tableau', 'SAP MM', 'Google Sheets'], soft: ['Negotiation', 'Cross-functional Collaboration', 'Data-driven Decision Making'], languages: ['English (Fluent)', 'Hindi (Native)', 'Punjabi'] },
    projects: [{ name: 'D2C Brand Launch Strategy', tech: 'Market Research, Excel', duration: '2022', bullets: ['Developed go-to-market plan for sustainable apparel brand — projected ₹3Cr revenue in Year 1'], link: '' }],
    achievements: ['Top Performer Q3 2023 — Myntra Category Management', 'Winner — Symbiosis National Business Plan Competition 2022', 'CAT 2022 — 94.3 percentile'],
    certifications: ['Google Analytics Individual Qualification (2023)', 'Supply Chain Management — Coursera/Rutgers (2022)', 'Excel Expert — Microsoft (2021)'],
    publications: [],
    extraCurricular: ['Marketing Head — Symbiosis Business Club (organized 4 corporate conclaves with 500+ attendees)', 'Captain — College football team; Inter-university runners-up 2021'],
    personalDetails: { dob: '29 Jan 2001', nationality: 'Indian', languages: ['English', 'Hindi', 'Punjabi'] },
  },
  government: {
    personalInfo: { name: 'Ananya Krishnan', email: 'ananya.krishnan@email.com', phone: '+91 94321 09876', location: 'Chennai' },
    profileSummary: 'UPSC CSE aspirant with B.A. (Hons) Political Science from St. Stephen\'s College, Delhi — CGPA 9.1. Cleared UPSC Prelims 2023 and currently preparing for Mains. Completed internships at Ministry of Finance and NITI Aayog. Active in NSS and social welfare activities with strong research & analytical skills.',
    education: [
      { degree: 'B.A. (Hons) Political Science', institution: 'St. Stephen\'s College, Delhi', location: 'New Delhi', year: '2019–2022', score: '9.1/10 CGPA', honors: 'Top of Batch' },
      { degree: 'Class XII (CBSE)', institution: 'DAV Public School', location: 'Chennai', year: '2019', score: '97.8%', honors: 'State Rank 4 (CBSE Tamil Nadu)' },
    ],
    experience: [
      { title: 'Research Intern', company: 'NITI Aayog', location: 'New Delhi', duration: 'May–Jul 2022', bullets: ['Assisted in drafting policy brief on rural sanitation for Swachh Bharat Mission Phase-2 (**reviewed by Director**)', 'Compiled and analysed state-level WASH data for **28 states** — findings presented in quarterly review meeting'] },
      { title: 'Legislative Intern', company: 'Ministry of Finance (Budget Division)', location: 'New Delhi', duration: 'Dec 2021 – Jan 2022', bullets: ['Researched fiscal consolidation strategies across **15 countries** for budget pre-consultations document'] },
    ],
    skills: { technical: ['Public Policy Analysis', 'Constitutional Law', 'Essay Writing & Precis', 'Data Interpretation', 'Report Drafting'], tools: ['MS Office', 'SPSS', 'Google Workspace', 'PRS Legislative Research'], soft: ['Critical Thinking', 'Communication', 'Leadership'], languages: ['English (Fluent)', 'Hindi (Fluent)', 'Tamil (Native)'] },
    projects: [{ name: 'Urban Local Body Governance — Comparative Study', tech: 'Research Paper, StSC', duration: '2022', bullets: ['Published comparative analysis of municipal governance in Chennai vs. Ahmedabad — cited in PRS Legislative blog'], link: '' }],
    achievements: ['UPSC CSE 2023 Prelims Cleared', 'State Rank 4 — CBSE Class XII Tamil Nadu 2019', 'Best Debater — Inter-college Political Debate, Delhi 2021 & 2022'],
    certifications: ['Certificate in Public Policy — NLSIU/IIM-B Joint Programme (2022)', 'NCC \'B\' Certificate — Army Wing (2021)', 'NSS Special Camp Certificate (2021)'],
    publications: ['Krishnan A. "Decentralisation and Urban Governance in India". St. Stephen\'s Journal of Social Sciences. 2022'],
    extraCurricular: ['NSS Programme Officer — led **12 community camps** benefiting 400+ villagers in Haryana', 'Captain, Inter-college Debate Team — 3 national-level trophies', 'NCC Cadet of the Year (2021)'],
    personalDetails: { dob: '11 Apr 2001', nationality: 'Indian', languages: ['English', 'Hindi', 'Tamil', 'Sanskrit (Basic)'] },
  },
};

/* Fallback to engineering data for any unmapped stream */
const PREVIEW_SAMPLE_DATA = STREAM_PREVIEW_DATA.engineering;

function TemplatePreviewLive({ layout, accent, accentLight, accentDark, streamId, templateSections }) {
  const PREV_W = 794;
  const PREV_SCALE = 0.30;
  const DISPLAY_W = Math.round(PREV_W * PREV_SCALE);
  const DISPLAY_H = Math.round(DISPLAY_W * 1.35);

  // Use field-specific sample data
  const previewData = STREAM_PREVIEW_DATA[streamId] || STREAM_PREVIEW_DATA.engineering;

  // Use the actual template's selectedSections if available, else fall back to layout defaults
  const previewSections = templateSections
    ? templateSections.map(s => ({ ...s, visible: true }))
    : (TEMPLATE_SECTIONS[layout] || DEFAULT_SECTIONS).map(s => ({ ...s, visible: true }));

  return (
    <div style={{
      width: DISPLAY_W,
      height: DISPLAY_H,
      overflow: 'hidden',
      borderRadius: 3,
      boxShadow: '0 3px 16px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)',
      background: '#fff',
      flexShrink: 0,
    }}>
      <div style={{
        width: PREV_W,
        transform: `scale(${PREV_SCALE})`,
        transformOrigin: 'top left',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        <ResumeRenderer
          data={previewData}
          template={{ layout, accent, accentLight, accentDark }}
          sections={previewSections}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   RESUME TEMPLATE RENDERERS — 5 Professional Indian Formats
──────────────────────────────────────────────────────────────── */

/* Shared helpers used across all templates */
function RBulletList({ items, fontSize = 9.8, color = '#2d2d2d', markerColor }) {
  if (!items?.length) return null;
  // Render **bold** and _italic_ inline markers from AI-generated bullets
  function renderBullet(text) {
    const parts = [];
    let remaining = text;
    let key = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/_(.+?)_/);
      const nextBold = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity;
      const nextItalic = italicMatch ? remaining.indexOf(italicMatch[0]) : Infinity;
      if (boldMatch && nextBold <= nextItalic) {
        if (nextBold > 0) parts.push(<span key={key++}>{remaining.slice(0, nextBold)}</span>);
        parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(nextBold + boldMatch[0].length);
      } else if (italicMatch && nextItalic < Infinity) {
        if (nextItalic > 0) parts.push(<span key={key++}>{remaining.slice(0, nextItalic)}</span>);
        parts.push(<em key={key++}>{italicMatch[1]}</em>);
        remaining = remaining.slice(nextItalic + italicMatch[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }
    return parts;
  }
  return (
    <div style={{ marginTop: 3 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 2.5, alignItems: 'flex-start' }}>
          <span style={{ color: markerColor || '#666', fontSize: fontSize + 1, lineHeight: 1.35, flexShrink: 0, marginTop: 0.5 }}>▸</span>
          <span style={{ fontSize, color, lineHeight: 1.5 }}>{renderBullet(item)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── SHARED EDUCATION TABLE — used in ALL templates ── */
function EducationTable({ data, accent, accentLight, accentDark, variant = 'default', hideSpecialization = false, hideScore = false }) {
  if (!data?.education?.length) return null;

  // Variant styles per template family
  const V = {
    default: {
      headerBg: accentLight || '#f0f4ff',
      headerColor: accentDark || accent,
      headerBorder: `1.5px solid ${accent}`,
      rowBorder: `1px solid ${accentLight || '#e8eaf0'}`,
      altBg: 'rgba(0,0,0,0.018)',
      yearColor: accent,
      degreeWeight: 700,
    },
    minimal: {
      headerBg: '#f5f5f5',
      headerColor: '#555',
      headerBorder: '1px solid #ddd',
      rowBorder: '1px solid #eee',
      altBg: '#fafafa',
      yearColor: accent,
      degreeWeight: 700,
    },
    bold: {
      headerBg: `linear-gradient(90deg, ${accentDark || accent}, ${accent}dd)`,
      headerColor: '#fff',
      headerBorder: 'none',
      rowBorder: `1px solid ${accentLight || '#eee'}`,
      altBg: accentLight || '#f8f8ff',
      yearColor: accentDark || accent,
      degreeWeight: 700,
    },
    academic: {
      headerBg: accentLight || '#eef0f8',
      headerColor: accentDark || accent,
      headerBorder: `1px solid ${accent}`,
      rowBorder: `1px solid ${accentLight || '#e0e0e0'}`,
      altBg: 'rgba(0,0,0,0.015)',
      yearColor: accent,
      degreeWeight: 700,
    },
  };
  const s = V[variant] || V.default;

  // Col widths — always sum to exactly 100% across visible columns
  const allCols = [
    { label: 'Qualification / Degree', key: 'degree',  baseW: 25 },
    { label: 'Institution',            key: 'inst',    baseW: 25 },
    { label: 'Year',                   key: 'year',    baseW: 10 },
    { label: 'Score / CGPA',           key: 'score',   baseW: 14, hide: hideScore },
    { label: 'Specialization / Honors',key: 'honors',  baseW: 26, hide: hideSpecialization },
  ];
  const cols = allCols.filter(c => !c.hide);
  const hiddenTotal = allCols.filter(c => c.hide).reduce((s, c) => s + c.baseW, 0);
  const visTotal    = cols.reduce((s, c) => s + c.baseW, 0);
  const rawWidths   = cols.map(c => c.baseW + hiddenTotal * (c.baseW / visTotal));
  const floorWidths = rawWidths.map(w => Math.floor(w));
  const remainder   = 100 - floorWidths.reduce((a, b) => a + b, 0);
  const largestIdx  = rawWidths.indexOf(Math.max(...rawWidths));
  const colWidths   = floorWidths.map((w, i) => i === largestIdx ? w + remainder : w);

  const thStyle = {
    padding: '3px 4px',
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'left',
    background: variant === 'bold' ? undefined : s.headerBg,
    color: s.headerColor,
    borderBottom: `1.5px solid ${accent}`,
    whiteSpace: 'normal',      // allow wrapping so headers don't overflow
    wordBreak: 'break-word',
    lineHeight: 1.2,
  };

  return (
    <div style={{ marginTop: 4, overflowX: 'hidden' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 9,
        tableLayout: 'fixed',
      }}>
        <colgroup>
          {cols.map((c, i) => <col key={c.key} style={{ width: `${colWidths[i]}%` }} />)}
        </colgroup>
        <thead>
          <tr style={variant === 'bold' ? {
            background: `linear-gradient(90deg, ${accentDark || accent}, ${accent}dd)`,
          } : {}}>
            {cols.map(c => (
              <th key={c.key} style={thStyle}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.education.map((e, i) => {
            // Clean score: strip trailing " CGPA", " GPA", " cgpa" etc.
            const cleanScore = (e.score || '—').replace(/\s*(cgpa|gpa)\s*$/i, '').trim();
            // Clean honors: strip leading "Specialization:" or "Specialisation:" prefix
            const cleanHonors = (e.honors || '—').replace(/^(speciali[sz]ation\s*:?\s*)/i, '').trim() || '—';
            return (
            <tr key={i} style={{
              background: i % 2 === 1 ? s.altBg : 'transparent',
              borderBottom: s.rowBorder,
            }}>
              {/* Degree */}
              <td style={{ padding: '3px 4px', fontWeight: s.degreeWeight, fontSize: 8.5, color: '#1a1a1a', lineHeight: 1.3, verticalAlign: 'top', wordBreak: 'break-word' }}>
                {e.degree || '—'}
              </td>
              {/* Institution */}
              <td style={{ padding: '3px 4px', fontSize: 8.5, color: '#333', lineHeight: 1.3, verticalAlign: 'top', wordBreak: 'break-word' }}>
                {e.institution || '—'}{e.location ? `, ${e.location}` : ''}
              </td>
              {/* Year */}
              <td style={{ padding: '3px 4px', fontSize: 8.5, color: s.yearColor, fontWeight: 600, verticalAlign: 'top', wordBreak: 'break-word' }}>
                {e.year || '—'}
              </td>
              {/* Score — hidden if hideScore */}
              {!hideScore && (
                <td style={{ padding: '3px 4px', fontSize: 8.5, color: '#444', fontWeight: e.score ? 600 : 400, verticalAlign: 'top' }}>
                  {cleanScore}
                </td>
              )}
              {/* Honors / Specialization — hidden if hideSpecialization */}
              {!hideSpecialization && (
                <td style={{ padding: '3px 4px', fontSize: 8.5, color: '#555', lineHeight: 1.3, verticalAlign: 'top', wordBreak: 'break-word' }}>
                  {cleanHonors}
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── TEMPLATE 1: CLASSIC ── */
/* ── SECTION DEFINITIONS PER TEMPLATE LAYOUT ── */
const TEMPLATE_SECTIONS = {
  classic: [
    { key: 'summary',        label: 'Professional Summary' },
    { key: 'education',      label: 'Education' },
    { key: 'experience',     label: 'Work Experience' },
    { key: 'projects',       label: 'Projects' },
    { key: 'skills',         label: 'Technical Skills' },
    { key: 'achievements',   label: 'Achievements & Awards' },
    { key: 'certifications', label: 'Certifications' },
    { key: 'extraCurricular',label: 'Extra-Curricular Activities' },
    { key: 'personalDetails',label: 'Personal Details' },
  ],
  'two-column': [
    { key: 'summary',          label: 'Profile Summary',             column: 'main' },
    { key: 'experience',       label: 'Work Experience',             column: 'main' },
    { key: 'education',        label: 'Education',                   column: 'main' },
    { key: 'projects',         label: 'Projects',                    column: 'main' },
    { key: 'extraCurricular',  label: 'Extra-Curricular Activities', column: 'main' },
    { key: 'skills',           label: 'Technical Skills',            column: 'sidebar' },
    { key: 'skills_tools',     label: 'Tools & Platforms',           column: 'sidebar' },
    { key: 'skills_soft',      label: 'Soft Skills',                 column: 'sidebar' },
    { key: 'skills_languages', label: 'Languages',                   column: 'sidebar' },
    { key: 'certifications',   label: 'Certifications',              column: 'sidebar' },
    { key: 'achievements',     label: 'Achievements',                column: 'sidebar' },
    { key: 'personalDetails',  label: 'Personal Details',            column: 'sidebar' },
  ],
  minimal: [
    { key: 'summary',        label: 'Profile' },
    { key: 'experience',     label: 'Experience' },
    { key: 'education',      label: 'Education' },
    { key: 'projects',       label: 'Projects' },
    { key: 'skills',         label: 'Skills' },
    { key: 'achievements',   label: 'Achievements' },
    { key: 'certifications', label: 'Certifications' },
    { key: 'extraCurricular',label: 'Extra-Curricular' },
    { key: 'personalDetails',label: 'Personal Details' },
  ],
  bold: [
    { key: 'summary',        label: 'Professional Summary' },
    { key: 'experience',     label: 'Work Experience' },
    { key: 'education',      label: 'Education' },
    { key: 'projects',       label: 'Projects' },
    { key: 'skills',         label: 'Skills' },
    { key: 'achievements',   label: 'Achievements & Awards' },
    { key: 'certifications', label: 'Certifications' },
    { key: 'extraCurricular',label: 'Extra-Curricular Activities' },
    { key: 'personalDetails',label: 'Personal Details' },
  ],
  academic: [
    { key: 'summary',        label: 'Profile Summary' },
    { key: 'education',      label: 'Academic Background' },
    { key: 'experience',     label: 'Professional Experience' },
    { key: 'projects',       label: 'Research / Projects' },
    { key: 'skills',         label: 'Skills & Competencies' },
    { key: 'achievements',   label: 'Awards & Achievements' },
    { key: 'certifications', label: 'Certifications & Courses' },
    { key: 'extraCurricular',label: 'Positions of Responsibility & Activities' },
    { key: 'personalDetails',label: 'Personal Information' },
  ],
};

/* Fallback for unknown layouts */
const DEFAULT_SECTIONS = TEMPLATE_SECTIONS.classic;

function isVisible(sections, key) {
  if (!sections) return true; // default: all visible
  const found = sections.find(s => s.key === key);
  return found ? found.visible !== false : false; // new custom sections default visible
}
function sectionLabel(sections, key, fallback) {
  if (!sections) return fallback;
  const found = sections.find(s => s.key === key);
  return (found && found.label) || fallback;
}
// Get any user-added custom sections that have no matching template render block
function getCustomSections(sections) {
  if (!sections) return [];
  const KNOWN_KEYS = new Set(['summary','education','experience','projects','skills','skills_tools','skills_soft','skills_languages','achievements','certifications','extraCurricular','personalDetails']);
  return sections.filter(s => !KNOWN_KEYS.has(s.key) && s.visible !== false);
}

function ClassicTemplate({ data, accent, accentLight, accentDark, sections, hideSpecialization = false, hideScore = false }) {
  const p = data?.personalInfo || {};
  const S = ({ title }) => (
    <div style={{ marginTop: 9, marginBottom: 3 }}>
      <div style={{ fontSize: 10.4, fontWeight: 700, color: accentDark || accent, textTransform: 'uppercase', letterSpacing: '1.8px', paddingBottom: 2, borderBottom: `1.5px solid ${accent}` }}>
        {title}
      </div>
    </div>
  );
  const contactParts = [p.email, p.phone, p.location, p.linkedin, p.github].filter(Boolean);

  // Render a section block by key — drives the order from sections array
  const renderBlock = (key, label) => {
    switch(key) {
      case 'summary': return data?.profileSummary ? (
        <div key={key}><S title={label} /><p style={{ fontSize: 9, color: '#2d2d2d', lineHeight: 1.5, margin: '3px 0 0', textAlign: 'justify' }}>{data.profileSummary}</p></div>
      ) : null;
      case 'education': return data?.education?.length > 0 ? (
        <div key={key}><S title={label} /><EducationTable data={data} accent={accent} accentLight={accentLight} accentDark={accentDark} variant="default" hideSpecialization={hideSpecialization} hideScore={hideScore} /></div>
      ) : null;
      case 'experience': return data?.experience?.length > 0 ? (
        <div key={key}><S title={label} />{data.experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}><span style={{ fontWeight: 700, fontSize: 10.9 }}>{exp.title}</span>{exp.company && <span style={{ color: '#333' }}> — {exp.company}{exp.location ? `, ${exp.location}` : ''}</span>}</div>
              <span style={{ fontSize: 9.8, color: accent, fontWeight: 600, flexShrink: 0, marginLeft: 8, whiteSpace: 'nowrap' }}>{exp.duration}</span>
            </div>
            <RBulletList items={exp.bullets} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'projects': return data?.projects?.length > 0 ? (
        <div key={key}><S title={label} />{data.projects.map((proj, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div><span style={{ fontWeight: 700, fontSize: 10.9 }}>{proj.name}</span>{proj.tech && <span style={{ fontSize: 9.8, color: '#555', fontStyle: 'italic' }}> | {proj.tech}</span>}</div>
              <span style={{ fontSize: 9.8, color: '#666', flexShrink: 0, marginLeft: 8 }}>{proj.duration}</span>
            </div>
            {proj.link && <div style={{ fontSize: 9.8, color: accent, marginTop: 1 }}>{proj.link}</div>}
            <RBulletList items={proj.bullets} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'skills': return (data?.skills?.technical?.length > 0 || data?.skills?.tools?.length > 0) ? (
        <div key={key}><S title={label} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px', marginTop: 3 }}>
          {data.skills.technical?.length > 0 && <div style={{ fontSize: 9 }}><strong>Technical: </strong>{data.skills.technical.join(', ')}</div>}
          {data.skills.tools?.length > 0 && <div style={{ fontSize: 9 }}><strong>Tools: </strong>{data.skills.tools.join(', ')}</div>}
          {data.skills.soft?.length > 0 && <div style={{ fontSize: 9 }}><strong>Soft Skills: </strong>{data.skills.soft.join(', ')}</div>}
          {data.skills.languages?.length > 0 && <div style={{ fontSize: 9 }}><strong>Languages: </strong>{data.skills.languages.join(', ')}</div>}
        </div></div>
      ) : null;
      case 'skills_tools': return data?.skills?.tools?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.tools} markerColor={accent} /></div>
      ) : null;
      case 'skills_soft': return data?.skills?.soft?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.soft} markerColor={accent} /></div>
      ) : null;
      case 'skills_languages': return data?.skills?.languages?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.languages} markerColor={accent} /></div>
      ) : null;
      case 'achievements': return data?.achievements?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.achievements} markerColor={accent} /></div>
      ) : null;
      case 'certifications': return data?.certifications?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.certifications} markerColor={accent} /></div>
      ) : null;
      case 'extraCurricular': return data?.extraCurricular?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.extraCurricular} markerColor={accent} /></div>
      ) : null;
      case 'personalDetails': return data?.personalDetails && (data.personalDetails.dob || data.personalDetails.nationality) ? (
        <div key={key}><S title={label} /><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 3, fontSize: 9 }}>
          {data.personalDetails.dob && <span><strong>Date of Birth:</strong> {data.personalDetails.dob}</span>}
          {data.personalDetails.nationality && <span><strong>Nationality:</strong> {data.personalDetails.nationality}</span>}
          {data.personalDetails.languages?.length > 0 && <span><strong>Languages Known:</strong> {data.personalDetails.languages.join(', ')}</span>}
        </div></div>
      ) : null;
      default: return (
        <div key={key}><S title={label} />{(() => {
          const cs = data?.customSections?.find(s => s.key === key);
          const bullets = cs?.bullets || [];
          return bullets.length > 0
            ? <RBulletList items={bullets} markerColor={accent} />
            : <div style={{ fontSize: 9.8, color: '#888', fontStyle: 'italic', marginTop: 3 }}>Generating content...</div>;
        })()}</div>
      );
    }
  };

  // Get ordered, visible sections
  const orderedSections = sections
    ? sections.filter(s => s.visible !== false && !s.deleted)
    : TEMPLATE_SECTIONS.classic;

  return (
    <div style={{ padding: '22px 32px 20px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.8, color: '#1a1a1a', lineHeight: 1.38, background: '#fff' }}>
      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: 9 }}>
        <div style={{ fontSize: 19.7, fontWeight: 700, color: accentDark || '#111', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>{p.name || 'Your Name'}</div>
        <div style={{ fontSize: 9.8, color: '#555', letterSpacing: '0.3px' }}>{contactParts.join('  •  ')}</div>
        {p.website && <div style={{ fontSize: 9.8, color: accent, marginTop: 2 }}>{p.website}</div>}
      </div>
      <div style={{ borderBottom: `2px solid ${accent}`, marginBottom: 3 }} />
      {orderedSections.map(sec => renderBlock(sec.key, sec.label))}
    </div>
  );
}

/* ── TEMPLATE 2: TWO-COLUMN ── */
function TwoColumnTemplate({ data, accent, accentLight, accentDark, sections, hideSpecialization = false, hideScore = false }) {
  const p = data?.personalInfo || {};

  // Exact pixel math: sidebar=186, border=2, main-padding=14×2 → main content = 794-186-2-28 = 578px
  const SIDEBAR_W = 186;
  const MAIN_PAD  = 14;
  const MAIN_W    = 794 - SIDEBAR_W - 2 - (MAIN_PAD * 2); // 578px

  const SideHead = ({ title }) => (
    <div style={{
      fontSize: 9, fontWeight: 700, color: accentDark || accent,
      textTransform: 'uppercase', letterSpacing: '1px',
      marginTop: 9, marginBottom: 3, paddingBottom: 2,
      borderBottom: `1.5px solid ${accent}`,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>{title}</div>
  );

  const MainHead = ({ title }) => (
    <div style={{
      fontSize: 9.5, fontWeight: 700, color: accentDark || accent,
      textTransform: 'uppercase', letterSpacing: '1.3px',
      marginTop: 10, marginBottom: 4, paddingBottom: 2,
      borderBottom: `1.5px solid ${accent}`,
    }}>{title}</div>
  );

  const DEFAULT_SIDEBAR_KEYS = new Set(['skills', 'certifications', 'achievements', 'personalDetails']);

  const renderMainBlock = (key, label) => {
    // Pre-compute which sub-skill keys are explicitly listed as separate sections
    const hasToolsSec   = orderedSections.some(s => s.key === 'skills_tools');
    const hasSoftSec    = orderedSections.some(s => s.key === 'skills_soft');
    const hasLangSec    = orderedSections.some(s => s.key === 'skills_languages');
    switch(key) {
      case 'summary': return data?.profileSummary ? (
        <div key={key} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#2d2d2d', lineHeight: 1.5, padding: '5px 8px', background: accentLight, border: `1px solid ${accent}22`, borderRadius: 3 }}>
            {data.profileSummary}
          </div>
        </div>
      ) : null;
      case 'experience': return data?.experience?.length > 0 ? (
        <div key={key}>
          <MainHead title={label} />
          {data.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 9.5 }}>{exp.title}</span>
                  {exp.company && <span style={{ color: '#444', fontSize: 9 }}> — {exp.company}{exp.location ? `, ${exp.location}` : ''}</span>}
                </div>
                <span style={{ fontSize: 9, color: accent, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{exp.duration}</span>
              </div>
              <RBulletList items={exp.bullets} fontSize={9} markerColor={accent} />
            </div>
          ))}
        </div>
      ) : null;
      case 'education': return data?.education?.length > 0 ? (
        <div key={key}>
          <MainHead title={label} />
          <div style={{ width: MAIN_W, maxWidth: '100%', overflow: 'hidden' }}>
            <EducationTable data={data} accent={accent} accentLight={accentLight} accentDark={accentDark} variant="default" hideSpecialization={hideSpecialization} hideScore={hideScore} />
          </div>
        </div>
      ) : null;
      case 'projects': return data?.projects?.length > 0 ? (
        <div key={key}>
          <MainHead title={label} />
          {data.projects.map((proj, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 9.5 }}>{proj.name}</span>
                  {proj.tech && <span style={{ fontSize: 8.5, color: '#555', fontStyle: 'italic' }}> | {proj.tech}</span>}
                </div>
                <span style={{ fontSize: 9, color: '#666', flexShrink: 0, whiteSpace: 'nowrap' }}>{proj.duration}</span>
              </div>
              {proj.link && <div style={{ fontSize: 8.5, color: accent, marginTop: 1, wordBreak: 'break-all' }}>{proj.link}</div>}
              <RBulletList items={proj.bullets} fontSize={9} markerColor={accent} />
            </div>
          ))}
        </div>
      ) : null;
      case 'extraCurricular': return data?.extraCurricular?.length > 0 ? (
        <div key={key}><MainHead title={label} /><RBulletList items={data.extraCurricular} fontSize={9} markerColor={accent} /></div>
      ) : null;
      case 'skills': return (data?.skills?.technical?.length > 0 || data?.skills?.tools?.length > 0) ? (
        <div key={key}>
          <MainHead title={label} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', marginTop: 2 }}>
            {data.skills.technical?.length > 0 && <div style={{ fontSize: 9 }}><strong>Technical: </strong>{data.skills.technical.join(', ')}</div>}
            {!hasToolsSec && data.skills.tools?.length > 0 && <div style={{ fontSize: 9 }}><strong>Tools: </strong>{data.skills.tools.join(', ')}</div>}
            {!hasSoftSec && data.skills.soft?.length > 0 && <div style={{ fontSize: 9 }}><strong>Soft: </strong>{data.skills.soft.join(', ')}</div>}
            {!hasLangSec && data.skills.languages?.length > 0 && <div style={{ fontSize: 9 }}><strong>Languages: </strong>{data.skills.languages.join(', ')}</div>}
          </div>
        </div>
      ) : null;
      case 'skills_tools': return data?.skills?.tools?.length > 0 ? (
        <div key={key}><MainHead title={label} /><RBulletList items={data.skills.tools} fontSize={9} markerColor={accent} /></div>
      ) : null;
      case 'skills_soft': return data?.skills?.soft?.length > 0 ? (
        <div key={key}><MainHead title={label} /><RBulletList items={data.skills.soft} fontSize={9} markerColor={accent} /></div>
      ) : null;
      case 'skills_languages': return data?.skills?.languages?.length > 0 ? (
        <div key={key}><MainHead title={label} /><RBulletList items={data.skills.languages} fontSize={9} markerColor={accent} /></div>
      ) : null;
      case 'achievements': return data?.achievements?.length > 0 ? (
        <div key={key}><MainHead title={label} /><RBulletList items={data.achievements} fontSize={9} markerColor={accent} /></div>
      ) : null;
      case 'certifications': return data?.certifications?.length > 0 ? (
        <div key={key}><MainHead title={label} /><RBulletList items={data.certifications} fontSize={9} markerColor={accent} /></div>
      ) : null;
      default: {
        const cs = data?.customSections?.find(s => s.key === key);
        const bullets = cs?.bullets || [];
        return (
          <div key={key}>
            <MainHead title={label} />
            {bullets.length > 0
              ? <RBulletList items={bullets} fontSize={9} markerColor={accent} />
              : <div style={{ fontSize: 9, color: '#888', fontStyle: 'italic', marginTop: 3 }}>Generating content...</div>}
          </div>
        );
      }
    }
  };

  const orderedSections = sections
    ? sections.filter(s => s.visible !== false && !s.deleted)
    : TEMPLATE_SECTIONS['two-column'].map(s => ({ ...s, visible: true }));

  const sidebarSections = orderedSections.filter(s =>
    sections ? (s.column === 'sidebar') : DEFAULT_SIDEBAR_KEYS.has(s.key)
  );
  const mainSections = orderedSections.filter(s =>
    sections ? (s.column !== 'sidebar') : !DEFAULT_SIDEBAR_KEYS.has(s.key)
  );

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9, color: '#1a1a1a', background: '#fff', display: 'flex', minHeight: 1123, margin: 0, padding: 0 }}>

      {/* ── SIDEBAR: background flush to page edges, comfortable internal padding ── */}
      <div style={{
        width: SIDEBAR_W, flexShrink: 0,
        background: accentLight || '#f0f4ff',
        borderRight: `2px solid ${accent}`,
        padding: '16px 12px 20px 16px',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Name + contact */}
        <div style={{ marginBottom: 10, borderBottom: `1px solid ${accent}33`, paddingBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: accentDark || '#111', lineHeight: 1.25, marginBottom: 5, wordBreak: 'break-word' }}>
            {p.name || 'Your Name'}
          </div>
          {[p.email, p.phone, p.location, p.linkedin, p.github, p.website].filter(Boolean).map((item, i) => (
            <div key={i} style={{ fontSize: 8, color: '#555', marginBottom: 2.5, wordBreak: 'break-all', lineHeight: 1.3 }}>{item}</div>
          ))}
        </div>

        {sidebarSections.map(sec => {
          // Check which sub-skill keys are explicitly listed as separate sections
          const hasToolsSec   = sidebarSections.some(s => s.key === 'skills_tools');
          const hasSoftSec    = sidebarSections.some(s => s.key === 'skills_soft');
          const hasLangSec    = sidebarSections.some(s => s.key === 'skills_languages');
          switch(sec.key) {
            case 'skills': return (
              <React.Fragment key={sec.key}>
                {data?.skills?.technical?.length > 0 && (<>
                  <SideHead title={sec.label} />
                  {data.skills.technical.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35, wordBreak: 'break-word' }}>▸ {s}</div>)}
                </>)}
                {/* Only render sub-groups here if they don't have their own explicit section key */}
                {!hasToolsSec && data?.skills?.tools?.length > 0 && (<>
                  <SideHead title="Tools & Platforms" />
                  {data.skills.tools.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35, wordBreak: 'break-word' }}>▸ {s}</div>)}
                </>)}
                {!hasSoftSec && data?.skills?.soft?.length > 0 && (<>
                  <SideHead title="Soft Skills" />
                  {data.skills.soft.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35, wordBreak: 'break-word' }}>▸ {s}</div>)}
                </>)}
                {!hasLangSec && data?.skills?.languages?.length > 0 && (<>
                  <SideHead title="Languages" />
                  {data.skills.languages.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35 }}>▸ {s}</div>)}
                </>)}
              </React.Fragment>
            );
            case 'skills_tools': return data?.skills?.tools?.length > 0 ? (
              <React.Fragment key={sec.key}>
                <SideHead title={sec.label} />
                {data.skills.tools.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35, wordBreak: 'break-word' }}>▸ {s}</div>)}
              </React.Fragment>
            ) : null;
            case 'skills_soft': return data?.skills?.soft?.length > 0 ? (
              <React.Fragment key={sec.key}>
                <SideHead title={sec.label} />
                {data.skills.soft.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35, wordBreak: 'break-word' }}>▸ {s}</div>)}
              </React.Fragment>
            ) : null;
            case 'skills_languages': return data?.skills?.languages?.length > 0 ? (
              <React.Fragment key={sec.key}>
                <SideHead title={sec.label} />
                {data.skills.languages.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35 }}>▸ {s}</div>)}
              </React.Fragment>
            ) : null;
            case 'certifications': return data?.certifications?.length > 0 ? (
              <React.Fragment key={sec.key}>
                <SideHead title={sec.label} />
                {data.certifications.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 3, lineHeight: 1.35, wordBreak: 'break-word' }}>{s}</div>)}
              </React.Fragment>
            ) : null;
            case 'achievements': return data?.achievements?.length > 0 ? (
              <React.Fragment key={sec.key}>
                <SideHead title={sec.label} />
                {data.achievements.map((s, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 3, lineHeight: 1.35, wordBreak: 'break-word' }}>▸ {s}</div>)}
              </React.Fragment>
            ) : null;
            case 'personalDetails': return data?.personalDetails && (data.personalDetails.dob || data.personalDetails.nationality) ? (
              <React.Fragment key={sec.key}>
                <SideHead title={sec.label} />
                {data.personalDetails.dob && <div style={{ fontSize: 9, color: '#333', marginBottom: 2.5 }}><strong>DOB:</strong> {data.personalDetails.dob}</div>}
                {data.personalDetails.nationality && <div style={{ fontSize: 9, color: '#333', marginBottom: 2.5 }}><strong>Nationality:</strong> {data.personalDetails.nationality}</div>}
                {data.personalDetails.languages?.length > 0 && <div style={{ fontSize: 9, color: '#333', marginBottom: 2.5 }}><strong>Languages:</strong> {data.personalDetails.languages.join(', ')}</div>}
              </React.Fragment>
            ) : null;
            default: {
              const cs = data?.customSections?.find(s => s.key === sec.key);
              const bullets = cs?.bullets || [];
              return (
                <React.Fragment key={sec.key}>
                  <SideHead title={sec.label} />
                  {bullets.length > 0
                    ? bullets.map((b, i) => <div key={i} style={{ fontSize: 9, color: '#333', marginBottom: 2.5, lineHeight: 1.35, wordBreak: 'break-word' }}>▸ {b}</div>)
                    : <div style={{ fontSize: 9, color: '#888', fontStyle: 'italic' }}>Content here</div>}
                </React.Fragment>
              );
            }
          }
        })}
      </div>

      {/* ── MAIN: explicit 578px, hard-bounded ── */}
      <div style={{
        width: MAIN_W, flexShrink: 0,
        padding: `10px ${MAIN_PAD}px 16px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        {mainSections.map(sec => renderMainBlock(sec.key, sec.label))}
      </div>

    </div>
  );
}

/* ── TEMPLATE 3: MINIMAL ── */
function MinimalTemplate({ data, accent, accentLight, accentDark, sections, hideSpecialization = false, hideScore = false }) {
  const p = data?.personalInfo || {};
  const S = ({ title }) => (
    <div style={{ marginTop: 11, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 9.2, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '2px' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: '#ddd' }} />
    </div>
  );
  const contactParts = [p.email, p.phone, p.location].filter(Boolean);
  const webParts = [p.linkedin, p.github, p.website].filter(Boolean);

  const renderBlock = (key, label) => {
    switch(key) {
      case 'summary': return data?.profileSummary ? (
        <div key={key}><S title={label} /><p style={{ fontSize: 9, color: '#333', lineHeight: 1.6, margin: '3px 0 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{data.profileSummary}</p></div>
      ) : null;
      case 'education': return data?.education?.length > 0 ? (
        <div key={key}><S title={label} /><EducationTable data={data} accent={accent} accentLight={accentLight} accentDark={accentDark} variant="minimal" hideSpecialization={hideSpecialization} hideScore={hideScore} /></div>
      ) : null;
      case 'experience': return data?.experience?.length > 0 ? (
        <div key={key}><S title={label} />{data.experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 1.5 }}><div style={{ flex: 1, minWidth: 0, paddingRight: 8, fontWeight: 700, fontSize: 10.9, fontFamily: 'Arial, sans-serif' }}>{exp.title}<span style={{ fontWeight: 400, color: '#555', marginLeft: 6 }}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</span></div>
              <span style={{ fontSize: 9.8, color: '#888', flexShrink: 0, marginLeft: 10 }}>{exp.duration}</span>
            </div>
            <RBulletList items={exp.bullets} fontSize={9.7} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'projects': return data?.projects?.length > 0 ? (
        <div key={key}><S title={label} />{data.projects.map((proj, i) => (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 10.9, fontFamily: 'Arial, sans-serif' }}>{proj.name}{proj.tech && <span style={{ fontWeight: 400, fontSize: 9.8, color: '#666', marginLeft: 6 }}>({proj.tech})</span>}</div>
              <span style={{ fontSize: 9.8, color: '#888', flexShrink: 0, marginLeft: 8 }}>{proj.duration}</span>
            </div>
            {proj.link && <div style={{ fontSize: 9.2, color: accent, marginBottom: 1 }}>{proj.link}</div>}
            <RBulletList items={proj.bullets} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'skills': return (data?.skills?.technical?.length > 0 || data?.skills?.tools?.length > 0) ? (
        <div key={key}><S title={label} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 20px', marginTop: 3, fontFamily: 'Arial, sans-serif' }}>
          {data.skills.technical?.length > 0 && <div style={{ fontSize: 9 }}><span style={{ color: '#888', fontSize: 9 }}>TECHNICAL </span>{data.skills.technical.join(' · ')}</div>}
          {data.skills.tools?.length > 0 && <div style={{ fontSize: 9 }}><span style={{ color: '#888', fontSize: 9 }}>TOOLS </span>{data.skills.tools.join(' · ')}</div>}
          {data.skills.soft?.length > 0 && <div style={{ fontSize: 9 }}><span style={{ color: '#888', fontSize: 9 }}>SOFT </span>{data.skills.soft.join(' · ')}</div>}
          {data.skills.languages?.length > 0 && <div style={{ fontSize: 9 }}><span style={{ color: '#888', fontSize: 9 }}>LANGUAGES </span>{data.skills.languages.join(' · ')}</div>}
        </div></div>
      ) : null;
      case 'skills_tools': return data?.skills?.tools?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.tools} markerColor={accent} /></div>
      ) : null;
      case 'skills_soft': return data?.skills?.soft?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.soft} markerColor={accent} /></div>
      ) : null;
      case 'skills_languages': return data?.skills?.languages?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.languages} markerColor={accent} /></div>
      ) : null;
      case 'achievements': return data?.achievements?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.achievements} markerColor={accent} /></div>) : null;
      case 'certifications': return data?.certifications?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.certifications} markerColor={accent} /></div>) : null;
      case 'extraCurricular': return data?.extraCurricular?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.extraCurricular} markerColor={accent} /></div>) : null;
      case 'personalDetails': return data?.personalDetails && (data.personalDetails.dob || data.personalDetails.nationality) ? (
        <div key={key}><S title={label} /><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'Arial, sans-serif', fontSize: 9.8 }}>
          {data.personalDetails.dob && <span><span style={{ color: '#888' }}>DOB: </span>{data.personalDetails.dob}</span>}
          {data.personalDetails.nationality && <span><span style={{ color: '#888' }}>Nationality: </span>{data.personalDetails.nationality}</span>}
          {data.personalDetails.languages?.length > 0 && <span><span style={{ color: '#888' }}>Languages: </span>{data.personalDetails.languages.join(', ')}</span>}
        </div></div>
      ) : null;
      default: return (<div key={key}><S title={label} />{(() => {
          const cs = data?.customSections?.find(s => s.key === key);
          const bullets = cs?.bullets || [];
          return bullets.length > 0
            ? <RBulletList items={bullets} markerColor={accent} />
            : <div style={{ fontSize: 9.8, color: '#888', fontStyle: 'italic', marginTop: 3 }}>Generating content...</div>;
        })()}</div>);
    }
  };

  const orderedSections = sections ? sections.filter(s => s.visible !== false && !s.deleted) : TEMPLATE_SECTIONS.minimal;

  return (
    <div style={{ padding: '26px 36px', fontFamily: 'Georgia, Times New Roman, serif', fontSize: 9.8, color: '#1a1a1a', lineHeight: 1.42, background: '#fff' }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 21.9, fontWeight: 400, color: '#111', letterSpacing: '-0.5px', marginBottom: 4, fontFamily: 'Georgia, serif' }}>{p.name || 'Your Name'}</div>
        {contactParts.length > 0 && <div style={{ fontSize: 9.8, color: '#666', fontFamily: 'Arial, sans-serif', marginBottom: 2 }}>{contactParts.join('   ·   ')}</div>}
        {webParts.length > 0 && <div style={{ fontSize: 9.8, color: accent, fontFamily: 'Arial, sans-serif' }}>{webParts.join('   ·   ')}</div>}
      </div>
      {orderedSections.map(sec => renderBlock(sec.key, sec.label))}
    </div>
  );
}
/* ── TEMPLATE 4: BOLD ── */
function BoldTemplate({ data, accent, accentLight, accentDark, sections, hideSpecialization = false, hideScore = false }) {
  const p = data?.personalInfo || {};
  const S = ({ title }) => (
    <div style={{ marginTop: 9, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: 10.4, fontWeight: 700, color: accentDark || accent, textTransform: 'uppercase', letterSpacing: '1.8px' }}>{title}</div>
        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to right, ${accent}, transparent)` }} />
      </div>
    </div>
  );
  const contactParts = [p.email, p.phone, p.location, p.linkedin, p.github].filter(Boolean);

  const renderBlock = (key, label) => {
    switch(key) {
      case 'summary': return data?.profileSummary ? (
        <div key={key}><div style={{ padding: '7px 11px', background: accentLight, border: `1.5px solid ${accent}40`, borderLeft: `4px solid ${accent}`, borderRadius: 3, marginBottom: 3, marginTop: 4 }}>
          <p style={{ fontSize: 9, color: '#2d2d2d', lineHeight: 1.55, margin: 0 }}>{data.profileSummary}</p>
        </div></div>
      ) : null;
      case 'education': return data?.education?.length > 0 ? (
        <div key={key}><S title={label} /><EducationTable data={data} accent={accent} accentLight={accentLight} accentDark={accentDark} variant="bold" hideSpecialization={hideSpecialization} hideScore={hideScore} /></div>
      ) : null;
      case 'experience': return data?.experience?.length > 0 ? (
        <div key={key}><S title={label} />{data.experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}><span style={{ fontWeight: 700, fontSize: 10.9, color: accentDark || accent }}>{exp.title}</span>{exp.company && <span style={{ color: '#333', fontSize: 9.8 }}> — {exp.company}{exp.location ? `, ${exp.location}` : ''}</span>}</div>
              <span style={{ fontSize: 9.8, background: accentLight, color: accentDark || accent, fontWeight: 700, padding: '1px 6px', borderRadius: 2, flexShrink: 0, marginLeft: 8, whiteSpace: 'nowrap' }}>{exp.duration}</span>
            </div>
            <RBulletList items={exp.bullets} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'projects': return data?.projects?.length > 0 ? (
        <div key={key}><S title={label} />{data.projects.map((proj, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div><span style={{ fontWeight: 700, fontSize: 10.9, color: accentDark || accent }}>{proj.name}</span>{proj.tech && <span style={{ fontSize: 9.8, color: '#555', fontStyle: 'italic' }}> | {proj.tech}</span>}</div>
              <span style={{ fontSize: 9.8, color: '#666', flexShrink: 0, marginLeft: 8 }}>{proj.duration}</span>
            </div>
            {proj.link && <div style={{ fontSize: 9.2, color: accent, marginTop: 1 }}>{proj.link}</div>}
            <RBulletList items={proj.bullets} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'skills': return (data?.skills?.technical?.length > 0 || data?.skills?.tools?.length > 0) ? (
        <div key={key}><S title={label} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px', marginTop: 3 }}>
          {data.skills.technical?.length > 0 && <div style={{ fontSize: 9 }}><strong style={{ color: accentDark || accent }}>Technical: </strong>{data.skills.technical.join(', ')}</div>}
          {data.skills.tools?.length > 0 && <div style={{ fontSize: 9 }}><strong style={{ color: accentDark || accent }}>Tools: </strong>{data.skills.tools.join(', ')}</div>}
          {data.skills.soft?.length > 0 && <div style={{ fontSize: 9 }}><strong style={{ color: accentDark || accent }}>Soft Skills: </strong>{data.skills.soft.join(', ')}</div>}
          {data.skills.languages?.length > 0 && <div style={{ fontSize: 9 }}><strong style={{ color: accentDark || accent }}>Languages: </strong>{data.skills.languages.join(', ')}</div>}
        </div></div>
      ) : null;
      case 'skills_tools': return data?.skills?.tools?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.tools} markerColor={accent} /></div>
      ) : null;
      case 'skills_soft': return data?.skills?.soft?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.soft} markerColor={accent} /></div>
      ) : null;
      case 'skills_languages': return data?.skills?.languages?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.languages} markerColor={accent} /></div>
      ) : null;
      case 'achievements': return data?.achievements?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.achievements} markerColor={accent} /></div>) : null;
      case 'certifications': return data?.certifications?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.certifications} markerColor={accent} /></div>) : null;
      case 'extraCurricular': return data?.extraCurricular?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.extraCurricular} markerColor={accent} /></div>) : null;
      case 'personalDetails': return data?.personalDetails && (data.personalDetails.dob || data.personalDetails.nationality) ? (
        <div key={key}><S title={label} /><div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 9.8 }}>
          {data.personalDetails.dob && <span><strong style={{ color: accentDark || accent }}>Date of Birth:</strong> {data.personalDetails.dob}</span>}
          {data.personalDetails.nationality && <span><strong style={{ color: accentDark || accent }}>Nationality:</strong> {data.personalDetails.nationality}</span>}
          {data.personalDetails.languages?.length > 0 && <span><strong style={{ color: accentDark || accent }}>Languages:</strong> {data.personalDetails.languages.join(', ')}</span>}
        </div></div>
      ) : null;
      default: return (<div key={key}><S title={label} />{(() => {
          const cs = data?.customSections?.find(s => s.key === key);
          const bullets = cs?.bullets || [];
          return bullets.length > 0
            ? <RBulletList items={bullets} markerColor={accent} />
            : <div style={{ fontSize: 9.8, color: '#888', fontStyle: 'italic', marginTop: 3 }}>Generating content...</div>;
        })()}</div>);
    }
  };

  const orderedSections = sections ? sections.filter(s => s.visible !== false && !s.deleted) : TEMPLATE_SECTIONS.bold;

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.8, color: '#1a1a1a', background: '#fff' }}>
      <div style={{ background: `linear-gradient(135deg, ${accentDark || accent}, ${accent})`, padding: '20px 32px 16px', color: '#fff' }}>
        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '0.5px', marginBottom: 3 }}>{p.name || 'Your Name'}</div>
        <div style={{ fontSize: 9.8, opacity: 0.9, letterSpacing: '0.3px' }}>{contactParts.join('   |   ')}</div>
        {p.website && <div style={{ fontSize: 9.8, opacity: 0.75, marginTop: 2 }}>{p.website}</div>}
      </div>
      <div style={{ height: 3, background: `linear-gradient(to right, ${accentDark || accent}cc, ${accent}44)` }} />
      <div style={{ padding: '12px 32px 20px' }}>
        {orderedSections.map(sec => renderBlock(sec.key, sec.label))}
      </div>
    </div>
  );
}
/* ── TEMPLATE 5: ACADEMIC ── */
function AcademicTemplate({ data, accent, accentLight, accentDark, sections, hideSpecialization = false, hideScore = false }) {
  const p = data?.personalInfo || {};
  const S = ({ title }) => (
    <div style={{ marginTop: 9, marginBottom: 3 }}>
      <div style={{ fontSize: 10.4, fontWeight: 700, color: accentDark || accent, textTransform: 'uppercase', letterSpacing: '1.5px', paddingBottom: 2, borderBottom: `1px solid ${accent}`, borderTop: `1px solid ${accent}`, padding: '2px 0', marginBottom: 0 }}>{title}</div>
    </div>
  );
  const contactParts = [p.email, p.phone, p.location, p.linkedin].filter(Boolean);

  const renderBlock = (key, label) => {
    switch(key) {
      case 'summary': return data?.profileSummary ? (
        <div key={key}><S title={label} /><p style={{ fontSize: 9, color: '#2d2d2d', lineHeight: 1.55, margin: '4px 0 0', textAlign: 'justify' }}>{data.profileSummary}</p></div>
      ) : null;
      case 'education': return data?.education?.length > 0 ? (
        <div key={key}><S title={label} /><EducationTable data={data} accent={accent} accentLight={accentLight} accentDark={accentDark} variant="academic" hideSpecialization={hideSpecialization} hideScore={hideScore} /></div>
      ) : null;
      case 'experience': return data?.experience?.length > 0 ? (
        <div key={key}><S title={label} />{data.experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}><span style={{ fontWeight: 700, fontSize: 10.9 }}>{exp.title}</span>{exp.company && <span style={{ color: '#333', fontSize: 9.8 }}> — {exp.company}{exp.location ? `, ${exp.location}` : ''}</span>}</div>
              <span style={{ fontSize: 9.8, color: '#555', fontStyle: 'italic', flexShrink: 0, marginLeft: 8 }}>{exp.duration}</span>
            </div>
            <RBulletList items={exp.bullets} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'projects': return data?.projects?.length > 0 ? (
        <div key={key}><S title={label} />{data.projects.map((proj, i) => (
          <div key={i} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div><span style={{ fontWeight: 700, fontSize: 10.9 }}>{proj.name}</span>{proj.tech && <span style={{ fontSize: 9.8, color: '#555', fontStyle: 'italic' }}> | {proj.tech}</span>}</div>
              <span style={{ fontSize: 9.8, color: '#555', fontStyle: 'italic', flexShrink: 0, marginLeft: 8 }}>{proj.duration}</span>
            </div>
            {proj.link && <div style={{ fontSize: 9.8, color: accent, marginBottom: 1 }}>{proj.link}</div>}
            <RBulletList items={proj.bullets} markerColor={accent} />
          </div>
        ))}</div>
      ) : null;
      case 'skills': return (data?.skills?.technical?.length > 0 || data?.skills?.tools?.length > 0) ? (
        <div key={key}><S title={label} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px', marginTop: 4 }}>
          {data.skills.technical?.length > 0 && <div style={{ fontSize: 9 }}><strong>Technical: </strong>{data.skills.technical.join(', ')}</div>}
          {data.skills.tools?.length > 0 && <div style={{ fontSize: 9 }}><strong>Tools: </strong>{data.skills.tools.join(', ')}</div>}
          {data.skills.soft?.length > 0 && <div style={{ fontSize: 9 }}><strong>Soft Skills: </strong>{data.skills.soft.join(', ')}</div>}
          {data.skills.languages?.length > 0 && <div style={{ fontSize: 9 }}><strong>Languages: </strong>{data.skills.languages.join(', ')}</div>}
        </div></div>
      ) : null;
      case 'skills_tools': return data?.skills?.tools?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.tools} markerColor={accent} /></div>
      ) : null;
      case 'skills_soft': return data?.skills?.soft?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.soft} markerColor={accent} /></div>
      ) : null;
      case 'skills_languages': return data?.skills?.languages?.length > 0 ? (
        <div key={key}><S title={label} /><RBulletList items={data.skills.languages} markerColor={accent} /></div>
      ) : null;
      case 'achievements': return data?.achievements?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.achievements} markerColor={accent} /></div>) : null;
      case 'certifications': return data?.certifications?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.certifications} markerColor={accent} /></div>) : null;
      case 'extraCurricular': return data?.extraCurricular?.length > 0 ? (<div key={key}><S title={label} /><RBulletList items={data.extraCurricular} markerColor={accent} /></div>) : null;
      case 'personalDetails': return data?.personalDetails && (data.personalDetails.dob || data.personalDetails.nationality) ? (
        <div key={key}><S title={label} /><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 9, marginTop: 3 }}>
          {data.personalDetails.dob && <span><strong>Date of Birth:</strong> {data.personalDetails.dob}</span>}
          {data.personalDetails.nationality && <span><strong>Nationality:</strong> {data.personalDetails.nationality}</span>}
          {data.personalDetails.languages?.length > 0 && <span><strong>Languages Known:</strong> {data.personalDetails.languages.join(', ')}</span>}
        </div></div>
      ) : null;
      default: return (<div key={key}><S title={label} />{(() => {
          const cs = data?.customSections?.find(s => s.key === key);
          const bullets = cs?.bullets || [];
          return bullets.length > 0
            ? <RBulletList items={bullets} markerColor={accent} />
            : <div style={{ fontSize: 9.8, color: '#888', fontStyle: 'italic', marginTop: 3 }}>Generating content...</div>;
        })()}</div>);
    }
  };

  const orderedSections = sections ? sections.filter(s => s.visible !== false && !s.deleted) : TEMPLATE_SECTIONS.academic;

  return (
    <div style={{ padding: '18px 28px 18px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 9.8, color: '#1a1a1a', lineHeight: 1.38, background: '#fff' }}>
      <div style={{ textAlign: 'center', paddingBottom: 7, borderBottom: `2px solid ${accentDark || accent}`, marginBottom: 3 }}>
        <div style={{ fontSize: 17.6, fontWeight: 700, color: accentDark || '#111', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 3 }}>{p.name || 'Your Name'}</div>
        <div style={{ fontSize: 9.8, color: '#444', letterSpacing: '0.3px' }}>{contactParts.join('  •  ')}</div>
        {(p.github || p.website) && <div style={{ fontSize: 9.8, color: accent, marginTop: 2 }}>{[p.github, p.website].filter(Boolean).join('  •  ')}</div>}
      </div>
      {orderedSections.map(sec => renderBlock(sec.key, sec.label))}
      <div style={{ marginTop: 14, textAlign: 'center', fontSize: 8.2, color: '#ccc', fontStyle: 'italic' }}>
        I hereby declare that all the information provided above is true to the best of my knowledge and belief.
      </div>
    </div>
  );
}
/* ─────────────────────────────────────────────
   SINGLE-PAGE ENFORCER — hard trims data after generation
   so the resume never exceeds one A4 page.

   Two-column layouts: sidebar content (skills, achievements,
   certs, personalDetails) is kept MORE generous to fill the
   left column to page bottom. Main column is trimmed tightly.

   Single-column layouts: everything is aggressively trimmed.
───────────────────────────────────────────── */
function enforceOnePage(data, layout = 'classic') {
  if (!data) return data;

  const isTwoCol = layout === 'two-column';

  // Two-column: main column is ~60% width → shorter bullets (100–120 chars)
  // Single-column: full width → longer bullets (120–130 chars)
  const CHAR_MAX = isTwoCol ? 120 : 130;
  const CHAR_MIN = isTwoCol ? 100 : 120; // for reference — we don't pad, AI handles min

  // Clamp at max only — trim over-long bullets at last word boundary
  const clamp = (s, max = CHAR_MAX) => {
    if (!s) return s;
    const clean = s.trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > max * 0.75 ? cut.slice(0, lastSpace) : cut).trimEnd();
  };

  // Bullet counts per layout — two-column has narrower main area so fewer bullets fill A4
  const maxExpBullets    = isTwoCol ? 4 : 5;   // bullets per experience role
  const maxProjects      = isTwoCol ? 2 : 3;   // max projects shown
  const maxProjBullets   = isTwoCol ? 3 : 3;   // bullets per project
  const maxAchievements  = isTwoCol ? 4 : 5;
  const maxCertifications= isTwoCol ? 4 : 4;
  const maxExtraCurric   = isTwoCol ? 3 : 3;
  const maxTechnical     = isTwoCol ? 8  : 10;
  const maxTools         = isTwoCol ? 6  : 8;
  const achClamp         = isTwoCol ? 105 : 125;
  const extClamp         = isTwoCol ? 105 : 125;

  return {
    ...data,
    profileSummary: data.profileSummary,
    experience: Array.isArray(data.experience) ? data.experience.map(e => ({
      ...e,
      bullets: (e.bullets || []).slice(0, maxExpBullets).map(b => clamp(b)),
    })) : data.experience,
    projects: Array.isArray(data.projects) ? data.projects.slice(0, maxProjects).map(p => ({
      ...p,
      bullets: (p.bullets || []).slice(0, maxProjBullets).map(b => clamp(b)),
    })) : data.projects,
    achievements:    (data.achievements    || []).slice(0, maxAchievements).map(b => clamp(b, achClamp)),
    certifications:  (data.certifications  || []).slice(0, maxCertifications),
    extraCurricular: (data.extraCurricular || []).slice(0, maxExtraCurric).map(b => clamp(b, extClamp)),
    skills: data.skills ? {
      technical: (data.skills.technical || []).slice(0, maxTechnical),
      tools:     (data.skills.tools     || []).slice(0, maxTools),
      soft:      (data.skills.soft      || []).slice(0, isTwoCol ? 4 : 4),
      languages: data.skills.languages,
    } : data.skills,
  };
}

/* ─────────────────────────────────────────────
   MARKDOWN STRIPPER — removes **bold** and _italic_ markers
   from all string fields in the resume data object so
   raw asterisks never appear anywhere in the output.
───────────────────────────────────────────── */
function stripMd(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
    .replace(/_(.+?)_/g, '$1');         // _italic_ → italic (plain)
}

function stripMdFromData(data) {
  if (!data) return data;
  const s = stripMd;
  const sArr = arr => Array.isArray(arr) ? arr.map(s) : arr;

  return {
    ...data,
    profileSummary: s(data.profileSummary),
    personalInfo: data.personalInfo ? {
      ...data.personalInfo,
      name:     s(data.personalInfo.name),
      email:    s(data.personalInfo.email),
      phone:    s(data.personalInfo.phone),
      location: s(data.personalInfo.location),
      linkedin: s(data.personalInfo.linkedin),
      github:   s(data.personalInfo.github),
      website:  s(data.personalInfo.website),
    } : data.personalInfo,
    experience: Array.isArray(data.experience) ? data.experience.map(e => ({
      ...e,
      title:    s(e.title),
      company:  s(e.company),
      location: s(e.location),
      duration: s(e.duration),
      bullets:  sArr(e.bullets),
    })) : data.experience,
    education: Array.isArray(data.education) ? data.education.map(e => ({
      ...e,
      degree:      s(e.degree),
      institution: s(e.institution),
      location:    s(e.location),
      year:        s(e.year),
      score:       s(e.score),
      honors:      s(e.honors),
    })) : data.education,
    projects: Array.isArray(data.projects) ? data.projects.map(p => ({
      ...p,
      name:     s(p.name),
      tech:     s(p.tech),
      duration: s(p.duration),
      link:     s(p.link),
      bullets:  sArr(p.bullets),
    })) : data.projects,
    skills: data.skills ? {
      technical: sArr(data.skills.technical),
      tools:     sArr(data.skills.tools),
      soft:      sArr(data.skills.soft),
      languages: sArr(data.skills.languages),
    } : data.skills,
    achievements:   sArr(data.achievements),
    certifications: sArr(data.certifications),
    extraCurricular:sArr(data.extraCurricular),
    personalDetails: data.personalDetails ? {
      ...data.personalDetails,
      dob:         s(data.personalDetails.dob),
      nationality: s(data.personalDetails.nationality),
      languages:   sArr(data.personalDetails.languages),
    } : data.personalDetails,
    customSections: Array.isArray(data.customSections) ? data.customSections.map(cs => ({
      ...cs,
      label:   s(cs.label),
      bullets: sArr(cs.bullets),
    })) : data.customSections,
  };
}

/* ── MASTER RESUME RENDERER ── */
function ResumeRenderer({ data, template, sections }) {
  if (!data || !template) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>No resume data yet.</div>;
  const props = {
    data,
    accent: template.accent, accentLight: template.accentLight, accentDark: template.accentDark,
    sections,
    hideSpecialization: template.hideSpecialization || false,
    hideScore:          template.hideScore          || false,
  };
  const map = { classic: ClassicTemplate, 'two-column': TwoColumnTemplate, minimal: MinimalTemplate, bold: BoldTemplate, academic: AcademicTemplate };
  const Component = map[template.layout] || ClassicTemplate;
  return <Component {...props} />;
}

/* ─────────────────────────────────────────────────────────────
   RESUME BUILDER WIZARD — 4-Step Process
──────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   DITTO COPY: Vision-based pixel-perfect resume clone
──────────────────────────────────────────────────────────────── */
function extractNameFromRaw(raw) {
  // Try to find a name on the first line or after "Name:"
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const nameLine = lines.find(l => /^name[:\-\s]/i.test(l));
  if (nameLine) return nameLine.replace(/^name[:\-\s]+/i, '').trim();
  // Fallback: first non-label-looking line
  const first = lines.find(l => l.length > 2 && l.length < 50 && !/[:@]/.test(l));
  return first || 'Candidate';
}

async function generateDittoCopyResume(rawInfo, pageImageBase64, streamId) {
  const stream = RESUME_STREAMS.find(s => s.id === streamId);
  const streamLabel = stream?.label || streamId;

  // ═══════════════════════════════════════════════════════════
  // PASS 1 — Visual analysis: extract exact template spec
  // ═══════════════════════════════════════════════════════════
  const analysisPrompt = `You are a pixel-perfect HTML/CSS analyst. Examine this resume image and extract a COMPLETE, PRECISE visual specification. Be extremely specific — exact pixel values, exact hex colors, exact font sizes.

Return a JSON object with this EXACT structure (no markdown, no fences):
{
  "page": {
    "bgColor": "#ffffff",
    "paddingTop": 0,
    "paddingRight": 0,
    "paddingBottom": 0,
    "paddingLeft": 0,
    "fontFamily": "Arial"
  },
  "header": {
    "nameFontSize": 24,
    "nameFontWeight": 700,
    "nameColor": "#000000",
    "nameTextTransform": "uppercase",
    "nameTextAlign": "center",
    "nameLetterSpacing": "2px",
    "contactFontSize": 9,
    "contactColor": "#0000FF",
    "contactSeparator": "|",
    "contactAlign": "center",
    "tagBarExists": true,
    "tagBarBgColor": "#1a1a2e",
    "tagBarTextColor": "#ffffff",
    "tagBarFontSize": 9,
    "tagBarPadding": "4px 10px",
    "tagBarSeparator": "|"
  },
  "sectionHeader": {
    "bgColor": "#1a1a2e",
    "textColor": "#ffffff",
    "fontSize": 9,
    "fontWeight": 700,
    "textTransform": "uppercase",
    "letterSpacing": "1.5px",
    "padding": "3px 8px",
    "marginTop": 8,
    "marginBottom": 4,
    "hasBorder": false,
    "borderColor": "",
    "isFullWidth": true
  },
  "twoColumnLayout": {
    "used": true,
    "leftColWidth": "22%",
    "leftColBgColor": "transparent",
    "leftColFontWeight": 700,
    "leftColFontSize": 8,
    "leftColColor": "#000000",
    "leftColPadding": "3px 8px",
    "rightColPadding": "3px 8px",
    "rowBorderBottom": "1px solid #cccccc"
  },
  "companyRow": {
    "companyFontWeight": 700,
    "companyFontSize": 9,
    "companyColor": "#000000",
    "titleFontWeight": 400,
    "titleFontStyle": "italic",
    "titleFontSize": 9,
    "dateAlign": "right",
    "dateFontStyle": "italic",
    "dateColor": "#555555",
    "dateFontSize": 8,
    "layout": "company-left-date-right"
  },
  "bullet": {
    "marker": "•",
    "markerColor": "#000000",
    "fontSize": 8,
    "lineHeight": 1.4,
    "color": "#000000",
    "indentLeft": 10,
    "boldKeywords": true,
    "marginBottom": 2
  },
  "educationTable": {
    "headerBgColor": "#cccccc",
    "headerTextColor": "#000000",
    "headerFontWeight": 700,
    "headerFontSize": 8,
    "cellFontSize": 8,
    "cellPadding": "3px 6px",
    "borderColor": "#cccccc",
    "altRowBgColor": "#f9f9f9",
    "columns": ["Qualification / Degree","Institution","Year","Score / CGPA","Specialization / Honors"]
  },
  "sidebarLayout": {
    "used": false,
    "sidebarSide": "left",
    "sidebarWidthPct": 28,
    "sidebarBgColor": "#f0f0f0",
    "sidebarTextColor": "#000000",
    "mainBgColor": "#ffffff",
    "dividerColor": "#cccccc",
    "sidebarSections": [],
    "mainSections": []
  },
  "skillsLayout": "bullet-columns",
  "sections": []
}

IMPORTANT for sidebarLayout:
- Set "used":true if the resume has a persistent LEFT or RIGHT column (sidebar) that runs the full height of the page.
- If the resume is a classic single-column layout, set "used":false.

Analyze the image carefully and fill in the ACTUAL values you see. Be precise about colors (use hex), sizes (use px numbers), and layout details.`;

  const analysisRes = await enqueue(() => fetchWithRetry(`${SUPABASE_URL}/functions/v1/resume-analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      prompt: analysisPrompt,
      maxTokens: 3000,
      imageBase64: pageImageBase64,
      systemPrompt: "You are a pixel-perfect HTML/CSS analyst. Return ONLY valid JSON. No markdown, no fences."
    })
  }));

  const analysisData = await analysisRes.json();
  if (analysisData.error) throw new Error(analysisData.error);
  const specText = analysisData.text || '{}';
  let templateSpec;
  try {
    const clean = specText.replace(/^```json?\n?/i, '').replace(/\n?```$/,'').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    templateSpec = JSON.parse(clean.slice(start, end + 1));
  } catch(e) {
    templateSpec = {};
  }

  // ═══════════════════════════════════════════════════════════
  // PASS 2 — HTML generation using the extracted spec
  // ═══════════════════════════════════════════════════════════
  const genPrompt = `You are an expert HTML developer. Your job is to recreate this resume as a PIXEL-PERFECT HTML document, then fill it with the user's data below.

TEMPLATE SPECIFICATION (extracted from the image above):
${JSON.stringify(templateSpec, null, 2)}

STEP 0 — MANDATORY PRE-CODING DECISION (do this FIRST)
Before writing any HTML, answer these questions based on the spec above:
  A) Is templateSpec.sidebarLayout.used === true? → YES = sidebar layout; NO = single-column layout
  B) If YES: what is sidebarLayout.sidebarWidthPct? What are sidebarSections vs. mainSections?
Write your answers as an HTML comment at the top of your output.

CRITICAL RULES:
1. Replicate the EXACT visual structure — same section order, same layout type
2. Dark background section headers → reproduce EXACTLY with the same color
3. ALL CSS must be INLINE (style="...") — no <style> tags, no class names
4. Return ONLY raw HTML starting with <div — NO DOCTYPE, NO markdown fences
5. Exactly 794px wide, use system fonts only
6. Every color MUST use hex values
7. STAR FRAMEWORK for every bullet: [Action Verb] + [Scope] + [Action] + [Quantified Result]
8. Include ALL user-provided information — nothing omitted
9. Education section MUST be an HTML table with headers

CONTENT RULES (${streamLabel}):
- Organize user's data into the EXACT same section names as the reference template
- Minimum 2 bullets per experience role, minimum 1 bullet per project

USER'S INFORMATION:
${rawInfo}

Now generate the complete pixel-perfect HTML.`;

  const genRes = await enqueue(() => fetchWithRetry(`${SUPABASE_URL}/functions/v1/resume-analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      prompt: genPrompt,
      maxTokens: 16000,
      imageBase64: pageImageBase64,
      systemPrompt: "You are an expert HTML developer. Return ONLY raw HTML starting with <div. No markdown, no code fences, no explanation."
    })
  }));

  const genData = await genRes.json();
  if (genData.error) throw new Error(genData.error);
  const html = genData.text || '';
  return html
    .replace(/^```html?\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

/* ─────────────────────────────────────────────────────────────
   DITTO COPY → WORD EXPORT  (v2 — fully editable OOXML, no images)
   ----------------------------------------------------------------
   Walks the inline-CSS HTML that generateDittoCopyResume produces
   and converts it directly to Word Open XML.  Handles:
     • Sidebar (flex-row) layouts  →  Word two-column table
     • Section header bars (colored bg + white text)
     • Education & other <table> elements with header shading
     • Bullet <div>/<p> lines with proper indentation
     • Bold / italic / font-size / color on every text run
     • Background shading on cells and paragraphs
   No canvas, no html2canvas, no image embedding — ever.
──────────────────────────────────────────────────────────────── */

// ── helpers ──────────────────────────────────────────────────
function _xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // strip control chars
}

// Parse a CSS inline-style string → plain object
function _parseStyle(styleStr) {
  const obj = {};
  if (!styleStr) return obj;
  styleStr.split(';').forEach(part => {
    const idx = part.indexOf(':');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();
    if (k && v) obj[k] = v;
  });
  return obj;
}

// px / pt / % → half-points (Word sz unit).  Fallback = defaultHp.
function _toHalfPt(val, defaultHp = 18) {
  if (!val) return defaultHp;
  const n = parseFloat(val);
  if (isNaN(n)) return defaultHp;
  if (val.includes('px')) return Math.round(n * 1.333); // 1px ≈ 0.75pt → *2 for half-pt = *1.5, but empirically *1.333 looks right
  if (val.includes('pt')) return Math.round(n * 2);
  return defaultHp;
}

// CSS color → 6-char hex (strips #).  Returns null if un-parseable.
function _toHex(color) {
  if (!color) return null;
  color = color.trim();
  // already hex
  const h6 = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (h6) return h6[1].toUpperCase();
  const h3 = color.match(/^#([0-9a-fA-F]{3})$/);
  if (h3) {
    const [r,g,b] = h3[1].split('');
    return (r+r+g+g+b+b).toUpperCase();
  }
  // named (basic set)
  const named = { white:'FFFFFF', black:'000000', red:'FF0000', blue:'0000FF',
    navy:'000080', gray:'808080', grey:'808080', silver:'C0C0C0',
    transparent: null };
  if (named[color.toLowerCase()] !== undefined) return named[color.toLowerCase()];
  return null;
}

// px → DXA (twentieths of a point, Word table unit).  1px = 15 DXA at 72dpi.
function _pxToDxa(px, def = 0) {
  const n = parseFloat(px);
  return isNaN(n) ? def : Math.round(n * 15);
}

// percent string "28%" → number 28
function _pctToNum(s) {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// A4 content width in DXA (no margins — we handle margins in sectPr)
const _A4W_DXA = 11906;

// Build a <w:rPr> block from a style context object
function _rPr(ctx) {
  let xml = '';
  const font = ctx.font || 'Arial';
  xml += `<w:rFonts w:ascii="${_xmlEsc(font)}" w:hAnsi="${_xmlEsc(font)}" w:cs="${_xmlEsc(font)}"/>`;
  const sz = ctx.fontSize || 18;
  xml += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
  if (ctx.bold)   xml += '<w:b/><w:bCs/>';
  if (ctx.italic) xml += '<w:i/><w:iCs/>';
  if (ctx.color && ctx.color !== '000000' && ctx.color !== 'auto')
    xml += `<w:color w:val="${ctx.color}"/>`;
  return xml ? `<w:rPr>${xml}</w:rPr>` : '';
}

// Build a single <w:r> text run
function _run(text, ctx) {
  if (!text) return '';
  const rpr = _rPr(ctx);
  const t   = _xmlEsc(text);
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : '';
  return `<w:r>${rpr}<w:t${space}>${t}</w:t></w:r>`;
}

// Build <w:pPr> for a paragraph
function _pPr({ align, spBefore = 0, spAfter = 40, indent = null, shadingHex = null, borderBot = null } = {}) {
  let xml = '';
  if (align && align !== 'left') {
    const map = { center:'center', right:'end', justify:'both' };
    xml += `<w:jc w:val="${map[align] || align}"/>`;
  }
  xml += `<w:spacing w:before="${spBefore}" w:after="${spAfter}" w:line="240" w:lineRule="auto"/>`;
  if (indent) xml += `<w:ind w:left="${indent.left||0}" w:hanging="${indent.hanging||0}"/>`;
  if (shadingHex) xml += `<w:shd w:val="clear" w:color="auto" w:fill="${shadingHex}"/>`;
  if (borderBot) xml += `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${borderBot}"/></w:pBdr>`;
  return `<w:pPr>${xml}</w:pPr>`;
}

// ── Context inheritance ───────────────────────────────────────
function _mergeCtx(parent, el) {
  const ctx = { ...parent };
  if (!el || !el.style) return ctx;
  const s = _parseStyle(el.getAttribute ? el.getAttribute('style') : '');

  const fw = s['font-weight'];
  if (fw === 'bold' || fw === '700' || fw === '800' || parseInt(fw) >= 700) ctx.bold = true;
  if (fw === 'normal' || fw === '400') ctx.bold = false;

  const fs = s['font-style'];
  if (fs === 'italic') ctx.italic = true;
  if (fs === 'normal') ctx.italic = false;

  const fz = s['font-size'];
  if (fz) ctx.fontSize = _toHalfPt(fz, ctx.fontSize);

  const col = s['color'];
  if (col) { const h = _toHex(col); if (h) ctx.color = h; }

  const ff = s['font-family'];
  if (ff) {
    const f = ff.split(',')[0].replace(/['"]/g,'').trim();
    if (f) ctx.font = f;
  }

  const bg = s['background-color'] || s['background'];
  if (bg && bg !== 'transparent') {
    const h = _toHex(bg.split(' ')[0]);
    if (h) ctx.bgColor = h;
  }

  const ta = s['text-align'];
  if (ta) ctx.textAlign = ta;

  const tt = s['text-transform'];
  if (tt === 'uppercase') ctx.uppercase = true;

  const ls = s['letter-spacing'];
  if (ls) ctx.letterSpacing = ls;

  return ctx;
}

// ── Leaf text extraction with runs ───────────────────────────
function _nodeToRuns(node, ctx) {
  if (node.nodeType === 3) { // TEXT_NODE
    const text = node.textContent;
    if (!text.trim() && !/\S/.test(text)) return ''; // pure-whitespace skip
    return _run(ctx.uppercase ? text.toUpperCase() : text, ctx);
  }
  if (node.nodeType !== 1) return ''; // not element
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '<w:r><w:br/></w:r>';

  const childCtx = _mergeCtx(ctx, node);
  // Inline bold/italic shortcuts
  if (tag === 'strong' || tag === 'b') childCtx.bold = true;
  if (tag === 'em' || tag === 'i')     childCtx.italic = true;

  // For block-level children inside a run context — just grab text
  let out = '';
  node.childNodes.forEach(ch => { out += _nodeToRuns(ch, childCtx); });
  return out;
}

// ── Convert a DOM node to Word paragraph(s) XML ──────────────
// Returns an array of paragraph XML strings
function _nodesToParas(nodes, ctx, tableWidthDxa) {
  const paras = [];

  function pushPara(text, c, pPrOpts = {}) {
    if (!text.trim()) return;
    paras.push(`<w:p>${_pPr(pPrOpts)}${_run(c.uppercase ? text.toUpperCase() : text, c)}</w:p>`);
  }

  function pushRunsPara(runs, pPrOpts = {}) {
    if (!runs.trim()) return;
    paras.push(`<w:p>${_pPr(pPrOpts)}${runs}</w:p>`);
  }

  function processNode(node, inheritCtx) {
    if (node.nodeType === 3) {
      const t = node.textContent.replace(/\s+/g,' ').trim();
      if (t) pushPara(t, inheritCtx);
      return;
    }
    if (node.nodeType !== 1) return;

    const tag = node.tagName.toLowerCase();
    const elCtx = _mergeCtx(inheritCtx, node);
    const st = _parseStyle(node.getAttribute ? node.getAttribute('style') : '');

    // ── TABLE ──────────────────────────────────────────────────
    if (tag === 'table') {
      paras.push(_tableToOoxml(node, elCtx, tableWidthDxa));
      return;
    }

    // ── Detect sidebar flex-row wrapper ─────────────────────────
    const display = st['display'] || '';
    const isFlex  = display === 'flex' || display === 'inline-flex';
    if (isFlex && (st['flex-direction'] || 'row') === 'row') {
      // Treat flex children as two columns in a Word table
      const children = Array.from(node.children);
      if (children.length >= 2) {
        paras.push(_flexRowToOoxml(node, elCtx, tableWidthDxa));
        return;
      }
    }

    // ── Block elements ─────────────────────────────────────────
    const isBlock = ['div','p','section','article','header','main','aside','h1','h2','h3','h4','h5','h6','li'].includes(tag);

    if (isBlock) {
      // Collect all inline content (runs) first
      let runs = '';
      let hasBlockChild = false;
      node.childNodes.forEach(ch => {
        if (ch.nodeType === 1) {
          const ct = ch.tagName.toLowerCase();
          if (['div','p','section','h1','h2','h3','h4','h5','h6','table','ul','ol','li'].includes(ct)) {
            hasBlockChild = true;
          }
        }
      });

      if (!hasBlockChild) {
        // Fully inline — build a single paragraph
        node.childNodes.forEach(ch => { runs += _nodeToRuns(ch, elCtx); });
        if (runs.trim()) {
          const bgHex = elCtx.bgColor;
          const pOpts = {
            align: elCtx.textAlign,
            spBefore: _pxToDxa(st['margin-top'] || st['padding-top'], 0),
            spAfter:  _pxToDxa(st['margin-bottom'] || st['padding-bottom'], 20),
            shadingHex: bgHex && bgHex !== 'FFFFFF' && bgHex !== 'transparent' ? bgHex : null,
          };
          pushRunsPara(runs, pOpts);
        } else {
          // empty para (spacing)
          paras.push(`<w:p>${_pPr({ spAfter: 20 })}</w:p>`);
        }
      } else {
        // Mixed or block children — recurse
        node.childNodes.forEach(ch => processNode(ch, elCtx));
      }
      return;
    }

    // ── UL / OL ────────────────────────────────────────────────
    if (tag === 'ul' || tag === 'ol') {
      node.childNodes.forEach(ch => processNode(ch, elCtx));
      return;
    }

    // ── Inline fallback ────────────────────────────────────────
    const t = node.textContent.replace(/\s+/g,' ').trim();
    if (t) pushPara(t, elCtx);
  }

  nodes.forEach(n => processNode(n, ctx));
  return paras;
}

// ── Convert an HTML <table> → OOXML <w:tbl> ─────────────────
function _tableToOoxml(tableEl, ctx, parentWidthDxa) {
  const st = _parseStyle(tableEl.getAttribute('style') || '');
  const tblW = parentWidthDxa || _A4W_DXA;

  // Gather rows (skip thead/tbody wrappers)
  const rows = [];
  function collectRows(el) {
    el.childNodes.forEach(ch => {
      if (ch.nodeType !== 1) return;
      const t = ch.tagName.toLowerCase();
      if (t === 'tr') rows.push(ch);
      else collectRows(ch);
    });
  }
  collectRows(tableEl);

  if (!rows.length) return '';

  // Determine column count from first row
  const firstCells = Array.from(rows[0].children).filter(c => ['td','th'].includes(c.tagName.toLowerCase()));
  const colCount = firstCells.length || 1;
  const colW = Math.floor(tblW / colCount);
  const colWidths = Array(colCount).fill(colW);
  // adjust last col so total = tblW
  colWidths[colCount - 1] = tblW - colW * (colCount - 1);

  const tblGrid = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');

  const rowsXml = rows.map((row, ri) => {
    const cells = Array.from(row.children).filter(c => ['td','th'].includes(c.tagName.toLowerCase()));
    const isHeader = ri === 0 && (row.closest('thead') || cells.some(c => c.tagName.toLowerCase() === 'th'));

    const cellsXml = cells.map((cell, ci) => {
      const cellSt = _parseStyle(cell.getAttribute('style') || '');
      const cellCtx = _mergeCtx(ctx, cell);
      if (isHeader) cellCtx.bold = true;

      const bgHex = cellCtx.bgColor
        || (isHeader ? (ctx.bgColor || null) : null);

      // Build cell content paragraphs
      const cellParas = _nodesToParas(Array.from(cell.childNodes), cellCtx, colWidths[ci] - 180);
      const cellContent = cellParas.length ? cellParas.join('') : `<w:p>${_pPr({ spAfter: 0 })}</w:p>`;

      const cw = colWidths[ci] || colW;
      const shading = bgHex ? `<w:shd w:val="clear" w:color="auto" w:fill="${bgHex}"/>` : '';
      const padT = _pxToDxa(cellSt['padding-top'] || cellSt['padding'] || '60px', 60);
      const padB = _pxToDxa(cellSt['padding-bottom'] || cellSt['padding'] || '60px', 60);
      const padL = _pxToDxa(cellSt['padding-left'] || cellSt['padding'] || '80px', 80);
      const padR = _pxToDxa(cellSt['padding-right'] || cellSt['padding'] || '80px', 80);

      return `<w:tc>
  <w:tcPr>
    <w:tcW w:w="${cw}" w:type="dxa"/>
    ${shading}
    <w:tcMar>
      <w:top w:w="${padT}" w:type="dxa"/>
      <w:bottom w:w="${padB}" w:type="dxa"/>
      <w:left w:w="${padL}" w:type="dxa"/>
      <w:right w:w="${padR}" w:type="dxa"/>
    </w:tcMar>
  </w:tcPr>
  ${cellContent}
</w:tc>`;
    }).join('');

    return `<w:tr>${cellsXml}</w:tr>`;
  }).join('');

  return `<w:tbl>
<w:tblPr>
  <w:tblW w:w="${tblW}" w:type="dxa"/>
  <w:tblBorders>
    <w:insideH w:val="single" w:sz="2" w:space="0" w:color="CCCCCC"/>
    <w:insideV w:val="single" w:sz="2" w:space="0" w:color="CCCCCC"/>
  </w:tblBorders>
  <w:tblLayout w:type="fixed"/>
</w:tblPr>
<w:tblGrid>${tblGrid}</w:tblGrid>
${rowsXml}
</w:tbl>`;
}

// ── Convert a flex-row div (sidebar layout) → two-col Word table ─
function _flexRowToOoxml(wrapperEl, ctx, parentWidthDxa) {
  const tblW = parentWidthDxa || _A4W_DXA;
  const children = Array.from(wrapperEl.children);
  if (children.length < 2) {
    return _nodesToParas(Array.from(wrapperEl.childNodes), ctx, tblW).join('');
  }

  // ── Determine column widths ────────────────────────────────
  function resolveColDxa(el, totalDxa) {
    const s = _parseStyle(el.getAttribute('style') || '');
    const w = s['width'] || s['min-width'] || '';
    if (!w) {
      // flex property
      const flex = s['flex'] || '';
      if (flex === '1' || flex.startsWith('1 ')) return Math.floor(totalDxa * 0.72);
      return Math.floor(totalDxa * 0.28);
    }
    if (w.includes('%')) return Math.floor(totalDxa * _pctToNum(w) / 100);
    if (w.includes('px')) return Math.min(_pxToDxa(w, Math.floor(totalDxa * 0.28)), totalDxa - 1000);
    return Math.floor(totalDxa * 0.28);
  }

  const col0W = resolveColDxa(children[0], tblW);
  const col1W = tblW - col0W;
  const colWidths = [col0W, col1W];

  const tblGrid = colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('');

  const cellsXml = children.slice(0, 2).map((child, ci) => {
    const childCtx = _mergeCtx(ctx, child);
    const bgHex = childCtx.bgColor;
    const shading = bgHex && bgHex !== 'FFFFFF' ? `<w:shd w:val="clear" w:color="auto" w:fill="${bgHex}"/>` : '';
    const cw = colWidths[ci];

    const paras = _nodesToParas(Array.from(child.childNodes), childCtx, cw - 160);
    const content = paras.length ? paras.join('') : `<w:p>${_pPr({ spAfter: 0 })}</w:p>`;

    return `<w:tc>
  <w:tcPr>
    <w:tcW w:w="${cw}" w:type="dxa"/>
    ${shading}
    <w:tcMar>
      <w:top w:w="80" w:type="dxa"/>
      <w:bottom w:w="80" w:type="dxa"/>
      <w:left w:w="120" w:type="dxa"/>
      <w:right w:w="120" w:type="dxa"/>
    </w:tcMar>
  </w:tcPr>
  ${content}
</w:tc>`;
  }).join('');

  return `<w:tbl>
<w:tblPr>
  <w:tblW w:w="${tblW}" w:type="dxa"/>
  <w:tblBorders>
    <w:top w:val="none"/><w:bottom w:val="none"/>
    <w:left w:val="none"/><w:right w:val="none"/>
    <w:insideH w:val="none"/><w:insideV w:val="none"/>
  </w:tblBorders>
  <w:tblLayout w:type="fixed"/>
</w:tblPr>
<w:tblGrid>${tblGrid}</w:tblGrid>
<w:tr>${cellsXml}</w:tr>
</w:tbl>`;
}

// ── Main entry: parse HTML string → OOXML body paragraphs ────
function _htmlToOoxmlBody(html, widthDxa) {
  // Parse in a detached div
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const baseCtx = { font: 'Arial', fontSize: 18, bold: false, italic: false, color: '000000' };
  const paras = _nodesToParas(Array.from(wrapper.childNodes), baseCtx, widthDxa);
  return paras.join('\n');
}

// ── Assemble complete DOCX zip ────────────────────────────────
async function downloadDittoCopyAsWord(html, candidateName = 'Resume') {
  track('resume-download', { format: 'docx', mode: 'ditto-copy' });
  const safeName = (candidateName || 'Resume').replace(/\s+/g, '_');

  // Load JSZip
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // A4, zero margins — content fills the full page width
  const PAGE_W   = 11906;
  const PAGE_H   = 16838;
  const MARGIN   = 0;   // no margin — the HTML itself carries its own padding
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const bodyXml = _htmlToOoxmlBody(html, CONTENT_W);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  mc:Ignorable="w14 wpc"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">
<w:body>
${bodyXml}
<w:sectPr>
  <w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}" w:orient="portrait"/>
  <w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}"
           w:header="0" w:footer="0" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"   Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:sz w:val="18"/><w:szCs w:val="18"/>
      <w:color w:val="1A1A1A"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:before="0" w:after="20" w:line="240" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableNormal" w:default="1">
    <w:name w:val="Normal Table"/>
    <w:tblPr><w:tblInd w:w="0" w:type="dxa"/></w:tblPr>
  </w:style>
</w:styles>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`;

  const zip = new window.JSZip();
  zip.file('[Content_Types].xml',          contentTypesXml);
  zip.file('_rels/.rels',                  rootRelsXml);
  zip.file('word/document.xml',            documentXml);
  zip.file('word/_rels/document.xml.rels', wordRelsXml);
  zip.file('word/styles.xml',              stylesXml);
  zip.file('word/settings.xml',            settingsXml);

  const docxBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  const url  = URL.createObjectURL(docxBlob);
  const link = document.createElement('a');
  link.href  = url;
  link.download = `${safeName}_Resume.docx`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 1000);
}

/* ─────────────────────────────────────────────────────────────
   TEMPLATE PREVIEW MODAL
──────────────────────────────────────────────────────────────── */
function TemplatePreviewModal({ tmpl, stream, edits, onEditsChange, onSelect, onClose }) {
  if (!tmpl) return null;

  const MODAL_SCALE = 0.72;
  const MODAL_W = 794;

  // Section state: initialize from template's actual section names if not already customised
  const layoutSections = TEMPLATE_SECTIONS[tmpl.layout] || DEFAULT_SECTIONS;
  const defaultSections = edits.sections || layoutSections.map(s => ({ ...s, visible: true }));
  const liveSections = defaultSections;

  const setSections = (newSections) => onEditsChange({ ...edits, sections: newSections });

  const toggleSection = (key) => {
    const sec = liveSections.find(s => s.key === key);
    if (!sec) return;
    if (sec.deleted || !sec.visible) {
      // Restore: mark visible and not deleted
      setSections(liveSections.map(s => s.key === key ? { ...s, deleted: false, visible: true } : s));
    } else {
      // Hide: mark as deleted (shows strikethrough + restore button)
      setSections(liveSections.map(s => s.key === key ? { ...s, deleted: true, visible: false } : s));
    }
  };
  const renameSection = (key, newLabel) => {
    setSections(liveSections.map(s => s.key === key ? { ...s, label: newLabel } : s));
  };
  // Soft delete — mark as deleted, keep in list for undo
  const deleteSection = (key) => {
    setSections(liveSections.map(s => s.key === key ? { ...s, deleted: true, visible: false } : s));
  };
  const restoreSection = (key) => {
    setSections(liveSections.map(s => s.key === key ? { ...s, deleted: false, visible: true } : s));
  };
  const addSection = (label) => {
    if (!label.trim()) return;
    const key = 'custom_' + Date.now();
    setSections([...liveSections, { key, label: label.trim(), visible: true, custom: true }]);
  };
  const moveSection = (key, dir) => {
    const visibleArr = liveSections.filter(s => !s.deleted);
    const idx = visibleArr.findIndex(s => s.key === key);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= visibleArr.length) return;
    // Rebuild full array preserving deleted items' positions but reordering visible ones
    const reordered = [...visibleArr];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setSections(reordered);
  };

  // Live template with possibly overridden accent + education column visibility
  const liveTemplate = {
    layout:            tmpl.layout,
    accent:            edits.accent      || tmpl.accent,
    accentLight:       edits.accentLight || tmpl.accentLight,
    accentDark:        edits.accentDark  || tmpl.accentDark,
    hideSpecialization: edits.hideSpecialization || false,
    hideScore:          edits.hideScore          || false,
  };

  // Live data: use field-specific sample data, only override name if user typed one
  const streamSampleData = STREAM_PREVIEW_DATA[stream?.id] || STREAM_PREVIEW_DATA.engineering;
  const liveData = {
    ...streamSampleData,
    personalInfo: {
      ...streamSampleData.personalInfo,
      name: edits.name || streamSampleData.personalInfo.name,
    },
  };

  const [newSectionInput, setNewSectionInput] = React.useState('');
  const [editingKey, setEditingKey] = React.useState(null);
  const [editingLabel, setEditingLabel] = React.useState('');
  const dragKeyRef = React.useRef(null);
  const [dragOverKey, setDragOverKey] = React.useState(null);
  const [dragPosition, setDragPosition] = React.useState(null); // 'above' | 'below'
  const [isDragging, setIsDragging] = React.useState(false);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(20,12,4,0.72)', backdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', animation: 'fadeIn 0.18s ease-out',
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(150deg, #FDF8F0 0%, #F5EDD8 100%)',
        borderRadius: 20, width: '100%', maxWidth: 1200, height: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 48px 120px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        animation: 'fadeUp 0.22s ease-out',
      }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px 12px',
          borderBottom: '1px solid rgba(195,165,110,0.18)',
          background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 17, color: '#1a1108' }}>
              {tmpl.name}
            </div>
            <div style={{ fontSize: 11.5, color: '#8a7a60', marginTop: 2 }}>
              {stream?.label} · {tmpl.layout.replace('-',' ')} · Changes reflect live in preview
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              padding: '7px 16px', borderRadius: 10,
              border: '1.5px solid rgba(195,165,110,0.35)',
              background: 'rgba(255,255,255,0.65)', cursor: 'pointer',
              fontSize: 12.5, color: '#5a4a30',
            }}>✕ Close</button>
            <button onClick={() => { onSelect(liveTemplate, liveSections); onClose(); }} style={{
              padding: '7px 22px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${liveTemplate.accent}, ${liveTemplate.accentDark || liveTemplate.accent})`,
              color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              boxShadow: `0 4px 18px ${liveTemplate.accent}55`,
            }}>✓ Save & Select Template</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* LEFT panel: Name + Color + Sections */}
          <div style={{
            width: 320, flexShrink: 0,
            borderRight: '1px solid rgba(195,165,110,0.15)',
            background: 'rgba(255,255,255,0.48)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px' }}>

              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#5a4a30', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Your Name</div>
                <input
                  type="text"
                  value={edits.name || ''}
                  onChange={e => onEditsChange({ ...edits, name: e.target.value })}
                  placeholder={streamSampleData.personalInfo.name}
                  style={{
                    width: '100%', padding: '8px 11px', borderRadius: 9,
                    border: `1.5px solid rgba(195,165,110,0.3)`, background: 'rgba(255,255,255,0.85)',
                    fontSize: 12.5, color: '#1a1108', outline: 'none',
                    fontFamily: "'Jost',sans-serif", boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = liveTemplate.accent}
                  onBlur={e => e.target.style.borderColor = 'rgba(195,165,110,0.3)'}
                />
              </div>

              {/* Accent Color */}
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(195,165,110,0.18)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#5a4a30', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Accent Color</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color"
                    value={edits.accent || tmpl.accent}
                    onChange={e => {
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
                      onEditsChange({ ...edits, accent: hex, accentLight: `rgba(${r},${g},${b},0.12)`, accentDark: `rgb(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)})` });
                    }}
                    style={{ width: 44, height: 36, borderRadius: 9, border: '1px solid rgba(195,165,110,0.35)', cursor: 'pointer', padding: 3 }}
                  />
                  <div>
                    <div style={{ fontSize: 11, color: '#2a1f0e', fontFamily: 'monospace', fontWeight: 600 }}>{edits.accent || tmpl.accent}</div>
                    <button onClick={() => onEditsChange({ ...edits, accent: undefined, accentLight: undefined, accentDark: undefined })}
                      style={{ fontSize: 10, color: liveTemplate.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>Reset to default</button>
                  </div>
                </div>
              </div>

              {/* Section headings manager */}
              {tmpl.layout === 'two-column' ? (
                /* ── TWO-COLUMN LAYOUT: show sidebar / main columns ── */
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#5a4a30', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Layout Columns</div>
                  <div style={{ fontSize: 10, color: '#8a7a60', marginBottom: 12, lineHeight: 1.45 }}>
                    Drag ⠿ within or between columns · Click label to rename · ✕ to remove
                  </div>

                  {/* Two column drop zones */}
                  {(() => {
                    const isTwoCol = true;
                    const colDragOverKey = dragOverKey;
                    const colDragPos = dragPosition;

                    const renderColSection = (sec, colId) => {
                      const isBeingDragged = isDragging && dragKeyRef.current === sec.key;
                      const isDragTarget = colDragOverKey === sec.key && dragKeyRef.current !== sec.key && !sec.deleted;

                      if (sec.deleted || sec.visible === false) return (
                        <div key={sec.key} style={{ marginBottom: 4, padding: '4px 7px', borderRadius: 7, background: 'rgba(192,57,43,0.05)', border: '1px dashed rgba(192,57,43,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ flex: 1, fontSize: 10.5, color: '#b33', textDecoration: 'line-through' }}>{sec.label}</span>
                          <button onClick={() => restoreSection(sec.key)} style={{ fontSize: 9.5, fontWeight: 700, color: '#2a7', background: 'none', border: '1px solid rgba(40,160,100,0.4)', borderRadius: 5, padding: '1px 7px', cursor: 'pointer' }}>↩ Restore</button>
                        </div>
                      );

                      return (
                        <div key={sec.key}
                          draggable={!editingKey}
                          onDragStart={e => { dragKeyRef.current = sec.key; setIsDragging(true); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${sec.key}|${colId}`); }}
                          onDragEnd={() => { dragKeyRef.current = null; setDragOverKey(null); setDragPosition(null); setIsDragging(false); }}
                          onDragOver={e => {
                            e.preventDefault(); e.stopPropagation();
                            if (sec.key !== dragKeyRef.current) {
                              setDragOverKey(sec.key);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDragPosition(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
                            }
                          }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setDragOverKey(null); setDragPosition(null); } }}
                          onDrop={e => {
                            e.preventDefault(); e.stopPropagation();
                            const fromKey = dragKeyRef.current;
                            const toKey = sec.key;
                            if (!fromKey || fromKey === toKey) { setDragOverKey(null); setDragPosition(null); return; }
                            const arr = [...liveSections];
                            const fromIdx = arr.findIndex(s => s.key === fromKey);
                            // Move to target column
                            arr[fromIdx] = { ...arr[fromIdx], column: colId };
                            // Reorder within the target column
                            const [moved] = arr.splice(fromIdx, 1);
                            const newToIdx = arr.findIndex(s => s.key === toKey);
                            const insertAt = colDragPos === 'above' ? newToIdx : newToIdx + 1;
                            arr.splice(Math.max(0, insertAt), 0, moved);
                            setSections(arr);
                            setDragOverKey(null); setDragPosition(null);
                            dragKeyRef.current = null; setIsDragging(false);
                          }}
                          style={{
                            marginBottom: 4, borderRadius: 7, padding: '4px 7px',
                            background: sec.visible ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${sec.visible ? 'rgba(195,165,110,0.2)' : 'rgba(195,165,110,0.1)'}`,
                            opacity: isBeingDragged ? 0.3 : sec.visible ? 1 : 0.5,
                            cursor: 'grab',
                            borderTop: isDragTarget && colDragPos === 'above' ? `2.5px solid ${liveTemplate.accent}` : undefined,
                            borderBottom: isDragTarget && colDragPos === 'below' ? `2.5px solid ${liveTemplate.accent}` : undefined,
                            boxShadow: isDragTarget ? `0 ${colDragPos === 'above' ? '-2px' : '2px'} 6px ${liveTemplate.accent}44` : 'none',
                            transition: 'opacity 0.1s',
                          }}>
                          {editingKey === sec.key ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input autoFocus value={editingLabel} onChange={e => setEditingLabel(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { renameSection(sec.key, editingLabel); setEditingKey(null); } if (e.key === 'Escape') setEditingKey(null); }}
                                style={{ flex: 1, fontSize: 10.5, padding: '2px 6px', borderRadius: 5, border: `1.5px solid ${liveTemplate.accent}`, outline: 'none', fontFamily: "'Jost',sans-serif" }} />
                              <button onClick={() => { renameSection(sec.key, editingLabel); setEditingKey(null); }} style={{ fontSize: 10, background: liveTemplate.accent, color: '#fff', border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer' }}>✓</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontSize: 11, color: 'rgba(180,150,80,0.5)', userSelect: 'none', cursor: 'grab' }}>⠿</span>
                              <button onClick={() => toggleSection(sec.key)} style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, background: sec.visible ? liveTemplate.accent : 'rgba(195,165,110,0.15)', border: 'none', cursor: 'pointer', fontSize: 8, color: sec.visible ? '#fff' : '#999', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sec.visible ? '✓' : '○'}</button>
                              <span style={{ flex: 1, fontSize: 10.5, color: sec.visible ? '#1a1108' : '#999', cursor: 'pointer', userSelect: 'none', lineHeight: 1.2 }} onClick={() => { setEditingKey(sec.key); setEditingLabel(sec.label); }} title="Click to rename">{sec.label}</span>
                              <button onClick={() => renameSection(sec.key, editingLabel) || (setEditingKey(sec.key), setEditingLabel(sec.label))} style={{ background: 'none', border: 'none', fontSize: 9, cursor: 'pointer', color: '#b07d2a', padding: '0 1px' }} onClick={() => { setEditingKey(sec.key); setEditingLabel(sec.label); }}>✏</button>
                              <button onClick={() => deleteSection(sec.key)} style={{ background: 'none', border: 'none', fontSize: 10, cursor: 'pointer', color: '#c0392b', padding: '0 1px', fontWeight: 700 }}>✕</button>
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {/* SIDEBAR column */}
                        <div
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={e => {
                            e.preventDefault();
                            const fromKey = dragKeyRef.current;
                            if (!fromKey) return;
                            // If dropped on empty sidebar area (not on a specific item), append
                            const arr = [...liveSections];
                            const fromIdx = arr.findIndex(s => s.key === fromKey);
                            if (fromIdx >= 0) {
                              arr[fromIdx] = { ...arr[fromIdx], column: 'sidebar' };
                              setSections([...arr]);
                            }
                            setDragOverKey(null); setDragPosition(null);
                            dragKeyRef.current = null; setIsDragging(false);
                          }}
                        >
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: liveTemplate.accent, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, padding: '4px 7px', background: `${liveTemplate.accent}12`, borderRadius: 6, textAlign: 'center', border: `1px solid ${liveTemplate.accent}25` }}>
                            ◀ Sidebar
                          </div>
                          {liveSections.filter(s => s.column === 'sidebar').map(sec => renderColSection(sec, 'sidebar'))}
                          {/* Add to sidebar */}
                          <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                            <input type="text" placeholder="+ Add…"
                              style={{ flex: 1, padding: '4px 7px', borderRadius: 6, border: '1px dashed rgba(195,165,110,0.35)', background: 'rgba(255,255,255,0.6)', fontSize: 10, outline: 'none', fontFamily: "'Jost',sans-serif" }}
                              onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { const k = 'custom_'+Date.now(); setSections([...liveSections, { key: k, label: e.target.value.trim(), visible: true, custom: true, column: 'sidebar' }]); e.target.value=''; } }}
                            />
                          </div>
                        </div>

                        {/* MAIN column */}
                        <div
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={e => {
                            e.preventDefault();
                            const fromKey = dragKeyRef.current;
                            if (!fromKey) return;
                            const arr = [...liveSections];
                            const fromIdx = arr.findIndex(s => s.key === fromKey);
                            if (fromIdx >= 0) {
                              arr[fromIdx] = { ...arr[fromIdx], column: 'main' };
                              setSections([...arr]);
                            }
                            setDragOverKey(null); setDragPosition(null);
                            dragKeyRef.current = null; setIsDragging(false);
                          }}
                        >
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, padding: '4px 7px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
                            Main Content ▶
                          </div>
                          {liveSections.filter(s => s.column !== 'sidebar').map(sec => renderColSection(sec, 'main'))}
                          {/* Add to main */}
                          <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                            <input type="text" placeholder="+ Add…"
                              style={{ flex: 1, padding: '4px 7px', borderRadius: 6, border: '1px dashed rgba(195,165,110,0.35)', background: 'rgba(255,255,255,0.6)', fontSize: 10, outline: 'none', fontFamily: "'Jost',sans-serif" }}
                              onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { const k = 'custom_'+Date.now(); setSections([...liveSections, { key: k, label: e.target.value.trim(), visible: true, custom: true, column: 'main' }]); e.target.value=''; } }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Global add */}
                  <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(255,255,255,0.5)', borderRadius: 8, border: '1px solid rgba(195,165,110,0.15)', fontSize: 10, color: '#8a7a60' }}>
                    💡 Drag sections between columns to restructure your layout
                  </div>

                  {/* ── Education Sub-columns — always visible whenever education section exists in template ── */}
                  {liveSections.some(s => s.key === 'education') && (
                    <div style={{
                      marginTop: 10, borderRadius: 8,
                      background: `${liveTemplate.accent}08`,
                      border: `1px solid ${liveTemplate.accent}28`,
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: liveTemplate.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>
                        🎓 Education Table Columns
                      </div>
                      {[
                        { key: 'hideSpecialization', label: 'Specialization / Honors', hint: 'Last column of the education table' },
                        { key: 'hideScore',          label: 'Score / CGPA',            hint: '4th column — GPA or percentage' },
                      ].map(field => {
                        const isHidden = edits[field.key] === true;
                        return (
                          <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <button
                              onClick={() => onEditsChange({ ...edits, [field.key]: !isHidden })}
                              style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: !isHidden ? liveTemplate.accent : 'rgba(195,165,110,0.18)', border: 'none', cursor: 'pointer', fontSize: 8, color: !isHidden ? '#fff' : '#999', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >{!isHidden ? '✓' : '○'}</button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: !isHidden ? '#1a1108' : '#999', fontWeight: 600, lineHeight: 1.2 }}>{field.label}</div>
                              <div style={{ fontSize: 9, color: '#9a8a70', lineHeight: 1.2 }}>{field.hint}</div>
                            </div>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, flexShrink: 0, cursor: 'pointer',
                              background: !isHidden ? `${liveTemplate.accent}15` : 'rgba(192,57,43,0.08)',
                              color: !isHidden ? liveTemplate.accent : '#c0392b',
                              border: `1px solid ${!isHidden ? liveTemplate.accent+'30' : 'rgba(192,57,43,0.25)'}`,
                            }} onClick={() => onEditsChange({ ...edits, [field.key]: !isHidden })}>
                              {!isHidden ? 'Shown' : 'Hidden'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* ── SINGLE COLUMN LAYOUT: existing list ── */
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#5a4a30', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Section Headings</div>
                  <div style={{ fontSize: 10.5, color: '#8a7a60', marginBottom: 10, lineHeight: 1.45 }}>
                    Drag ⠿ to reorder · Toggle, rename or delete sections
                  </div>

                  {liveSections.map((sec) => {
                    const visibleArr = liveSections.filter(s => !s.deleted);
                    const visIdx = visibleArr.findIndex(s => s.key === sec.key);
                    const isBeingDragged = isDragging && dragKeyRef.current === sec.key;
                    const isDragTarget = dragOverKey === sec.key && dragKeyRef.current !== sec.key && !sec.deleted;

                    if (sec.deleted || sec.visible === false) return (
                      <div key={sec.key} style={{ marginBottom: 5, borderRadius: 8, padding: '5px 8px', background: 'rgba(192,57,43,0.05)', border: '1px dashed rgba(192,57,43,0.3)', display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
                        <span style={{ flex: 1, fontSize: 11.5, color: '#b33', textDecoration: 'line-through', lineHeight: 1.2 }}>{sec.label}</span>
                        <button onClick={() => restoreSection(sec.key)} style={{ fontSize: 10, fontWeight: 700, color: '#2a7', background: 'none', border: '1px solid rgba(40,160,100,0.4)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>↩ Restore</button>
                      </div>
                    );

                    return (
                    <div key={sec.key} draggable={!editingKey}
                      onDragStart={e => { dragKeyRef.current = sec.key; setIsDragging(true); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', sec.key); }}
                      onDragEnd={() => { dragKeyRef.current = null; setDragOverKey(null); setDragPosition(null); setIsDragging(false); }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sec.key !== dragKeyRef.current) { setDragOverKey(sec.key); const rect = e.currentTarget.getBoundingClientRect(); setDragPosition(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below'); } }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setDragOverKey(null); setDragPosition(null); } }}
                      onDrop={e => {
                        e.preventDefault();
                        const fromKey = dragKeyRef.current; const toKey = sec.key;
                        if (!fromKey || fromKey === toKey) { setDragOverKey(null); setDragPosition(null); return; }
                        const arr = [...liveSections];
                        const fromIdx = arr.findIndex(s => s.key === fromKey);
                        const [moved] = arr.splice(fromIdx, 1);
                        const newToIdx = arr.findIndex(s => s.key === toKey);
                        const insertAt = dragPosition === 'above' ? newToIdx : newToIdx + 1;
                        arr.splice(Math.max(0, insertAt), 0, moved);
                        setSections(arr); setDragOverKey(null); setDragPosition(null); dragKeyRef.current = null; setIsDragging(false);
                      }}
                      style={{ marginBottom: 5, borderRadius: 8, background: sec.visible ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.04)', border: `1px solid ${sec.visible ? 'rgba(195,165,110,0.25)' : 'rgba(195,165,110,0.12)'}`, padding: '5px 8px', opacity: isBeingDragged ? 0.3 : sec.visible ? 1 : 0.55, cursor: editingKey === sec.key ? 'default' : 'grab', position: 'relative', borderTop: isDragTarget && dragPosition === 'above' ? `3px solid ${liveTemplate.accent}` : undefined, borderBottom: isDragTarget && dragPosition === 'below' ? `3px solid ${liveTemplate.accent}` : undefined, boxShadow: isDragTarget ? `0 ${dragPosition === 'above' ? '-2px' : '2px'} 8px ${liveTemplate.accent}55` : 'none', transition: 'opacity 0.12s' }}>
                      {editingKey === sec.key ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <input autoFocus value={editingLabel} onChange={e => setEditingLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { renameSection(sec.key, editingLabel); setEditingKey(null); } if (e.key === 'Escape') setEditingKey(null); }} style={{ flex: 1, fontSize: 11.5, padding: '3px 7px', borderRadius: 6, border: `1.5px solid ${liveTemplate.accent}`, outline: 'none', fontFamily: "'Jost',sans-serif" }} />
                          <button onClick={() => { renameSection(sec.key, editingLabel); setEditingKey(null); }} style={{ fontSize: 11, background: liveTemplate.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>✓</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13, color: 'rgba(180,150,80,0.5)', cursor: 'grab', flexShrink: 0, lineHeight: 1, userSelect: 'none', paddingRight: 2 }}>⠿</span>
                          <button onClick={() => toggleSection(sec.key)} style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: sec.visible ? liveTemplate.accent : 'rgba(195,165,110,0.18)', border: 'none', cursor: 'pointer', fontSize: 8, color: sec.visible ? '#fff' : '#999', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sec.visible ? '✓' : '○'}</button>
                          <span style={{ flex: 1, fontSize: 11.5, color: sec.visible ? '#1a1108' : '#999', lineHeight: 1.2, cursor: 'pointer', userSelect: 'none' }} onClick={() => { setEditingKey(sec.key); setEditingLabel(sec.label); }} title="Click to rename">{sec.label}</span>
                          <button onClick={() => moveSection(sec.key, -1)} disabled={visIdx === 0} style={{ background: 'none', border: 'none', fontSize: 9, cursor: visIdx === 0 ? 'default' : 'pointer', color: '#b07d2a', opacity: visIdx === 0 ? 0.25 : 0.7, padding: '0 1px' }}>↑</button>
                          <button onClick={() => moveSection(sec.key, 1)} disabled={visIdx === visibleArr.length - 1} style={{ background: 'none', border: 'none', fontSize: 9, cursor: visIdx === visibleArr.length-1 ? 'default' : 'pointer', color: '#b07d2a', opacity: visIdx === visibleArr.length-1 ? 0.25 : 0.7, padding: '0 1px' }}>↓</button>
                          <button onClick={() => { setEditingKey(sec.key); setEditingLabel(sec.label); }} style={{ background: 'none', border: 'none', fontSize: 9.5, cursor: 'pointer', color: '#b07d2a', padding: '0 1px' }}>✏</button>
                          <button onClick={() => deleteSection(sec.key)} style={{ background: 'none', border: 'none', fontSize: 11, cursor: 'pointer', color: '#c0392b', padding: '0 1px', fontWeight: 700 }}>✕</button>
                        </div>
                      )}
                    </div>
                    );
                  })}

                  {/* ── Education Sub-columns — always visible whenever education section exists ── */}
                  {liveSections.some(s => s.key === 'education') && (
                    <div style={{
                      marginBottom: 5, marginTop: 8,
                      borderRadius: 8,
                      background: `${liveTemplate.accent}08`,
                      border: `1px solid ${liveTemplate.accent}28`,
                      padding: '6px 8px 7px 12px',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: liveTemplate.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                        🎓 Education Sub-columns
                      </div>
                      {[
                        { key: 'hideSpecialization', label: 'Specialization / Honors', hint: 'Last column of the education table' },
                        { key: 'hideScore',          label: 'Score / CGPA',            hint: '4th column — GPA or percentage' },
                      ].map(field => {
                        const isHidden = edits[field.key] === true;
                        return (
                          <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <button
                              onClick={() => onEditsChange({ ...edits, [field.key]: !isHidden })}
                              style={{
                                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                background: !isHidden ? liveTemplate.accent : 'rgba(195,165,110,0.18)',
                                border: 'none', cursor: 'pointer', fontSize: 8,
                                color: !isHidden ? '#fff' : '#999',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >{!isHidden ? '✓' : '○'}</button>
                            <div>
                              <div style={{ fontSize: 11, color: !isHidden ? '#1a1108' : '#999', fontWeight: 600, lineHeight: 1.2 }}>{field.label}</div>
                              <div style={{ fontSize: 9.5, color: '#9a8a70', lineHeight: 1.2 }}>{field.hint}</div>
                            </div>
                            <span style={{
                              marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                              padding: '1px 7px', borderRadius: 10, flexShrink: 0,
                              background: !isHidden ? `${liveTemplate.accent}15` : 'rgba(192,57,43,0.08)',
                              color: !isHidden ? liveTemplate.accent : '#c0392b',
                              border: `1px solid ${!isHidden ? liveTemplate.accent+'30' : 'rgba(192,57,43,0.25)'}`,
                              cursor: 'pointer',
                            }} onClick={() => onEditsChange({ ...edits, [field.key]: !isHidden })}>
                              {!isHidden ? 'Shown' : 'Hidden'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add new section */}
                  <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                    <input type="text" value={newSectionInput} onChange={e => setNewSectionInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { addSection(newSectionInput); setNewSectionInput(''); } }} placeholder="Add new section…"
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid rgba(195,165,110,0.28)', background: 'rgba(255,255,255,0.8)', fontSize: 11.5, outline: 'none', fontFamily: "'Jost',sans-serif" }}
                      onFocus={e => e.target.style.borderColor = liveTemplate.accent} onBlur={e => e.target.style.borderColor = 'rgba(195,165,110,0.28)'} />
                    <button onClick={() => { addSection(newSectionInput); setNewSectionInput(''); }} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: liveTemplate.accent, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+</button>
                  </div>
                </div>
              )}

              {/* Note */}
              <div style={{ marginTop: 16, padding: '9px 11px', background: `${liveTemplate.accent}0d`, border: `1px solid ${liveTemplate.accent}28`, borderRadius: 9, fontSize: 10, color: '#5a4a30', lineHeight: 1.55 }}>
                💡 These changes control the template structure. Your full resume content fills in at generation time.
              </div>

              <button onClick={() => onEditsChange({})} style={{ width: '100%', marginTop: 10, padding: '7px', borderRadius: 8, border: '1px solid rgba(195,165,110,0.28)', background: 'transparent', fontSize: 11, color: '#8a7a60', cursor: 'pointer' }}>↺ Reset all to defaults</button>

            </div>
          </div>

          {/* RIGHT: Live resume preview — fully scrollable */}
          <div style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            padding: '20px 24px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(230,224,213,0.5)',
          }}>
            <div style={{ fontSize: 11, color: '#8a7a60', marginBottom: 14, textAlign: 'center', letterSpacing: '0.3px' }}>
              📄 Live Preview — {tmpl.name} · Scroll to see full resume
            </div>

            {/* Paper wrapper: clips right edge to scaled width; right panel scrolls for full height */}
            <div style={{
              background: '#fff',
              boxShadow: '0 10px 56px rgba(0,0,0,0.2), 0 2px 10px rgba(0,0,0,0.1)',
              borderRadius: 3,
              width: MODAL_W * MODAL_SCALE,
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              <div style={{
                width: MODAL_W,
                transform: `scale(${MODAL_SCALE})`,
                transformOrigin: 'top left',
                lineHeight: 'normal',
                pointerEvents: 'none',
              }}>
                <ResumeRenderer
                  key={liveSections.map(s=>`${s.key}:${s.visible?1:0}:${s.deleted?1:0}:${s.label}`).join('|')}
                  data={liveData}
                  template={liveTemplate}
                  sections={liveSections}
                />
              </div>
            </div>

            <div style={{ marginTop: 24, flexShrink: 0 }}>
              <button onClick={() => { onSelect(liveTemplate, liveSections); onClose(); }} style={{
                padding: '12px 40px', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, ${liveTemplate.accent}, ${liveTemplate.accentDark || liveTemplate.accent})`,
                color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700,
                boxShadow: `0 6px 28px ${liveTemplate.accent}55`,
                animation: 'floatY 3s ease-in-out infinite',
              }}>✓ Save & Select This Template →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResumeBuilderWizard({ onBack }) {
  const [step, setStep]           = useState(1);
  const [stream, setStream]       = useState(null);
  const [template, setTemplate]   = useState(null);
  const [customTemplateText, setCustomTemplateText] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [refResumeFile, setRefResumeFile]         = useState(null);
  const [refResumeStructure, setRefResumeStructure] = useState('');
  const [refPDFImage, setRefPDFImage]             = useState(null);
  const [analyzingRef, setAnalyzingRef]           = useState(false);
  const [refAnalyzed, setRefAnalyzed]             = useState(false);
  const [customResumeHTML, setCustomResumeHTML]   = useState(null);
  const [rawInfo, setRawInfo]     = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]   = useState('');
  const [resumeData, setResumeData] = useState(null);
  const [pageMode, setPageMode]   = useState('single'); // 'single' | 'multi'
  const [pdfLoading, setPdfLoading] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  // Template preview modal
  const [previewModal, setPreviewModal]   = useState(null); // tmpl object being previewed
  const [previewEdits, setPreviewEdits]   = useState({});   // per-template live edits
  const previewRef = useRef(null);
  const exportRef  = useRef(null);
  const [previewContentH, setPreviewContentH] = useState(1123);

  // Track resume content height for page break lines
  React.useEffect(() => {
    if (!exportRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPreviewContentH(entry.contentRect.height);
      }
    });
    obs.observe(exportRef.current);
    return () => obs.disconnect();
  }, [resumeData, template]);

  const streamTemplates = stream ? (RESUME_TEMPLATES[stream.id] || []) : [];

  const SCALE = 0.60;
  const RESUME_W = 794;

  /* Step 3 → Generate */
  async function handleGenerate() {
    if (!rawInfo.trim()) return;
    setGenerating(true);
    setGenError('');
    setCustomResumeHTML(null);
    try {
      // ── Ditto Copy path: reference PDF image was uploaded ──
      if (useCustom && refPDFImage) {
        const html = await generateDittoCopyResume(rawInfo, refPDFImage, stream.id);
        setCustomResumeHTML(html);
        setResumeData({ personalInfo: { name: extractNameFromRaw(rawInfo) } });
        setStep(4);
        setGenerating(false);
        return;
      }
      // ── Standard path ──
      const effectiveTemplate = useCustom
        ? { ...template, name: 'Custom Template', layout: template?.layout || 'classic' }
        : template;
      const effectiveCustomText = refAnalyzed && refResumeStructure
        ? `Reference Resume Structure (extracted from uploaded file):\n${refResumeStructure}\n\n${customTemplateText}`.trim()
        : customTemplateText;
      // Pass selected sections order/labels to generation if user customised them
      const selectedSections = template?.selectedSections;
      const isTwoCol = template?.layout === 'two-column';
      const sectionsInstruction = selectedSections
        ? (() => {
            const visible = selectedSections.filter(s => s.visible !== false && !s.deleted);
            const KNOWN_KEYS = new Set(['summary','education','experience','projects','skills','skills_tools','skills_soft','skills_languages','achievements','certifications','extraCurricular','personalDetails']);
            const customSecs = visible.filter(s => !KNOWN_KEYS.has(s.key));
            const customNote = customSecs.length > 0
              ? `\n\nCUSTOM SECTIONS TO FILL (generate real STAR-framework bullets for each):\n${customSecs.map(s => `- key: "${s.key}", label: "${s.label}" — write 2-3 relevant bullets based on user's background`).join('\n')}\nInclude these in the "customSections" array in the JSON, matching the key and label exactly.`
              : '';
            if (isTwoCol) {
              const sidebar = visible.filter(s => s.column === 'sidebar');
              const main    = visible.filter(s => s.column !== 'sidebar');
              return `\nSECTION LAYOUT (user-customised — follow exactly):\nSIDEBAR COLUMN (left): ${sidebar.map(s => s.label).join(', ')}\nMAIN COLUMN (right, in this order): ${main.map(s => s.label).join(' → ')}\nUse these EXACT heading names. Only include these sections. Sidebar sections go in the sidebar panel; main sections go in the main content area.${customNote}`;
            }
            return `\nSECTION ORDER & HEADINGS (user-customised — follow exactly):\n${visible.map((s, i) => `${i+1}. ${s.label}`).join('\n')}\nOnly include these sections in this order. Use these exact heading names.${customNote}`;
          })()
        : '';
      const data = await generateResumeFromClaude(rawInfo, stream.id, effectiveTemplate, effectiveCustomText + sectionsInstruction, pageMode);
      const cleaned = stripMdFromData(data);
      // Single-page: enforce hard limits on bullet counts after generation
      setResumeData(pageMode === 'single' ? enforceOnePage(cleaned, effectiveTemplate?.layout || 'classic') : cleaned);
      setStep(4);
    } catch (err) {
      setGenError(err.message || 'Failed to generate resume. Please try again.');
    }
    setGenerating(false);
  }

  /* Analyze uploaded reference resume — extract structure text AND capture page-1 image */
  async function analyzeRefResume(file) {
    setAnalyzingRef(true);
    setRefAnalyzed(false);
    setRefResumeStructure('');
    setRefPDFImage(null);
    try {
      // ── Load PDF.js if needed ──
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            res();
          };
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      const page = await pdf.getPage(1);

      // Render at high resolution for Claude vision
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const pageImage = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]; // base64 only
      setRefPDFImage(pageImage);

      // Brief structure description for display
      const pdfText = await extractPDFText(file);
      setRefResumeStructure(`Page 1 captured (${Math.round(viewport.width/2)}×${Math.round(viewport.height/2)}px). Will replicate colors, fonts, layout, alignment and bold/italic patterns exactly.`);
      setRefAnalyzed(true);
    } catch (err) {
      setRefResumeStructure('Could not analyze resume. Please describe the format manually.');
      setRefAnalyzed(true);
    }
    setAnalyzingRef(false);
  }
  async function handlePDF() {
    setPdfLoading(true);
    try {
      // ── Step 1: Load html2canvas ──────────────────────────────────────────
      if (!window.html2canvas) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = res;
          s.onerror = () => rej(new Error('html2canvas failed to load'));
          document.head.appendChild(s);
        });
      }

      // ── Step 2: Load jsPDF ───────────────────────────────────────────────
      if (!window.jspdf && !window.jsPDF) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          s.onload = res;
          s.onerror = () => rej(new Error('jsPDF failed to load'));
          document.head.appendChild(s);
        });
      }

      const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!jsPDFCtor) throw new Error('jsPDF not available');

      // ── Step 3: Build full-res render source ─────────────────────────────
      // Get the inline styles used by all <style> tags on the page
      const allStyles = Array.from(document.querySelectorAll('style'))
        .map(s => s.textContent).join('\n');

      // Get the full resume HTML from our hidden print target
      const printTarget = document.getElementById('rb-print-target');
      if (!printTarget) throw new Error('Print target not found. Please try again.');
      const resumeHTML = printTarget.innerHTML;

      // ── Step 4: Render in an isolated off-screen iframe ───────────────────
      // Use auto-height so multi-page resumes are never clipped.
      const iframe = document.createElement('iframe');
      iframe.style.cssText = [
        'position:fixed',
        'left:-9999px',
        'top:0',
        'width:794px',
        'height:2px',       // start minimal; will be expanded after content renders
        'border:none',
        'visibility:hidden',
        'z-index:-9999',
      ].join(';');
      document.body.appendChild(iframe);

      await new Promise(resolve => {
        iframe.onload = resolve;
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; width: 794px; height: auto; overflow: visible; background: #fff; }
  ${allStyles}
</style>
</head>
<body>
  <div style="width:794px;background:#fff;overflow:visible;">${resumeHTML}</div>
</body>
</html>`);
        doc.close();
      });

      // Give fonts and layout a tick to settle, then measure true height
      await new Promise(r => setTimeout(r, 700));
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const renderTarget = iframeDoc.body.firstElementChild || iframeDoc.body;
      const contentH = Math.max(renderTarget.scrollHeight, renderTarget.offsetHeight, 1123);
      // Expand iframe to full content height so nothing overflows off-screen
      iframe.style.height = contentH + 'px';
      await new Promise(r => setTimeout(r, 150)); // reflow

      // ── Step 5: Capture full-height canvas ───────────────────────────────
      const canvas = await window.html2canvas(renderTarget, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        height: contentH,
        windowWidth: 794,
        windowHeight: contentH,
        logging: false,
        imageTimeout: 15000,
        removeContainer: false,
      });

      document.body.removeChild(iframe);

      // ── Step 6: Build multi-page PDF — slice canvas into A4 pages ────────
      // A4 at 96dpi = 794 × 1123 px. Each page slice is 1123px tall.
      const A4_W_MM  = 210;
      const A4_H_MM  = 297;
      const A4_PX_H  = 1123;   // A4 height in CSS pixels at 96dpi
      const SCALE_F  = 2;       // html2canvas scale factor used above
      const totalPages = Math.ceil(contentH / A4_PX_H);

      const pdf = new jsPDFCtor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        // Slice the full canvas: each page is A4_PX_H * SCALE_F pixels tall
        const srcY      = page * A4_PX_H * SCALE_F;
        const sliceH_px = Math.min(A4_PX_H * SCALE_F, canvas.height - srcY);
        if (sliceH_px <= 0) break;

        // Draw the slice onto a page-sized canvas
        const pageCanvas    = document.createElement('canvas');
        pageCanvas.width    = canvas.width;              // 794 * 2 = 1588
        pageCanvas.height   = A4_PX_H * SCALE_F;        // always full A4 height
        const ctx           = pageCanvas.getContext('2d');
        ctx.fillStyle       = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH_px, 0, 0, canvas.width, sliceH_px);

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.97);
        // Map canvas pixels back to mm: canvas is 2x, so 1588px → 210mm
        const sliceH_mm = (sliceH_px / (A4_PX_H * SCALE_F)) * A4_H_MM;
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM, '', 'FAST');
      }

      const candidateName = (resumeData?.personalInfo?.name || 'Resume').replace(/\s+/g, '_');
      pdf.save(`${candidateName}_Resume.pdf`);

    } catch (err) {
      console.error('PDF generation error:', err);
      // ── Fallback: window.print() ─────────────────────────────────────────
      try {
        const printTarget = document.getElementById('rb-print-target');
        if (!printTarget) throw new Error('no target');
        const allStyles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
        const printWindow = window.open('', '_blank', 'width=794,height=1123');
        printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Resume</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  @media print { @page { size: A4 portrait; margin: 0; } }
  ${allStyles}
</style>
</head>
<body>${printTarget.innerHTML}</body>
</html>`);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); }, 800);
      } catch (fbErr) {
        alert('PDF download failed: ' + err.message + '\n\nTip: Use your browser\'s Print → Save as PDF option as an alternative.');
      }
    }
    setPdfLoading(false);
  }

  /* Word Download — native DOCX text format, styled to match the selected template */
  async function handleWord() {
    setWordLoading(true);
    try {
      if (customResumeHTML) {
        // Ditto-copy path: export the generated HTML directly.
        // resumeData only holds the name when useCustom is active, so
        // we must NOT pass it to downloadResumeAsWord (gives only name+line).
        await downloadDittoCopyAsWord(
          customResumeHTML,
          resumeData?.personalInfo?.name || extractNameFromRaw(rawInfo) || 'Resume',
        );
      } else {
        // Standard path: structured OOXML from resumeData
        await downloadResumeAsWord(resumeData, template, template?.selectedSections, pageMode);
      }
    } catch (err) {
      console.error('Word download error:', err);
      alert('Word download failed: ' + err.message);
    }
    setWordLoading(false);
  }

  const Dot = ({ n }) => (
    <div style={{ width: 8, height: 8, borderRadius: '50%', background: step >= n ? T.gold : 'rgba(195,165,110,0.25)', transition: 'background 0.3s', border: `1.5px solid ${step >= n ? T.gold : 'rgba(195,165,110,0.25)'}` }} />
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: "'Jost', sans-serif", position: 'relative', overflowX: 'hidden' }}>
      <BgOrbs />

      {/* Template Preview Modal */}
      {previewModal && (
        <TemplatePreviewModal
          tmpl={previewModal}
          stream={stream}
          edits={previewEdits[previewModal.id] || {}}
          onEditsChange={edits => setPreviewEdits(prev => ({ ...prev, [previewModal.id]: edits }))}
          onSelect={(liveTemplate, liveSections) => {
            setTemplate({ ...previewModal, ...liveTemplate, selectedSections: liveSections });
            setUseCustom(false);
            setPreviewModal(null);
            setStep(3); // Go straight to "Tell us about yourself"
          }}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {/* ── TOP BAR ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 28px', borderBottom: `1px solid rgba(195,165,110,0.25)`, background: 'rgba(253,248,240,0.88)', backdropFilter: 'blur(24px)' }}>
        <button className="btn-ghost" onClick={step === 1 ? onBack : () => setStep(s => Math.max(1, s - 1))} style={{ padding: '6px 14px', fontSize: 13.2 }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#B07D2A,#D4A850)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15.4 }}>✨</div>
          <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 18.7 }}>Resume<span style={{ color: T.gold }}>Builder</span></span>
        </div>
        <div style={{ flex: 1 }} />
        {step <= 3 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1, 2, 3].map(n => <Dot key={n} n={n} />)}
            <span style={{ fontSize: 12.1, color: T.muted, marginLeft: 6 }}>Step {step} of 3</span>
          </div>
        )}
        {step === 4 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleWord} disabled={wordLoading} className="btn-ghost" style={{ padding: '7px 16px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {wordLoading ? <><span style={{ animation: 'spin 0.9s linear infinite', display: 'inline-block' }}>⟳</span> Preparing...</> : '📄 Download Word'}
            </button>
            <button onClick={handlePDF} disabled={pdfLoading} className="btn-primary" style={{ padding: '7px 18px', fontSize: 13.2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {pdfLoading ? <><span style={{ animation: 'spin 0.9s linear infinite', display: 'inline-block' }}>⟳</span> Generating PDF...</> : '📥 Download PDF'}
            </button>
          </div>
        )}
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: step === 4 ? 1100 : 920, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* ════════ STEP 1: CHOOSE STREAM ════════ */}
        {step === 1 && (
          <div style={{ animation: 'fadeUp 0.5s ease-out' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', border: `1px solid rgba(176,125,42,0.25)`, borderRadius: 24, padding: '7px 18px', marginBottom: 20, fontSize: 13.2, color: T.gold }}>
                ✨ Step 1 of 3 — Choose Your Field
              </div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: T.text, marginBottom: 10, letterSpacing: '-0.5px' }}>What's your field of study or career?</h1>
              <p style={{ color: T.muted, fontSize: 16.5, maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>We'll show you the 5 most effective resume formats used by top professionals in your domain.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 32 }}>
              {RESUME_STREAMS.map(s => (
                <div key={s.id} onClick={() => setStream(s)} style={{
                  padding: '22px 18px', borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s ease',
                  background: stream?.id === s.id ? `rgba(${s.color.replace('#','').match(/../g).map(h=>parseInt(h,16)).join(',')},0.12)` : 'rgba(255,255,255,0.60)',
                  backdropFilter: 'blur(16px)',
                  border: `2px solid ${stream?.id === s.id ? s.color : 'rgba(195,165,110,0.28)'}`,
                  boxShadow: stream?.id === s.id ? `0 8px 28px ${s.color}30` : '0 4px 16px rgba(140,105,50,0.08)',
                  transform: stream?.id === s.id ? 'translateY(-3px)' : 'none',
                }}>
                  <div style={{ fontSize: 33, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15.4, color: stream?.id === s.id ? s.color : T.text, marginBottom: 5 }}>{s.label}</div>
                  <div style={{ fontSize: 12.1, color: T.muted, lineHeight: 1.5 }}>{s.desc}</div>
                  {stream?.id === s.id && <div style={{ marginTop: 10, fontSize: 12.1, color: s.color, fontWeight: 600 }}>✓ Selected</div>}
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center' }}>
              <button onClick={() => stream && setStep(2)} disabled={!stream} className={stream ? 'btn-primary' : ''} style={{
                padding: '14px 42px', fontSize: 16.5, borderRadius: 14,
                background: !stream ? 'rgba(195,165,110,0.2)' : undefined,
                border: !stream ? '1px solid rgba(195,165,110,0.3)' : 'none',
                color: !stream ? T.dim : 'white',
                cursor: !stream ? 'not-allowed' : 'pointer',
              }}>
                {stream ? `Continue with ${stream.label} →` : 'Select a field to continue'}
              </button>
            </div>
          </div>
        )}

        {/* ════════ STEP 2: CHOOSE TEMPLATE ════════ */}
        {step === 2 && stream && (
          <div style={{ animation: 'fadeUp 0.5s ease-out' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', border: `1px solid rgba(176,125,42,0.25)`, borderRadius: 24, padding: '7px 18px', marginBottom: 20, fontSize: 13.2, color: T.gold }}>
                {stream.icon} Step 2 of 3 — {stream.label}
              </div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(24px,4vw,38px)', fontWeight: 800, color: T.text, marginBottom: 10, letterSpacing: '-0.5px' }}>Choose your resume template</h1>
              <p style={{ color: T.muted, fontSize: 15.4, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>These are the 5 most effective formats used by {stream.label} professionals in India. Each is ATS-optimized and recruiter-approved.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 20, marginBottom: 20 }}>
              {streamTemplates.map(tmpl => (
                <div key={tmpl.id} onClick={() => { setTemplate(tmpl); setUseCustom(false); }} style={{
                  borderRadius: 16, cursor: 'pointer', overflow: 'hidden', transition: 'all 0.22s ease',
                  background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
                  border: `2px solid ${template?.id === tmpl.id && !useCustom ? tmpl.accent : 'rgba(195,165,110,0.22)'}`,
                  boxShadow: template?.id === tmpl.id && !useCustom ? `0 12px 36px ${tmpl.accent}40` : '0 4px 18px rgba(140,105,50,0.09)',
                  transform: template?.id === tmpl.id && !useCustom ? 'translateY(-5px)' : 'none',
                }}>
                  {/* Live Template Preview with hover overlay */}
                  <div style={{
                    padding: '14px 14px 0',
                    background: template?.id === tmpl.id && !useCustom ? `${tmpl.accentLight}` : 'rgba(248,244,238,0.7)',
                    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Selected checkmark */}
                    {template?.id === tmpl.id && !useCustom && (
                      <div style={{
                        position: 'absolute', top: 10, right: 10, zIndex: 10,
                        width: 24, height: 24, borderRadius: '50%',
                        background: tmpl.accent, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, boxShadow: `0 2px 8px ${tmpl.accent}60`,
                      }}>✓</div>
                    )}
                    {/* Preview button — shown on hover via CSS class isn't possible inline, use always-visible small button */}
                    <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 10 }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          // Clear any stale sections so they reinitialize from this template's layout
                          setPreviewEdits(prev => ({ ...prev, [tmpl.id]: { ...(prev[tmpl.id] || {}), sections: undefined } }));
                          setPreviewModal(tmpl);
                        }}
                        style={{
                          padding: '4px 10px', borderRadius: 8, border: 'none',
                          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
                          color: tmpl.accent, fontSize: 10.5, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = tmpl.accent; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.color = tmpl.accent; }}
                      >
                        👁 Preview
                      </button>
                    </div>
                    <TemplatePreviewLive
                      layout={tmpl.layout}
                      accent={(previewEdits[tmpl.id] || {}).accent || tmpl.accent}
                      accentLight={(previewEdits[tmpl.id] || {}).accentLight || tmpl.accentLight}
                      accentDark={(previewEdits[tmpl.id] || {}).accentDark || tmpl.accentDark}
                      streamId={stream?.id}
                      templateSections={(previewEdits[tmpl.id] || {}).sections || tmpl.selectedSections}
                    />
                  </div>
                  <div style={{ padding: '12px 14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14.3, color: T.text }}>{tmpl.name}</div>
                      {template?.id === tmpl.id && !useCustom && <span style={{ background: tmpl.accent, color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, letterSpacing: '0.3px' }}>SELECTED</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.5 }}>{tmpl.desc}</div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, background: `${tmpl.accent}18`, color: tmpl.accent, border: `1px solid ${tmpl.accent}35`, padding: '2px 9px', borderRadius: 12, fontWeight: 700, letterSpacing: '0.5px' }}>{tmpl.layout.replace('-', ' ').toUpperCase()}</span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPreviewEdits(prev => ({ ...prev, [tmpl.id]: { ...(prev[tmpl.id] || {}), sections: undefined } }));
                          setPreviewModal(tmpl);
                        }}
                        style={{
                          fontSize: 10.5, color: tmpl.accent, background: 'none', border: `1px solid ${tmpl.accent}40`,
                          borderRadius: 10, padding: '2px 10px', cursor: 'pointer', fontWeight: 600,
                        }}
                      >Preview & Edit →</button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Upload Custom Template */}
              <div onClick={() => setUseCustom(u => !u)} style={{
                borderRadius: 18, cursor: 'pointer', overflow: 'hidden', transition: 'all 0.22s ease',
                background: useCustom ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
                backdropFilter: 'blur(16px)',
                border: `2px dashed ${useCustom ? T.gold : 'rgba(195,165,110,0.40)'}`,
                boxShadow: useCustom ? `0 10px 32px rgba(176,125,42,0.20)` : 'none',
                transform: useCustom ? 'translateY(-4px)' : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ flex: 1, padding: '24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <div style={{ fontSize: 39.6 }}>📤</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15.4, color: T.text, textAlign: 'center' }}>Upload / Describe Custom Template</div>
                  <div style={{ fontSize: 12.7, color: T.muted, lineHeight: 1.55, textAlign: 'center' }}>Upload a resume PDF — we'll make a <strong style={{ color: T.gold }}>ditto copy</strong>: same colors, fonts, layout & bold patterns, just your content.</div>
                  {useCustom && <span style={{ background: T.gold, color: 'white', fontSize: 9.9, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>SELECTED</span>}
                </div>
                {useCustom && (
                  <div style={{ padding: '0 16px 16px', display:'flex', flexDirection:'column', gap:10 }} onClick={e => e.stopPropagation()}>

                    {/* File Upload Zone */}
                    <label style={{
                      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                      padding:'14px 12px', cursor:'pointer',
                      background: refAnalyzed ? 'rgba(76,138,114,0.08)' : 'rgba(255,255,255,0.7)',
                      border: `1.5px dashed ${refAnalyzed ? T.sage : 'rgba(195,165,110,0.5)'}`,
                      borderRadius:10, transition:'all 0.2s',
                    }}>
                      <input
                        type="file" accept=".pdf" style={{ display:'none' }}
                        onChange={async e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setRefResumeFile(f);
                          await analyzeRefResume(f);
                        }}
                      />
                      {analyzingRef ? (
                        <>
                          <div style={{ fontSize:22, animation:'spin 1s linear infinite' }}>⏳</div>
                          <div style={{ fontSize:12.1, color:T.muted, fontFamily:"'Jost',sans-serif" }}>Analysing resume structure…</div>
                        </>
                      ) : refAnalyzed ? (
                        <>
                          <div style={{ fontSize:22 }}>✅</div>
                          <div style={{ fontSize:12.1, color:T.sage, fontWeight:600, fontFamily:"'Jost',sans-serif" }}>Captured: {refResumeFile?.name}</div>
                          <div style={{ fontSize:11, color:T.muted, fontFamily:"'Jost',sans-serif", textAlign:'center' }}>
                            {refPDFImage ? '🎨 Will clone colors, fonts, layout & alignment exactly' : 'Structure noted'}<br/>Click to upload different file
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize:22 }}>📎</div>
                          <div style={{ fontSize:12.1, color:T.muted, fontFamily:"'Jost',sans-serif", textAlign:'center' }}>
                            <strong style={{ color:T.gold }}>Upload reference resume PDF</strong><br/>
                            We'll make a ditto copy — your content, their exact style
                          </div>
                        </>
                      )}
                    </label>

                    {/* Show ditto copy status */}
                    {refAnalyzed && refResumeStructure && (
                      <div style={{ padding:'10px 12px', background: refPDFImage ? 'rgba(76,138,114,0.07)' : 'rgba(176,125,42,0.07)', border:`1px solid ${refPDFImage ? 'rgba(76,138,114,0.25)' : 'rgba(176,125,42,0.25)'}`, borderRadius:8, fontSize:11.6, color:T.text, lineHeight:1.6, fontFamily:"'Jost',sans-serif" }}>
                        <div style={{ fontWeight:700, color: refPDFImage ? T.sage : T.gold, marginBottom:4, fontSize:11 }}>
                          {refPDFImage ? '🎨 DITTO COPY MODE ACTIVE' : '📋 STRUCTURE NOTED'}
                        </div>
                        {refResumeStructure}
                      </div>
                    )}

                    {/* Manual description textarea */}
                    <textarea
                      value={customTemplateText}
                      onChange={e => setCustomTemplateText(e.target.value)}
                      placeholder={refPDFImage
                        ? "Optional: add any extra instructions, e.g. 'use my current job title as-is' or 'skip the photo placeholder'…"
                        : "Describe your preferred format. E.g.: 'Single column, start with a profile headline, then skills table, then experience using STAR format, then education, then a brief personal note. Use bold section headers.'"}
                      style={{ width: '100%', height: 70, padding: '10px 12px', background: 'rgba(255,255,255,0.8)', border: `1px solid rgba(195,165,110,0.4)`, borderRadius: 10, fontSize: 12.7, color: T.text, resize: 'vertical', outline: 'none', fontFamily: "'Jost',sans-serif", lineHeight: 1.6, boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <button onClick={() => (template || useCustom) && setStep(3)} disabled={!template && !useCustom} className={(template || useCustom) ? 'btn-primary' : ''} style={{
                padding: '14px 42px', fontSize: 16.5, borderRadius: 14,
                background: !template && !useCustom ? 'rgba(195,165,110,0.2)' : undefined,
                border: !template && !useCustom ? '1px solid rgba(195,165,110,0.3)' : 'none',
                color: !template && !useCustom ? T.dim : 'white',
                cursor: !template && !useCustom ? 'not-allowed' : 'pointer',
              }}>
                {(template || useCustom) ? 'Continue with this Template →' : 'Select a template to continue'}
              </button>
            </div>
          </div>
        )}

        {/* ════════ STEP 3: PASTE INFO ════════ */}
        {step === 3 && (
          <div style={{ animation: 'fadeUp 0.5s ease-out', maxWidth: 820, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)', border: `1px solid rgba(176,125,42,0.25)`, borderRadius: 24, padding: '7px 20px', marginBottom: 18, fontSize: 13.2, color: T.gold, letterSpacing: '0.3px' }}>
                🖊️ Step 3 of 3 — Your Information
              </div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 'clamp(26px,4vw,42px)', fontWeight: 800, color: T.text, marginBottom: 12, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                Tell us everything about yourself
              </h1>
              <p style={{ color: T.muted, fontSize: 15.4, maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
                Paste everything you have — rough notes, LinkedIn bio, old resume text, project descriptions. Don't worry about format. Our AI will structure it all perfectly.
              </p>
            </div>

            {/* ── Selected template reminder ── */}
            {template && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
                padding: '12px 18px', borderRadius: 14,
                background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)',
                border: `1.5px solid ${template.accent || T.gold}30`,
                boxShadow: `0 4px 20px ${template.accent || T.gold}10`,
              }}>
                {/* Color swatch */}
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${template.accentDark || template.accent || T.gold}, ${template.accent || T.gold})`, flexShrink: 0, boxShadow: `0 3px 10px ${template.accent || T.gold}40` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14, color: T.text }}>
                    {template.name || 'Selected Template'}
                    <span style={{ fontSize: 11, fontWeight: 400, color: T.muted, marginLeft: 8 }}>{stream?.label} · {template.layout?.replace('-',' ')} layout</span>
                  </div>
                  {template.selectedSections && (() => {
                    const visible = template.selectedSections.filter(s => s.visible !== false && !s.deleted);
                    return (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                        {visible.map(s => (
                          <span key={s.key} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${template.accent || T.gold}14`, color: template.accentDark || template.accent || T.gold, border: `1px solid ${template.accent || T.gold}30`, fontWeight: 600 }}>
                            {s.label}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <button
                  onClick={() => {
                    setStep(2);
                    if (template && !useCustom) {
                      // Re-open the preview modal for the selected template,
                      // restoring all previously saved edits (sections, accent, etc.)
                      setPreviewModal(template);
                    }
                  }}
                  style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid rgba(195,165,110,0.3)`, background: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12, color: T.muted, flexShrink: 0 }}>
                  ✏️ Change Headings
                </button>
              </div>
            )}

            {/* ── Page Mode Selector ── */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'Playfair Display',serif", marginBottom: 10 }}>
                📐 Choose Resume Length
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  {
                    key: 'single',
                    icon: '📄',
                    title: 'Single Page',
                    subtitle: 'Strict 1-page A4',
                    desc: 'AI aggressively compresses content — every bullet fits in one line, only key sections kept. Best for 0–3 years experience.',
                    badge: 'RECOMMENDED',
                    badgeColor: T.sage,
                  },
                  {
                    key: 'multi',
                    icon: '📑',
                    title: 'Multi Page',
                    subtitle: 'No page limit',
                    desc: 'Full content preserved — all bullets, sections and details included. Best for 3+ years experience or academic CVs.',
                    badge: 'DETAILED',
                    badgeColor: T.blue,
                  },
                ].map(opt => {
                  const isActive = pageMode === opt.key;
                  return (
                    <div
                      key={opt.key}
                      onClick={() => setPageMode(opt.key)}
                      style={{
                        padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                        background: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.45)',
                        backdropFilter: 'blur(12px)',
                        border: `2px solid ${isActive ? (opt.key==='single' ? T.sage : T.blue) : 'rgba(195,165,110,0.22)'}`,
                        boxShadow: isActive ? `0 6px 24px ${opt.key==='single' ? 'rgba(76,138,114,0.18)' : 'rgba(74,112,156,0.18)'}` : 'none',
                        transform: isActive ? 'translateY(-2px)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 20 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14.3, color: T.text, display: 'flex', alignItems: 'center', gap: 7 }}>
                            {opt.title}
                            {isActive && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: opt.key==='single' ? T.sageBg : T.blueBg, color: opt.key==='single' ? T.sage : T.blue, border: `1px solid ${opt.key==='single' ? T.sage+'40' : T.blue+'40'}` }}>{opt.badge}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: isActive ? (opt.key==='single' ? T.sage : T.blue) : T.muted, fontWeight: 600, marginTop: 1 }}>{opt.subtitle}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isActive ? (opt.key==='single' ? T.sage : T.blue) : 'rgba(195,165,110,0.35)'}`, background: isActive ? (opt.key==='single' ? T.sage : T.blue) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isActive && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.5, paddingLeft: 28 }}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start', marginBottom: 24 }}>
              <div className="glass-card" style={{ padding: '20px 18px', position: 'sticky', top: 80 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 13.8, color: T.text, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📋 <span>What to include</span>
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 12, fontStyle: 'italic' }}>The more detail, the better your resume</div>
                {[
                  { icon: '👤', label: 'Personal', detail: 'Name, phone, email, city' },
                  { icon: '🎓', label: 'Education', detail: 'College, year, CGPA/%' },
                  { icon: '💼', label: 'Work Exp', detail: 'Company, role, dates, what you did' },
                  { icon: '🛠', label: 'Projects', detail: 'Name, tech stack, impact' },
                  { icon: '⚙️', label: 'Skills', detail: 'Tools, languages, certs' },
                  { icon: '🏆', label: 'Achievements', detail: 'Rank, awards, competitions' },
                  { icon: '📜', label: 'Certifications', detail: 'Name, issuer, year' },
                  { icon: '🌱', label: 'Extra-curricular', detail: 'Clubs, sports, volunteering' },
                  { icon: '🔗', label: 'Links', detail: 'LinkedIn, GitHub, portfolio' },
                  { icon: '📅', label: 'Personal details', detail: 'DOB, languages known' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 9, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(195,165,110,0.15)' }}>
                    <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text, marginBottom: 1 }}>{item.label}</div>
                      <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.35 }}>{item.detail}</div>
                    </div>
                  </div>
                ))}

                {/* ChatGPT Prompt Copy Button */}
                <div style={{ marginTop: 16, borderTop: '1px solid rgba(195,165,110,0.18)', paddingTop: 14 }}>
                  {/* Header label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: 'linear-gradient(180deg,#74b9ff,#0984e3)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily:"'Jost',sans-serif", letterSpacing: '0.2px' }}>No structured data yet?</div>
                      <div style={{ fontSize: 10, color: T.muted, fontFamily:"'Jost',sans-serif", lineHeight: 1.3 }}>Use this prompt in ChatGPT, then paste here</div>
                    </div>
                  </div>

                  {/* The button */}
                  <div style={{ position: 'relative' }}>
                    {/* Ambient glow behind button */}
                    {!promptCopied && (
                      <div style={{
                        position: 'absolute', inset: -3, borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(116,185,255,0.25), rgba(9,132,227,0.18), rgba(116,185,255,0.25))',
                        filter: 'blur(6px)',
                        animation: 'pulse 2.8s ease-in-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}

                    <button
                      onClick={() => {
                        const CHATGPT_PROMPT = `You are an expert resume writer, ATS optimization specialist, and career coach.\n\nIMPORTANT INSTRUCTIONS:\n- The user will FIRST send this prompt.\n- The user will THEN send their raw resume data in the NEXT message.\n- DO NOT generate any output until the user provides their data.\n\n---\n\nYOUR TASK\n\nYou will receive unstructured, poorly written, grammatically incorrect resume content.\n\nYour job is to:\n1. CLEAN the language (fix grammar, spelling, clarity)\n2. STRUCTURE the content properly into sections\n3. CONVERT inputs into strong, numbered points WITH supporting detail lines\n4. ENRICH the content by adding meaningful context based on understanding\n5. ADD metrics/impact wherever logically possible (%, scale, outcomes)\n6. USE strong ACTION VERBS at the beginning of EVERY point\n7. DO NOT add false information — only enhance and infer reasonably\n8. IF data is missing or unclear, ASK for clarification instead of guessing\n\n---\n\nACTION VERB RULE (MANDATORY)\n\n- EVERY numbered point MUST start with a strong action verb\n- DO NOT repeat the same verb excessively\n- Use varied, high-impact verbs such as:\n\nDeveloped, Built, Led, Designed, Implemented, Optimized, Analyzed, Automated, Delivered, Improved, Created, Engineered, Spearheaded, Executed, Reduced, Increased, Managed\n\n- Avoid weak phrases like:\n  ❌ "Worked on"\n  ❌ "Helped with"\n  ❌ "Was responsible for"\n\n---\n\nCLARIFICATION RULE (VERY IMPORTANT)\n\n- If any section lacks sufficient detail, DO NOT proceed blindly\n- ASK follow-up questions BEFORE generating final output\n- Questions must be:\n  - Clear and specific\n  - In numbered format\n  - Easy for user to answer quickly\n\nExample:\n1. What technologies did you use in Project X?\n2. Any measurable impact (users, revenue, time saved)?\n3. What was your exact role in the team?\n\n- Once user responds, THEN generate the final resume\n\n---\n\nOUTPUT FORMAT (STRICT — FOLLOW EXACTLY)\n\n1. Personal\n- Name:\n- Phone:\n- Email:\n- City:\n\n---\n\n2. Education\nFor each entry:\n- College Name | Degree | Year\n- CGPA / Percentage\n\n1. Key Focus / Academic Strength\n   → Start with action verb and explain specialization or strengths\n\n2. Notable Learning / Exposure\n   → Start with action verb and mention relevant coursework or exposure\n\n---\n\n3. Work Experience\nFor each role:\n- Company Name | Role | Duration\n\n1. Responsibility / Contribution\n   → Start with action verb and describe primary responsibility\n\n2. Action + Impact\n   → Start with action verb and include measurable or logical outcome\n\n3. Tools / Skills Applied\n   → Start with action verb and mention technologies/methods used\n\n4. Business/Team Impact\n   → Start with action verb and explain impact on team/company\n\n5. Additional Highlight (optional)\n   → Start with action verb and show leadership/initiative\n\n---\n\n4. Projects\nFor each project:\n- Project Name | Tech Stack\n\n1. Project Overview\n   → Start with action verb and explain purpose\n\n2. Implementation\n   → Start with action verb and describe features built\n\n3. Impact / Outcome\n   → Start with action verb and explain result/problem solved\n\n4. Technical Depth (optional)\n   → Start with action verb and highlight complexity\n\n---\n\n5. Skills\n\n- Technical Skills:\n- Tools & Technologies:\n- Languages:\n- Certifications (if applicable):\n\n→ Add 1 short line summarizing overall capability\n\n---\n\n6. Achievements\n\n1. Achievement Title\n   → Start with action verb and add impact/ranking\n\n2. Achievement Title\n   → Start with action verb and add context\n\n3. Achievement Title\n   → Start with action verb and add measurable detail\n\n---\n\n7. Certifications\n\n1. Certification Name | Issuer | Year\n   → Start with action verb and explain skill validated\n\n2. Certification Name | Issuer | Year\n   → Start with action verb and explain relevance\n\n---\n\n8. Extra-Curricular\n\n1. Activity / Role\n   → Start with action verb and describe contribution\n\n2. Activity / Role\n   → Start with action verb and describe impact\n\n---\n\n9. Links\n\n- LinkedIn:\n- GitHub:\n- Portfolio:\n\n---\n\n10. Personal Details\n\n- Date of Birth:\n- Languages Known:\n\n---\n\nWRITING RULES\n\n- Use NUMBERED points (1, 2, 3…)\n- EACH point MUST include a short descriptive line (→ format)\n- EVERY point MUST start with an ACTION VERB\n- Keep each point concise (1–2 lines max)\n- NO plain bullet fragments — always include explanation\n- Avoid repetition of verbs\n- Keep language professional, concise, and impactful\n- Avoid fluff or generic statements\n\n---\n\nEXECUTION FLOW\n\nSTEP 1: Wait for user data\nSTEP 2: Check if data is sufficient\nSTEP 3: If NOT sufficient → Ask clarification questions (numbered)\nSTEP 4: If sufficient → Generate final structured resume\n\n---\n\nWAITING MODE\n\nNow WAIT for the user to provide their data in the next message.\nDo NOT respond until data is received.`;
                        navigator.clipboard.writeText(CHATGPT_PROMPT).then(() => {
                          setPromptCopied(true);
                          setTimeout(() => setPromptCopied(false), 2500);
                        }).catch(() => {
                          const ta = document.createElement('textarea');
                          ta.value = CHATGPT_PROMPT;
                          ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                          setPromptCopied(true);
                          setTimeout(() => setPromptCopied(false), 2500);
                        });
                      }}
                      style={{
                        position: 'relative', overflow: 'hidden',
                        width: '100%', padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        fontSize: 12.5, fontWeight: 700, fontFamily: "'Jost',sans-serif",
                        letterSpacing: '0.3px',
                        border: promptCopied ? `1.5px solid ${T.ok}` : '1.5px solid rgba(9,132,227,0.55)',
                        background: promptCopied
                          ? `linear-gradient(135deg, ${T.ok}18, ${T.ok}08)`
                          : 'linear-gradient(135deg, rgba(116,185,255,0.18) 0%, rgba(9,132,227,0.12) 50%, rgba(116,185,255,0.18) 100%)',
                        color: promptCopied ? T.ok : '#0984e3',
                        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                        transform: promptCopied ? 'scale(0.97)' : 'scale(1)',
                        boxShadow: promptCopied
                          ? `0 4px 20px ${T.ok}30`
                          : '0 4px 16px rgba(9,132,227,0.18)',
                      }}
                      onMouseEnter={e => { if (!promptCopied) { e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(9,132,227,0.28)'; e.currentTarget.style.borderColor = 'rgba(9,132,227,0.75)'; }}}
                      onMouseLeave={e => { if (!promptCopied) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(9,132,227,0.18)'; e.currentTarget.style.borderColor = 'rgba(9,132,227,0.55)'; }}}
                    >
                      {/* Shimmer sweep on idle */}
                      {!promptCopied && (
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)',
                          animation: 'promptShimmer 2.6s ease-in-out infinite',
                          pointerEvents: 'none',
                        }} />
                      )}

                      {/* Success ripple */}
                      {promptCopied && (
                        <div style={{
                          position: 'absolute', width: 40, height: 40, borderRadius: '50%',
                          background: `${T.ok}30`,
                          animation: 'successRipple 0.6s ease-out forwards',
                          pointerEvents: 'none',
                        }} />
                      )}

                      {/* Icon */}
                      <span style={{
                        fontSize: 15,
                        display: 'inline-block',
                        animation: promptCopied ? 'checkPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'promptBounceIcon 2.8s ease-in-out infinite',
                        flexShrink: 0,
                      }}>
                        {promptCopied ? '✓' : '✦'}
                      </span>

                      {/* Label */}
                      <span style={{ position: 'relative', zIndex: 1 }}>
                        {promptCopied ? 'Prompt Copied to Clipboard!' : 'Copy ChatGPT Prompt'}
                      </span>

                      {/* ChatGPT badge */}
                      {!promptCopied && (
                        <span style={{
                          marginLeft: 'auto', fontSize: 9.5, fontWeight: 700,
                          background: 'linear-gradient(135deg,#74b9ff,#0984e3)',
                          color: '#fff', padding: '2px 7px', borderRadius: 20,
                          letterSpacing: '0.4px', textTransform: 'uppercase', flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(9,132,227,0.35)',
                        }}>GPT</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <textarea
                  value={rawInfo}
                  onChange={e => setRawInfo(e.target.value)}
                  placeholder={`Paste everything here. Example:\n\nName: Priya Sharma\nPhone: 9876543210 | Email: priya@gmail.com | Location: Bangalore\nLinkedIn: linkedin.com/in/priyasharma\n\nEducation:\nB.Tech Computer Science — IIT Bombay, 2019–2023, CGPA: 8.7/10\n\nWork Experience:\nSoftware Engineer at Google India, July 2023 – Present\n- Built recommendation engine for Google Maps, improved CTR by 23%\n\nSkills: Python, Java, React, AWS, Docker, SQL\nAchievements: AIR 487 JEE Advanced | Google India Scholarship 2022\nDOB: 12 Jan 2001 | Nationality: Indian`}
                  style={{
                    width: '100%', height: 420, padding: '18px 20px',
                    background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(12px)',
                    border: `1.5px solid rgba(195,165,110,0.35)`, borderRadius: 16,
                    fontSize: 13.8, color: T.text, lineHeight: 1.7, resize: 'vertical',
                    outline: 'none', fontFamily: "'Jost',sans-serif", boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = T.gold}
                  onBlur={e => e.target.style.borderColor = 'rgba(195,165,110,0.35)'}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 2px' }}>
                  <span style={{ fontSize: 11.5, color: T.muted }}>💡 More detail = higher quality resume</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: rawInfo.length > 500 ? T.ok : rawInfo.length > 200 ? T.gold : T.muted }}>
                    {rawInfo.length > 500 ? '✓ Great detail' : rawInfo.length > 200 ? '↑ Add more detail' : `${rawInfo.length} chars`}
                  </span>
                </div>

                {genError && (
                  <div style={{ padding: '12px 16px', background: 'rgba(184,92,82,0.08)', border: `1px solid rgba(184,92,82,0.3)`, borderRadius: 12, fontSize: 13.2, color: T.danger, marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0 }}>❌</span> {genError}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={!rawInfo.trim() || generating}
                  className={rawInfo.trim() && !generating ? 'btn-primary' : ''}
                  style={{
                    width: '100%', marginTop: 16, padding: '17px 24px', fontSize: 17.6, borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    background: !rawInfo.trim() || generating ? 'rgba(195,165,110,0.18)' : undefined,
                    border: !rawInfo.trim() || generating ? '1.5px solid rgba(195,165,110,0.28)' : 'none',
                    color: !rawInfo.trim() || generating ? T.dim : 'white',
                    cursor: !rawInfo.trim() || generating ? 'not-allowed' : 'pointer',
                    animation: rawInfo.trim() && !generating ? 'floatY 3s ease-in-out infinite' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {generating
                    ? <><span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', fontSize: 18 }}>✦</span> Building…</>
                    : <>✨ Build My Resume →</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════ FULL-SCREEN LOADING OVERLAY ════════ */}
        {generating && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(253,248,240,0.97)', backdropFilter: 'blur(24px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(176,125,42,0.13) 0%, transparent 65%)', top: '5%', left: '10%', animation: 'orb1 8s ease-in-out infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(76,138,114,0.1) 0%, transparent 65%)', bottom: '10%', right: '8%', animation: 'orb2 11s ease-in-out infinite 2s', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 32 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(176,125,42,0.12)', animation: 'spin 4s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: `3px solid transparent`, borderTopColor: T.gold, borderRightColor: `${T.gold}88`, animation: 'spin 1.1s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: `2px solid transparent`, borderBottomColor: T.sage, borderLeftColor: `${T.sage}66`, animation: 'spinRev 1.7s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, animation: 'pulse 2s ease-in-out infinite' }}>✦</div>
            </div>

            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, fontWeight: 700, color: T.text, marginBottom: 10, letterSpacing: '-0.3px', textAlign: 'center' }}>
              {useCustom && refPDFImage ? 'Replicating your template' : 'Crafting your resume'}
            </div>
            <div style={{ fontSize: 15, color: T.muted, marginBottom: 40, textAlign: 'center', maxWidth: 380, lineHeight: 1.55 }}>
              {useCustom && refPDFImage
                ? 'Analysing layout, colors & structure — then filling with your content'
                : `Applying STAR framework · Optimising for ${stream?.label || 'your field'}`}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 540 }}>
              {(useCustom && refPDFImage
                ? [{ icon: '🔍', label: 'Scanning visual layout' }, { icon: '🎨', label: 'Extracting colors & fonts' }, { icon: '⚙️', label: 'Building structure' }, { icon: '✍️', label: 'Filling your content' }]
                : [{ icon: '📖', label: 'Parsing your information' }, { icon: '✍️', label: 'Writing STAR bullets' }, { icon: '📐', label: 'Structuring sections' }, { icon: '✨', label: 'Polishing & finalising' }]
              ).map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 30,
                  background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)',
                  border: `1px solid rgba(176,125,42,0.2)`, boxShadow: '0 2px 12px rgba(176,125,42,0.07)',
                  animation: `blink 2s ${i * 0.5}s infinite`,
                }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{s.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 36 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: T.gold, opacity: 0.7, animation: `dotBounce 1.4s ${i*0.18}s ease-in-out infinite` }} />
              ))}
            </div>

            <div style={{ position: 'absolute', bottom: 28, fontSize: 12, color: T.dim, letterSpacing: '0.3px' }}>
              This takes 20–40 seconds ✦ crafting something great
            </div>
          </div>
        )}

        {/* ════════ STEP 4: PREVIEW + DOWNLOAD ════════ */}
        {step === 4 && resumeData && (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>

            {/* ══ HERO CARD ══ */}
            <div style={{
              background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(195,165,110,0.22)',
              borderRadius: 20, padding: '24px 28px 20px',
              marginBottom: 22,
              boxShadow: '0 8px 40px rgba(140,105,50,0.10)',
            }}>

              {/* Top row: title + subtitle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 26, color: T.text, marginBottom: 5, letterSpacing: '-0.3px' }}>
                    Your Resume is Ready! 🎉
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {resumeData?.personalInfo?.name && (
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: T.gold }}>
                        {resumeData.personalInfo.name}
                      </span>
                    )}
                    <span style={{ color: T.dim, fontSize: 13 }}>·</span>
                    <span style={{ fontSize: 13, color: T.muted }}>{stream?.label}</span>
                    <span style={{ color: T.dim, fontSize: 13 }}>·</span>
                    <span style={{ fontSize: 13, color: T.muted }}>{template?.name || (useCustom ? 'Your Style' : 'Custom')} Template</span>
                  </div>
                </div>

                {/* Badges top-right */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(customResumeHTML ? [
                    { icon: '✦', text: 'Style Matched',          color: T.sage },
                    { icon: '✦', text: 'STAR Applied',           color: T.ok   },
                    { icon: '✦', text: 'Colors Replicated',      color: T.blue },
                    { icon: '✦', text: 'A4 Format',              color: T.gold },
                  ] : [
                    { icon: '✦', text: 'STAR Framework',         color: T.sage },
                    { icon: '✦', text: 'ATS Optimised',          color: T.ok   },
                    { icon: '✦', text: 'Indian Format',          color: T.blue },
                    { icon: pageMode === 'single' ? '📄' : '📑', text: pageMode === 'single' ? '1 Page' : 'Multi Page', color: pageMode === 'single' ? T.gold : T.blue },
                  ]).map((b, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 20,
                      background: `${b.color}10`, border: `1px solid ${b.color}35`, color: b.color,
                      letterSpacing: '0.2px', whiteSpace: 'nowrap',
                    }}>{b.icon} {b.text}</span>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(195,165,110,0.15)', marginBottom: 18 }} />

              {/* Buttons — two logical groups */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>

                {/* LEFT GROUP — Edit/Navigate actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

                  {/* Change Resume Length */}
                  <button
                    onClick={() => { setStep(3); setResumeData(null); }}
                    style={{
                      padding: '8px 16px', fontSize: 12.5, fontFamily: "'Jost',sans-serif", fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
                      border: '1.5px solid rgba(61,122,99,0.45)',
                      borderRadius: 10, color: '#3D7A63',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(61,122,99,0.1)'; e.currentTarget.style.borderColor='#3D7A63'; e.currentTarget.style.transform='translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor='rgba(61,122,99,0.45)'; e.currentTarget.style.transform=''; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                    Change Length
                  </button>

                  {/* Change Headings */}
                  <button
                    onClick={() => { setResumeData(null); setStep(2); if (template && !useCustom) { setPreviewModal(template); } }}
                    style={{
                      padding: '8px 16px', fontSize: 12.5, fontFamily: "'Jost',sans-serif", fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
                      border: '1.5px solid rgba(176,125,42,0.45)',
                      borderRadius: 10, color: '#9A6318',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(176,125,42,0.08)'; e.currentTarget.style.borderColor='#B07D2A'; e.currentTarget.style.transform='translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor='rgba(176,125,42,0.45)'; e.currentTarget.style.transform=''; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Change Headings
                  </button>

                </div>

                {/* RIGHT GROUP — Primary download CTAs */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>

                  {/* Download Word */}
                  <button
                    onClick={handleWord}
                    disabled={wordLoading}
                    style={{
                      padding: '10px 22px', fontSize: 13.5, fontFamily: "'Jost',sans-serif", fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 8, cursor: wordLoading ? 'not-allowed' : 'pointer',
                      background: wordLoading ? 'rgba(74,112,156,0.45)' : 'linear-gradient(135deg, #2D5A8E 0%, #4A84C8 100%)',
                      border: 'none', borderRadius: 12, color: '#fff',
                      boxShadow: wordLoading ? 'none' : '0 4px 20px rgba(45,90,142,0.38)',
                      transition: 'all 0.22s ease',
                      position: 'relative', overflow: 'hidden',
                      animation: wordLoading ? 'none' : 'wordBtnPulse 2.8s ease-in-out infinite',
                    }}
                    onMouseEnter={e => { if (!wordLoading) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(45,90,142,0.52)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=wordLoading?'none':'0 4px 20px rgba(45,90,142,0.38)'; }}
                  >
                    {!wordLoading && (
                      <span style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)',
                        animation: 'wordShimmer 2.8s ease-in-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}
                    {wordLoading
                      ? <><span style={{ animation: 'spin 0.9s linear infinite', display: 'inline-block' }}>⟳</span> Preparing…</>
                      : <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/></svg>
                          Download Word
                        </>
                    }
                  </button>

                  {/* Download PDF — primary CTA */}
                  <button
                    onClick={handlePDF}
                    disabled={pdfLoading}
                    style={{
                      padding: '10px 26px', fontSize: 14, fontFamily: "'Jost',sans-serif", fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 8, cursor: pdfLoading ? 'not-allowed' : 'pointer',
                      background: pdfLoading ? 'rgba(176,125,42,0.45)' : 'linear-gradient(135deg, #8A5412 0%, #D4A040 55%, #A87020 100%)',
                      border: 'none', borderRadius: 12, color: '#fff',
                      boxShadow: pdfLoading ? 'none' : '0 6px 28px rgba(176,125,42,0.50)',
                      transition: 'all 0.25s ease',
                      letterSpacing: '0.2px',
                    }}
                    onMouseEnter={e => { if (!pdfLoading) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 36px rgba(176,125,42,0.65)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=pdfLoading?'none':'0 6px 28px rgba(176,125,42,0.50)'; }}
                  >
                    {pdfLoading
                      ? <><span style={{ animation: 'spin 0.9s linear infinite', display: 'inline-block' }}>⟳</span> Generating…</>
                      : <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Download PDF
                        </>
                    }
                  </button>

                </div>
              </div>

            </div>
            {/* ══ END HERO CARD ══ */}

            <div id="rb-print-target" style={{ position: 'fixed', left: '-9999px', top: 0, width: 794, overflow: 'visible', background: '#fff', zIndex: -9999, pointerEvents: 'none' }}>
              {customResumeHTML
                ? <div dangerouslySetInnerHTML={{ __html: customResumeHTML }} style={{ width: 794 }} />
                : <ResumeRenderer data={resumeData} template={template || { layout: 'classic', accent: '#1a73e8', accentLight: '#e8f0fe', accentDark: '#0d47a1' }} sections={template?.selectedSections} />
              }
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 60 }}>
              <div>
                <div style={{ background: '#ede8df', padding: '32px 32px 48px', borderRadius: 12, boxShadow: '0 32px 80px rgba(0,0,0,0.13), 0 8px 24px rgba(0,0,0,0.06)', position: 'relative', display: 'inline-block' }}>

                  {/* Page break overlay — renders after content using a portal-like approach */}
                  {(() => {
                    const A4_H_PX = 1123; // A4 height in px at 96dpi (794 × 1.4142)
                    const scaledA4H = A4_H_PX * SCALE;
                    const scaledW   = RESUME_W * SCALE;
                    // Estimate content height from DOM after render — use ResizeObserver via React state
                    // For now calculate from content height via the exportRef
                    const contentH = previewContentH;
                    const totalPages = Math.ceil(contentH / A4_H_PX);
                    const pageBreaks = Array.from({ length: totalPages - 1 }, (_, i) => (i + 1) * scaledA4H);
                    return pageBreaks.map((y, i) => (
                      <div key={i} style={{
                        position: 'absolute',
                        left: 0, right: 0,
                        top: 32 + y, // 32 = top padding of outer container
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}>
                        {/* Dashed page break line */}
                        <div style={{
                          height: 2,
                          background: 'repeating-linear-gradient(90deg, #c0392b 0, #c0392b 8px, transparent 8px, transparent 16px)',
                          width: scaledW,
                          opacity: 0.7,
                        }} />
                        {/* Page label */}
                        <div style={{
                          position: 'absolute', right: 0, top: 3,
                          background: '#c0392b', color: '#fff',
                          fontSize: 9.5, fontWeight: 700, fontFamily: "'Jost',sans-serif",
                          padding: '1px 7px', borderRadius: '0 0 0 6px',
                          letterSpacing: '0.3px', whiteSpace: 'nowrap',
                        }}>Page {i + 2}</div>
                        {/* Shadow below — simulates paper gap */}
                        <div style={{
                          height: 6,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, transparent 100%)',
                          width: scaledW,
                        }} />
                      </div>
                    ));
                  })()}

                  <div style={{
                    width: RESUME_W * SCALE,
                    background: '#fff',
                    boxShadow: '0 6px 40px rgba(0,0,0,0.14), 0 1px 6px rgba(0,0,0,0.07)',
                    borderRadius: 2,
                    display: 'block',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: RESUME_W,
                      transform: `scale(${SCALE})`,
                      transformOrigin: 'top left',
                      height: 'fit-content',
                      lineHeight: 'normal',
                    }}>
                      <div id="rb-preview-content" ref={exportRef} style={{ width: 794, background: '#fff', display: 'block' }}>
                        {customResumeHTML
                          ? <div dangerouslySetInnerHTML={{ __html: customResumeHTML }} style={{ width: 794 }} />
                          : <ResumeRenderer data={resumeData} template={template || { layout: 'classic', accent: '#1a73e8', accentLight: '#e8f0fe', accentDark: '#0d47a1' }} sections={template?.selectedSections} />
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Page count + template info */}
                {(() => {
                  const contentH = previewContentH;
                  const totalPages = Math.ceil(contentH / 1123);
                  return (
                    <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12.1, color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span>{pageMode === 'single' ? '📄' : '📑'}</span>
                      <span>A4 · <strong style={{ color: totalPages > 1 ? T.warn : T.ok }}>{totalPages} Page{totalPages > 1 ? 's' : ''}</strong></span>
                      <span style={{ color: T.dim }}>·</span>
                      <span>{template?.name || (useCustom ? 'Your Style' : 'Custom')} Template</span>
                      {totalPages > 1 && pageMode === 'single' && (
                        <span style={{ fontSize: 11, color: T.danger, fontWeight: 600, background: `${T.danger}12`, padding: '2px 8px', borderRadius: 10, border: `1px solid ${T.danger}30` }}>
                          ⚠ Regenerate as Multi-Page or shorten content
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 40 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14.3, color: T.text, marginBottom: 12 }}>💡 Pro Tips for Your Resume</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                {[
                  'Keep resume to 1 page if under 3 years experience',
                  'Customize the profile summary for every job you apply to',
                  'Add specific numbers to all bullets where possible',
                  'Upload to LinkedIn as your featured resume',
                  'Run through CVsetuAI ATS Score Engine before applying',
                  'Save both PDF and Word versions — employers prefer different formats',
                ].map((tip, i) => (
                  <div key={i} style={{ fontSize: 12.1, color: T.muted, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ color: T.gold, flexShrink: 0, marginTop: 1 }}>›</span> {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function App() {
  injectGlobalCSS();
  const [page,       setPage]       = useState('landing');
  const [progress,   setProgress]   = useState(0);
  const [results,    setResults]    = useState(null);
  const [error,      setError]      = useState('');
  const [storedFile, setStoredFile] = useState(null);

  const handleAnalyze = useCallback(async ({ resumeFile, jdFile, industry, role, stream }) => {
    setPage('analyzing');
    setProgress(0);
    setError('');
    setStoredFile(resumeFile);

    try {
      const resumeText = await extractPDFText(resumeFile);
      const jdText     = jdFile ? await extractPDFText(jdFile) : '';
      const result     = await runAnalysis({ resumeText, jdText, industry, role, stream });

      // Signal completion — AnalyzingScreen's own timer handles all intermediate %
      setProgress(100);
      setResults(result);
      setTimeout(() => setPage('results'), 800);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please check your PDF and try again.');
      setPage('upload');
    }
  }, []);

  if (page === 'landing')       return <LandingScreen onStart={() => setPage('upload')} onCreateResume={() => setPage('resumeBuilder')} />;
  if (page === 'resumeBuilder') return <ResumeBuilderWizard onBack={() => setPage('landing')} />;
  if (page === 'analyzing') return <AnalyzingScreen progress={progress} />;
  if (page === 'results')   return <ResultsDashboard results={results} resumeFile={storedFile} onBack={() => setPage('landing')} onReanalyze={() => setPage('upload')} />;

  return (
    <>
      <UploadScreen onBack={() => setPage('landing')} onAnalyze={handleAnalyze} />
      {error && (
        <div style={{ position:'fixed',top:0,left:0,right:0,zIndex:2000,background:'rgba(253,248,240,0.96)',backdropFilter:'blur(20px)',borderBottom:`2px solid ${T.danger}`,padding:'14px 24px',display:'flex',alignItems:'flex-start',gap:14,boxShadow:'0 4px 24px rgba(184,92,82,0.15)' }}>
          <span style={{fontSize:20,flexShrink:0}}>❌</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,color:T.danger,fontSize:14,marginBottom:4}}>Analysis Failed</div>
            <div style={{color:T.rose,fontSize:13,lineHeight:1.5,fontFamily:"'Jost',sans-serif"}}>{error}</div>
          </div>
          <button onClick={() => setError('')} className="btn-ghost" style={{padding:'5px 12px',fontSize:12,flexShrink:0}}>Dismiss ✕</button>
        </div>
      )}
    </>
  );
}
