-- PR #44 phase 2: remove only provably redundant SELECT evaluation
-- Split FOR ALL policies only when their SELECT predicate is exactly identical
-- to an existing SELECT policy for the same table and roles.
DO $pr44_split$
DECLARE
  p record;
  role_list text;
  insert_name text;
  update_name text;
  delete_name text;
  check_expr text;
BEGIN
  FOR p IN
    SELECT DISTINCT
      a.schemaname, a.tablename, a.policyname, a.roles, a.qual, a.with_check
    FROM pg_policies a
    JOIN pg_policies s
      ON s.schemaname = a.schemaname
     AND s.tablename = a.tablename
     AND s.cmd = 'SELECT'
     AND s.roles = a.roles
     AND s.permissive = 'PERMISSIVE'
    WHERE a.schemaname='public'
      AND a.cmd='ALL'
      AND a.permissive='PERMISSIVE'
      AND a.qual = s.qual
  LOOP
    SELECT string_agg(quote_ident(r::text), ', ')
      INTO role_list
    FROM unnest(p.roles) AS r;

    check_expr := coalesce(p.with_check, p.qual);
    insert_name := left(p.policyname, 52) || '_ins44';
    update_name := left(p.policyname, 52) || '_upd44';
    delete_name := left(p.policyname, 52) || '_del44';

    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR INSERT TO %s WITH CHECK (%s)',
      insert_name, p.schemaname, p.tablename, role_list, check_expr
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
      update_name, p.schemaname, p.tablename, role_list, p.qual, check_expr
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR DELETE TO %s USING (%s)',
      delete_name, p.schemaname, p.tablename, role_list, p.qual
    );
  END LOOP;
END
$pr44_split$;
