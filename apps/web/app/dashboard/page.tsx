import DashboardCommandCenterV2 from '@/components/dashboard/DashboardCommandCenterV2'
import { DashboardGlobalSearch } from '@/components/dashboard/DashboardGlobalSearch'
import { DashboardOperationalAttention } from '@/components/dashboard/DashboardOperationalAttention'
import { EcosystemBridge } from '@/components/dashboard/EcosystemBridge'
import { RoleAdaptiveLauncher } from '@/components/dashboard/RoleAdaptiveLauncher'

export default function DashboardPage() {
  return (
    <>
      <EcosystemBridge />
      <DashboardGlobalSearch />
      <DashboardOperationalAttention />
      <RoleAdaptiveLauncher />
      <DashboardCommandCenterV2 />
    </>
  )
}
