import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./src/supabaseClient.js";

const ISSUE_CATEGORIES = {
    "Mobile Experience": [
        { id: "mob1", label: "Site not mobile responsive", impact: "visitors on phones see a broken layout and leave immediately" },
        { id: "mob2", label: "Text too small to read on mobile", impact: "people have to pinch-zoom just to read anything, most won't bother" },
        { id: "mob3", label: "Buttons/links too small to tap", impact: "visitors can't actually click your CTAs on a phone" },
        { id: "mob4", label: "Layout breaks on mobile", impact: "elements overlap or go offscreen, making the site unusable on phones" },
        { id: "mob5", label: "Horizontal scrolling required", impact: "forces visitors to scroll sideways which feels broken and unprofessional" },
    ],
    "Page Speed": [
        { id: "spd1", label: "Very slow load time (5s+)", impact: "most visitors leave before the page even finishes loading" },
        { id: "spd2", label: "Slow load time (3-5s)", impact: "you're losing a chunk of visitors to impatience before they see your content" },
        { id: "spd3", label: "Huge uncompressed images", impact: "images are loading at full resolution, tanking your page speed for no reason" },
        { id: "spd4", label: "PageSpeed score below 40", impact: "Google is actively ranking you lower because your site is so slow" },
        { id: "spd5", label: "PageSpeed score 40-60", impact: "your site is slower than most competitors, hurting both rankings and conversions" },
    ],
    "Functionality": [
        { id: "fn1", label: "Contact form is broken", impact: "people trying to reach you literally can't — you're losing leads you already earned" },
        { id: "fn2", label: "Phone number not clickable on mobile", impact: "mobile visitors can't tap to call, they have to memorize and manually dial your number" },
        { id: "fn3", label: "Broken links / 404 pages", impact: "visitors hit dead ends, looks unprofessional and kills trust" },
        { id: "fn4", label: "Missing images", impact: "blank spaces where images should be make the site look abandoned" },
        { id: "fn5", label: "Navigation menu broken", impact: "visitors can't find their way around your site at all" },
        { id: "fn6", label: "Forms submit but go nowhere", impact: "you think leads are coming in but the form data isn't actually reaching you" },
    ],
    "SEO Red Flags": [
        { id: "seo1", label: "No meta description", impact: "Google shows a random snippet instead of a compelling reason to click your listing" },
        { id: "seo2", label: "Missing or generic title tags", impact: "your pages show up in Google as 'Home' or 'Untitled' instead of your business name" },
        { id: "seo3", label: "HTTP instead of HTTPS", impact: "browsers show a 'Not Secure' warning to every visitor — instant trust killer" },
        { id: "seo4", label: "Doesn't show up in Google for business name", impact: "people who search specifically for your business can't find you" },
        { id: "seo5", label: "No Google Business integration", impact: "you're invisible on Google Maps and local search results" },
    ],
    "Design & Trust": [
        { id: "des1", label: "Severely outdated design", impact: "the site looks like it was built 10+ years ago, which makes the business feel behind the times" },
        { id: "des2", label: "No testimonials or reviews", impact: "nothing on the site builds trust or shows that real people use your service" },
        { id: "des3", label: "No clear call to action", impact: "visitors don't know what you want them to do — call? book? fill out a form?" },
        { id: "des4", label: "All stock photos", impact: "the site feels generic and impersonal, doesn't show the real business" },
        { id: "des5", label: "No address or location info", impact: "local customers can't confirm you're actually in their area" },
        { id: "des6", label: "Walls of text, no structure", impact: "nobody reads it — visitors skim and bounce" },
    ],
    "Critical (Jackpot)": [
        { id: "crit1", label: "No website at all", impact: "ad traffic goes to Facebook only — no professional web presence, no SEO, no conversion funnel" },
        { id: "crit2", label: "Site is completely down", impact: "they're paying for ads that send people to an error page" },
        { id: "crit3", label: "Domain expired", impact: "their web address leads nowhere — any existing SEO equity is evaporating" },
    ],
};
const ISSUE_CATEGORIES_ENTRIES = [
    ["Critical (Jackpot)", ISSUE_CATEGORIES["Critical (Jackpot)"]],
    ...Object.entries(ISSUE_CATEGORIES).filter(([k]) => k !== "Critical (Jackpot)")
];
const CADENCE = { 1: 0, 2: 3, 3: 7 };

const STATUS_CONFIG = {
    new: { label: "New Lead", color: "#64748b", bg: "#1e293b", icon: "◯" },
    msg1_ready: { label: "Prompt Ready", color: "#f59e0b", bg: "#451a03", icon: "◎" },
    msg1_sent: { label: "Msg 1 Sent", color: "#3b82f6", bg: "#172554", icon: "①" },
    msg2_due: { label: "Msg 2 Due", color: "#f97316", bg: "#431407", icon: "⧖" },
    msg2_sent: { label: "Msg 2 Sent", color: "#3b82f6", bg: "#172554", icon: "②" },
    msg3_due: { label: "Msg 3 Due", color: "#ef4444", bg: "#450a0a", icon: "⧖" },
    msg3_sent: { label: "Final Msg Sent", color: "#8b5cf6", bg: "#2e1065", icon: "③" },
    dead: { label: "Dead", color: "#6b7280", bg: "#111827", icon: "✕" },
    replied: { label: "Replied!", color: "#10b981", bg: "#022c22", icon: "✓" },
    meeting: { label: "Meeting Set", color: "#06d6a0", bg: "#003d29", icon: "★" },
    converted: { label: "Converted", color: "#fbbf24", bg: "#3d2e00", icon: "$" },
};

const STATUS_ORDER = ["new", "msg1_ready", "msg1_sent", "msg2_due", "msg2_sent", "msg3_due", "msg3_sent", "replied", "meeting", "converted", "dead"];

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function daysBetween(d1, d2) { return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)); }

function dbToLead(row) {
    return {
        id:           row.id,
        name:         row.name,
        business:     row.business,
        businessType: row.business_type,
        url:          row.url,
        adContent:    row.ad_content,
        status:       row.status,
        dateAdded:    new Date(row.date_added),
        lastAction:   new Date(row.last_action),
        issues:       row.issues   ?? [],
        messages:     row.messages ?? { 1: "", 2: "", 3: "" },
        notes:        row.notes,
        keyword:      row.keyword,
    };
}

function leadToDb(lead, userId) {
    return {
        id:            lead.id,
        user_id:       userId,
        name:          lead.name,
        business:      lead.business,
        business_type: lead.businessType,
        url:           lead.url,
        ad_content:    lead.adContent,
        status:        lead.status,
        date_added:    lead.dateAdded instanceof Date ? lead.dateAdded.toISOString() : lead.dateAdded,
        last_action:   lead.lastAction instanceof Date ? lead.lastAction.toISOString() : lead.lastAction,
        issues:        lead.issues,
        messages:      lead.messages,
        notes:         lead.notes,
        keyword:       lead.keyword,
    };
}

const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", icon: "◫" },
    { key: "pipeline", label: "Pipeline", icon: "▤" },
    { key: "prompt", label: "Prompt Maker", icon: "⌘" },
    { key: "keywords", label: "Keyword Bank", icon: "◇" },
    { key: "dead", label: "Dead Leads", icon: "◌" },
];

export default function App({ user }) {
    const [tab, setTab] = useState("dashboard");
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState([]);
    const [revenue, setRevenue] = useState(0);
    const [activeLead, setActiveLead] = useState(null);
    const [editingLead, setEditingLead] = useState(null);
    const [showAddLead, setShowAddLead] = useState(false);
    const [newLead, setNewLead] = useState({ name: "", business: "", businessType: "", url: "", adContent: "", notes: "", keyword: "" });
    const [keywords, setKeywords] = useState([]);
    const [newKeyword, setNewKeyword] = useState("");
    const [promptLead, setPromptLead] = useState(null);
    const [selectedIssues, setSelectedIssues] = useState([]);
    const [generatedPrompt, setGeneratedPrompt] = useState("");
    const [pasteMode, setPasteMode] = useState(null);
    const [pasteText, setPasteText] = useState("");
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [filterStatus, setFilterStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!user) return;
        async function loadData() {
            setLoading(true);
            const [leadsRes, settingsRes] = await Promise.all([
                supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
                supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
            ]);
            if (leadsRes.error)    console.error("leads load error:", leadsRes.error);
            if (settingsRes.error) console.error("settings load error:", settingsRes.error);
            setLeads((leadsRes.data ?? []).map(dbToLead));
            setRevenue(settingsRes.data?.revenue ?? 0);
            setKeywords(settingsRes.data?.keywords ?? []);
            setLoading(false);
        }
        loadData();
    }, [user]);

    const activeLeads = useMemo(() => leads.filter((l) => l.status !== "dead"), [leads]);
    const deadLeads = useMemo(() => leads.filter((l) => l.status === "dead"), [leads]);
    const filteredLeads = useMemo(() => {
        let result = activeLeads;
        if (filterStatus !== "all") result = result.filter((l) => l.status === filterStatus);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((l) => (l.name || "").toLowerCase().includes(q) || (l.business || "").toLowerCase().includes(q) || (l.url || "").toLowerCase().includes(q) || (l.businessType || "").toLowerCase().includes(q));
        }
        return result;
    }, [activeLeads, filterStatus, searchQuery]);

    const stats = useMemo(() => ({
        total: activeLeads.length,
        needsAction: activeLeads.filter((l) => ["new", "msg2_due", "msg3_due"].includes(l.status)).length,
        replied: activeLeads.filter((l) => l.status === "replied").length,
        meetings: activeLeads.filter((l) => l.status === "meeting").length,
        converted: activeLeads.filter((l) => l.status === "converted").length,
        dead: deadLeads.length,
        sent: activeLeads.filter((l) => ["msg1_sent", "msg2_sent", "msg3_sent"].includes(l.status)).length,
    }), [activeLeads, deadLeads]);

    const updateLead = useCallback(async (id, updates) => {
        // Optimistic: apply update immediately
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));

        // Build snake_case partial update for DB
        const dbUpdates = {};
        if ("name"         in updates) dbUpdates.name          = updates.name;
        if ("business"     in updates) dbUpdates.business      = updates.business;
        if ("businessType" in updates) dbUpdates.business_type = updates.businessType;
        if ("url"          in updates) dbUpdates.url           = updates.url;
        if ("adContent"    in updates) dbUpdates.ad_content    = updates.adContent;
        if ("status"       in updates) dbUpdates.status        = updates.status;
        if ("dateAdded"    in updates) dbUpdates.date_added    = updates.dateAdded instanceof Date ? updates.dateAdded.toISOString() : updates.dateAdded;
        if ("lastAction"   in updates) dbUpdates.last_action   = updates.lastAction instanceof Date ? updates.lastAction.toISOString() : updates.lastAction;
        if ("issues"       in updates) dbUpdates.issues        = updates.issues;
        if ("messages"     in updates) dbUpdates.messages      = updates.messages;
        if ("notes"        in updates) dbUpdates.notes         = updates.notes;
        if ("keyword"      in updates) dbUpdates.keyword       = updates.keyword;

        const { error } = await supabase.from("leads").update(dbUpdates).eq("id", id).eq("user_id", user.id);
        if (error) {
            console.error("updateLead error:", error);
            // Reload from DB to restore consistency
            const { data } = await supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            if (data) setLeads(data.map(dbToLead));
        }
    }, [user]);

    const deleteLead = async (id) => {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        setActiveLead(null);
        const { error } = await supabase.from("leads").delete().eq("id", id).eq("user_id", user.id);
        if (error) {
            console.error("deleteLead error:", error);
            const { data } = await supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            if (data) setLeads(data.map(dbToLead));
        }
    };

    const updateRevenue = async (val) => {
        setRevenue(val);
        const { error } = await supabase.from("user_settings").upsert(
            { user_id: user.id, revenue: val },
            { onConflict: "user_id" }
        );
        if (error) console.error("updateRevenue error:", error);
    };

    const updateKeywords = async (newKeywords) => {
        setKeywords(newKeywords);
        const { error } = await supabase.from("user_settings").upsert(
            { user_id: user.id, keywords: newKeywords },
            { onConflict: "user_id" }
        );
        if (error) console.error("updateKeywords error:", error);
    };

    const addLead = async () => {
        if (!newLead.name && !newLead.business) return;
        const lead = {
            id: generateId(),
            ...newLead,
            status: "new",
            dateAdded: new Date(),
            lastAction: new Date(),
            issues: [],
            messages: { 1: "", 2: "", 3: "" },
        };
        // Optimistic: update UI immediately
        setLeads((prev) => [lead, ...prev]);
        setNewLead({ name: "", business: "", businessType: "", url: "", adContent: "", notes: "", keyword: "" });
        setShowAddLead(false);
        // Background: persist to Supabase
        const { error } = await supabase.from("leads").insert(leadToDb(lead, user.id));
        if (error) {
            console.error("addLead error:", error);
            setLeads((prev) => prev.filter((l) => l.id !== lead.id));
        }
    };

    const getNextActionInfo = (lead) => {
        const now = new Date();
        const daysSince = daysBetween(new Date(lead.lastAction), now);
        if (lead.status === "msg1_sent") { const d = CADENCE[2] - daysSince; return d <= 0 ? { text: "Follow-up 1 due now", urgent: true } : { text: `Follow-up 1 in ${d}d`, urgent: false }; }
        if (lead.status === "msg2_sent") { const d = CADENCE[3] - daysSince; return d <= 0 ? { text: "Final msg due now", urgent: true } : { text: `Final msg in ${d}d`, urgent: false }; }
        if (lead.status === "msg3_sent") { const d = 3 - daysSince; return d <= 0 ? { text: "Move to dead", urgent: true } : { text: `Auto-dead in ${d}d`, urgent: false }; }
        if (lead.status === "new") return { text: "Build prompt →", urgent: false };
        if (lead.status === "msg1_ready") return { text: "Send msg 1", urgent: false };
        return { text: "—", urgent: false };
    };

    const markSent = (lead, msgNum) => {
        const statusMap = { 1: "msg1_sent", 2: "msg2_sent", 3: "msg3_sent" };
        updateLead(lead.id, { status: statusMap[msgNum], lastAction: new Date() });
    };

    const generatePromptText = () => {
        if (!promptLead) return;
        const l = promptLead;
        const issueBlocks = selectedIssues.map((iss, i) => {
            const num = i + 1;
            return `ISSUE #${num} (${num === 1 ? "biggest problem" : num === 2 ? "second issue" : "third issue"}): ${iss.label}\nWHY IT COSTS THEM: ${iss.impact}`;
        });
        const prompt = `You are writing Messenger outreach messages for me. I'm a web dev student who finds businesses running Meta ads, checks their website, and reaches out when I spot real problems. I message them through Facebook Messenger.\n\nHere are my rules. Follow every single one:\n\n- Sound like a real person. A college-age guy who's sharp and direct. Not a marketer, not a copywriter, not an agency. Just a person talking to another person.\n- No exclamation point abuse. One max across all three messages combined.\n- No buzzwords. Never say "optimize," "leverage," "elevate," "transform," "unlock," "boost," "maximize," "take your business to the next level," or anything that sounds like a LinkedIn post.\n- No emoji unless it's a single thumbs up or something equally minimal.\n- Never compliment their business first as a buttering-up tactic. Skip the "Love what you're doing with [business]" opener. Everyone sees through that.\n- Never use the phrase "I couldn't help but notice." That's the cold outreach equivalent of "I'm not like other girls."\n- Short paragraphs. These are Messenger messages, not emails. No message should exceed 5 sentences.\n- Each message should feel like it was typed quickly and casually, not drafted and polished. Light punctuation. A fragment here and there is fine.\n- Confidence without arrogance. I know what I'm talking about, but I'm not talking down to them.\n- Absolutely zero pressure. I'm pointing out a problem that's costing them money and offering to help. If they're not interested, that's fine.\n- The ask is always a short call or meeting. Never frame it as "picking their brain" or "a quick chat to explore synergies." Just a 15-minute call.\n\nHere are the details for this prospect:\n\nBUSINESS NAME: ${l.business}\nWHAT THEY SELL/DO: ${l.businessType}\nOWNER'S FIRST NAME: ${l.name || "there"}\nWHAT THEIR AD WAS FOR: ${l.adContent}\nTHEIR WEBSITE URL: ${l.url}\n\n${issueBlocks.join("\n\n")}\n\nNow write three Messenger messages:\n\nMESSAGE 1 (send Day 1):\n- Mention I saw their ad (reference what it was for specifically)\n- Bring up Issue #1 only\n- Explain why it matters in plain terms\n- End with something like "happy to point out a couple other things I noticed" — NOT a meeting request yet. Just opening the door.\n\nMESSAGE 2 (send Day 3-4 if no reply):\n- Don't re-explain who I am or re-introduce myself\n- Bring up Issue #2 (and #3 if provided)\n- Keep it shorter than Message 1\n- Still no hard ask for a meeting. Just adding value.\n\nMESSAGE 3 (send Day 7-8 if no reply):\n- Acknowledge this is my last message without being weird about it\n- Briefly tie the issues back to their ad spend being wasted\n- Now make the ask: a 15-minute call, totally free, no strings\n- End cleanly. No guilt trip, no "your loss" energy.\n\nWrite all three messages now. Label them MESSAGE 1, MESSAGE 2, MESSAGE 3.\nDo not add commentary or explanations between them.`;
        setGeneratedPrompt(prompt);
        updateLead(l.id, { status: "msg1_ready", issues: selectedIssues });
    };

    const copyPrompt = async () => {
        try { await navigator.clipboard.writeText(generatedPrompt); } catch { const ta = document.createElement("textarea"); ta.value = generatedPrompt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };

    const savePastedMessages = () => {
        if (!pasteMode || !pasteText.trim()) return;
        const text = pasteText.trim();
        const msgs = { 1: "", 2: "", 3: "" };
        const parts = text.split(/MESSAGE\s*[#]?\s*(\d)/i);
        for (let i = 1; i < parts.length; i += 2) { const num = parseInt(parts[i]); if (num >= 1 && num <= 3) msgs[num] = parts[i + 1]?.trim().replace(/^[:\-–—\s]+/, "") || ""; }
        if (!msgs[1] && !msgs[2] && !msgs[3]) msgs[1] = text;
        updateLead(pasteMode.id, { messages: msgs });
        setPasteMode(null); setPasteText("");
    };

    // ─── STYLES ─────────────────────────────────
    const font = "'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace";
    const inputStyle = { width: "100%", padding: "11px 14px", background: "#12121a", border: "1px solid #252530", borderRadius: "8px", color: "#e2e8f0", fontSize: "13px", outline: "none", boxSizing: "border-box", fontFamily: font };
    const btnPrimary = { padding: "10px 22px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", fontFamily: font, boxShadow: "0 2px 12px #3b82f633" };
    const btnGhost = { padding: "8px 16px", background: "transparent", color: "#94a3b8", border: "1px solid #252530", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontFamily: font };
    const card = { background: "#13131d", border: "1px solid #1e1e2a", borderRadius: "12px", boxShadow: "0 2px 16px rgba(0,0,0,0.3)" };

    const StatusBadge = ({ status }) => {
        const c = STATUS_CONFIG[status] || STATUS_CONFIG.new;
        return <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.color}33`, whiteSpace: "nowrap", letterSpacing: "0.3px", textTransform: "uppercase", width: "auto", maxWidth: "120px" }}>{c.label}</span>;
    };

    const StatusDropdown = ({ lead }) => (
        <select value={lead.status} onChange={(e) => updateLead(lead.id, { status: e.target.value, lastAction: new Date() })}
            style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: "12px", background: "#0c0c14", cursor: "pointer", color: STATUS_CONFIG[lead.status]?.color || "#e2e8f0" }}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
    );

    const IssueChip = ({ issue, selected, onClick }) => (
        <button onClick={onClick} style={{ display: "flex", alignItems: "flex-start", gap: "10px", width: "100%", padding: "11px 14px", border: selected ? "1px solid #3b82f6" : "1px solid #252530", borderRadius: "8px", background: selected ? "#1e3a5f" : "#12121a", cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: font }}>
            <span style={{ width: "18px", height: "18px", borderRadius: "4px", border: selected ? "2px solid #3b82f6" : "2px solid #444", background: selected ? "#3b82f6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px", fontSize: "12px", color: "#fff", fontWeight: 700 }}>{selected ? "✓" : ""}</span>
            <div><div style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 500 }}>{issue.label}</div><div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "3px", lineHeight: 1.4 }}>Impact: {issue.impact}</div></div>
        </button>
    );

    const StatCard = ({ label, value, color, sub }) => (
        <div style={{ ...card, padding: "20px 24px", flex: 1, minWidth: "140px" }}>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{label}</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color: color || "#f8fafc", lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>{sub}</div>}
        </div>
    );

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "#0a0a10", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", fontFamily: font, fontSize: "13px" }}>
                loading...
            </div>
        );
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a10", color: "#e2e8f0", fontFamily: font }}>
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

            {/* ─── SIDEBAR ─── */}
            <div style={{ width: "220px", background: "#0e0e16", borderRight: "1px solid #1a1a24", display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}>
                <div style={{ padding: "24px 20px 32px", borderBottom: "1px solid #1a1a24" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.5px" }}><span style={{ color: "#3b82f6" }}>▸</span> OUTREACH CRM</div>
                </div>
                <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                    {NAV_ITEMS.map((item) => (
                        <button key={item.key} onClick={() => setTab(item.key)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: tab === item.key ? 600 : 400, fontFamily: font, background: tab === item.key ? "#1e293b" : "transparent", color: tab === item.key ? "#f8fafc" : "#64748b", transition: "all 0.15s", textAlign: "left", width: "100%" }}>
                            <span style={{ fontSize: "16px", opacity: 0.7 }}>{item.icon}</span>
                            {item.label}
                            {item.key === "dead" && deadLeads.length > 0 && <span style={{ marginLeft: "auto", fontSize: "10px", background: "#6b728020", color: "#64748b", padding: "2px 7px", borderRadius: "10px" }}>{deadLeads.length}</span>}
                        </button>
                    ))}
                </div>
                <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a24", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "10px", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                    <button
                        onClick={async () => {
                            setLeads([]);
                            setRevenue(0);
                            setKeywords([]);
                            await supabase.auth.signOut();
                        }}
                        style={{ background: "transparent", border: "1px solid #252530", borderRadius: "6px", color: "#475569", cursor: "pointer", fontSize: "10px", padding: "6px 10px", fontFamily: font, textAlign: "left" }}
                    >
                        sign out
                    </button>
                </div>
            </div>

            {/* ─── MAIN CONTENT ─── */}
            <div style={{ marginLeft: "220px", flex: 1, padding: "28px 36px", minHeight: "100vh" }}>

                {/* ═══ DASHBOARD ═══ */}
                {tab === "dashboard" && (
                    <div>
                        <div style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginBottom: "24px" }}>Dashboard</div>
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "28px" }}>
                            <StatCard label="Active Leads" value={stats.total} color="#3b82f6" />
                            <StatCard label="Needs Action" value={stats.needsAction} color="#f59e0b" sub="new or follow-up due" />
                            <StatCard label="Awaiting Reply" value={stats.sent} color="#8b5cf6" sub="messages sent" />
                            <StatCard label="Replied" value={stats.replied} color="#10b981" />
                            <StatCard label="Meetings" value={stats.meetings} color="#06d6a0" />
                            <StatCard label="Converted" value={stats.converted} color="#fbbf24" />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                            {/* Revenue */}
                            <div style={{ ...card, padding: "24px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc", marginBottom: "16px" }}>Revenue</div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                    <span style={{ fontSize: "32px", fontWeight: 700, color: "#10b981" }}>$</span>
                                    <input type="number" value={revenue} onChange={(e) => updateRevenue(parseFloat(e.target.value) || 0)}
                                        style={{ ...inputStyle, fontSize: "28px", fontWeight: 700, color: "#10b981", background: "transparent", border: "1px solid #1e1e2a", width: "200px", padding: "8px 12px" }} />
                                </div>
                                <div style={{ fontSize: "11px", color: "#475569" }}>Total revenue from converted leads. Edit this manually.</div>
                                {stats.converted > 0 && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>Avg per conversion: <b style={{ color: "#10b981" }}>${stats.converted > 0 ? Math.round(revenue / stats.converted).toLocaleString() : 0}</b></div>}
                            </div>

                            {/* Funnel */}
                            <div style={{ ...card, padding: "24px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc", marginBottom: "16px" }}>Conversion Funnel</div>
                                {[
                                    { label: "Total Contacted", val: leads.length, color: "#3b82f6" },
                                    { label: "Got Reply", val: stats.replied + stats.meetings + stats.converted, color: "#10b981" },
                                    { label: "Meeting Set", val: stats.meetings + stats.converted, color: "#06d6a0" },
                                    { label: "Converted", val: stats.converted, color: "#fbbf24" },
                                ].map((row) => (
                                    <div key={row.label} style={{ marginBottom: "12px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                                            <span>{row.label}</span><span style={{ color: row.color, fontWeight: 600 }}>{row.val}</span>
                                        </div>
                                        <div style={{ height: "6px", background: "#1a1a24", borderRadius: "3px", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${leads.length > 0 ? (row.val / leads.length) * 100 : 0}%`, background: row.color, borderRadius: "3px", transition: "width 0.3s" }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Dead stats */}
                        <div style={{ ...card, padding: "20px 24px", marginTop: "20px", display: "flex", alignItems: "center", gap: "20px" }}>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>Dead leads: <b style={{ color: "#6b7280" }}>{stats.dead}</b></div>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>Reply rate: <b style={{ color: "#10b981" }}>{leads.length > 0 ? Math.round(((stats.replied + stats.meetings + stats.converted) / leads.length) * 100) : 0}%</b></div>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>Close rate: <b style={{ color: "#fbbf24" }}>{leads.length > 0 ? Math.round((stats.converted / leads.length) * 100) : 0}%</b></div>
                        </div>
                    </div>
                )}

                {/* ═══ PIPELINE ═══ */}
                {tab === "pipeline" && (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                            <div style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc" }}>Pipeline</div>
                            <button onClick={() => setShowAddLead(!showAddLead)} style={btnPrimary}>+ Add Lead</button>
                        </div>

                        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                            <div style={{ position: "relative", flex: 1, maxWidth: "360px" }}>
                                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
                                <input
                                    type="text" placeholder="Search by name, business, or URL..."
                                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ ...inputStyle, paddingLeft: "36px", background: "#0e0e16", border: "1px solid #252530" }}
                                />
                            </div>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                                style={{ ...inputStyle, width: "auto", padding: "11px 14px", paddingRight: "32px", background: "#0e0e16", cursor: "pointer", fontSize: "13px", color: filterStatus === "all" ? "#94a3b8" : (STATUS_CONFIG[filterStatus]?.color || "#e2e8f0"), minWidth: "160px", appearance: "none", WebkitAppearance: "none" }}>
                                <option value="all">All Statuses</option>
                                {["new", "msg1_sent", "msg2_due", "msg2_sent", "msg3_due", "msg3_sent", "replied", "meeting", "converted"].map((s) => (
                                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                ))}
                            </select>
                            {(filterStatus !== "all" || searchQuery) && (
                                <button onClick={() => { setFilterStatus("all"); setSearchQuery(""); }} style={{ ...btnGhost, fontSize: "12px", padding: "10px 14px", color: "#64748b" }}>Clear</button>
                            )}
                            <div style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap" }}>{filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}</div>
                        </div>

                        {showAddLead && (
                            <div style={{ ...card, padding: "20px", marginBottom: "20px" }}>
                                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", color: "#f8fafc" }}>New Lead</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                                    {[["name", "Owner's First Name", "Mike"], ["business", "Business Name", "Precision HVAC"], ["businessType", "What They Do", "residential HVAC repair"], ["url", "Website URL", "precisionhvac.ca"], ["adContent", "Their Ad Was For", "spring AC tune-up special"], ["notes", "Notes", "Optional notes"]].map(([key, label, ph]) => (
                                        <div key={key}><label style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", display: "block" }}>{label}</label><input style={inputStyle} placeholder={ph} value={newLead[key]} onChange={(e) => setNewLead({ ...newLead, [key]: e.target.value })} /></div>
                                    ))}
                                    <div>
                                        <label style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", display: "block" }}>Keyword</label>
                                        <select value={newLead.keyword} onChange={(e) => setNewLead({ ...newLead, keyword: e.target.value })} style={{ ...inputStyle, cursor: "pointer" }}>
                                            <option value="">No keyword</option>
                                            {keywords.map((kw) => <option key={kw} value={kw}>{kw}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                                    <button onClick={addLead} style={btnPrimary}>Add to Pipeline</button>
                                    <button onClick={() => setShowAddLead(false)} style={btnGhost}>Cancel</button>
                                </div>
                            </div>
                        )}

                        <div style={{ ...card, overflow: "hidden" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2.5fr", padding: "14px 18px", borderBottom: "1px solid #252530", fontSize: "11px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                <span>Lead</span><span>Business</span><span>Status</span><span>Action</span>
                            </div>
                            {filteredLeads.length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "#475569", fontSize: "13px" }}>{filterStatus === "all" && !searchQuery ? "No leads yet. Click + Add Lead to start." : "No leads match your filters."}</div>}
                            {filteredLeads.map((lead) => {
                                const action = getNextActionInfo(lead);
                                const isOpen = activeLead === lead.id;
                                const isEditing = editingLead === lead.id;
                                const ab = { ...btnGhost, fontSize: "11px", padding: "5px 12px" };
                                return (
                                    <div key={lead.id}>
                                        <div onClick={() => setActiveLead(isOpen ? null : lead.id)}
                                            style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2.5fr", padding: "14px 18px", borderBottom: isOpen ? "none" : "1px solid #15151f", alignItems: "center", transition: "background 0.15s", cursor: "pointer", background: isOpen ? "#15151f" : "transparent" }}
                                            onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "#15151f"; }} onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}>
                                            <div><div style={{ fontWeight: 600, fontSize: "14px", color: "#f8fafc" }}>{lead.name || "Unknown"}</div><div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{lead.url || "no site"}</div></div>
                                            <div style={{ fontSize: "13px", color: "#cbd5e1" }}>{lead.business}</div>
                                            <StatusBadge status={lead.status} />
                                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                                                {lead.status === "new" && <button onClick={() => { setPromptLead(lead); setSelectedIssues(lead.issues || []); setGeneratedPrompt(""); setTab("prompt"); }} style={{ ...ab, color: "#3b82f6", borderColor: "#3b82f633" }}>Build Prompt</button>}
                                                {lead.status === "msg1_ready" && !lead.messages?.[1] && <button onClick={() => { setPasteMode(lead); setPasteText(""); }} style={{ ...ab, color: "#f59e0b", borderColor: "#f59e0b33" }}>Paste Messages</button>}
                                                {lead.status === "msg1_ready" && lead.messages?.[1] && <button onClick={() => markSent(lead, 1)} style={{ ...ab, color: "#3b82f6", borderColor: "#3b82f633" }}>✓ Msg 1 Sent</button>}
                                                {lead.status === "msg1_sent" && !action.urgent && <span style={{ fontSize: "12px", color: "#64748b" }}>{action.text}</span>}
                                                {(lead.status === "msg1_sent" && action.urgent) && <button onClick={() => updateLead(lead.id, { status: "msg2_due" })} style={{ ...ab, color: "#f97316", borderColor: "#f9731633" }}>⚡ Msg 2 Ready</button>}
                                                {lead.status === "msg2_due" && <button onClick={() => markSent(lead, 2)} style={{ ...ab, color: "#3b82f6", borderColor: "#3b82f633" }}>✓ Msg 2 Sent</button>}
                                                {lead.status === "msg2_sent" && !action.urgent && <span style={{ fontSize: "12px", color: "#64748b" }}>{action.text}</span>}
                                                {(lead.status === "msg2_sent" && action.urgent) && <button onClick={() => updateLead(lead.id, { status: "msg3_due" })} style={{ ...ab, color: "#ef4444", borderColor: "#ef444433" }}>⚡ Msg 3 Ready</button>}
                                                {lead.status === "msg3_due" && <button onClick={() => markSent(lead, 3)} style={{ ...ab, color: "#3b82f6", borderColor: "#3b82f633" }}>✓ Final Msg Sent</button>}
                                                {lead.status === "msg3_sent" && !action.urgent && <span style={{ fontSize: "12px", color: "#64748b" }}>{action.text}</span>}
                                                {(lead.status === "msg3_sent" && action.urgent) && <button onClick={() => updateLead(lead.id, { status: "dead" })} style={{ ...ab, color: "#6b7280" }}>Mark Dead</button>}
                                                {["msg1_sent", "msg2_sent", "msg3_sent", "msg2_due", "msg3_due"].includes(lead.status) && <button onClick={() => updateLead(lead.id, { status: "replied", lastAction: new Date() })} style={{ ...ab, color: "#10b981", borderColor: "#10b98133" }}>Replied</button>}
                                                {lead.status === "replied" && <button onClick={() => updateLead(lead.id, { status: "meeting", lastAction: new Date() })} style={{ ...ab, color: "#06d6a0", borderColor: "#06d6a033" }}>Meeting Set</button>}
                                                {lead.status === "meeting" && <button onClick={() => updateLead(lead.id, { status: "converted", lastAction: new Date() })} style={{ ...ab, color: "#fbbf24", borderColor: "#fbbf2433" }}>Won!</button>}
                                                {["converted", "dead"].includes(lead.status) && <span style={{ fontSize: "12px", color: "#475569" }}>—</span>}
                                                <span style={{ fontSize: "10px", color: "#333", marginLeft: "auto", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                                            </div>
                                        </div>
                                        {isOpen && (
                                            <div style={{ background: "#0e0e16", padding: "20px 24px", borderBottom: "1px solid #1e1e2a" }}>
                                                {/* Header: status dropdown + actions */}
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                        <span style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc" }}>{lead.business} — {lead.name}</span>
                                                        <StatusDropdown lead={lead} />
                                                    </div>
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                        <button onClick={(e) => { e.stopPropagation(); setEditingLead(isEditing ? null : lead.id); }} style={{ ...btnGhost, fontSize: "11px", padding: "6px 12px", color: isEditing ? "#3b82f6" : "#94a3b8" }}>{isEditing ? "Done Editing" : "✎ Edit"}</button>
                                                        <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this lead?")) deleteLead(lead.id); }} style={{ ...btnGhost, fontSize: "11px", padding: "6px 12px", color: "#ef4444", borderColor: "#ef444433" }}>🗑 Delete</button>
                                                    </div>
                                                </div>


                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                                                    {/* Left: Details */}
                                                    <div>
                                                        <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600, marginBottom: "10px", textTransform: "uppercase" }}>Details</div>
                                                        {isEditing ? (
                                                            <div style={{ display: "grid", gap: "10px" }}>
                                                                {[["name", "Name"], ["business", "Business"], ["businessType", "Type"], ["url", "URL"], ["adContent", "Ad"], ["notes", "Notes"]].map(([key, label]) => (
                                                                    <div key={key}>
                                                                        <label style={{ fontSize: "10px", color: "#475569", marginBottom: "3px", display: "block" }}>{label}</label>
                                                                        <input value={lead[key] || ""} onChange={(e) => updateLead(lead.id, { [key]: e.target.value })} style={{ ...inputStyle, padding: "8px 12px", fontSize: "12px" }} />
                                                                    </div>
                                                                ))}
                                                                <div>
                                                                    <label style={{ fontSize: "10px", color: "#475569", marginBottom: "3px", display: "block" }}>Keyword</label>
                                                                    <select value={lead.keyword || ""} onChange={(e) => updateLead(lead.id, { keyword: e.target.value })} style={{ ...inputStyle, padding: "8px 12px", fontSize: "12px", cursor: "pointer" }}>
                                                                        <option value="">No keyword</option>
                                                                        {keywords.map((kw) => <option key={kw} value={kw}>{kw}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontSize: "13px", lineHeight: 2, color: "#cbd5e1" }}>
                                                                <div>Type: {lead.businessType || "—"}</div><div>URL: {lead.url || "none"}</div><div>Ad: {lead.adContent || "—"}</div><div>Keyword: <b style={{ color: "#3b82f6" }}>{lead.keyword || "none"}</b></div><div>Added: {new Date(lead.dateAdded).toLocaleDateString()}</div>
                                                                {lead.notes && <div>Notes: {lead.notes}</div>}
                                                            </div>
                                                        )}
                                                        {lead.issues?.length > 0 && <div style={{ marginTop: "12px" }}><div style={{ fontSize: "11px", color: "#475569", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase" }}>Issues Found</div>{lead.issues.map((iss) => <div key={iss.id} style={{ fontSize: "12px", color: "#f59e0b", padding: "4px 0" }}>• {iss.label}</div>)}</div>}
                                                    </div>
                                                    {/* Right: Messages (editable) */}
                                                    <div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                                            <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600, textTransform: "uppercase" }}>Messages</div>
                                                            <button onClick={() => { setPasteMode(lead); setPasteText(""); }} style={{ ...btnGhost, fontSize: "10px", padding: "4px 10px" }}>Paste All</button>
                                                        </div>
                                                        {[1, 2, 3].map((n) => (
                                                            <div key={n} style={{ marginBottom: "12px" }}>
                                                                <div style={{ fontSize: "11px", fontWeight: 600, color: lead.messages?.[n] ? "#3b82f6" : "#252530", marginBottom: "4px" }}>Message {n}</div>
                                                                <textarea
                                                                    value={lead.messages?.[n] || ""}
                                                                    onChange={(e) => updateLead(lead.id, { messages: { ...lead.messages, [n]: e.target.value } })}
                                                                    placeholder={`Write or paste message ${n} here...`}
                                                                    style={{ ...inputStyle, minHeight: "80px", resize: "vertical", fontSize: "12px", lineHeight: 1.5, background: "#0a0a10" }}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {pasteMode && (
                            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
                                <div style={{ ...card, padding: "24px", width: "600px", maxWidth: "90vw" }}>
                                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#f8fafc", marginBottom: "6px" }}>Paste LLM Response</div>
                                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>Paste the full output from the LLM (all 3 messages). The app will split them automatically.</div>
                                    <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste the full LLM response here..." style={{ ...inputStyle, height: "260px", resize: "vertical", fontFamily: font, lineHeight: 1.5 }} />
                                    <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
                                        <button onClick={() => { setPasteMode(null); setPasteText(""); }} style={btnGhost}>Cancel</button>
                                        <button onClick={savePastedMessages} style={btnPrimary}>Save Messages</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ PROMPT MAKER ═══ */}
                {tab === "prompt" && (
                    <div>
                        <div style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginBottom: "20px" }}>Prompt Maker</div>
                        {!promptLead ? (
                            <div>
                                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "16px", color: "#94a3b8" }}>Select a lead to build a prompt for:</div>
                                <div style={{ display: "grid", gap: "8px" }}>
                                    {leads.filter((l) => ["new", "msg1_ready"].includes(l.status)).map((lead) => (
                                        <button key={lead.id} onClick={() => { setPromptLead(lead); setSelectedIssues(lead.issues || []); setGeneratedPrompt(""); }}
                                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "16px 18px", ...card, cursor: "pointer", textAlign: "left", color: "#e2e8f0", fontFamily: font }}>
                                            <div><span style={{ fontWeight: 600 }}>{lead.business}</span><span style={{ color: "#64748b", marginLeft: "12px", fontSize: "12px" }}>{lead.name} · {lead.url || "no site"}</span></div>
                                            <span style={{ color: "#3b82f6", fontSize: "12px" }}>Select →</span>
                                        </button>
                                    ))}
                                    {leads.filter((l) => ["new", "msg1_ready"].includes(l.status)).length === 0 && <div style={{ padding: "48px", textAlign: "center", color: "#475569", fontSize: "13px" }}>No leads ready for prompt building. Add a lead in the Pipeline tab first.</div>}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                    <div><span style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>{promptLead.business}</span><span style={{ color: "#64748b", marginLeft: "12px", fontSize: "13px" }}>{promptLead.name} · {promptLead.url}</span></div>
                                    <button onClick={() => { setPromptLead(null); setSelectedIssues([]); setGeneratedPrompt(""); }} style={btnGhost}>← Back</button>
                                </div>
                                {!generatedPrompt ? (
                                    <div>
                                        <div style={{ ...card, padding: "16px 20px", marginBottom: "16px" }}>
                                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>How this works</div>
                                            <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.6 }}>Check the issues you found on their site below. Pick 2-3 (the first one you select is treated as the biggest problem). <b>If you select a Jackpot issue, it instantly overrides everything else.</b> Then hit Generate and copy the prompt into your LLM.</div>
                                        </div>
                                        <div style={{ fontSize: "12px", color: (selectedIssues.some(iss => iss.id.startsWith("crit")) || selectedIssues.length >= 2) ? "#10b981" : "#f59e0b", marginBottom: "16px", fontWeight: 600 }}>
                                            {selectedIssues.some(i => i.id.startsWith("crit")) ? "Jackpot issue selected — ready to generate!" : (selectedIssues.length === 0 ? "Select at least 2 issues" : (selectedIssues.length === 1 ? "Select at least 1 more" : (selectedIssues.length >= 2 ? `${selectedIssues.length} issues selected — ready to generate` : "")))}
                                            {selectedIssues.length > 3 && !selectedIssues.some(i => i.id.startsWith("crit")) && " (3 max recommended)"}
                                        </div>
                                        {selectedIssues.length > 0 && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>{selectedIssues.map((iss, i) => (<div key={iss.id} style={{ padding: "6px 12px", background: iss.id.startsWith("crit") ? "#450a0a" : "#1e3a5f", border: iss.id.startsWith("crit") ? "1px solid #ef4444" : "1px solid #3b82f6", borderRadius: "6px", fontSize: "12px", color: iss.id.startsWith("crit") ? "#fca5a5" : "#93c5fd", display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "10px", fontWeight: 700, color: iss.id.startsWith("crit") ? "#ef4444" : "#3b82f6" }}>#{i + 1}</span>{iss.label}<button onClick={() => setSelectedIssues((p) => p.filter((x) => x.id !== iss.id))} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", padding: 0, marginLeft: "4px" }}>×</button></div>))}</div>}
                                        
                                        {ISSUE_CATEGORIES_ENTRIES.map(([cat, issues]) => {
                                            const hasJackpotSelected = selectedIssues.some(iss => iss.id.startsWith("crit"));
                                            const isJackpotCat = cat === "Critical (Jackpot)";
                                            if (hasJackpotSelected && !isJackpotCat) return null; // Hide other categories when jackpot is hit
                                            
                                            return (
                                                <div key={cat} style={{ marginBottom: "8px" }}>
                                                    <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} style={{ width: "100%", padding: "14px 18px", ...card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: font, color: "#e2e8f0", fontSize: "13px", fontWeight: 600, borderRadius: expandedCategory === cat ? "12px 12px 0 0" : "12px", border: isJackpotCat ? "1px solid #ef444444" : "1px solid #1e1e2a" }}>
                                                        <span style={{ color: isJackpotCat ? "#fca5a5" : "inherit" }}>{isJackpotCat ? "🎯 " : ""}{cat}</span>
                                                        <span style={{ color: "#64748b", fontSize: "12px" }}>{issues.filter((i) => selectedIssues.some((s) => s.id === i.id)).length}/{issues.length} · {expandedCategory === cat ? "▾" : "▸"}</span>
                                                    </button>
                                                    {expandedCategory === cat && <div style={{ background: "#0e0e16", border: isJackpotCat ? "1px solid #ef444444" : "1px solid #1e1e2a", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px", display: "grid", gap: "8px" }}>
                                                        {issues.map((issue) => (
                                                            <IssueChip key={issue.id} issue={issue} selected={selectedIssues.some((s) => s.id === issue.id)} 
                                                                onClick={() => setSelectedIssues((p) => {
                                                                    const isSelected = p.some((s) => s.id === issue.id);
                                                                    if (isSelected) return p.filter((s) => s.id !== issue.id);
                                                                    if (issue.id.startsWith("crit")) return [issue]; // Override everything
                                                                    return [...p.filter(x => !x.id.startsWith("crit")), issue]; // Remove jacpots if picking a normal issue
                                                                })} 
                                                            />
                                                        ))}
                                                    </div>}
                                                </div>
                                            );
                                        })}
                                        <div style={{ marginTop: "20px" }}><button onClick={generatePromptText} disabled={selectedIssues.length < 2 && !selectedIssues.some(i => i.id.startsWith("crit"))} style={{ ...btnPrimary, opacity: (selectedIssues.length < 2 && !selectedIssues.some(i => i.id.startsWith("crit"))) ? 0.4 : 1, cursor: (selectedIssues.length < 2 && !selectedIssues.some(i => i.id.startsWith("crit"))) ? "not-allowed" : "pointer" }}>Generate Prompt ({selectedIssues.length} issues)</button></div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                            <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>Prompt Ready — Copy & Paste into LLM</div>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button onClick={() => setGeneratedPrompt("")} style={btnGhost}>← Edit Issues</button>
                                                <button onClick={copyPrompt} style={{ ...btnPrimary, background: copied ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #3b82f6, #2563eb)" }}>{copied ? "✓ Copied" : "Copy Prompt"}</button>
                                            </div>
                                        </div>
                                        <pre style={{ ...card, padding: "20px", fontSize: "12px", lineHeight: 1.6, color: "#cbd5e1", whiteSpace: "pre-wrap", maxHeight: "500px", overflow: "auto", fontFamily: font }}>{generatedPrompt}</pre>
                                        <div style={{ marginTop: "16px", background: "#1e3a5f", border: "1px solid #3b82f633", borderRadius: "12px", padding: "16px" }}>
                                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#93c5fd", marginBottom: "8px" }}>Next Steps</div>
                                            <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.8 }}>1. Copy the prompt above and paste it into Claude (or any LLM)<br />2. Get the 3 messages back<br />3. Go to Pipeline → click "Paste Messages" on this lead<br />4. Paste the full LLM response — the app will split them automatically<br />5. Send Message 1, click "Mark Sent" — the cadence timer starts</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ DEAD LEADS ═══ */}
                {tab === "dead" && (
                    <div>
                        <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px", color: "#f8fafc" }}>Dead Leads</div>
                        <div style={{ fontSize: "12px", color: "#475569", marginBottom: "20px" }}>These leads didn't respond after 3 messages. You can revive them later.</div>
                        {deadLeads.length === 0 ? <div style={{ padding: "48px", textAlign: "center", color: "#475569", fontSize: "13px", ...card }}>No dead leads yet. That's a good sign.</div> : (
                            <div style={{ ...card, overflow: "hidden" }}>
                                {deadLeads.map((lead) => (
                                    <div key={lead.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid #15151f" }}>
                                        <div><span style={{ fontWeight: 600, color: "#94a3b8" }}>{lead.business}</span><span style={{ color: "#475569", marginLeft: "12px", fontSize: "12px" }}>{lead.name} · died {new Date(lead.lastAction).toLocaleDateString()}</span></div>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button onClick={() => updateLead(lead.id, { status: "new", lastAction: new Date() })} style={{ ...btnGhost, fontSize: "11px", padding: "5px 12px", color: "#10b981", borderColor: "#10b98133" }}>Revive</button>
                                            <button onClick={() => deleteLead(lead.id)} style={{ ...btnGhost, fontSize: "11px", padding: "5px 12px", color: "#ef4444", borderColor: "#ef444433" }}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {/* ═══ KEYWORD BANK ═══ */}
                {tab === "keywords" && (() => {
                    const kwStats = keywords.map((kw) => {
                        const kwLeads = leads.filter((l) => l.keyword === kw);
                        const replied = kwLeads.filter((l) => ["replied", "meeting", "converted"].includes(l.status)).length;
                        const meetings = kwLeads.filter((l) => ["meeting", "converted"].includes(l.status)).length;
                        const converted = kwLeads.filter((l) => l.status === "converted").length;
                        const replyRate = kwLeads.length > 0 ? Math.round((replied / kwLeads.length) * 100) : 0;
                        return { kw, total: kwLeads.length, replied, meetings, converted, replyRate };
                    }).sort((a, b) => b.replyRate - a.replyRate || b.converted - a.converted || b.total - a.total);
                    const top3 = kwStats.filter((s) => s.total > 0).slice(0, 3);
                    return (
                        <div>
                            <div style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginBottom: "20px" }}>Keyword Bank</div>

                            {/* Top 3 */}
                            {top3.length > 0 && (
                                <div style={{ marginBottom: "24px" }}>
                                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#f59e0b", marginBottom: "12px" }}>★ Top Performing Keywords</div>
                                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                                        {top3.map((s, i) => (
                                            <div key={s.kw} style={{ ...card, padding: "18px 22px", flex: 1, minWidth: "180px", border: i === 0 ? "1px solid #fbbf2444" : "1px solid #1e1e2a" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                                                    <span style={{ fontSize: "16px", fontWeight: 700, color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : "#b45309" }}>#{i + 1}</span>
                                                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>{s.kw}</span>
                                                </div>
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px", color: "#94a3b8" }}>
                                                    <div>Leads: <b style={{ color: "#3b82f6" }}>{s.total}</b></div>
                                                    <div>Reply rate: <b style={{ color: "#10b981" }}>{s.replyRate}%</b></div>
                                                    <div>Meetings: <b style={{ color: "#06d6a0" }}>{s.meetings}</b></div>
                                                    <div>Converted: <b style={{ color: "#fbbf24" }}>{s.converted}</b></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Add keyword */}
                            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                                <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="Add a new keyword..." style={{ ...inputStyle, maxWidth: "300px" }}
                                    onKeyDown={(e) => { if (e.key === "Enter" && newKeyword.trim() && !keywords.includes(newKeyword.trim())) { updateKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); }}} />
                                <button onClick={() => { if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) { updateKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); }}} style={btnPrimary}>+ Add</button>
                            </div>

                            {/* All keywords table */}
                            {keywords.length === 0 ? <div style={{ padding: "48px", textAlign: "center", color: "#475569", fontSize: "13px", ...card }}>No keywords yet. Add one above to start tracking.</div> : (
                                <div style={{ ...card, overflow: "hidden" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 0.5fr", padding: "14px 18px", borderBottom: "1px solid #252530", fontSize: "11px", fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                        <span>Keyword</span><span>Leads</span><span>Replied</span><span>Meetings</span><span>Converted</span><span></span>
                                    </div>
                                    {kwStats.map((s) => (
                                        <div key={s.kw} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 0.5fr", padding: "14px 18px", borderBottom: "1px solid #15151f", alignItems: "center", fontSize: "13px" }}>
                                            <div style={{ fontWeight: 600, color: "#f8fafc" }}>{s.kw}</div>
                                            <div style={{ color: "#3b82f6" }}>{s.total}</div>
                                            <div style={{ color: "#10b981" }}>{s.replied} <span style={{ fontSize: "10px", color: "#475569" }}>({s.replyRate}%)</span></div>
                                            <div style={{ color: "#06d6a0" }}>{s.meetings}</div>
                                            <div style={{ color: "#fbbf24" }}>{s.converted}</div>
                                            <button onClick={() => updateKeywords(keywords.filter((k) => k !== s.kw))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "14px", padding: 0 }}>×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}