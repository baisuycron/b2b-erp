ALTER TABLE admin_roles
  ADD COLUMN permission_json TEXT NULL AFTER role_status;
