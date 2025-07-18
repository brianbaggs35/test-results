# Test Results Platform

A React-based web application for analyzing JUnit XML test results with comprehensive testing and CI/CD pipeline.

## Features

- **Dashboard**: Upload and view test result summaries with interactive charts
- **Failure Analysis**: Detailed analysis of failed tests with filtering capabilities  
- **Progress Tracking**: Track resolution progress for failed tests and view full stack trace
- **Report Generation**: Generate PDF reports from test data
- **Comprehensive Testing**: Vitest for unit and component tests and playwright for e2e

## Getting Started

### Prerequisites
- Node.js 18.x or 20.x also supports 22.x and 24.x
- npm 11.4.2

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
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ui` - Run tests with UI interface
- `npm run test:e2e` - Run e2e tests with playwright
- `npm run test:e2e:ui` - Open playwright UI
- `npm run ci` - Run playwright e2e tests with coverage report

## Testing

This project has comprehensive test coverage with:

- **173 tests** covering unit and component functionality
- **70.47% coverage** on utility functions
- **100% coverage** on core components (App, Dashboard, FileUploader, Navbar, FailureAnalysisPage)
- **Vitest** testing framework with React Testing Library
- **Playwright** e2e testing with istanbul coverage
- **Coverage reporting** with v8 provider

### Test Categories

1. **Unit Tests**: Utility functions (xmlParser, parseTestPath, formatting)
2. **Component Tests**: React components with mocked dependencies  
3. **Integration Tests**: Component interactions and data flow
4. **End-to-End Tests**: Playwright testing still a work in progress

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

#Run playwright e2e tests
npm run test:e2e

#Run playwright e2e tests with coverage
npm run ci
```

## CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/main.yml`) that:

- Runs on Node.js 20.x, 22.x and 24.x
- Executes linting, typescript checks, and testing
- Generates coverage reports
- Builds the application

## Project Structure

```
src/
├── components/
│   ├── Dashboard/         # Main dashboard components
│   ├── FailureAnalysis/   # Test failure analysis
│   ├── Layout/           # Navigation and layout
│   └── ReportGenerator/  # PDF report generation
├── utils/                # Utility functions
│   ├── xmlParser.js      # JUnit XML parsing
│   ├── parseTestPath.ts  # Test path utilities
│   └── formatting.ts     # Format helpers
└── test/                 # Test files
    ├── setup.ts          # Test environment setup
    └── *.test.tsx        # Component and unit tests
```

## Coverage Goals

The project maintains high code coverage standards:

- **Lines**: 66.63% (Target: 80%+)
- **Branches**: 79.56% (Target: 80%+) 
- **Functions**: 70.47% (Target: 80%+)

Core business logic and components achieve 90%+ coverage. Some UI-heavy components like ReportGenerator have lower coverage due to complex PDF generation dependencies.

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Vitest** - Testing framework
- **React Testing Library** - Component testing
- **Playwright** - End-to-End testing
- **Recharts** - Data visualization
- **jsPDF** - PDF generation

## Contributing

1. Ensure all tests pass: `npm test`
2. Maintain code coverage above 80% for all new code
3. Follow existing code style
4. Add tests for new features
5. Update documentation as needed

## License

This code was generated by [Magic Patterns](https://magicpatterns.com). This code has been heavily improved and altered by Brian Baggs with the help of Co-Pilot. 
