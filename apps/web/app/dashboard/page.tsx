import CitizenCommandCenter from '@/components/dashboard/CitizenCommandCenter'
import DashboardActionResolutionPlan from '@/components/dashboard/DashboardActionResolutionPlan'

export default function DashboardPage() {
  return (
    <div className="bg-[#F7F9FC]">
      <DashboardActionResolutionPlan />
      <CitizenCommandCenter />
    </div>
  )
}
