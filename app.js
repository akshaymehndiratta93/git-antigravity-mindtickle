/* ═══════════════════════════════════════════════════════
   BrandLens Copilot — Application Logic
   ═══════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────
const State = {
    currentBrand: null,
    brandData: null,
    brandsSummary: null,
    activeView: 'overview',
    stageFilter: '',
    drillFilter: '',
};

const DATA_BASE = 'data/';

// ─── Initialization ─────────────────────────────────────
async function init() {
    try {
        const res = await fetch(DATA_BASE + 'brands_summary.json');
        State.brandsSummary = await res.json();
        renderBrandLanding();
        setupNavigation();
        setupBrandSelector();
    } catch (e) {
        console.error('Failed to load brands summary:', e);
        const isFileProtocol = window.location.protocol === 'file:';
        document.getElementById('brandGrid').innerHTML = `
            <div class="empty-state" style="grid-column: span 4; max-width: 600px; margin: 40px auto; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h3 style="margin-bottom: 12px;">Data Loading Failed</h3>
                ${isFileProtocol ? `
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        It looks like you opened the file directly in your browser. Modern browsers block data loading from local files for security (CORS).
                    </p>
                    <div style="background: #f5f5f7; padding: 20px; border-radius: 12px; text-align: left; font-family: monospace; font-size: 13px;">
                        <strong>To fix this, run a local server:</strong><br><br>
                        1. Open Terminal<br>
                        2. <code>cd ${window.location.pathname.split('/').slice(0, -1).join('/')}</code><br>
                        3. <code>python3 -m http.server 8888</code><br>
                        4. Visit: <strong>http://localhost:8888</strong>
                    </div>
                ` : `
                    <p style="color: var(--text-secondary);">
                        Could not find data files. Please ensure you have run the pre-processing script:
                    </p>
                    <code style="display: block; background: #f5f5f7; padding: 12px; border-radius: 8px; margin-top: 10px;">python3 Codes/process_data.py</code>
                `}
            </div>`;
    }
}

// ─── Brand Landing ──────────────────────────────────────
function renderBrandLanding() {
    const grid = document.getElementById('brandGrid');
    const brands = State.brandsSummary.brands;

    grid.innerHTML = brands.map(b => `
        <div class="brand-card" data-brand="${b.slug}" onclick="selectBrand('${b.slug}')">
            <div class="brand-count"><strong>${b.total_calls}</strong> calls</div>
            <div class="brand-name">${b.brand}</div>
        </div>
    `).join('');

    // Also populate the dropdown
    const select = document.getElementById('brandSelect');
    select.innerHTML = '<option value="">Select a Brand…</option>' +
        brands.map(b => `<option value="${b.slug}">${b.brand} (${b.total_calls})</option>`).join('');
}

// ─── Brand Selection ────────────────────────────────────
async function selectBrand(slug) {
    try {
        const res = await fetch(DATA_BASE + slug + '.json');
        State.brandData = await res.json();
        State.currentBrand = slug;

        // Update dropdown
        document.getElementById('brandSelect').value = slug;

        // Show dashboard
        document.getElementById('brandLanding').style.display = 'none';
        document.getElementById('statsStrip').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'block';

        // Render all dashboards
        renderKPIStrip();
        renderOverview();
        renderStageIntelligence();
        renderAccountHealth();
        renderQualification();
        renderMessaging();
        populateStageFilter();

    } catch (e) {
        console.error('Failed to load brand data:', e);
    }
}

function setupBrandSelector() {
    document.getElementById('brandSelect').addEventListener('change', e => {
        if (e.target.value) {
            selectBrand(e.target.value);
        } else {
            // Go back to landing
            document.getElementById('brandLanding').style.display = '';
            document.getElementById('statsStrip').style.display = 'none';
            document.getElementById('mainContent').style.display = 'none';
            State.currentBrand = null;
            State.brandData = null;
        }
    });
}

// ─── Navigation ─────────────────────────────────────────
function setupNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            switchView(view);
        });
    });
}

function switchView(viewId) {
    State.activeView = viewId;

    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-view="${viewId}"]`)?.classList.add('active');

    // Update sections
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const viewEl = document.getElementById('view-' + viewId);
    if (viewEl) {
        viewEl.classList.add('active');
    }
}

// ─── KPI Strip ──────────────────────────────────────────
function renderKPIStrip() {
    const kpi = State.brandData.kpis;
    document.getElementById('stat-total').textContent = kpi.total_calls;
    document.getElementById('stat-budget').textContent = kpi.budget_clarity_rate + '%';
    document.getElementById('stat-timeline').textContent = kpi.timeline_clarity_rate + '%';
    document.getElementById('stat-growth').textContent = kpi.growth_mention_rate + '%';
    document.getElementById('stat-multithread').textContent = kpi.multi_threaded_rate + '%';
}

// ═══════════════════════════════════════════════════════
// DASHBOARD 1: BRAND OVERVIEW
// ═══════════════════════════════════════════════════════

function renderOverview() {
    const data = State.brandData;
    document.getElementById('overviewTitle').textContent = `Brand Overview — ${data.brand}`;

    renderStageDistribution(data.kpis.stage_distribution);
    renderOverviewCallTable(data.call_list);
    renderDrillFilters();
}

function renderStageDistribution(stages) {
    const el = document.getElementById('stageDistribution');
    if (!stages || Object.keys(stages).length === 0) {
        el.innerHTML = emptyState('No stage data available');
        return;
    }

    const total = Object.values(stages).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(stages).sort((a, b) => b[1] - a[1]);
    const colors = ['', 'green', 'orange', 'purple', 'indigo', 'teal', 'red'];

    el.innerHTML = sorted.map(([stage, count], i) => {
        const pct = (count / total * 100).toFixed(1);
        return `
            <div class="bar-row">
                <div class="bar-label" title="${stage}">${stage}</div>
                <div class="bar-track">
                    <div class="bar-fill ${colors[i % colors.length]}" style="width: ${pct}%"></div>
                </div>
                <div class="bar-value">${count}</div>
            </div>`;
    }).join('');
}

function renderPainClusters(painClusters, dealPainClusters) {
    const el = document.getElementById('painClusters');
    const clusters = [...(painClusters || []), ...(dealPainClusters || [])];

    if (clusters.length === 0) {
        el.innerHTML = emptyState('No pain point clusters generated yet', 'Run process_data.py to generate AI clusters');
        return;
    }

    // Deduplicate by theme
    const seen = new Set();
    const unique = clusters.filter(c => {
        if (seen.has(c.theme)) return false;
        seen.add(c.theme);
        return true;
    });

    el.innerHTML = unique.slice(0, 8).map(c => `
        <div class="cluster-item">
            <div class="cluster-theme">${c.theme}</div>
            <div class="cluster-detail">${c.description || ''}</div>
            <div class="cluster-meta">
                <span class="cluster-count">${c.count || '—'} mentions</span>
                ${c.representative_sr_nos ? `<span class="cluster-sr-nos">Sr No: ${(c.representative_sr_nos || []).join(', ')}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function renderBusinessImpacts(impacts) {
    const el = document.getElementById('businessImpacts');
    if (!impacts || !impacts.categories || Object.keys(impacts.categories).length === 0) {
        el.innerHTML = emptyState('No business impact data', 'Impact categorization requires AI clustering');
        return;
    }

    const catMap = {
        'Cost': 'cost', 'Time': 'time', 'Revenue': 'revenue',
        'Risk': 'risk', 'Operational': 'operational',
        'Patient/Customer Experience': 'patient', 'Patient Experience': 'patient',
        'Customer Experience': 'patient', 'Compliance': 'risk'
    };

    el.innerHTML = '<div class="impact-grid">' +
        Object.entries(impacts.categories).map(([cat, data]) => {
            const cls = catMap[cat] || 'operational';
            const themes = data.key_themes ? data.key_themes.slice(0, 2).join(', ') : '';
            return `
                <div class="impact-chip ${cls}">
                    <div class="impact-label">${cat}</div>
                    <div class="impact-count">${data.count || 0}</div>
                    ${themes ? `<div class="impact-themes">${themes}</div>` : ''}
                </div>`;
        }).join('') +
        '</div>';
}

function renderGrowthSignals(clusters) {
    const el = document.getElementById('growthSignals');
    if (!clusters || clusters.length === 0) {
        el.innerHTML = emptyState('No growth signal clusters', 'Growth clustering requires AI analysis');
        return;
    }

    el.innerHTML = clusters.slice(0, 6).map(c => `
        <div class="cluster-item">
            <div class="cluster-theme">${c.theme}</div>
            <div class="cluster-detail">${c.description || ''}</div>
            <div class="cluster-meta">
                <span class="cluster-count">${c.count || '—'} mentions</span>
                ${c.representative_sr_nos ? `<span class="cluster-sr-nos">Sr No: ${(c.representative_sr_nos || []).join(', ')}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function renderQualSnapshot(qualByStage) {
    const el = document.getElementById('qualSnapshot');
    if (!qualByStage || Object.keys(qualByStage).length === 0) {
        el.innerHTML = emptyState('No qualification data');
        return;
    }

    const sorted = Object.entries(qualByStage)
        .filter(([s]) => s !== 'Unknown')
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6);

    el.innerHTML = sorted.map(([stage, data]) => `
        <div class="qual-stage-block">
            <div class="qual-stage-name">${stage} <span style="color:var(--text-tertiary);font-size:11px;">(${data.total})</span></div>
            <div class="qual-meters">
                <div class="qual-meter">
                    <div class="qual-meter-label">Budget</div>
                    <div class="qual-meter-track">
                        <div class="qual-meter-fill ${data.budget_clear_pct >= 50 ? 'good' : data.budget_clear_pct >= 25 ? 'warn' : 'bad'}" 
                             style="width: ${data.budget_clear_pct}%"></div>
                    </div>
                    <div class="qual-meter-val">${data.budget_clear_pct}%</div>
                </div>
                <div class="qual-meter">
                    <div class="qual-meter-label">Timeline</div>
                    <div class="qual-meter-track">
                        <div class="qual-meter-fill ${data.timeline_clear_pct >= 50 ? 'good' : data.timeline_clear_pct >= 25 ? 'warn' : 'bad'}" 
                             style="width: ${data.timeline_clear_pct}%"></div>
                    </div>
                    <div class="qual-meter-val">${data.timeline_clear_pct}%</div>
                </div>
                <div class="qual-meter">
                    <div class="qual-meter-label">Key Players</div>
                    <div class="qual-meter-track">
                        <div class="qual-meter-fill ${data.key_players_clear_pct >= 50 ? 'good' : data.key_players_clear_pct >= 25 ? 'warn' : 'bad'}" 
                             style="width: ${data.key_players_clear_pct}%"></div>
                    </div>
                    <div class="qual-meter-val">${data.key_players_clear_pct}%</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderOverviewCallTable(calls, filter = '') {
    const body = document.getElementById('overviewCallBody');
    let filtered = calls;

    if (filter === 'no-budget') {
        filtered = calls.filter(c => !c.has_budget);
    } else if (filter === 'growth') {
        filtered = calls.filter(c => c.has_growth);
    } else if (filter) {
        filtered = calls.filter(c => c.stages.includes(filter));
    }

    const shown = filtered.slice(0, 15);

    body.innerHTML = shown.map(c => {
        const safeTitle = (c.pain_point || '').replace(/"/g, '&quot;');
        return `
        <tr>
            <td><strong>${c.sr_no}</strong></td>
            <td>${truncate(c.title, 40)}</td>
            <td>${c.stages.map(s => `<span class="drill-btn" style="padding:2px 6px;font-size:10px;cursor:default">${s}</span>`).join(' ')}</td>
            <td>${truncate(c.opportunity, 30)}</td>
            <td><div class="row-pain-point" title="${safeTitle}">${c.pain_point || '—'}</div></td>
            <td>${c.url ? `<a href="${c.url}" target="_blank" class="link-btn"><i data-lucide="external-link"></i> Open</a>` : '—'}</td>
        </tr>
    `}).join('');

    // Re-init lucide icons for the new links
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderDrillFilters() {
    const el = document.getElementById('overviewDrillFilters');
    const stages = Object.keys(State.brandData.kpis.stage_distribution).slice(0, 4);

    el.innerHTML = `
        <button class="drill-btn ${State.drillFilter === '' ? 'active' : ''}" onclick="applyDrill('')">All Calls</button>
        ${stages.map(s => `<button class="drill-btn ${State.drillFilter === s ? 'active' : ''}" onclick="applyDrill('${s}')">${s}</button>`).join('')}
        <button class="drill-btn ${State.drillFilter === 'no-budget' ? 'active' : ''}" onclick="applyDrill('no-budget')">Unclear Budget</button>
        <button class="drill-btn ${State.drillFilter === 'growth' ? 'active' : ''}" onclick="applyDrill('growth')">Growth Ready</button>
    `;
}

function applyDrill(filter) {
    State.drillFilter = filter;
    renderOverviewCallTable(State.brandData.call_list, filter);
    renderDrillFilters();
}

// ═══════════════════════════════════════════════════════
// DASHBOARD 2: STAGE INTELLIGENCE
// ═══════════════════════════════════════════════════════

function populateStageFilter() {
    const stages = Object.keys(State.brandData.kpis.stage_distribution);
    const sel = document.getElementById('stageFilter');
    sel.innerHTML = '<option value="">All Stages</option>' +
        stages.map(s => `<option value="${s}">${s}</option>`).join('');
    sel.onchange = () => {
        State.stageFilter = sel.value;
        renderStageIntelligence();
    };
}

function renderStageIntelligence() {
    const data = State.brandData;
    const stage = State.stageFilter;

    document.getElementById('stageTitle').textContent = stage
        ? `Stage Intelligence — ${stage}`
        : `Stage Intelligence — ${data.brand}`;

    // Filter calls by stage
    let calls = data.call_list;
    if (stage) {
        calls = calls.filter(c => c.stages.includes(stage));
    }

    // Pain Themes
    renderStagePainThemes(data.pain_clusters, data.deal_pain_clusters);

    // Impact framing
    renderStageImpactFraming(data.business_impacts);

    // Value framing
    renderStageValueFraming(data.messaging);

    // Qualification gaps
    renderStageQualGaps(data.qualification_by_stage, stage);

    // Evidence table
    renderStageCallTable(calls);
}

function renderStagePainThemes(painClusters, dealPainClusters) {
    const el = document.getElementById('stagePainThemes');
    const clusters = [...(painClusters || []), ...(dealPainClusters || [])];

    if (clusters.length === 0) {
        el.innerHTML = emptyState('No pain themes available');
        return;
    }

    el.innerHTML = clusters.slice(0, 6).map((c, i) => `
        <div class="cluster-item">
            <div class="cluster-theme">${i + 1}. ${c.theme}</div>
            <div class="cluster-detail">${c.description || ''}</div>
            <div class="cluster-meta">
                <span class="cluster-count">${c.count || '—'} mentions</span>
            </div>
        </div>
    `).join('');
}

function renderStageImpactFraming(impacts) {
    const el = document.getElementById('stageImpactFraming');
    if (!impacts || !impacts.categories || Object.keys(impacts.categories).length === 0) {
        el.innerHTML = emptyState('No impact framing data');
        return;
    }

    el.innerHTML = Object.entries(impacts.categories).map(([cat, data]) => {
        const quantPct = data.is_quantified_pct || 0;
        return `
            <div class="cluster-item">
                <div class="cluster-theme">${cat}</div>
                <div class="cluster-detail">
                    ${data.key_themes ? data.key_themes.join(' • ') : 'No sub-themes'}
                </div>
                <div class="cluster-meta">
                    <span class="cluster-count">${data.count || 0} calls</span>
                    <span class="cluster-sr-nos">${quantPct}% quantified</span>
                </div>
            </div>`;
    }).join('');
}

function renderStageValueFraming(messaging) {
    const el = document.getElementById('stageValueFraming');
    if (!messaging || !messaging.repeated_value_props || messaging.repeated_value_props.length === 0) {
        el.innerHTML = emptyState('No value framing data');
        return;
    }

    el.innerHTML = messaging.repeated_value_props.slice(0, 5).map(vp => `
        <div class="cluster-item">
            <div class="cluster-theme">${vp.theme || vp.value_proposition || 'Value Prop'}</div>
            <div class="cluster-detail">${vp.description || ''}</div>
            <div class="cluster-meta">
                <span class="cluster-count">${vp.frequency || vp.count || '—'} mentions</span>
            </div>
        </div>
    `).join('');
}

function renderStageQualGaps(qualByStage, stage) {
    const el = document.getElementById('stageQualGaps');

    if (!qualByStage || Object.keys(qualByStage).length === 0) {
        el.innerHTML = emptyState('No qualification data');
        return;
    }

    let data;
    if (stage && qualByStage[stage]) {
        data = { [stage]: qualByStage[stage] };
    } else {
        // Show top stages
        data = Object.fromEntries(
            Object.entries(qualByStage)
                .filter(([s]) => s !== 'Unknown')
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 4)
        );
    }

    el.innerHTML = Object.entries(data).map(([s, d]) => {
        const budgetGap = 100 - d.budget_clear_pct;
        const timelineGap = 100 - d.timeline_clear_pct;
        const keyPlayerGap = 100 - d.key_players_clear_pct;
        return `
            <div class="cluster-item">
                <div class="cluster-theme">${s}</div>
                <div class="cluster-detail">
                    Budget unclear: <strong>${budgetGap.toFixed(0)}%</strong> · 
                    Timeline unclear: <strong>${timelineGap.toFixed(0)}%</strong> · 
                    Key Players missing: <strong>${keyPlayerGap.toFixed(0)}%</strong>
                </div>
                <div class="cluster-meta">
                    <span class="cluster-count">${d.total} calls</span>
                </div>
            </div>`;
    }).join('');
}

function renderStageCallTable(calls) {
    const body = document.getElementById('stageCallBody');
    const shown = calls.slice(0, 15);

    body.innerHTML = shown.map(c => `
        <tr>
            <td><strong>${c.sr_no}</strong></td>
            <td>${truncate(c.title, 50)}</td>
            <td>${c.stages.join(', ')}</td>
            <td><span class="status-dot ${c.has_budget ? 'yes' : 'no'}"></span>${c.has_budget ? 'Yes' : 'No'}</td>
            <td><span class="status-dot ${c.has_timeline ? 'yes' : 'no'}"></span>${c.has_timeline ? 'Yes' : 'No'}</td>
            <td>${c.url ? `<a href="${c.url}" target="_blank" class="link-btn"><i data-lucide="external-link"></i> Open</a>` : '—'}</td>
        </tr>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ═══════════════════════════════════════════════════════
// DASHBOARD 3: ACCOUNT HEALTH
// ═══════════════════════════════════════════════════════

function renderAccountHealth() {
    const data = State.brandData;
    document.getElementById('accountsTitle').textContent = `Account Health — ${data.brand}`;

    renderAccountCards(data.account_health);
    renderCustomerWins(data);
    renderAccountGrowth(data.growth_clusters);
    renderAccountCallTable(data.call_list);
}

function renderAccountCards(accounts) {
    const el = document.getElementById('accountHealthGrid');
    if (!accounts || accounts.length === 0) {
        el.innerHTML = emptyState('No account-level data', 'Accounts are grouped by Opportunity Name');
        return;
    }

    el.innerHTML = accounts.slice(0, 12).map(a => `
        <div class="account-card ${a.status}">
            <div class="account-name">${truncate(a.name, 40)}</div>
            <div class="account-score">${a.status === 'healthy' ? '● Healthy' : a.status === 'at_risk' ? '● At Risk' : '● Critical'} — ${a.health_score}%</div>
            <div class="account-metrics">
                <div class="account-metric">
                    <div class="metric-val">${a.call_count}</div>
                    <div class="metric-lbl">Calls</div>
                </div>
                <div class="account-metric">
                    <div class="metric-val">${a.wins_count}</div>
                    <div class="metric-lbl">Wins</div>
                </div>
                <div class="account-metric">
                    <div class="metric-val">${a.growth_signals}</div>
                    <div class="metric-lbl">Growth</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCustomerWins(data) {
    const el = document.getElementById('customerWins');
    // Extract customer wins from messaging or if available
    const accounts = data.account_health || [];
    const winsAccounts = accounts.filter(a => a.wins_count > 0);

    if (winsAccounts.length === 0) {
        el.innerHTML = emptyState('No customer win signals detected');
        return;
    }

    el.innerHTML = winsAccounts.slice(0, 6).map(a => `
        <div class="cluster-item">
            <div class="cluster-theme">${a.name}</div>
            <div class="cluster-detail">${a.wins_count} win signal${a.wins_count > 1 ? 's' : ''} across ${a.call_count} calls</div>
            <div class="cluster-meta">
                <span class="cluster-count">${a.engagement_pct}% engagement</span>
            </div>
        </div>
    `).join('');
}

function renderAccountGrowth(clusters) {
    const el = document.getElementById('accountGrowth');
    if (!clusters || clusters.length === 0) {
        el.innerHTML = emptyState('No growth opportunity clusters');
        return;
    }

    el.innerHTML = clusters.slice(0, 5).map(c => `
        <div class="cluster-item">
            <div class="cluster-theme">${c.theme}</div>
            <div class="cluster-detail">${c.description || ''}</div>
            <div class="cluster-meta">
                <span class="cluster-count">${c.count || '—'} mentions</span>
            </div>
        </div>
    `).join('');
}

function renderAccountCallTable(calls) {
    const body = document.getElementById('accountCallBody');
    const withOpp = calls.filter(c => c.opportunity);
    const shown = withOpp.length > 0 ? withOpp.slice(0, 15) : calls.slice(0, 15);

    body.innerHTML = shown.map(c => `
        <tr>
            <td><strong>${c.sr_no}</strong></td>
            <td>${truncate(c.title, 45)}</td>
            <td>${truncate(c.opportunity, 35)}</td>
            <td>${c.stages.join(', ')}</td>
            <td>${c.url ? `<a href="${c.url}" target="_blank" class="link-btn"><i data-lucide="external-link"></i> Open</a>` : '—'}</td>
        </tr>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ═══════════════════════════════════════════════════════
// DASHBOARD 4: QUALIFICATION HEALTH
// ═══════════════════════════════════════════════════════

function renderQualification() {
    const data = State.brandData;
    document.getElementById('qualTitle').textContent = `Qualification Maturity — ${data.brand}`;

    renderBudgetClarity(data.kpis);
    renderTimelineClarity(data.kpis);
    renderKeyPlayersClarity(data.qualification_by_stage);
    renderPainClarity(data);
    renderRiskSummary(data.risk_signals);
}

function renderBudgetClarity(kpis) {
    const el = document.getElementById('budgetClarity');
    const pct = kpis.budget_clarity_rate;
    el.innerHTML = renderDonut(pct, 'Defined', kpis.budget_defined, kpis.budget_undefined, 'green');
}

function renderTimelineClarity(kpis) {
    const el = document.getElementById('timelineClarity');
    const pct = kpis.timeline_clarity_rate;
    el.innerHTML = renderDonut(pct, 'Defined', kpis.timeline_defined, kpis.timeline_undefined, 'accent');
}

function renderDonut(pct, label, defined, undefined_, color) {
    const angle = pct / 100 * 360;
    const colorVal = color === 'green' ? '#34c759' : '#0071e3';
    const bgAngle = `conic-gradient(${colorVal} 0deg ${angle}deg, #f0f0f2 ${angle}deg 360deg)`;

    return `
        <div class="donut-container">
            <div class="donut" style="background: ${bgAngle};">
                <div class="donut-label" style="background:white;width:80px;height:80px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                    <div class="donut-pct">${pct}%</div>
                    <div class="donut-text">${label}</div>
                </div>
            </div>
            <div class="donut-legend">
                <div class="legend-item">
                    <div class="legend-dot ${color === 'green' ? 'defined' : 'accent'}"></div>
                    <span>Defined: ${defined}</span>
                </div>
                <div class="legend-item">
                    <div class="legend-dot undefined"></div>
                    <span>Undefined: ${undefined_}</span>
                </div>
            </div>
        </div>`;
}

function renderKeyPlayersClarity(qualByStage) {
    const el = document.getElementById('keyPlayersClarity');
    if (!qualByStage || Object.keys(qualByStage).length === 0) {
        el.innerHTML = emptyState('No key player data');
        return;
    }

    const sorted = Object.entries(qualByStage)
        .filter(([s]) => s !== 'Unknown')
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 6);

    el.innerHTML = sorted.map(([stage, d]) => `
        <div class="bar-row">
            <div class="bar-label" title="${stage}">${truncate(stage, 20)}</div>
            <div class="bar-track">
                <div class="bar-fill ${d.key_players_clear_pct >= 50 ? 'green' : d.key_players_clear_pct >= 25 ? 'orange' : 'red'}" 
                     style="width: ${d.key_players_clear_pct}%"></div>
            </div>
            <div class="bar-value">${d.key_players_clear_pct}%</div>
        </div>
    `).join('');
}

function renderPainClarity(data) {
    const el = document.getElementById('painClarity');
    const calls = data.call_list;
    const total = calls.length;

    if (total === 0) {
        el.innerHTML = emptyState('No data');
        return;
    }

    // Count how many calls have all 4 pain clarity fields
    // We approximate using the full data from KPIs
    const kpis = data.kpis;
    const debriefRate = kpis.calls_with_debrief || 0;
    const clarityPct = total > 0 ? Math.round(debriefRate / total * 100) : 0;

    el.innerHTML = `
        <div style="text-align:center;padding:20px 0;">
            <div style="font-size:48px;font-weight:800;letter-spacing:-0.03em;color: ${clarityPct >= 50 ? 'var(--green)' : clarityPct >= 25 ? 'var(--orange)' : 'var(--red)'}">
                ${clarityPct}%
            </div>
            <div style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.08em;">
                Pain Clarity Score
            </div>
            <div style="font-size:13px;color:var(--text-tertiary);margin-top:8px;">
                ${debriefRate} of ${total} calls have complete pain point debrief
            </div>
        </div>
        <div class="bar-row" style="margin-top:12px;">
            <div class="bar-label">Situation</div>
            <div class="bar-track"><div class="bar-fill green" style="width:${clarityPct}%"></div></div>
            <div class="bar-value">${clarityPct}%</div>
        </div>
        <div class="bar-row">
            <div class="bar-label">Challenges</div>
            <div class="bar-track"><div class="bar-fill green" style="width:${clarityPct}%"></div></div>
            <div class="bar-value">${clarityPct}%</div>
        </div>
        <div class="bar-row">
            <div class="bar-label">Impact</div>
            <div class="bar-track"><div class="bar-fill orange" style="width:${clarityPct}%"></div></div>
            <div class="bar-value">${clarityPct}%</div>
        </div>
        <div class="bar-row">
            <div class="bar-label">Value of Solving</div>
            <div class="bar-track"><div class="bar-fill purple" style="width:${clarityPct}%"></div></div>
            <div class="bar-value">${clarityPct}%</div>
        </div>`;
}

function renderRiskSummary(risks) {
    const el = document.getElementById('riskSummary');
    if (!risks || risks.length === 0) {
        el.innerHTML = `<div class="empty-state"><p>No late-stage risk signals detected. ✅</p></div>`;
        return;
    }

    // Group by type
    const grouped = {};
    risks.forEach(r => {
        grouped[r.type] = grouped[r.type] || [];
        grouped[r.type].push(r);
    });

    const typeLabels = {
        'late_stage_no_budget': 'Late-stage deals missing budget clarity',
        'late_stage_no_key_players': 'Late-stage deals missing key player identification'
    };

    el.innerHTML = Object.entries(grouped).map(([type, items]) => `
        <div class="risk-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            <div>
                <strong>${typeLabels[type] || type}</strong> — ${items.length} call${items.length > 1 ? 's' : ''}
                <div style="margin-top:4px;font-size:12px;">
                    ${items.slice(0, 3).map(r => `Sr No. ${r.sr_no}: ${r.url ? `<a href="${r.url}" target="_blank">${truncate(r.title, 40)}</a>` : truncate(r.title, 40)}`).join('<br>')}
                    ${items.length > 3 ? `<br><em>+${items.length - 3} more</em>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// ═══════════════════════════════════════════════════════
// DASHBOARD 5: MESSAGING & POSITIONING
// ═══════════════════════════════════════════════════════

function renderMessaging() {
    const data = State.brandData;
    document.getElementById('messagingTitle').textContent = `Messaging Intelligence — ${data.brand}`;

    renderValueProps(data.messaging);
    renderInconsistentNarratives(data.messaging);
    renderProofSignals(data.messaging);
    renderContentGaps(data.messaging);
}

function renderValueProps(messaging) {
    const el = document.getElementById('valueProps');
    const props = messaging?.repeated_value_props;

    if (!props || props.length === 0) {
        el.innerHTML = emptyState('No repeated value propositions detected', 'Requires AI-powered messaging analysis');
        return;
    }

    el.innerHTML = props.slice(0, 8).map((vp, i) => `
        <div class="value-prop-item">
            <div class="vp-rank">${i + 1}</div>
            <div>
                <div class="vp-text">${vp.theme || vp.value_proposition || 'Value Prop'}</div>
                <div class="vp-freq">${vp.frequency || vp.count || '—'} mentions${vp.representative_sr_nos ? ` · Sr No: ${vp.representative_sr_nos.join(', ')}` : ''}</div>
            </div>
        </div>
    `).join('');
}

function renderInconsistentNarratives(messaging) {
    const el = document.getElementById('inconsistentNarratives');
    const narratives = messaging?.inconsistent_narratives;

    if (!narratives || narratives.length === 0) {
        el.innerHTML = emptyState('No narrative inconsistencies detected', 'Consistent positioning across calls ✅');
        return;
    }

    el.innerHTML = narratives.map(n => `
        <div class="narrative-item">
            <div class="nar-title">${n.conflict || n.title || 'Inconsistency'}</div>
            <div class="nar-detail">${n.description || n.detail || ''}</div>
            ${n.sr_nos || n.representative_sr_nos ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Sr No: ${(n.sr_nos || n.representative_sr_nos || []).join(', ')}</div>` : ''}
        </div>
    `).join('');
}

function renderProofSignals(messaging) {
    const el = document.getElementById('proofSignals');
    const proofs = messaging?.proof_signals;

    if (!proofs || proofs.length === 0) {
        el.innerHTML = emptyState('No proof signal data');
        return;
    }

    el.innerHTML = proofs.map(p => `
        <div class="cluster-item">
            <div class="cluster-theme">${p.type || p.theme || p.signal_type || 'Proof Signal'}</div>
            <div class="cluster-detail">${p.description || p.detail || ''}</div>
            <div class="cluster-meta">
                ${p.count ? `<span class="cluster-count">${p.count} mentions</span>` : ''}
                ${p.representative_sr_nos ? `<span class="cluster-sr-nos">Sr No: ${p.representative_sr_nos.join(', ')}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function renderContentGaps(messaging) {
    const el = document.getElementById('contentGaps');
    const gaps = messaging?.content_gaps;

    if (!gaps || gaps.length === 0) {
        el.innerHTML = emptyState('No content gaps identified');
        return;
    }

    el.innerHTML = gaps.map(g => `
        <div class="gap-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            <div>
                <div class="gap-text"><strong>${g.gap || g.theme || g.title || 'Content Gap'}</strong></div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${g.description || g.detail || ''}</div>
                ${g.representative_sr_nos ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">Sr No: ${g.representative_sr_nos.join(', ')}</div>` : ''}
            </div>
        </div>
    `).join('');
}

// ─── Utility Functions ──────────────────────────────────
function truncate(str, maxLen) {
    if (!str) return '—';
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

function emptyState(title, subtitle = '') {
    return `<div class="empty-state">
        <h4>${title}</h4>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>`;
}

// ─── Boot ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
