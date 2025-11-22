'use client'

import { UserTable } from '@/components/admin/UserTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminUsersPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
                    <p className="text-muted-foreground">
                        Manage users, roles, and permissions.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Users</CardTitle>
                    <CardDescription>
                        A list of all users in the system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <UserTable />
                </CardContent>
            </Card>
        </div>
    )
}
