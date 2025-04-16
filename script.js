document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // DOM elements
    const tickerInput = document.getElementById('ticker');
    const loadButton = document.getElementById('loadData');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingTicker = document.getElementById('loadingTicker');
    const errorMessage = document.getElementById('errorMessage');
    const dataContainer = document.getElementById('dataContainer');
    const companyHeader = document.getElementById('companyHeader');
    // Updated DOM elements for key metrics
    const revenueEl = document.getElementById('revenue');
    const netIncomeEl = document.getElementById('netIncome');
    const debtEquityEl = document.getElementById('debtEquity');
    const freeCashFlowEl = document.getElementById('freeCashFlow');
    const epsEl = document.getElementById('eps');
    const metricYearEls = document.querySelectorAll('.metric-year');
    // Chart and table elements
    const chartLegend = document.getElementById('chartLegend');
    const incomeTable = document.getElementById('incomeTable');
    const balanceSheetTable = document.getElementById('balanceSheetTable');
    const cashFlowTable = document.getElementById('cashFlowTable');

    let revenueChart = null;
    let metricsChart = null;
    const chartColors = [
        '#1c2541', // Navy - Revenue
        '#c5a47e', // Gold - Net Income
        '#6c757d', // Gray - Operating Cash Flow
        '#f3e1bb'  // Pastel Gold - Free Cash Flow
    ];

    // Event listeners
    loadButton.addEventListener('click', loadFinancialData);
    tickerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') loadFinancialData();
    });

    // Create chart legend
    function createChartLegend() {
        const labels = [
            'Net Income',
            'Operating Cash Flow',
            'Free Cash Flow'
        ];

        chartLegend.innerHTML = labels.map((label, i) => `
            <div class="chart-legend-item">
                <span class="chart-legend-color" style="background-color: ${chartColors[i+1]}"></span>
                ${label}
            </div>
        `).join('');
    }

    // Main function to load financial data
    async function loadFinancialData() {
        const ticker = tickerInput.value.trim().toUpperCase();

        if (!ticker) {
            showError('Please enter a valid ticker symbol');
            return;
        }

        // Show loading state
        loadingTicker.textContent = ticker;
        loadingIndicator.style.display = 'flex';
        errorMessage.style.display = 'none';
        dataContainer.style.display = 'none';

        try {
            const [incomeData, cashFlowData, balanceSheetData] = await Promise.all([
                fetchData(`${ticker}/income_statement_annual.json`),
                fetchData(`${ticker}/cash_flow_statement_annual.json`),
                fetchData(`${ticker}/balance_sheet_statement_annual.json`)
            ]);

            processFinancialData(ticker, incomeData, cashFlowData, balanceSheetData);

        } catch (error) {
            showError(`Error loading data for ${ticker}: ${error.message}`);
            console.error('Error loading financial data:', error);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    // Fetch data from DATA folder
    async function fetchData(path) {
        const response = await fetch(`DATA/${path}`);
        if (!response.ok) {
            throw new Error(`Data not found for ${path.split('/')[0]}`);
        }
        return response.json();
    }

    // Process and display the financial data
    function processFinancialData(ticker, incomeData, cashFlowData, balanceSheetData) {
        // Sort data by calendar year (oldest first for chart)
        incomeData.sort((a, b) => a.calendarYear - b.calendarYear);
        cashFlowData.sort((a, b) => a.calendarYear - b.calendarYear);
        balanceSheetData.sort((a, b) => a.calendarYear - b.calendarYear);

        // Update company header
        companyHeader.textContent = `${ticker} Financial Analysis`;

        // Get latest year's data
        const latestIncome = incomeData.length > 0 ? incomeData[incomeData.length - 1] : null;
        const latestCashFlow = cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1] : null;
        const latestBalanceSheet = balanceSheetData.length > 0 ? balanceSheetData[balanceSheetData.length - 1] : null;

        // Update year labels
        const latestYear = latestIncome ? latestIncome.calendarYear : 'N/A';
        metricYearEls.forEach(span => {
            span.textContent = latestYear;
        });

        // Display Key Metrics
        revenueEl.textContent = latestIncome ? formatCurrency(latestIncome.revenue) : 'N/A';
        netIncomeEl.textContent = latestIncome ? formatCurrency(latestIncome.netIncome) : 'N/A';

        if (latestBalanceSheet && latestBalanceSheet.totalDebt !== undefined && latestBalanceSheet.totalEquity && latestBalanceSheet.totalEquity > 0) {
            const debtEquityRatio = (latestBalanceSheet.totalDebt / latestBalanceSheet.totalEquity);
            debtEquityEl.textContent = formatNumber(debtEquityRatio);
        } else {
            debtEquityEl.textContent = 'N/A';
        }

        freeCashFlowEl.textContent = latestCashFlow ? formatCurrency(latestCashFlow.freeCashFlow) : 'N/A';

        let dilutedEpsValue = 'N/A';
        if (latestIncome) {
            const epsValue = latestIncome.epsdiluted !== undefined ? latestIncome.epsdiluted : latestIncome.eps;
            if (epsValue !== undefined && epsValue !== null) {
                dilutedEpsValue = formatNumber(epsValue);
            }
        }
        epsEl.textContent = dilutedEpsValue;

        // Create charts
        createRevenueChart(incomeData);
        createMetricsChart(incomeData, cashFlowData);

        // Create tables
        createFinancialTables(incomeData, cashFlowData, balanceSheetData);

        // Create chart legend
        createChartLegend();

        // Show the data container
        dataContainer.style.display = 'block';
    }

    // Create the revenue chart
    function createRevenueChart(incomeData) {
        const years = incomeData.map(item => item.calendarYear);
        const ctx = document.getElementById('revenueChart').getContext('2d');

        if (revenueChart) {
            revenueChart.destroy();
        }

        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Revenue',
                    data: incomeData.map(item => item.revenue),
                    borderColor: chartColors[0], // Navy
                    backgroundColor: chartColors[0],
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y'
                }]
            },
            options: getChartOptions()
        });
    }

    // Create the metrics chart
    function createMetricsChart(incomeData, cashFlowData) {
        const years = incomeData.map(item => item.calendarYear);
        const ctx = document.getElementById('metricsChart').getContext('2d');

        if (metricsChart) {
            metricsChart.destroy();
        }

        metricsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Net Income',
                        data: incomeData.map(item => item.netIncome),
                        borderColor: chartColors[1], // Gold
                        backgroundColor: chartColors[1],
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Operating Cash Flow',
                        data: cashFlowData.map(item => item.operatingCashFlow),
                        borderColor: chartColors[2], // Gray
                        backgroundColor: chartColors[2],
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Free Cash Flow',
                        data: cashFlowData.map(item => item.freeCashFlow),
                        borderColor: chartColors[3], // Pastel Gold
                        backgroundColor: chartColors[3],
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    }
                ]
            },
            options: getChartOptions()
        });
    }

    // Common chart options
    function getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, true);
                        },
                        precision: 0
                    },
                    grid: {
                        display: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.raw);
                            return label;
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            elements: {
                line: {
                    tension: 0.4
                }
            }
        };
    }

    // Create financial tables
    function createFinancialTables(incomeData, cashFlowData, balanceSheetData) {
        // Income Statement Table
        incomeTable.innerHTML = createTableHTML(
            ['Year', 'Revenue', 'Gross Profit', 'Net Income', 'Diluted EPS', 'Operating Income'],
            incomeData.map(item => {
                const epsValue = item.epsdiluted !== undefined ? item.epsdiluted : item.eps;
                return [
                    item.calendarYear,
                    { value: formatCurrency(item.revenue), raw: item.revenue, highlight: 'revenue' },
                    formatCurrency(item.grossProfit),
                    { value: formatCurrency(item.netIncome), raw: item.netIncome, highlight: 'netIncome' },
                    (epsValue !== undefined && epsValue !== null) ? formatNumber(epsValue) : 'N/A',
                    formatCurrency(item.operatingIncome)
                ];
            }).reverse()
        );

        // Balance Sheet Table
        balanceSheetTable.innerHTML = createTableHTML(
            ['Year', 'Total Assets', 'Total Debt', 'Total Equity', 'Cash', 'Current Assets'],
            balanceSheetData.map(item => [
                item.calendarYear,
                formatCurrency(item.totalAssets),
                { value: formatCurrency(item.totalDebt), raw: item.totalDebt, highlight: 'totalDebt' },
                { value: formatCurrency(item.totalEquity), raw: item.totalEquity, highlight: 'totalEquity' },
                formatCurrency(item.cashAndCashEquivalents),
                formatCurrency(item.totalCurrentAssets)
            ]).reverse()
        );

        // Cash Flow Table
        cashFlowTable.innerHTML = createTableHTML(
            ['Year', 'Operating CF', 'Investing CF', 'Financing CF', 'Free CF', 'Net Change'],
            cashFlowData.map(item => [
                item.calendarYear,
                { value: formatCurrency(item.operatingCashFlow), raw: item.operatingCashFlow, highlight: 'operatingCF' },
                formatCurrency(item.netCashUsedForInvestingActivites),
                formatCurrency(item.netCashUsedProvidedByFinancingActivities),
                { value: formatCurrency(item.freeCashFlow), raw: item.freeCashFlow, highlight: 'freeCF' },
                formatCurrency(item.netChangeInCash)
            ]).reverse()
        );
    }

    // Helper function to create table HTML
    function createTableHTML(headers, rows) {
        const headerHTML = headers.map(h => `<th>${h}</th>`).join('');

        const rowHTML = rows.map(row => {
            const cells = row.map((cell, index) => {
                if (index === 0) {
                    return `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`;
                }

                if (cell && typeof cell === 'object' && cell.value !== undefined) {
                    const value = cell.value;
                    const rawValue = cell.raw;
                    const highlightType = cell.highlight;

                    let classes = [];
                    if (typeof rawValue === 'number') {
                        classes.push(rawValue >= 0 ? 'positive-value' : 'negative-value');

                        if (highlightType) {
                            if (highlightType === 'revenue' && rawValue > 0) {
                                classes.push('highlight-positive');
                            } else if (highlightType === 'netIncome') {
                                classes.push(rawValue >= 0 ? 'highlight-positive' : 'highlight-negative');
                            }
                            else if (highlightType === 'totalDebt' && rawValue > 0) {
                                classes.push('highlight-negative');
                            } else if (highlightType === 'totalEquity') {
                                classes.push(rawValue >= 0 ? 'highlight-positive' : 'highlight-negative');
                            }
                            else if (highlightType === 'operatingCF' || highlightType === 'freeCF') {
                                classes.push(rawValue >= 0 ? 'highlight-positive' : 'highlight-negative');
                            }
                        }
                    }

                    return `<td><span class="${classes.join(' ')}">${value}</span></td>`;
                }

                return `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`;
            }).join('');

            return `<tr>${cells}</tr>`;
        }).join('');

        return `
            <table class="financial-table">
                <thead><tr>${headerHTML}</tr></thead>
                <tbody>${rowHTML}</tbody>
            </table>
        `;
    }

    // Helper function to format general numbers
    function formatNumber(value) {
        if (value === undefined || value === null || typeof value !== 'number') return 'N/A';

        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(value);
    }

    // Helper function to format large currency values
    function formatCurrency(value, forceAbbreviate = false) {
        if (value === undefined || value === null || typeof value !== 'number') return 'N/A';

        const absValue = Math.abs(value);
        let suffix = '';
        let divisor = 1;
        let minimumFractionDigits = 0;
        let maximumFractionDigits = 0;

        if (absValue >= 1000000000) {
            suffix = 'B';
            divisor = 1000000000;
        } else if (absValue >= 1000000) {
            suffix = 'M';
            divisor = 1000000;
        } else if (forceAbbreviate && absValue >= 1000) {
             suffix = 'K';
             divisor = 1000;
        } else if (absValue < 10) {
            minimumFractionDigits = 2;
            maximumFractionDigits = 2;
        }

        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: minimumFractionDigits,
            maximumFractionDigits: maximumFractionDigits
        });

        if (suffix) {
            const numFormatter = new Intl.NumberFormat('en-US', {
                 minimumFractionDigits: 0,
                 maximumFractionDigits: 0
            });
             formattedValue = numFormatter.format(value / divisor);
             return `$${formattedValue}${suffix}`;
        } else {
            return formatter.format(value);
        }
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
});