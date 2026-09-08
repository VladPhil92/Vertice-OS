import DashboardCommandCenterV2 from '@/components/dashboard/DashboardCommandCenterV2'
import { CrowdfundingDashboardShortcut } from '@/components/dashboard/CrowdfundingDashboardShortcut'

export default function DashboardPage() {
  return (
    <>
      <DashboardCommandCenterV2 />
      <CrowdfundingDashboardShortcut />
    </>
  )
}
