# ForensicFinancials: Powerful Financial Fundamentals Analyzer

[![Netlify Status](https://api.netlify.com/api/v1/badges/4c2e2b6f-8b1d-4e8d-8c6e-1234567890ab/deploy-status)](https://forensicfinancials-tools.netlify.app/)

**Live Demo:** [https://forensicfinancials-tools.netlify.app/](https://forensicfinancials-tools.netlify.app/)

ForensicFinancials is a modern web-based tool for deep, visual analysis of company fundamentals. Instantly analyze and compare key financial metrics, spot trends, and uncover red flags—all in a clean, interactive dashboard.

## Features

- **Instant Search**: Enter any stock ticker and get a full breakdown of that company’s financials.
- **Interactive Charts**: Visualize revenue, net income, cash flow, and more with layered, color-coded graphs.
- **Forensic Analysis**: Identify unusual patterns and potential accounting risks with clear, direct visuals.
- **Comprehensive Financial Tables**: View detailed income statements, balance sheets, and cash flow statements.
- **Responsive Design**: Works on desktop, tablet, and mobile.
- **Fast & Secure**: All processing is client-side. No personal data is stored or shared.

## Getting Started

### Requirements
- Modern web browser (Chrome, Firefox, Edge, Safari)
- [Python 3](https://www.python.org/) (for local development server)

### Local Setup
1. **Clone or Download the Project**
2. **Open a Terminal** and navigate to the project folder:
   ```bash
   cd path/to/fundamental_analysis-TESTING
   ```
3. **Start a Local Server**:
   ```bash
   python3 -m http.server 8000
   ```
4. **Open your browser** and go to [http://localhost:8000](http://localhost:8000)

You’re ready to analyze any company!

## File Structure

- `index.html`      — Landing page, project overview
- `search.html`     — Company ticker search interface
- `analyzer.html`   — Main dashboard for analysis and charts
- `script.js`       — All interactive JavaScript and chart logic
- `style.css`       — Modern, responsive styles

## Usage

1. **Go to the search page** and enter a stock ticker (e.g., `AAPL`, `MSFT`, `NVDA`).
2. **View the dashboard** for instant charts and tables.
3. **Hover on charts** for detailed values. Toggle metrics on/off in the legend.
4. **Scroll down** for full financial statements.

## Customization

- To change chart colors, edit CSS variables in `style.css` under `:root`.
- To add new metrics, update the `metricsCfg` array in `script.js`.

## Support

- If you find a bug or want to request a feature, open an issue or contact the maintainer.

## License

This project is for educational and demonstration purposes. For commercial use, please contact the author.

---

**ForensicFinancials** helps you make smarter, more confident investment decisions with data you can trust.
