alter table public.module_permissions drop constraint module_permissions_module_check;
alter table public.module_permissions add constraint module_permissions_module_check 
  check (module in ('vps','nodes','ip','orders','messages'));
