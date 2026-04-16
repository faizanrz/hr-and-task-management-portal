import { cn } from '@/lib/utils'

interface TableProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
  className?: string
}

export function Table({ children, className, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm text-left', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children, className, ...props }: TableProps) {
  return (
    <thead className={cn('bg-surface-mid text-xs text-gray-500 uppercase tracking-wider', className)} {...props}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className, ...props }: TableProps) {
  return <tbody className={cn('divide-y divide-surface-border', className)} {...props}>{children}</tbody>
}

export function TableRow({ children, className, ...props }: TableProps) {
  return <tr className={cn('hover:bg-surface-hover', className)} {...props}>{children}</tr>
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode
  className?: string
}

export function TableCell({ children, className, ...props }: TableCellProps) {
  return <td className={cn('px-4 py-3', className)} {...props}>{children}</td>
}

export function TableHeader({ children, className, ...props }: TableCellProps) {
  return <th className={cn('px-4 py-3 font-medium', className)} {...props}>{children}</th>
}
