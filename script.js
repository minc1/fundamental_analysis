document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const $ = id => document.getElementById(id);

    const tickerInput = $('ticker');
    const loadButton = $('loadData');
    const loadingIndicator = $('loadingIndicator');
    const loadingTicker = $('loadingTicker');
    const errorMessage = $('errorMessage');
    const dataContainer = $('dataContainer');
    const companyHeader = $('companyHeader');

    const metricYearEls = [...document.querySelectorAll('.metric-year')];
    const metricEls = {
        revenue: $('revenue'),
        netIncome: $('netIncome'),
        debtEquity: $('debtEquity'),
        freeCashFlow: $('freeCashFlow'),
        eps: $('eps')
    };

    const incomeTable = $('incomeTable');
    const balanceSheetTable = $('balanceSheetTable');
    const cashFlowTable = $('cashFlowTable');

    class ChartManager {
        constructor() {
            const css = getComputedStyle(document.documentElement);
            this.palette = [
                css.getPropertyValue('--chart-navy').trim() || '#1c2541',
                css.getPropertyValue('--chart-gold').trim() || '#c5a47e',
                css.getPropertyValue('--chart-gray').trim() || '#6c757d',
                css.getPropertyValue('--chart-pastel-gold').trim() || '#f3e1bb'
            ];
            this.gridColor = '#6c757d33';
        }
        baseOptions(minVal) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: {
                            display: true,
                            drawBorder: false,
                            lineWidth: 1,
                            color: ctx => {
                                if (ctx.tick.value === 0) return this.gridColor;
                                return ctx.index % 2 === 0 ? this.gridColor : 'transparent';
                            }
                        },
                        suggestedMin: minVal,
                        ticks: { callback: v => this.currency(v, true), precision: 0 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + this.currency(ctx.raw)
                        }
                    }
                },
                elements: { line: { tension: 0.4 } }
            };
        }
        currency(v, abbr = false) {
            if (v === undefined || v === null || isNaN(v)) return 'N/A';
            const abs = Math.abs(v);
            let suffix = '', div = 1;
            if (abs >= 1e9) { suffix = 'B'; div = 1e9; }
            else if (abs >= 1e6) { suffix = 'M'; div = 1e6; }
            else if (abbr && abs >= 1e3) { suffix = 'K'; div = 1e3; }
            const num = Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v / div);
            return '$' + num + suffix;
        }
    }

    const chartMgr = new ChartManager();
    const charts = {};

    function ensureLegend(containerElem) {
        let legend = containerElem.querySelector('.chart-legend');
        if (!legend) {
            legend = document.createElement('div');
            legend.className = 'chart-legend';
            containerElem.appendChild(legend);
        }
        return legend;
    }

    function buildLegend(chart, legendContainer) {
        legendContainer.innerHTML = chart.data.datasets.map((ds, i) =>
            `<div class="chart-legend-item" data-index="${i}">
                <span class="chart-legend-color" style="background:${ds.borderColor}"></span>${ds.label}
            </div>`
        ).join('');
        legendContainer.querySelectorAll('.chart-legend-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = +el.dataset.index;
                chart.toggleDataVisibility(idx);
                el.classList.toggle('disabled');
                chart.update();
            });
        });
    }

    function createLineChart({ canvasId, labels, datasets }) {
        if (charts[canvasId]) charts[canvasId].destroy();
        const styled = datasets.map((ds, i) => ({
            label: ds.label,
            data: ds.data,
            borderColor: chartMgr.palette[i] || chartMgr.palette[0],
            backgroundColor: chartMgr.palette[i] || chartMgr.palette[0],
            borderWidth: i === 0 ? 3 : 2,
            tension: 0.4,
            yAxisID: 'y',
            pointRadius: 3,
            pointHoverRadius: 5
        }));
        const flatData = styled.flatMap(d => d.data);
        const maxVal = Math.max(...flatData.map(Math.abs));
        const minValExisting = Math.min(...flatData);
        const suggestedMin = Math.min(minValExisting, -(maxVal * 0.05));
        const canvas = $(canvasId);
        const chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: styled },
            options: chartMgr.baseOptions(suggestedMin)
        });
        charts[canvasId] = chart;
        const header = canvas.closest('.chart-container').querySelector('.chart-header');
        const legendDiv = ensureLegend(header);
        buildLegend(chart, legendDiv);
    }

    function formatNum(v) {
        if (v === undefined || v === null || isNaN(v)) return 'N/A';
        return Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    }

    function calcDE(bal) {
        if (!bal || bal.totalDebt === undefined || !bal.totalEquity || bal.totalEquity === 0) return 'N/A';
        return formatNum(bal.totalDebt / bal.totalEquity);
    }

    function fmtCur(v) { return chartMgr.currency(v); }

    loadButton.addEventListener('click', loadData);
    tickerInput.addEventListener('keypress', e => { if (e.key === 'Enter') loadData(); });

    async function loadData() {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (!ticker) { showError('Please enter a valid ticker symbol'); return; }
        loadingTicker.textContent = ticker;
        loadingIndicator.style.display = 'flex';
        errorMessage.style.display = 'none';
        dataContainer.style.display = 'none';
        try {
            const [inc, cf, bs] = await Promise.all([
                fetchJSON(`${ticker}/income_statement_annual.json`),
                fetchJSON(`${ticker}/cash_flow_statement_annual.json`),
                fetchJSON(`${ticker}/balance_sheet_statement_annual.json`)
            ]);
            displayData(ticker, inc, cf, bs);
        } catch (e) {
            showError(`Error loading data for ${ticker}: ${e.message}`);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    async function fetchJSON(p) {
        const r = await fetch(`DATA/${p}`);
        if (!r.ok) throw new Error(`Data not found for ${p.split('/')[0]}`);
        return r.json();
    }

    function displayData(ticker, income, cash, balance) {
        income.sort((a, b) => a.calendarYear - b.calendarYear);
        cash.sort((a, b) => a.calendarYear - b.calendarYear);
        balance.sort((a, b) => a.calendarYear - b.calendarYear);

        companyHeader.textContent = `${ticker} Financial Analysis`;
        const latest = income.at(-1) || {};
        const latestCash = cash.at(-1) || {};
        const latestBal = balance.at(-1) || {};

        metricYearEls.forEach(s => s.textContent = latest.calendarYear || 'N/A');
        metricEls.revenue.textContent = fmtCur(latest.revenue);
        metricEls.netIncome.textContent = fmtCur(latest.netIncome);
        metricEls.freeCashFlow.textContent = fmtCur(latestCash.freeCashFlow);
        metricEls.debtEquity.textContent = calcDE(latestBal);
        metricEls.eps.textContent = formatNum(latest.epsdiluted ?? latest.eps);

        buildCharts(income, cash);
        buildTables(income, cash, balance);

        dataContainer.style.display = 'block';
    }

    function buildCharts(income, cash) {
        const years = income.map(i => i.calendarYear);
        createLineChart({
            canvasId: 'revenueChart',
            labels: years,
            datasets: [{ label: 'Revenue', data: income.map(i => i.revenue) }]
        });
        createLineChart({
            canvasId: 'metricsChart',
            labels: years,
            datasets: [
                { label: 'Net Income', data: income.map(i => i.netIncome) },
                { label: 'Operating Cash Flow', data: cash.map(i => i.operatingCashFlow) },
                { label: 'Free Cash Flow', data: cash.map(i => i.freeCashFlow) }
            ]
        });
    }

    function buildTables(inc, cf, bs) {
        incomeTable.innerHTML = createTable(
            ['Year', 'Revenue', 'Gross Profit', 'Net Income', 'Diluted EPS', 'Operating Income'],
            inc.map(r => {
                const eps = r.epsdiluted !== undefined ? r.epsdiluted : r.eps;
                return [
                    r.calendarYear,
                    { value: fmtCur(r.revenue), raw: r.revenue, highlight: 'revenue' },
                    fmtCur(r.grossProfit),
                    { value: fmtCur(r.netIncome), raw: r.netIncome, highlight: 'netIncome' },
                    eps !== undefined && eps !== null ? formatNum(eps) : 'N/A',
                    fmtCur(r.operatingIncome)
                ];
            }).reverse()
        );
        balanceSheetTable.innerHTML = createTable(
            ['Year', 'Total Assets', 'Total Debt', 'Total Equity', 'Cash', 'Current Assets'],
            bs.map(r => [
                r.calendarYear,
                fmtCur(r.totalAssets),
                { value: fmtCur(r.totalDebt), raw: r.totalDebt, highlight: 'totalDebt' },
                { value: fmtCur(r.totalEquity), raw: r.totalEquity, highlight: 'totalEquity' },
                fmtCur(r.cashAndCashEquivalents),
                fmtCur(r.totalCurrentAssets)
            ]).reverse()
        );
        cashFlowTable.innerHTML = createTable(
            ['Year', 'Operating CF', 'Investing CF', 'Financing CF', 'Free CF', 'Net Change'],
            cf.map(r => [
                r.calendarYear,
                { value: fmtCur(r.operatingCashFlow), raw: r.operatingCashFlow, highlight: 'operatingCF' },
                fmtCur(r.netCashUsedForInvestingActivites),
                fmtCur(r.netCashUsedProvidedByFinancingActivities),
                { value: fmtCur(r.freeCashFlow), raw: r.freeCashFlow, highlight: 'freeCF' },
                fmtCur(r.netChangeInCash)
            ]).reverse()
        );
    }

    function createTable(headers, rows) {
        const head = headers.map(h => `<th>${h}</th>`).join('');
        const body = rows.map(r => {
            const cells = r.map((c, i) => {
                if (i === 0) return `<td>${c ?? 'N/A'}</td>`;
                if (c && typeof c === 'object' && c.value !== undefined) {
                    const cls = [];
                    if (typeof c.raw === 'number') {
                        cls.push(c.raw >= 0 ? 'positive-value' : 'negative-value');
                        if (c.highlight) {
                            if (c.highlight === 'revenue' && c.raw > 0) cls.push('highlight-positive');
                            else if (c.highlight === 'netIncome') cls.push(c.raw >= 0 ? 'highlight-positive' : 'highlight-negative');
                            else if (c.highlight === 'totalDebt' && c.raw > 0) cls.push('highlight-negative');
                            else if (c.highlight === 'totalEquity') cls.push(c.raw >= 0 ? 'highlight-positive' : 'highlight-negative');
                            else if (c.highlight === 'operatingCF' || c.highlight === 'freeCF') cls.push(c.raw >= 0 ? 'highlight-positive' : 'highlight-negative');
                        }
                    }
                    return `<td><span class="${cls.join(' ')}">${c.value}</span></td>`;
                }
                return `<td>${c ?? 'N/A'}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        return `<table class="financial-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }

    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
    }
});
