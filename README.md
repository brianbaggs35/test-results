# Test Results Platform

A React-based web application for analyzing JUnit XML test results with comprehensive testing and CI/CD pipeline.

## Features

- **Dashboard**: Upload a JUnit XML file and view test result summaries with interactive charts
- **Failure Analysis**: Detailed analysis of failed tests with filtering capabilities
- **Progress Tracking**: Track resolution progress for failed tests, add notes/assignees, and view the full stack trace
- **Split & Combine**: Split a run's failures evenly between teammates, then combine each teammate's exported progress back into one report
- **Publish**: Send a summary of the loaded results to Slack (via TestBeats)
- **Report Generation**: Generate and preview PDF reports from test data
- **Light/Dark Mode**: Toggle between light and dark themes, persisted across sessions
- **Comprehensive Testing**: Vitest for unit/component tests, Playwright for e2e

## Getting Started

### Prerequisites
- Node.js 22.x or later (CI runs against 22.x, 24.x, and 26.x)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   npm fund
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lintfix` - Fix ESLint issues automatically
- `npx tsc` - Run typescript checks

### Testing
- `npm test` - Run tests in watch mode
- `npm run test:watch` - Alias for watch mode
- `npm run test:coverage` - Run tests once with a coverage report
- `npm run test:ui` - Run tests with the Vitest UI interface
- `npm run test:e2e` - Run e2e tests with Playwright
- `npm run test:e2e:ui` - Open the Playwright UI
- `npm run test:e2e:coverage` - Run Playwright e2e tests and report their code coverage (nyc)
- `npm run test:ci` - Run Playwright e2e tests (single worker, retries) and report coverage — used in CI

## Testing

This project has comprehensive test coverage with:

- **625 Vitest tests** covering unit, component, and hook functionality
- **45 Playwright end-to-end tests** covering upload, filtering, search, split/combine, bulk actions, report generation, and publishing flows
- **Vitest** testing framework (v8 coverage provider) with React Testing Library
- **Playwright** e2e testing with istanbul/nyc coverage reporting

Current coverage (all four metrics enforced above 90% in CI):

| Metric     | Coverage | Enforced minimum |
|------------|---------:|------------------:|
| Statements |   ~95%   | 93% |
| Branches   |   ~91%   | 90% |
| Functions  |   ~94%   | 92% |
| Lines      |   ~97%   | 95% |

Vendored shadcn/ui primitives under `src/components/ui/` are excluded from coverage (generated boilerplate, not hand-written logic). A handful of files with heavier branch counts — notably `ReportPreview.tsx` and `pdfGenerator.ts` — sit below the global average due to PDF-rendering edge cases that are impractical to exercise in jsdom; they're covered end-to-end instead via the Playwright report-generation spec.

### Test Categories

1. **Unit Tests**: Utility functions (xmlParser, parseTestPath, formatting, splitJUnitXml, combineResults, exportBundle, testIdentity)
2. **Component Tests**: React components with mocked dependencies
3. **Integration Tests**: Component interactions and data flow
4. **End-to-End Tests**: Full Playwright coverage of every tab and modal

### Running Tests

```bash
# Run all tests without coverage
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui

# Run specific test file
npm test -- --run src/test/App.test.tsx

# Run playwright e2e tests
npm run test:e2e

# Run playwright e2e tests with coverage (as run in CI)
npm run test:ci
```

## CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/main.yml`) that:

- Runs on Node.js 22.x, 24.x, and 26.x
- Executes linting and TypeScript checks on every matrix version
- Runs the Vitest suite with coverage on every matrix version
- Installs Playwright and runs the e2e suite with coverage on Node 22.x
- Builds the application

## Project Structure

```
src/
├── components/
│   ├── Dashboard/          # File upload, metrics, results table, test details modal
│   ├── FailureAnalysis/    # Failure list, resolution progress tracking, bulk actions
│   ├── Layout/             # Navbar and app shell
│   ├── Publish/            # Publish results to Slack (TestBeats)
│   ├── ReportGenerator/    # PDF report configuration, preview, and generation
│   ├── Split/              # Split failures between teammates and combine results back
│   ├── shared/             # Cross-tab primitives (StatusBadge, Pagination, EmptyState,
│   │                       #   FileDropZone, ConfirmDialog, FloatingScrollbar)
│   ├── theme/              # Light/dark ThemeProvider and toggle
│   └── ui/                 # shadcn/ui primitives (generated, not hand-maintained)
├── hooks/                  # Shared React hooks
├── utils/                  # Parsing, formatting, split/combine, and export utilities
└── test/                   # Vitest test files and environment setup (setup.ts)

spec/
├── e2e/                    # Playwright end-to-end specs
└── testfiles/              # Sample JUnit XML fixtures used by tests
```

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling, with CSS-variable-based light/dark theming
- **shadcn/ui (Radix primitives)** - Accessible component foundation
- **Vitest** - Testing framework
- **React Testing Library** - Component testing
- **Playwright** - End-to-End testing
- **Recharts** - Data visualization
- **jsPDF / html2canvas** - PDF generation

## Contributing

1. Ensure all tests pass: `npm test` and `npm run test:e2e`
2. Keep coverage above the thresholds configured in `vitest.config.ts` (currently 90%+ branches, 92%+ functions, 93%+ statements, 95%+ lines)
3. Follow existing code style (no semicolons in Playwright specs; run `npm run lint` and `npx tsc` before committing)
4. Add tests for new features
5. Update documentation as needed

## License

This code was generated by [Magic Patterns](https://magicpatterns.com). This code has been heavily improved and altered by Brian Baggs with the help of Co-Pilot. 
