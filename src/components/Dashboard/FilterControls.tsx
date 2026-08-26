import { SearchIcon, FilterIcon, ChevronDownIcon, ChevronUpIcon, XCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FilterControlsProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  suiteFilter: string;
  setSuiteFilter: (suite: string) => void;
  classNameFilter: string;
  setClassNameFilter: (className: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  suites: string[];
  classNames: string[];
  resetFilters: () => void;
  statusOptions?: Array<{ value: string; label: string }>;
}
export const FilterControls = ({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  suiteFilter,
  setSuiteFilter,
  classNameFilter,
  setClassNameFilter,
  showFilters,
  setShowFilters,
  suites,
  classNames,
  resetFilters,
  statusOptions
}: FilterControlsProps) => {
  const hasActiveFilters = statusFilter !== 'all' || suiteFilter !== 'all' || classNameFilter !== 'all' || searchTerm !== '';
  const selectClassName =
    'w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
  return <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <label htmlFor="search-tests" className="sr-only">Search tests</label>
            <Input
              id="search-tests"
              name="searchTests"
              type="text"
              placeholder="Search tests..."
              className="pl-9 w-full md:w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <FilterIcon className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </Button>
            {hasActiveFilters && <Button variant="outline" onClick={resetFilters} className="text-destructive hover:text-destructive">
                <XCircleIcon className="w-4 h-4" />
                Clear Filters
              </Button>}
          </div>
        </div>
      </div>
      {showFilters && <div className="mb-6 p-4 bg-muted/40 border rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="filter-status">Status</Label>
              <select id="filter-status" name="filterStatus" className={selectClassName} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {statusOptions ? (
                  statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="all">All Status</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="skipped">Skipped</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-suite">Test Suite</Label>
              <select id="filter-suite" name="filterSuite" className={selectClassName} value={suiteFilter} onChange={e => setSuiteFilter(e.target.value)}>
                {suites.map(suite => <option key={suite} value={suite}>
                    {suite === 'all' ? 'All Suites' : suite}
                  </option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-classname">Class Name</Label>
              <select id="filter-classname" name="filterClassName" className={selectClassName} value={classNameFilter} onChange={e => setClassNameFilter(e.target.value)}>
                {classNames.map(className => <option key={className} value={className}>
                    {className === 'all' ? 'All Classes' : className}
                  </option>)}
              </select>
            </div>
          </div>
        </div>}
    </>;
};