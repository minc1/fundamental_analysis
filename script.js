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
    const epsEl = document.getElementById('eps'); // Represents Diluted EPS value now
    const metricYearEls = document.querySelectorAll('.metric-year');
    // Chart and table elements
    const chartLegend = document.getElementById('chartLegend');
    const metricsLegend = document.getElementById('metricsLegend');
    const incomeTable = document.getElementById('incomeTable');
    const balanceSheetTable = document.getElementById('balanceSheetTable');
    const cashFlowTable = document.getElementById('cashFlowTable');

    let revenueChart = null;
    let metricsChart = null;
    const revenueColor = '#1c2541'; // Navy
    const metricsColors = [
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
        const revenueLabels = ['Revenue'];
        const metricsLabels = ['Net Income', 'Operating Cash Flow', 'Free Cash Flow'];

        chartLegend.innerHTML = revenueLabels.map((label, i) => `
            <div class="chart-legend-item">
                <span class="chart-legend-color" style="background-color: ${revenueColor}"></span>
                ${label}
            </div>
        `).join('');

        metricsLegend.innerHTML = metricsLabels.map((label, i) => `
            <div class="chart-legend-item">
                <span class="chart-legend-color" style="background-color: ${metricsColors[i]};"></span>
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

        // --- Get Latest Year and Update Labels ---
        const latestYear = latestIncome ? latestIncome.calendarYear : 'N/A';
        metricYearEls.forEach(span => {
            span.textContent = latestYear;
        });
        // --- End Year Update ---


        // --- Display Key Metrics (using direct data) ---

        // Revenue
        revenueEl.textContent = latestIncome ? formatCurrency(latestIncome.revenue) : 'N/A';

        // Net Income
        netIncomeEl.textContent = latestIncome ? formatCurrency(latestIncome.netIncome) : 'N/A';

        // Debt/Equity Ratio
        if (latestBalanceSheet && latestBalanceSheet.totalDebt !== undefined && latestBalanceSheet.totalEquity && latestBalanceSheet.totalEquity > 0) {
            const debtEquityRatio = (latestBalanceSheet.totalDebt / latestBalanceSheet.totalEquity);
            // Use formatNumber for ratios/non-currency numbers
            debtEquityEl.textContent = formatNumber(debtEquityRatio);
        } else {
            debtEquityEl.textContent = 'N/A';
        }

        // Free Cash Flow
        freeCashFlowEl.textContent = latestCashFlow ? formatCurrency(latestCashFlow.freeCashFlow) : 'N/A';

        // Diluted EPS (Earnings Per Share) - Updated Logic
        let dilutedEpsValue = 'N/A';
        if (latestIncome) {
            // Prefer 'epsdiluted', fallback to 'eps' if not available
            const epsValue = latestIncome.epsdiluted !== undefined ? latestIncome.epsdiluted : latestIncome.eps;
            if (epsValue !== undefined && epsValue !== null) {
                 // Use formatNumber for EPS as it's per-share, not large currency
                dilutedEpsValue = formatNumber(epsValue);
            }
        }
        epsEl.textContent = dilutedEpsValue;
        // --- End Key Metrics ---

        // Create financial charts
        createFinancialChart(incomeData, cashFlowData, balanceSheetData);

        // Create tables
        createFinancialTables(incomeData, cashFlowData, balanceSheetData);

        // Create chart legend
        createChartLegend();

        // Show the data container
        dataContainer.style.display = 'block';
    }

    // Create the financial charts
    function createFinancialChart(incomeData, cashFlowData, balanceSheetData) {
        const years = incomeData.map(item => item.calendarYear);
        
        // Destroy existing charts if they exist
        if (revenueChart) revenueChart.destroy();
        if (metricsChart) metricsChart.destroy();

        // Revenue Chart
        revenueChart = new Chart(
            document.getElementById('revenueChart'),
            {
                type: 'line',
                data: {
                    labels: years,
                    datasets: [{
                        label: 'Revenue',
                        data: incomeData.map(item => item.revenue),
                        borderColor: revenueColor,
                        backgroundColor: revenueColor,
                        borderWidth: 2,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value, true);
                                }
                            }
                        }
                    }
                }
            }
        );

        // Metrics Chart
        metricsChart = new Chart(
            document.getElementById('metricsChart'),
            {
                type: 'line',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Net Income',
                            data: incomeData.map(item => item.netIncome),
                            borderColor: metricsColors[0],
                            backgroundColor: metricsColors[0],
                            borderWidth: 2,
                            tension: 0.4
                        },
                        {
                            label: 'Operating Cash Flow',
                            data: cashFlowData.map(item => item.operatingCashFlow),
                            borderColor: metricsColors[1],
                            backgroundColor: metricsColors[1],
                            borderWidth: 2,
                            tension: 0.4
                        },
                        {
                            label: 'Free Cash Flow',
                            data: cashFlowData.map(item => item.freeCashFlow),
                            borderColor: metricsColors[2],
                            backgroundColor: metricsColors[2],
                            borderWidth: 2,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value, true);
                                }
                            }
                        }
                    }
                }
            }
        );
    }

    // Create financial tables
    function createFinancialTables(incomeData, cashFlowData, balanceSheetData) {
        // Income Statement Table - Updated EPS Header and Data Fetch
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
            if (!Array.isArray(row)) {
                console.error("Expected row data to be an array, but received:", row);
                return '';
            }
            
            const cells = row.map((cell, index) => {
                // Skip first column (Year)
                if (index === 0) {
                    return `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`;
                }
                
                // Check if cell is an object with highlight info
                if (cell && typeof cell === 'object' && cell.value !== undefined) {
                    const value = cell.value;
                    const rawValue = cell.raw;
                    const highlightType = cell.highlight;
                    
                    // Basic positive/negative formatting
                    let classes = [];
                    if (typeof rawValue === 'number') {
                        classes.push(rawValue >= 0 ? 'positive-value' : 'negative-value');
                        
                        // Apply additional highlighting based on type
                        if (highlightType) {
                            // For income statement
                            if (highlightType === 'revenue' && rawValue > 0) {
                                classes.push('highlight-positive');
                            } else if (highlightType === 'netIncome') {
                                classes.push(rawValue >= 0 ? 'highlight-positive' : 'highlight-negative');
                            }
                            // For balance sheet
                            else if (highlightType === 'totalDebt' && rawValue > 0) {
                                classes.push('highlight-negative'); // High debt is generally negative
                            } else if (highlightType === 'totalEquity') {
                                classes.push(rawValue >= 0 ? 'highlight-positive' : 'highlight-negative');
                            }
                            // For cash flow
                            else if (highlightType === 'operatingCF' || highlightType === 'freeCF') {
                                classes.push(rawValue >= 0 ? 'highlight-positive' : 'highlight-negative');
                            }
                        }
                    }
                    
                    return `<td><span class="${classes.join(' ')}">${value}</span></td>`;
                }
                
                // Regular cell
                return `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`;
            }).join('');
            
            return `<tr>${cells}</tr>`;
        }).join('');

        if (!rowHTML) {
            return '<p>No data available to display.</p>';
        }

        return `
            <table class="financial-table">
                <thead><tr>${headerHTML}</tr></thead>
                <tbody>${rowHTML}</tbody>
            </table>
        `;
    }

    // Helper function to format general numbers (like ratios, EPS)
    function formatNumber(value) {
        if (value === undefined || value === null || typeof value !== 'number') return 'N/A';

        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(value);
    }

    // Helper function to format large currency values (with M/B suffixes)
    function formatCurrency(value, forceAbbreviate = false) {
        if (value === undefined || value === null || typeof value !== 'number') return 'N/A';

        const absValue = Math.abs(value);
        let suffix = '';
        let divisor = 1;
        let minimumFractionDigits = 0; // Default to 0
        let maximumFractionDigits = 0; // Default to 0

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
            // Only apply decimals for very small numbers if no suffix is used
            minimumFractionDigits = 2;
            maximumFractionDigits = 2;
        }

        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: minimumFractionDigits, // Use the determined fraction digits
            maximumFractionDigits: maximumFractionDigits // Use the determined fraction digits
        });

        if (suffix) {
            // Ensure the number being formatted is treated as non-currency for suffix logic
            const numFormatter = new Intl.NumberFormat('en-US', {
                 minimumFractionDigits: 0, // Always 0 for K/M/B
                 maximumFractionDigits: 0 // Always 0 for K/M/B
            });
             formattedValue = numFormatter.format(value / divisor); // Format number part only
             return `$${formattedValue}${suffix}`;
        } else {
            // Use the currency formatter for values without suffixes
            return formatter.format(value);
        }
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
});