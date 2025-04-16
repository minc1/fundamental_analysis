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
    // Get all metric year spans
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
            // Construct file paths assuming DATA/TICKER/filename.json structure
            const incomePath = `${ticker}/income_statement_annual.json`;
            const cashFlowPath = `${ticker}/cash_flow_statement_annual.json`;
            const balanceSheetPath = `${ticker}/balance_sheet_statement_annual.json`;

            const [incomeData, cashFlowData, balanceSheetData] = await Promise.all([
                fetchData(incomePath),
                fetchData(cashFlowPath),
                fetchData(balanceSheetPath)
            ]);

            // Check if data arrays are empty
             if (!incomeData || incomeData.length === 0 ||
                 !cashFlowData || cashFlowData.length === 0 ||
                 !balanceSheetData || balanceSheetData.length === 0) {
                 throw new Error(`Incomplete or missing financial data for ${ticker}.`);
             }

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
             if (response.status === 404) {
                 throw new Error(`Data file not found at ${path}. Ensure ticker is correct and data exists.`);
             } else {
                throw new Error(`HTTP error ${response.status} fetching ${path}`);
             }
        }
        try {
            return await response.json();
        } catch (jsonError) {
            throw new Error(`Failed to parse JSON from ${path}: ${jsonError.message}`);
        }
    }

    // Process and display the financial data
    function processFinancialData(ticker, incomeData, cashFlowData, balanceSheetData) {
        // Sort data by calendar year (oldest first for chart consistency)
        // Use localeCompare for robust string comparison if years are strings,
        // or subtraction if they are numbers. Assuming numbers here based on JSON.
        incomeData.sort((a, b) => parseInt(a.calendarYear, 10) - parseInt(b.calendarYear, 10));
        cashFlowData.sort((a, b) => parseInt(a.calendarYear, 10) - parseInt(b.calendarYear, 10));
        balanceSheetData.sort((a, b) => parseInt(a.calendarYear, 10) - parseInt(b.calendarYear, 10));

        // Update company header
        companyHeader.textContent = `${ticker} Financial Analysis`;

        // --- Get latest year's data (last element after sorting oldest to newest) ---
        const latestIncome = incomeData[incomeData.length - 1];
        const latestCashFlow = cashFlowData.find(d => d.calendarYear === latestIncome.calendarYear) || cashFlowData[cashFlowData.length - 1]; // Ensure matching year if possible
        const latestBalanceSheet = balanceSheetData.find(d => d.calendarYear === latestIncome.calendarYear) || balanceSheetData[balanceSheetData.length - 1]; // Ensure matching year

        // --- Get Latest Year and Update Labels ---
        const latestYear = latestIncome ? latestIncome.calendarYear : 'N/A';
        metricYearEls.forEach(span => {
            span.textContent = latestYear; // Update all metric year spans
        });
        // --- End Year Update ---


        // --- Display Key Metrics (using data from the *latest* year) ---

        // Revenue
        revenueEl.textContent = latestIncome ? formatCurrency(latestIncome.revenue) : 'N/A';

        // Net Income
        netIncomeEl.textContent = latestIncome ? formatCurrency(latestIncome.netIncome) : 'N/A';

        // Debt/Equity Ratio
        if (latestBalanceSheet && latestBalanceSheet.totalDebt !== undefined && latestBalanceSheet.totalEquity !== undefined && latestBalanceSheet.totalEquity !== 0) {
            const debtEquityRatio = (latestBalanceSheet.totalDebt / latestBalanceSheet.totalEquity);
            // Use formatNumber for ratios/non-currency numbers
            debtEquityEl.textContent = formatNumber(debtEquityRatio);
        } else {
            debtEquityEl.textContent = 'N/A'; // Handle missing data or zero equity
        }

        // Free Cash Flow
        // Find the matching cash flow year data, fallback to latest if needed
        const matchingCashFlow = cashFlowData.find(cf => cf.calendarYear === latestYear) || latestCashFlow;
        freeCashFlowEl.textContent = matchingCashFlow ? formatCurrency(matchingCashFlow.freeCashFlow) : 'N/A';

        // Diluted EPS (Earnings Per Share) - Updated Logic
        let dilutedEpsValue = 'N/A';
        if (latestIncome) {
            // Prefer 'epsdiluted', fallback to 'eps' if not available
            const epsValue = latestIncome.epsdiluted !== undefined && latestIncome.epsdiluted !== null
                             ? latestIncome.epsdiluted
                             : latestIncome.eps;
            if (epsValue !== undefined && epsValue !== null) {
                 // Use formatNumber for EPS as it's per-share, not large currency
                dilutedEpsValue = formatNumber(epsValue);
            }
        }
        epsEl.textContent = dilutedEpsValue;
        // --- End Key Metrics ---

        // Create financial chart using the chronologically sorted data
        createFinancialChart(incomeData, cashFlowData, balanceSheetData);

        // Create tables (reverse the sorted data for newest-first view in tables)
        createFinancialTables(
            [...incomeData].reverse(),
            [...cashFlowData].reverse(),
            [...balanceSheetData].reverse()
        );

        // Create chart legend
        createChartLegend();

        // Show the data container
        dataContainer.style.display = 'block';
        errorMessage.style.display = 'none'; // Hide error message if data loaded successfully
    }

    // Create the financial chart
    function createFinancialChart(incomeData, cashFlowData, balanceSheetData) {
        // Extract years from the sorted income data for the X-axis
        const years = incomeData.map(item => item.calendarYear);

        // Helper to get data for a specific year, returning null if not found
        const getDataForYear = (dataArray, year, field) => {
            const item = dataArray.find(d => d.calendarYear === year);
            return item && item[field] !== undefined ? item[field] : null; // Return null for missing points
        };

        const datasets = [
            {
                label: 'Revenue',
                data: years.map(year => getDataForYear(incomeData, year, 'revenue')),
                borderColor: chartColors[0],
                backgroundColor: 'rgba(28, 37, 65, 0.1)',
                pointBackgroundColor: chartColors[0],
                pointBorderColor: chartColors[0],
                borderWidth: 2,
                tension: 0.1, // Slightly less curve for financial data
                yAxisID: 'y',
                spanGaps: true // Connect lines even if data points are missing (null)
            },
            {
                label: 'Net Income',
                data: years.map(year => getDataForYear(incomeData, year, 'netIncome')),
                borderColor: chartColors[1],
                backgroundColor: 'rgba(197, 164, 126, 0.1)',
                pointBackgroundColor: chartColors[1],
                pointBorderColor: chartColors[1],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y',
                spanGaps: true
            },
            {
                label: 'Operating Cash Flow',
                data: years.map(year => getDataForYear(cashFlowData, year, 'operatingCashFlow')),
                borderColor: chartColors[2],
                backgroundColor: 'rgba(243, 225, 187, 0.1)',
                pointBackgroundColor: chartColors[2],
                pointBorderColor: chartColors[2],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y',
                spanGaps: true
            },
            {
                label: 'Total Debt',
                data: years.map(year => getDataForYear(balanceSheetData, year, 'totalDebt')),
                borderColor: chartColors[3],
                backgroundColor: 'rgba(108, 117, 125, 0.1)',
                pointBackgroundColor: chartColors[3],
                pointBorderColor: chartColors[3],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y',
                spanGaps: true
            },
            {
                label: 'Free Cash Flow',
                data: years.map(year => getDataForYear(cashFlowData, year, 'freeCashFlow')),
                borderColor: chartColors[4],
                backgroundColor: 'rgba(33, 37, 41, 0.1)',
                pointBackgroundColor: chartColors[4],
                pointBorderColor: chartColors[4],
                borderWidth: 2,
                tension: 0.1,
                yAxisID: 'y',
                spanGaps: true
            }
        ];

        const ctx = document.getElementById('financialChart').getContext('2d');

        if (financialChart) {
            financialChart.destroy(); // Destroy previous chart instance
        }

        financialChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years, // Use the extracted years for labels
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index', // Show tooltips for all datasets at that index
                    intersect: false
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: {
                            // Format Y-axis ticks using the currency helper
                            callback: function(value) {
                                // Use forceAbbreviate=true for concise axis labels
                                return formatCurrency(value, true);
                            },
                            maxTicksLimit: 8 // Limit number of ticks for readability
                        },
                        grid: {
                            // drawBorder: false, // Optional: remove axis border
                            color: 'rgba(0, 0, 0, 0.05)' // Lighter grid lines
                        }
                    },
                    x: { // Ensure X axis (years) is configured
                        display: true,
                        title: {
                            display: false, // No need for an 'Year' title if labels are years
                            text: 'Year'
                        },
                        grid: {
                            display: false // Hide vertical grid lines
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
                                // Format tooltip values using standard currency format
                                label += formatCurrency(context.raw);
                                return label;
                            }
                        }
                    },
                    legend: {
                        display: false // Using custom legend above the chart
                    }
                },
                elements: {
                    line: {
                        // tension: 0.4 // Removed from here, set per dataset
                    },
                    point: {
                        radius: 3, // Smaller points
                        hoverRadius: 5 // Larger points on hover
                    }
                }
            }
        });
    }

    // Create financial tables (expects data sorted newest first)
    function createFinancialTables(incomeData, cashFlowData, balanceSheetData) {
        // Income Statement Table - Updated EPS Header and Data Fetch
        incomeTable.innerHTML = createTableHTML(
            // Updated header: 'Diluted EPS'
            ['Year', 'Revenue', 'Gross Profit', 'Net Income', 'Diluted EPS', 'Operating Income'],
            incomeData.map(item => {
                // Prioritize epsdiluted, fallback to eps
                const epsValue = item.epsdiluted !== undefined && item.epsdiluted !== null
                                 ? item.epsdiluted
                                 : item.eps;
                return [
                    item.calendarYear,
                    formatCurrency(item.revenue),
                    formatCurrency(item.grossProfit),
                    formatCurrency(item.netIncome),
                    // Format EPS as a number
                    (epsValue !== undefined && epsValue !== null) ? formatNumber(epsValue) : 'N/A',
                    formatCurrency(item.operatingIncome)
                ];
            }) // Data is already reversed before calling this function
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
            ]) // Data is already reversed
        );

        // Cash Flow Table
        cashFlowTable.innerHTML = createTableHTML(
            ['Year', 'Operating CF', 'Investing CF', 'Financing CF', 'Free CF', 'Net Change'],
            cashFlowData.map(item => [
                item.calendarYear,
                formatCurrency(item.operatingCashFlow),
                formatCurrency(item.netCashUsedForInvestingActivites), // Corrected property name if needed
                formatCurrency(item.netCashUsedProvidedByFinancingActivities), // Corrected property name if needed
                formatCurrency(item.freeCashFlow),
                formatCurrency(item.netChangeInCash)
            ]) // Data is already reversed
        );
    }

    // Helper function to create table HTML
    function createTableHTML(headers, rows) {
        if (!rows || rows.length === 0) {
             return '<p class="no-data-message">No data available to display in table.</p>';
        }

        const headerHTML = headers.map(h => `<th>${h}</th>`).join('');

        const rowHTML = rows.map(row => {
            // Basic check if row is an array
            if (!Array.isArray(row)) {
                console.error("Invalid row data for table:", row);
                return ''; // Skip invalid row
            }
            // Ensure N/A is shown for undefined/null cells
            const cells = row.map(cell => `<td>${cell !== undefined && cell !== null ? cell : 'N/A'}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        return `
            <table>
                <thead><tr>${headerHTML}</tr></thead>
                <tbody>${rowHTML}</tbody>
            </table>
        `;
    }

    // Helper function to format general numbers (like ratios, EPS)
    function formatNumber(value) {
        // Check for non-numeric types, null, or undefined
        if (typeof value !== 'number' || value === null || isNaN(value)) return 'N/A';

        // Format to 2 decimal places
        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(value);
    }

    // Helper function to format large currency values (with M/B/K suffixes)
    function formatCurrency(value, forceAbbreviate = false) {
        // Check for non-numeric types, null, or undefined
        if (typeof value !== 'number' || value === null || isNaN(value)) return 'N/A';

        const absValue = Math.abs(value);
        let suffix = '';
        let divisor = 1;
        let minimumFractionDigits = 0; // Default for whole numbers or K/M/B
        let maximumFractionDigits = 0;

        if (absValue >= 1000000000) {
            suffix = 'B';
            divisor = 1000000000;
            minimumFractionDigits = 2; // Show two decimals for Billions
            maximumFractionDigits = 2;
        } else if (absValue >= 1000000) {
            suffix = 'M';
            divisor = 1000000;
            minimumFractionDigits = 2; // Show two decimals for Millions
            maximumFractionDigits = 2;
        } else if (forceAbbreviate && absValue >= 1000) {
             suffix = 'K';
             divisor = 1000;
             // Show 1 decimal for K if less than 10K, otherwise 0
             minimumFractionDigits = absValue < 10000 ? 1 : 0;
             maximumFractionDigits = minimumFractionDigits;
        } else if (absValue < 1000 && absValue !== 0) {
             // For values less than 1000, show 2 decimal places only if needed (e.g., EPS)
             // But for large currency, we usually want whole numbers.
             // Let's default to 0 unless it's a very small number (e.g., < 10)
             if (absValue < 10) {
                 minimumFractionDigits = 2;
                 maximumFractionDigits = 2;
             } else {
                 minimumFractionDigits = 0;
                 maximumFractionDigits = 0;
             }
        } else if (value === 0) {
             minimumFractionDigits = 0;
             maximumFractionDigits = 0;
        }


        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: minimumFractionDigits,
            maximumFractionDigits: maximumFractionDigits
        });

        // Apply divisor and suffix logic
        let formattedValue;
        if (divisor > 1) {
             // Format the divided value, then remove currency symbol to add suffix
             formattedValue = formatter.format(value / divisor).replace(/[$]/g, ''); // Remove $
             // Handle potential negative sign placement if Intl puts it before $
             if (value < 0 && !formattedValue.startsWith('-')) {
                 formattedValue = '-' + formattedValue;
             }
             return `$${formattedValue}${suffix}`;
        } else {
            // No division, just format directly
            return formatter.format(value);
        }
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        dataContainer.style.display = 'none'; // Hide data container on error
    }
});