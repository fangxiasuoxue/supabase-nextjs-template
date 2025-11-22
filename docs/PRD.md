# Product Requirements Document: User, Role, and Authorization Module

## 1. Introduction
This document outlines the requirements for adding a User, Role, and Authorization management module to the Supabase Next.js Template. The goal is to provide a UI for administrators to manage users, assign roles, and configure permissions.

## 2. Goals
- Enable administrators to view a list of all users.
- Enable administrators to assign roles (Admin, Operator, User) to users.
- Enable administrators to configure module-level permissions (Read, Write, Manage) for users.
- Ensure all operations are secured and restricted to authorized users (Admins).

## 3. User Stories
- **As an Admin**, I want to see a list of all users so that I can manage them.
- **As an Admin**, I want to assign a role to a user so that they have the appropriate access level.
- **As an Admin**, I want to grant specific module permissions to a user so that they can access specific features.
- **As an Admin**, I want to revoke permissions or change roles when a user's responsibilities change.

## 4. Functional Requirements

### 4.1 User Management
- **List Users**: Display a paginated list of users with their email, current role, and created date.
- **Search Users**: Allow searching users by email.

### 4.2 Role Management
- **Assign Role**: Allow changing a user's role.
- **Supported Roles**: Admin, Operator, User (as defined in `user_roles` table).

### 4.3 Permission Management
- **Manage Permissions**: Allow toggling permissions for specific modules.
- **Modules**: `vps`, `nodes`, `ip`, `orders` (as defined in `module_permissions` table).
- **Permission Levels**: Read, Write, Manage.

## 5. Non-Functional Requirements
- **Security**: Only users with the 'admin' role can access these management features.
- **Performance**: User list should load quickly.
- **Usability**: The UI should be intuitive and provide feedback on success/failure of operations.

## 6. Data Model (Existing)
- `public.user_roles`: Stores user roles.
- `public.module_permissions`: Stores module-level permissions.
- `auth.users`: Supabase Auth users table (read-only from application perspective, managed via Supabase Auth API).

## 7. UI/UX
- A new "Users" or "Team" section in the settings or admin dashboard.
- A table view for users.
- A modal or side panel for editing a user's role and permissions.
