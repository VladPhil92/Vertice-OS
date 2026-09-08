import DashboardCommandCenterV2 from '@/components/dashboard/DashboardCommandCenterV2'
import { DashboardGlobalSearch } from '@/components/dashboard/DashboardGlobalSearch'
import { DashboardOperationalAttention } from '@/components/dashboard/DashboardOperationalAttention'
import { OperationalCapacityShortcut } from '@/components/dashboard/OperationalCapacityShortcut'
import { RoleAdaptiveLauncher } from '@/components/dashboard/RoleAdaptiveLauncher'

export default function DashboardPage() {
  return (
    <>
      <DashboardGlobalSearch />
      <DashboardOperationalAttention />
      <RoleAdaptiveLauncher />
      <OperationalCapacityShortcut />
      <DashboardCommandCenterV2 />
    </>
  )
}
