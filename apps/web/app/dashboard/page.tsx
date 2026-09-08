import DashboardCommandCenterV2 from '@/components/dashboard/DashboardCommandCenterV2'
import { DashboardOperationalAttention } from '@/components/dashboard/DashboardOperationalAttention'

export default function DashboardPage() {
  return (
    <>
      <DashboardOperationalAttention />
      <DashboardCommandCenterV2 />
    </>
  )
}
