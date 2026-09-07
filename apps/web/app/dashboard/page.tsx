import CitizenCommandCenter from '@/components/dashboard/CitizenCommandCenter'
import DashboardActionResolutionPlan from '@/components/dashboard/DashboardActionResolutionPlan'
import DashboardExperienceLayer from '@/components/dashboard/DashboardExperienceLayer'

export default function DashboardPage() {
  return (
    <div className="bg-[#F7F9FC]">
      <DashboardActionResolutionPlan />
      <DashboardExperienceLayer />
      <CitizenCommandCenter />
    </div>
  )
}
