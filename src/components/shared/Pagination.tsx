import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const count = Math.min(5, totalPages);
  let start: number;
  if (totalPages <= 5) {
    start = 1;
  } else if (currentPage <= 3) {
    start = 1;
  } else if (currentPage >= totalPages - 2) {
    start = totalPages - 4;
  } else {
    start = currentPage - 2;
  }
  return Array.from({ length: count }, (_, i) => start + i);
}

export function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-card px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        {/* Numbers stay as plain sibling text (not wrapped in their own elements) so this
            reads as one continuous "Showing X to Y of Z results" string; the page-count
            aside is deliberately a separate nested element, invisible to that string. */}
        Showing {startIndex + 1} to {endIndex} of {totalItems} results
        <span className="ml-2 text-xs">
          (Page {currentPage} of {totalPages})
        </span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="size-4" />
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {getVisiblePages(currentPage, totalPages).map((pageNum) => (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'default' : 'outline'}
              size="sm"
              className="w-9"
              onClick={() => onPageChange(pageNum)}
              aria-current={currentPage === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
