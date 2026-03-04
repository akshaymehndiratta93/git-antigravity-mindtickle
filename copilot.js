/* ═══════════════════════════════════════════════════════
   BrandLens Copilot — AI Q&A Integration (Gemini 2.5 Pro)
   ═══════════════════════════════════════════════════════ */

const COPILOT_CONFIG = {
    apiKey: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkdyR2VuTWlpWEhYREx4UlFPQ0otWXhBUXZtNCJ9.eyJhdWQiOiI2OTZlNmU2Zi03NjYxLTYzNjMtNjU3Mi0zYTY0MzIzNjY1NjMiLCJleHAiOjM3MzE1ODQwMjUsImlhdCI6MTc3MjAzMjAyNSwiaXNzIjoidHJ1ZWZvdW5kcnkuY29tIiwic3ViIjoiY21tMjY0NWhxNzN4aDAxbm00d2Q4Ym0wMSIsImp0aSI6ImNtbTI2NDVoczczeGkwMW5tZDRjYzh6ZzEiLCJzdWJqZWN0U2x1ZyI6ImRlZmF1bHQtY21tMjYzc2JoNXppajAxcWJmdjF5aGowdiIsInVzZXJuYW1lIjoiZGVmYXVsdC1jbW0yNjNzYmg1emlqMDFxYmZ2MXloajB2IiwidXNlclR5cGUiOiJzZXJ2aWNlYWNjb3VudCIsInN1YmplY3RUeXBlIjoic2VydmljZWFjY291bnQiLCJ0ZW5hbnROYW1lIjoiaW5ub3ZhY2NlciIsInJvbGVzIjpbXSwiand0SWQiOiJjbW0yNjQ1aHM3M3hpMDFubWQ0Y2M4emcxIiwiYXBwbGljYXRpb25JZCI6IjY5NmU2ZTZmLTc2NjEtNjM2My02NTcyLTNhNjQzMjM2NjU2MyJ9.Jdb2qq1alKSboc703Jp88GQYzEsEtGOdEYUvp8UcS5SYQ9p2KZtG7hAQbVMQEXotiDjnsOlPtX6N-nPSLVCPxteKYjG2D6vsdRokGYMoS6zIreP7uCpgrUZKtDLdxAtvFofM4TJCJMr1MqeYI6JnBZtlYbg4NiHBWEzuRBtNYrUWUaL7qMecq04aSfOdBSOlAUbydvgN1pz0bVcyHe6MTzzhnhs0EE3wZBuwHOfxe-el-Gu3YHAN476pK51k7ZwaywwS-fhFoS6WWQpXoU6BhsGovqQyn85dcZtXX-zJn5wDPQ-R2iudm_cglY0953AIxryA7lvWDYGnBafm6_bFXw',
    baseUrl: 'https://truefoundry.innovaccer.com/api/llm',
    model: 'analytics-genai/gemini-2-5-pro',
};

let copilotChatHistory = [];
let allCallsData = null;

// ─── Panel Toggle ───────────────────────────────────────
function initCopilot() {
    const toggle = document.getElementById('copilotToggle');
    const close = document.getElementById('copilotClose');
    const overlay = document.getElementById('copilotOverlay');
    const input = document.getElementById('copilotInput');
    const send = document.getElementById('copilotSend');

    toggle.addEventListener('click', openCopilot);
    close.addEventListener('click', closeCopilot);
    overlay.addEventListener('click', closeCopilot);

    send.addEventListener('click', handleSend);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Suggested prompt buttons
    document.querySelectorAll('.suggested-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.dataset.prompt;
            handleSend();
        });
    });

    // Pre-load full call data
    loadFullCallData();
}

function openCopilot() {
    document.getElementById('copilotPanel').classList.add('open');
    document.getElementById('copilotOverlay').classList.add('open');
    document.getElementById('copilotInput').focus();
}

function closeCopilot() {
    document.getElementById('copilotPanel').classList.remove('open');
    document.getElementById('copilotOverlay').classList.remove('open');
}

async function loadFullCallData() {
    try {
        const res = await fetch('data/calls_full.json');
        allCallsData = await res.json();
    } catch (e) {
        console.warn('Could not load full call data for copilot:', e);
    }
}

// ─── Send Message ───────────────────────────────────────
async function handleSend() {
    const input = document.getElementById('copilotInput');
    const question = input.value.trim();
    if (!question) return;

    input.value = '';

    // Add user message
    addChatMessage('user', question);

    // Show typing
    const typingEl = addTypingIndicator();

    try {
        const response = await askCopilot(question);
        typingEl.remove();
        addChatMessage('assistant', response);
    } catch (e) {
        typingEl.remove();
        addChatMessage('assistant', `⚠️ Error: ${e.message}. Please try again.`);
    }
}

function addChatMessage(role, content) {
    const messages = document.getElementById('copilotMessages');

    // Remove welcome if present
    const welcome = messages.querySelector('.copilot-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;

    if (role === 'user') {
        div.innerHTML = `<div class="msg-bubble">${escapeHtml(content)}</div>`;
    } else {
        div.innerHTML = `<div class="msg-bubble">${formatCopilotResponse(content)}</div>`;
    }

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function addTypingIndicator() {
    const messages = document.getElementById('copilotMessages');
    const div = document.createElement('div');
    div.className = 'chat-msg assistant';
    div.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
}

// ─── Copilot API Call ───────────────────────────────────
async function askCopilot(question) {
    const brand = State.currentBrand;
    const brandData = State.brandData;

    // Build context from current brand data
    let context = '';

    if (brandData) {
        // Include KPIs
        context += `\n## Current Brand: ${brandData.brand}\n`;
        context += `Total Calls: ${brandData.kpis.total_calls}\n`;
        context += `Budget Clarity: ${brandData.kpis.budget_clarity_rate}%\n`;
        context += `Timeline Clarity: ${brandData.kpis.timeline_clarity_rate}%\n`;
        context += `Multi-Threaded Rate: ${brandData.kpis.multi_threaded_rate}%\n`;
        context += `Growth Mention Rate: ${brandData.kpis.growth_mention_rate}%\n\n`;

        // Stage distribution
        context += `## Stage Distribution\n`;
        for (const [stage, count] of Object.entries(brandData.kpis.stage_distribution)) {
            context += `- ${stage}: ${count}\n`;
        }

        // Pain clusters
        if (brandData.pain_clusters?.length) {
            context += `\n## Pain Clusters\n`;
            brandData.pain_clusters.forEach(c => {
                context += `- ${c.theme}: ${c.description || ''} (${c.count || '?'} mentions, Sr No: ${(c.representative_sr_nos || []).join(', ')})\n`;
            });
        }

        // Growth clusters
        if (brandData.growth_clusters?.length) {
            context += `\n## Growth Opportunities\n`;
            brandData.growth_clusters.forEach(c => {
                context += `- ${c.theme}: ${c.description || ''} (${c.count || '?'} mentions)\n`;
            });
        }

        // Account health
        if (brandData.account_health?.length) {
            context += `\n## Account Health\n`;
            brandData.account_health.forEach(a => {
                context += `- ${a.name}: ${a.status} (score: ${a.health_score}%, calls: ${a.call_count}, wins: ${a.wins_count})\n`;
            });
        }

        // Risk signals
        if (brandData.risk_signals?.length) {
            context += `\n## Risk Signals\n`;
            brandData.risk_signals.forEach(r => {
                context += `- ${r.type}: Sr No. ${r.sr_no} - ${r.title} (${r.url})\n`;
            });
        }

        // Include some call details (limit to manage token count)
        const relevantCalls = getRelevantCalls(question);
        if (relevantCalls.length > 0) {
            context += `\n## Relevant Call Records\n`;
            relevantCalls.slice(0, 15).forEach(c => {
                context += `\nSr No. ${c['Sr No.'] || c.sr_no}: ${c.Title || c.title}\n`;
                context += `URL: ${c.URL || c.url}\n`;
                context += `Stage: ${c['Opportunity Stage'] || (c.stages || []).join(', ')}\n`;
                if (c.Summary || c.summary) context += `Summary: ${(c.Summary || c.summary).slice(0, 200)}\n`;
                if (c['Debrief - Customer Pain Point - Problems & Challenges']) {
                    context += `Pain Points: ${c['Debrief - Customer Pain Point - Problems & Challenges'].slice(0, 200)}\n`;
                }
                if (c['Debrief - Account Health - Growth Opportunities']) {
                    context += `Growth: ${c['Debrief - Account Health - Growth Opportunities'].slice(0, 200)}\n`;
                }
            });
        }
    } else {
        context = 'No brand is currently selected. Ask the user to select a brand first.';
    }

    const systemPrompt = `You are BrandLens Copilot, an analytical AI assistant for Brand Marketing Managers.

You analyze sales call records from Mindtickle and provide evidence-grounded insights.

STRICT RULES:
1. NEVER hallucinate data. Only reference information provided in the context.
2. ALWAYS cite Sr No. and include URLs when referencing specific calls.
3. If data is insufficient, say so clearly.
4. Format responses with clear structure using markdown.
5. At the end of your response, suggest 3-5 follow-up questions the user might ask.

YOUR RESPONSE FORMAT:
1. **Direct Answer**: Clear, concise, structured response
2. **Evidence**: Reference specific calls with Sr No. and URLs
3. **Suggested Follow-ups**: 3-5 questions separated by | characters on a single line starting with "FOLLOWUPS:"

CONTEXT:
${context}`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...copilotChatHistory.slice(-6),
        { role: 'user', content: question }
    ];

    // Streaming fetch
    const response = await fetch(COPILOT_CONFIG.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${COPILOT_CONFIG.apiKey}`,
            'X-TFY-METADATA': '{}',
            'X-TFY-LOGGING-CONFIG': '{"enabled": true}',
        },
        body: JSON.stringify({
            model: COPILOT_CONFIG.model,
            messages: messages,
            max_tokens: 3000,
            stream: false,
        }),
    });

    if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'No response received.';

    // Save to history
    copilotChatHistory.push({ role: 'user', content: question });
    copilotChatHistory.push({ role: 'assistant', content: answer });

    return answer;
}

// ─── Relevance Scoring ──────────────────────────────────
function getRelevantCalls(question) {
    if (!allCallsData) return State.brandData?.call_list?.slice(0, 10) || [];

    const brand = State.brandData?.brand;
    let brandCalls = allCallsData;

    if (brand) {
        brandCalls = allCallsData.filter(c =>
            (c['Brand Discussed'] || c['Brand Discussed '] || '').trim() === brand
        );
    }

    if (brandCalls.length <= 15) return brandCalls;

    // Simple keyword matching for relevance
    const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const scored = brandCalls.map(c => {
        let score = 0;
        const text = JSON.stringify(c).toLowerCase();
        keywords.forEach(kw => {
            if (text.includes(kw)) score++;
        });
        return { call: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 15).map(s => s.call);
}

// ─── Response Formatting ────────────────────────────────
function formatCopilotResponse(text) {
    // Extract follow-up prompts
    let followups = [];
    const followupMatch = text.match(/FOLLOWUPS?:\s*(.+)/i);
    if (followupMatch) {
        followups = followupMatch[1].split('|').map(f => f.trim()).filter(Boolean);
        text = text.replace(/\n?FOLLOWUPS?:\s*.+/i, '');
    }

    // Basic markdown → HTML
    let html = text
        // Headers
        .replace(/###\s+(.+)/g, '<h4>$1</h4>')
        .replace(/##\s+(.+)/g, '<h4>$1</h4>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Links - Mindtickle URLs
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Standalone URLs
        .replace(/(https:\/\/innovaccer\.mindtickle\.com\/[^\s\)]+)/g, '<a href="$1" target="_blank">🔗 Mindtickle</a>')
        // Lists
        .replace(/^-\s+(.+)/gm, '<li>$1</li>')
        .replace(/^\d+\.\s+(.+)/gm, '<li>$1</li>')
        // Paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // Wrap loose <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Add follow-up buttons
    if (followups.length > 0) {
        html += `<div class="chat-followups">${followups.map(f => `<button class="chat-followup-btn" onclick="askFollowup('${escapeAttr(f)}')">${f}</button>`).join('')
            }</div>`;
    }

    return html;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Global function for follow-up buttons
function askFollowup(question) {
    document.getElementById('copilotInput').value = question;
    handleSend();
}

// ─── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initCopilot);
