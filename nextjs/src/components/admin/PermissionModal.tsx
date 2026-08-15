'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { updateModulePermissionAction, UserWithDetails } from '@/app/actions/admin'
import { Loader2, Shield, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PermissionModalProps {
    user: UserWithDetails
    onUpdate: () => void
}

const MODULES = ['vps', 'nodes', 'ip', 'orders', 'messages']
const PERMISSIONS = [
    { key: 'menu', label: 'Menu', description: 'Can see menu item and access routes' },
    { key: 'read', label: 'Read', description: 'Can view all data in this module' },
    { key: 'write', label: 'Write', description: 'Can create and modify own data' },
    { key: 'manage', label: 'Manage', description: 'Can modify/delete any data and perform admin actions' },
] as const

export function PermissionModal({ user, onUpdate }: PermissionModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)

    const handleToggle = async (module: string, permission: 'menu' | 'read' | 'write' | 'manage', currentValue: boolean) => {
        const key = `${module}-${permission}`
        setLoading(key)
        try {
            const { error } = await updateModulePermissionAction(user.id, module, permission, !currentValue)
            if (error) {
                toast.error(error)
            } else {
                toast.success(`${permission.charAt(0).toUpperCase() + permission.slice(1)} permission ${!currentValue ? 'granted' : 'revoked'}`)
                onUpdate()
            }
        } catch {
            toast.error('Failed to update permission')
        } finally {
            setLoading(null)
        }
    }

    return (
        <TooltipProvider>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Shield className="w-4 h-4 mr-2" />
                        Permissions
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Manage Permissions for {user.email}</DialogTitle>
                        <DialogDescription>
                            Control what this user can access and do. Permissions are cumulative - users can have multiple permissions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-5 font-medium text-sm text-muted-foreground border-b pb-2">
                            <div>Module</div>
                            {PERMISSIONS.map((perm) => (
                                <div key={perm.key} className="text-center flex items-center justify-center gap-1">
                                    {perm.label}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-xs">{perm.description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                        {MODULES.map((module) => (
                            <div key={module} className="grid grid-cols-5 items-center gap-4">
                                <div className="font-medium capitalize">{module}</div>
                                {PERMISSIONS.map((perm) => {
                                    const isEnabled = user.permissions[module]?.[`can_${perm.key}`] || false
                                    const isLoading = loading === `${module}-${perm.key}`
                                    return (
                                        <div key={perm.key} className="flex justify-center">
                                            <div className="flex items-center space-x-2">
                                                {isLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={() => handleToggle(module, perm.key as 'menu' | 'read' | 'write' | 'manage', isEnabled)}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                        <strong>Note:</strong> Menu permission allows users to see the menu item. Data permissions (read/write/manage) control what they can do with the data.
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}
