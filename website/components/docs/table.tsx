import { cn } from "@/lib/utils";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="my-6 w-full overflow-y-auto">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="m-0 border-t p-0 even:bg-muted">{children}</tr>;
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border px-4 py-2 text-left font-bold">{children}</th>
  );
}

export function Td({ children }: { children: React.ReactNode }) {
  return <td className="border px-4 py-2 text-left">{children}</td>;
}
