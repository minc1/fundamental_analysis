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
    const incomeTable = document.getElementById('incomeTable');
    const balanceSheetTable = document.getElementById('balanceSheetTable');
    const cashFlowTable = document.getElementById('cashFlowTable');

    let financialChart = null;
    const chartColors = [
        '#1c2541', // Navy - Revenue (var(--navy))
        '#c5a47e', // Gold - Net Income (var(--gold))
        '#f3e1bb', // Pastel Gold - Operating Cash Flow (var(--pastel-gold))
        '#6c757d', // Gray - Total Debt (var(--gray-color))
        '#212529'  // Dark - Free Cash Flow (var(--dark-color))
    ];

    // Event listeners
    loadButton.addEventListener('click', loadFinancialData);
    tickerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') loadFinancialData();
    });

    // Create chart legend
    function createChartLegend() {
        const labels = [
            'Revenue',
            'Net Income',
            'Operating Cash Flow',
            'Total Debt',
            'Free Cash Flow'
        ];

        chartLegend.innerHTML = labels.map((label, i) => `
            <div class="chart-legend-item">
                <span class="chart-legend-color" style="background-color: ${chartColors[i]}"></span>
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

        // Create financial chart
        createFinancialChart(incomeData, cashFlowData, balanceSheetData);

        // Create tables
        createFinancialTables(incomeData, cashFlowData, balanceSheetData);

        // Create chart legend
        createChartLegend();

        // Show the data container
        dataContainer.style.display = 'block';
    }

    // Create the financial chart
    function createFinancialChart(incomeData, cashFlowData, balanceSheetData) {
        const years = incomeData.map(item => item.calendarYear);
        const datasets = [
            {
                label: 'Revenue',
                data: incomeData.map(item => item.revenue),
                borderColor: chartColors[0],
                backgroundColor: 'rgba(28, 37, 65, 0.1)',
                pointBackgroundColor: chartColors[0],
                pointBorderColor: chartColors[0],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Net Income',
                data: incomeData.map(item => item.netIncome),
                borderColor: chartColors[1],
                backgroundColor: 'rgba(197, 164, 126, 0.1)',
                pointBackgroundColor: chartColors[1],
                pointBorderColor: chartColors[1],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Operating Cash Flow',
                data: cashFlowData.map(item => item.operatingCashFlow),
                borderColor: chartColors[2],
                backgroundColor: 'rgba(243, 225, 187, 0.1)',
                pointBackgroundColor: chartColors[2],
                pointBorderColor: chartColors[2],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Total Debt',
                data: balanceSheetData.map(item => item.totalDebt),
                borderColor: chartColors[3],
                backgroundColor: 'rgba(108, 117, 125, 0.1)',
                pointBackgroundColor: chartColors[3],
                pointBorderColor: chartColors[3],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            },
            {
                label: 'Free Cash Flow',
                data: cashFlowData.map(item => item.freeCashFlow),
                borderColor: chartColors[4],
                backgroundColor: 'rgba(33, 37, 41, 0.1)',
                pointBackgroundColor: chartColors[4],
                pointBorderColor: chartColors[4],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y'
            }
        ];

        const ctx = document.getElementById('financialChart').getContext('2d');

        if (financialChart) {
            financialChart.destroy();
        }

        financialChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: datasets
            },
            options: {
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
                                // Use formatCurrency for axis labels as they represent large values
                                return formatCurrency(value, true); // Pass true to force abbreviation
                            }
                        },
                        grid: {
                            drawOnChartArea: true
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
                                // Use formatCurrency for tooltips as well
                                label += formatCurrency(context.raw);
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: false // Using custom legend
                    }
                }
            }
        });
    }

    // Create financial tables
    function createFinancialTables(incomeData, cashFlowData, balanceSheetData) {
        // Income Statement Table - Updated EPS Header and Data Fetch
        incomeTable.innerHTML = createTableHTML(
            ['Year', 'Revenue', 'Gross Profit', 'Net Income', 'Diluted EPS', 'Operating Income'], // <-- Updated Header
            incomeData.map(item => {
                // Prefer 'epsdiluted', fallback to 'eps'
                const epsValue = item.epsdiluted !== undefined ? item.epsdiluted : item.eps;
                return [
                    item.calendarYear,
                    formatCurrency(item.revenue),
                    formatCurrency(item.grossProfit),
                    formatCurrency(item.netIncome),
                    (epsValue !== undefined && epsValue !== null) ? formatNumber(epsValue) : 'N/A', // <-- Use formatNumber and fetch correct value
                    formatCurrency(item.operatingIncome)
                ];
            }).reverse() // Display latest year first in tables
        );

        // Balance Sheet Table
        balanceSheetTable.innerHTML = createTableHTML(
            ['Year', 'Total Assets', 'Total Debt', 'Total Equity', 'Cash', 'Current Assets'],
            balanceSheetData.map(item => [
                item.calendarYear,
                formatCurrency(item.totalAssets),
                formatCurrency(item.totalDebt),
                formatCurrency(item.totalEquity),
                formatCurrency(item.cashAndCashEquivalents),
                formatCurrency(item.totalCurrentAssets)
            ]).reverse()
        );

        // Cash Flow Table
        cashFlowTable.innerHTML = createTableHTML(
            ['Year', 'Operating CF', 'Investing CF', 'Financing CF', 'Free CF', 'Net Change'],
            cashFlowData.map(item => [
                item.calendarYear,
                formatCurrency(item.operatingCashFlow),
                formatCurrency(item.netCashUsedForInvestingActivites), // Check API source for exact key name if issues arise
                formatCurrency(item.netCashUsedProvidedByFinancingActivities),
                formatCurrency(item.freeCashFlow),
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
            const cells = row.map(cell => `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        if (!rowHTML) {
            return '<p>No data available to display.</p>';
        }

        return `
            <table>
                <thead><tr>${headerHTML}</tr></thead>
                <tbody>${rowHTML}</tbody>
            </table>
        `;
    }

    // Helper function to format general numbers (like ratios, EPS)
    function formatNumber(value) {
        if (value === undefined || value === null || typeof value !== 'number') return 'N/A';

        // Use Intl.NumberFormat for consistent number formatting (e.g., commas)
        // Typically use 2 decimal places for ratios and per-share values
        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(value);
    }


    // Helper function to format large currency values (with M/B suffixes)
    // Added 'forceAbbreviate' for axis ticks
    function formatCurrency(value, forceAbbreviate = false) {
        if (value === undefined || value === null || typeof value !== 'number') return 'N/A';

        const absValue = Math.abs(value);
        let suffix = '';
        let divisor = 1;
        let minimumFractionDigits = 0; // Default for whole numbers

        // Determine suffix and divisor
        if (absValue >= 1000000000) {
            suffix = 'B';
            divisor = 1000000000;
            minimumFractionDigits = 2; // Show decimals for Billions
        } else if (absValue >= 1000000) {
            suffix = 'M';
            divisor = 1000000;
            minimumFractionDigits = 2; // Show decimals for Millions
        } else if (forceAbbreviate && absValue >= 1000) {
             // Only add K if forced (e.g., for crowded axis)
             suffix = 'K';
             divisor = 1000;
             minimumFractionDigits = absValue < 10000 ? 1 : 0; // Fewer decimals for K unless small K
        } else if (absValue < 10) {
             minimumFractionDigits = 2; // Show decimals for small currency values if not abbreviating
        }


        // Use Intl.NumberFormat for the number part
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD', // Assuming USD
            minimumFractionDigits: minimumFractionDigits,
            maximumFractionDigits: minimumFractionDigits > 0 ? minimumFractionDigits : 0 // Match min decimals or use 0
        });

        // Format the (potentially divided) value
        let formattedValue = formatter.format(value / divisor);

        // Append suffix if needed, remove currency symbol if suffix exists
        if (suffix) {
             formattedValue = formattedValue.replace('$', ''); // Remove currency symbol
             return `$${formattedValue}${suffix}`;
        } else {
            return formattedValue; // Return full currency format
        }
    }


    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

});