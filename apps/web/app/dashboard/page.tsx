import CitizenCommandCenterRuntime from '@/components/dashboard/CitizenCommandCenterRuntime'
import DashboardActionResolutionPlan from '@/components/dashboard/DashboardActionResolutionPlan'
import DashboardExperienceLayer from '@/components/dashboard/DashboardExperienceLayer'
import DashboardIdentityHeader from '@/components/dashboard/DashboardIdentityHeader'

export default function DashboardPage() {
  return (
    <div className="bg-[#F7F9FC]">
      <DashboardIdentityHeader />
      <DashboardActionResolutionPlan />
      <DashboardExperienceLayer />
      <CitizenCommandCenterRuntime />
    </div>
  )
}
