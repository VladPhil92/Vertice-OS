export const semanticRoles = {
  institutional: 'navy',
  citizenAction: 'citizen',
  danger: 'red',
  focus: 'azure',
  success: 'emerald',
  information: 'cyan',
} as const

export const componentVariants = {
  button: ['primary', 'secondary', 'citizen', 'danger', 'ghost'],
  alert: ['info', 'success', 'warning', 'error'],
  badge: ['neutral', 'citizen', 'success', 'warning', 'danger'],
} as const
