export type Lang = 'en' | 'zh'

type Dict = Record<string, string>

const en: Dict = {
  'nav.home': 'Homepage',
  'nav.storage': 'Example Storage',
  'nav.table': 'Example Table',
  'nav.userSettings': 'User Settings',
  'nav.admin': 'Permission Management',
  'nav.ip': 'IP Management',
  'nav.signedInAs': 'Signed in as',
  'nav.changePassword': 'Change Password',
  'nav.signOut': 'Sign Out',
  'nav.language': 'Language',
  'lang.en': 'English',
  'lang.zh': 'Chinese',

  'dashboard.welcome': 'Welcome, {name}! 👋',
  'dashboard.memberDays': 'Member for {days} days',
  'dashboard.quickActions.title': 'Quick Actions',
  'dashboard.quickActions.desc': 'Frequently used features',
  'dashboard.quickActions.userSettings.title': 'User Settings',
  'dashboard.quickActions.userSettings.desc': 'Manage your account preferences',
  'dashboard.quickActions.examplePage.title': 'Example Page',
  'dashboard.quickActions.examplePage.desc': 'Check out example features',

  'ip.title': 'IP Management',
  'ip.desc': 'Manage IP assets and allocations',
  'ip.addAsset': 'Add IP Asset',
  'ip.provider': 'Provider',
  'ip.ip': 'IP Address',
  'ip.country': 'Country',
  'ip.status': 'Status',
  'ip.create': 'Create',
  'ip.allocate': 'Allocate',
  'ip.release': 'Release',
  'ip.assignedTo': 'Assigned To',
  'ip.notes': 'Notes',

  'user.title': 'User Settings',
  'user.desc': 'Manage your account settings and preferences',
  'user.details': 'User Details',
  'user.details.desc': 'Your account information',
  'user.id': 'User ID',
  'user.email': 'Email',
  'user.password.title': 'Change Password',
  'user.password.desc': 'Update your account password',
  'user.password.new': 'New Password',
  'user.password.confirm': 'Confirm New Password',
  'user.password.update': 'Update Password',
  'user.password.updating': 'Updating...',
  'user.password.mismatch': "New passwords don't match",
  'user.password.updated': 'Password updated successfully',
}

const zh: Dict = {
  'nav.home': '首页',
  'nav.storage': '示例存储',
  'nav.table': '示例表格',
  'nav.userSettings': '用户设置',
  'nav.admin': '权限管理',
  'nav.ip': 'IP 管理',
  'nav.signedInAs': '当前登录',
  'nav.changePassword': '修改密码',
  'nav.signOut': '退出登录',
  'nav.language': '语言',
  'lang.en': '英文',
  'lang.zh': '中文',

  'dashboard.welcome': '欢迎，{name}！👋',
  'dashboard.memberDays': '已成为会员 {days} 天',
  'dashboard.quickActions.title': '快捷操作',
  'dashboard.quickActions.desc': '常用功能入口',
  'dashboard.quickActions.userSettings.title': '用户设置',
  'dashboard.quickActions.userSettings.desc': '管理你的账号偏好',
  'dashboard.quickActions.examplePage.title': '示例页面',
  'dashboard.quickActions.examplePage.desc': '查看示例功能',

  'ip.title': 'IP 管理',
  'ip.desc': '管理 IP 资产与分配记录',
  'ip.addAsset': '新增 IP 资产',
  'ip.provider': '供应商',
  'ip.ip': 'IP 地址',
  'ip.country': '国家',
  'ip.status': '状态',
  'ip.create': '创建',
  'ip.allocate': '分配',
  'ip.release': '释放',
  'ip.assignedTo': '分配目标',
  'ip.notes': '备注',

  'user.title': '用户设置',
  'user.desc': '管理你的账号设置与偏好',
  'user.details': '用户信息',
  'user.details.desc': '你的账号资料',
  'user.id': '用户ID',
  'user.email': '邮箱',
  'user.password.title': '修改密码',
  'user.password.desc': '更新你的账号密码',
  'user.password.new': '新密码',
  'user.password.confirm': '确认新密码',
  'user.password.update': '更新密码',
  'user.password.updating': '更新中...',
  'user.password.mismatch': '两次输入的密码不一致',
  'user.password.updated': '密码已更新',
}

const dicts: Record<Lang, Dict> = { en, zh }

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const table = dicts[lang] || en
  let text = table[key] || key
  if (params) {
    Object.keys(params).forEach((k) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]))
    })
  }
  return text
}