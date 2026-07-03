import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type { AffiliateMilestone } from "@/types/affiliate";

interface AffiliateMilestonesTableProps {
  milestones: AffiliateMilestone[];
}

export function AffiliateMilestonesTable({
  milestones,
}: AffiliateMilestonesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hito</TableHead>
          <TableHead>Requisito</TableHead>
          <TableHead>Comisión</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {milestones.map((milestone) => (
          <TableRow key={milestone.id}>
            <TableCell className="font-medium text-slate-900">
              {milestone.name}
            </TableCell>
            <TableCell>{milestone.requirement}</TableCell>
            <TableCell>{milestone.commission}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
