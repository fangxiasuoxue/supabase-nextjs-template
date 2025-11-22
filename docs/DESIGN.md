# Design Document: User, Role, and Authorization Module

## 1. Architecture
The module will be built using Next.js App Router and Supabase.
- **Frontend**: React components using Tailwind CSS and Lucide icons.
- **Backend**: Next.js Server Actions interacting with Supabase via `createServerAdminClient` (for admin operations) and `createSPASassClient` (for regular operations).
- **Database**: Existing Supabase tables (`user_roles`, `module_permissions`) and `auth.users`.

## 2. Data Flow
1.  **Listing Users**:
    -   Client calls Server Action `getUsersAction`.
    -   `getUsersAction` uses `createServerAdminClient` to fetch users from `auth.users`.
    -   It also fetches data from `user_roles` and `module_permissions`.
    -   It combines the data and returns a list of `UserWithDetails` objects.
2.  **Updating Role**:
    -   Client calls Server Action `updateUserRoleAction`.
    -   `updateUserRoleAction` verifies the requester is an admin.
    -   It updates `public.user_roles`.
3.  **Updating Permissions**:
    -   Client calls Server Action `updateModulePermissionAction`.
    -   `updateModulePermissionAction` verifies the requester is an admin.
    -   It updates `public.module_permissions`.

## 3. API Design (Server Actions)

### `src/app/actions/admin.ts`

```typescript
type UserWithDetails = {
  id: string;
  email: string;
  created_at: string;
  role: 'admin' | 'operator' | 'user';
  permissions: {
    [module: string]: {
      can_read: boolean;
      can_write: boolean;
      can_manage: boolean;
    }
  }
}

// Fetch users with pagination and search
export async function getUsersAction(page: number, limit: number, search?: string): Promise<{ data: UserWithDetails[], count: number, error: string | null }>;

// Update user role
export async function updateUserRoleAction(userId: string, role: string): Promise<{ error: string | null }>;

// Update module permission
export async function updateModulePermissionAction(userId: string, module: string, permission: 'read' | 'write' | 'manage', value: boolean): Promise<{ error: string | null }>;
```

## 4. UI Design

### Page: `/app/admin/users/page.tsx`
-   **Layout**: Uses `AppLayout`.
-   **Header**: "User Management" title.
-   **Search Bar**: Input to filter users by email.
-   **Table**:
    -   Columns: Email, Role, Permissions, Created At, Actions.
    -   **Role Column**: Dropdown to select role.
    -   **Permissions Column**: Button to open "Manage Permissions" modal.
    -   **Actions Column**: Delete user (optional, maybe later).

### Component: `PermissionModal`
-   **Trigger**: Button in the user table.
-   **Content**:
    -   List of modules (`vps`, `nodes`, `ip`, `orders`).
    -   For each module, 3 checkboxes: Read, Write, Manage.
    -   Save button to commit changes.

## 5. Security
-   All Server Actions must check if the current user has `admin` role using `is_admin()` or equivalent check in `user_roles`.
-   The `auth.users` list is sensitive and should only be exposed to admins.
