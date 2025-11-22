你生成的脚本存在严重问题，我已经更换过一次项目了，第二个项目一样出现如下错误
npx supabase migrations up --linked
Using workdir /Users/boyang/Downloads/5Code/jiedian/supabase-nextjs-template
Initialising login role...
Connecting to remote database...
Applying migration 20250107210416_MFA.sql...
Applying migration 20250121000001_add_menu_permission.sql...
ERROR: relation "public.module_permissions" does not exist (SQLSTATE 42P01)
At statement: 0
-- Migration: Add menu permission to module_permissions table
-- This allows controlling whether users can see menu items and access routes

-- Add can_menu column
ALTER TABLE public.module_permissions
ADD COLUMN IF NOT EXISTS can_menu BOOLEAN DEFAULT false
Try rerunning the command with --debug to troubleshoot the error.
 ✘ ⚙ boyang@bodeMacBook-Pro  ~/Downloads/5Code/jiedian/supabase-nextjs-template/nextjs   main ±  npx supabase migrations up --linked
Using workdir /Users/boyang/Downloads/5Code/jiedian/supabase-nextjs-template
Initialising login role...
failed to connect as temp role: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=cli_login_postgres.vvgdwqvuxzcwkhoeavle database=postgres`: failed SASL auth (unexpected EOF)
Retry (3/8):
failed to connect as temp role: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=cli_login_postgres.vvgdwqvuxzcwkhoeavle database=postgres`: failed SASL auth (unexpected EOF)
Retry (4/8): failed to connect as temp role: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=cli_login_postgres.vvgdwqvuxzcwkhoeavle database=postgres`: failed SASL auth (unexpected EOF)
Retry (5/8):
failed to connect as temp role: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=cli_login_postgres.vvgdwqvuxzcwkhoeavle database=postgres`: failed SASL auth (FATAL: password authentication failed for user "cli_login_postgres" (SQLSTATE 28P01))
Retry (6/8): failed to connect as temp role: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=cli_login_postgres.vvgdwqvuxzcwkhoeavle database=postgres`: failed SASL auth (FATAL: password authentication failed for user "cli_login_postgres" (SQLSTATE 28P01))
Retry (7/8): failed to connect as temp role: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=cli_login_postgres.vvgdwqvuxzcwkhoeavle database=postgres`: failed SASL auth (FATAL: password authentication failed for user "cli_login_postgres" (SQLSTATE 28P01))
Retry (8/8):
Forgot your password? Reset it from the Dashboard: https://supabase.com/dashboard/project/vvgdwqvuxzcwkhoeavle/settings/database
Enter your database password:
Connecting to remote database...
failed to connect to postgres: failed to connect to `host=aws-1-ap-south-1.pooler.supabase.com user=postgres.vvgdwqvuxzcwkhoeavle database=postgres`: failed SASL auth (FATAL: password authentication failed for user "postgres" (SQLSTATE 28P01))
Try rerunning the command with --debug to troubleshoot the error.