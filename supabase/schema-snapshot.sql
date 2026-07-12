


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."apply_article_interaction_count_delta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  target_article_id uuid := coalesce(new.article_id, old.article_id);
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'article_likes' then
    update public.articles
    set likes_count = greatest(0, likes_count + delta)
    where id = target_article_id;
  elsif tg_table_name = 'comments' then
    update public.articles
    set comments_count = greatest(0, comments_count + delta)
    where id = target_article_id;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."apply_article_interaction_count_delta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  candidate_username text := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username'
  )), '');
begin
  begin
    insert into public.profiles (id, username, full_name, avatar_url)
    values (
      new.id,
      candidate_username,
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
      )), '')
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    -- A provider username is not an identity key. Preserve account creation
    -- when another user already owns the same case-insensitive username.
    insert into public.profiles (id, full_name, avatar_url)
    values (
      new.id,
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
      )), '')
    )
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role in ('member', 'admin')
  );
$$;


ALTER FUNCTION "public"."is_member"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_article_interaction_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if auth.uid() is not null
     and pg_trigger_depth() = 1
     and (
       new.likes_count is distinct from old.likes_count
       or new.comments_count is distinct from old.comments_count
     ) then
    raise exception 'Article interaction counts are maintained by database triggers'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."protect_article_interaction_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only administrators can change profile roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_profile_role"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profile_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "username" "text",
    "avatar_url" "text",
    "bio" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_changes_avatar_url_length_check" CHECK ((("avatar_url" IS NULL) OR ("length"("avatar_url") <= 2048))),
    CONSTRAINT "profile_changes_bio_length_check" CHECK ((("bio" IS NULL) OR ("length"("bio") <= 160))),
    CONSTRAINT "profile_changes_has_change_check" CHECK ((("username" IS NOT NULL) OR ("avatar_url" IS NOT NULL) OR ("bio" IS NOT NULL))),
    CONSTRAINT "profile_changes_review_state_check" CHECK (((("status" = 'pending'::"text") AND ("reviewed_by" IS NULL) AND ("reviewed_at" IS NULL)) OR (("status" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])) AND ("reviewed_by" IS NOT NULL) AND ("reviewed_at" IS NOT NULL)))),
    CONSTRAINT "profile_changes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "profile_changes_username_check" CHECK ((("username" IS NULL) OR (("length"(TRIM(BOTH FROM "username")) >= 1) AND ("length"(TRIM(BOTH FROM "username")) <= 40))))
);


ALTER TABLE "public"."profile_changes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_profile_change"("p_change_id" "uuid", "p_decision" "text", "p_review_note" "text" DEFAULT NULL::"text") RETURNS "public"."profile_changes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  pending_change public.profile_changes;
  reviewed_change public.profile_changes;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can review profile changes'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Profile change decision must be approved or rejected'
      using errcode = '22023';
  end if;

  select * into pending_change
  from public.profile_changes
  where id = p_change_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending profile change not found'
      using errcode = 'P0002';
  end if;

  if p_decision = 'approved' then
    update public.profiles
    set
      username = case
        when pending_change.username is not null then trim(pending_change.username)
        else username
      end,
      avatar_url = case
        when pending_change.avatar_url is not null then pending_change.avatar_url
        else avatar_url
      end,
      bio = case
        when pending_change.bio is not null then pending_change.bio
        else bio
      end
    where id = pending_change.user_id;

    if not found then
      raise exception 'Profile for requested change not found'
        using errcode = 'P0002';
    end if;
  end if;

  update public.profile_changes
  set
    status = p_decision,
    review_note = nullif(trim(p_review_note), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_change_id
  returning * into reviewed_change;

  return reviewed_change;
end;
$$;


ALTER FUNCTION "public"."review_profile_change"("p_change_id" "uuid", "p_decision" "text", "p_review_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_favorites" (
    "article_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."article_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_likes" (
    "article_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."article_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "content" "text" NOT NULL,
    "cover_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "reject_reason" "text",
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comments_count" integer DEFAULT 0 NOT NULL,
    "views_count" integer DEFAULT 0 NOT NULL,
    "kb_enabled" boolean DEFAULT false NOT NULL,
    "kb_branch_id" "uuid",
    "kb_sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "articles_content_not_blank" CHECK (("length"(TRIM(BOTH FROM "content")) > 0)),
    CONSTRAINT "articles_counts_nonnegative_check" CHECK ((("likes_count" >= 0) AND ("comments_count" >= 0) AND ("views_count" >= 0))),
    CONSTRAINT "articles_internal_not_in_kb_check" CHECK ((NOT (("visibility" = 'internal'::"text") AND "kb_enabled"))),
    CONSTRAINT "articles_kb_selection_check" CHECK (((NOT "kb_enabled") OR ("kb_branch_id" IS NOT NULL))),
    CONSTRAINT "articles_kb_sort_order_nonnegative_check" CHECK (("kb_sort_order" >= 0)),
    CONSTRAINT "articles_published_at_check" CHECK ((("status" <> 'published'::"text") OR ("published_at" IS NOT NULL))),
    CONSTRAINT "articles_rejection_reason_check" CHECK ((("status" <> 'rejected'::"text") OR ("length"(TRIM(BOTH FROM COALESCE("reject_reason", ''::"text"))) > 0))),
    CONSTRAINT "articles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'published'::"text", 'rejected'::"text"]))),
    CONSTRAINT "articles_title_not_blank" CHECK (("length"(TRIM(BOTH FROM "title")) > 0)),
    CONSTRAINT "articles_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'internal'::"text"])))
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comments_content_length_check" CHECK (("length"("content") <= 4000)),
    CONSTRAINT "comments_content_not_blank" CHECK (("length"(TRIM(BOTH FROM "content")) > 0))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "version" "text",
    "file_url" "text",
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "internal_resources_file_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "file_name")) > 0)),
    CONSTRAINT "internal_resources_file_path_not_blank" CHECK (("length"(TRIM(BOTH FROM "file_path")) > 0)),
    CONSTRAINT "internal_resources_file_size_check" CHECK ((("file_size" > 0) AND ("file_size" <= 524288000))),
    CONSTRAINT "internal_resources_status_check" CHECK (("status" = ANY (ARRAY['published'::"text", 'archived'::"text"]))),
    CONSTRAINT "internal_resources_title_not_blank" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."internal_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_branch_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "requested_path" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_note" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "knowledge_branch_requests_path_not_blank" CHECK (("length"(TRIM(BOTH FROM "requested_path")) > 0)),
    CONSTRAINT "knowledge_branch_requests_review_state_check" CHECK (((("status" = 'pending'::"text") AND ("reviewed_by" IS NULL) AND ("reviewed_at" IS NULL)) OR (("status" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])) AND ("reviewed_by" IS NOT NULL) AND ("reviewed_at" IS NOT NULL)))),
    CONSTRAINT "knowledge_branch_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."knowledge_branch_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "knowledge_branches_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "knowledge_branches_no_self_parent" CHECK ((("parent_id" IS NULL) OR ("parent_id" <> "id"))),
    CONSTRAINT "knowledge_branches_slug_format_check" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "knowledge_branches_slug_not_blank" CHECK (("length"(TRIM(BOTH FROM "slug")) > 0)),
    CONSTRAINT "knowledge_branches_sort_order_nonnegative_check" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."knowledge_branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'member'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."article_favorites"
    ADD CONSTRAINT "article_favorites_pkey" PRIMARY KEY ("article_id", "user_id");



ALTER TABLE ONLY "public"."article_likes"
    ADD CONSTRAINT "article_likes_pkey" PRIMARY KEY ("article_id", "user_id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_resources"
    ADD CONSTRAINT "internal_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_branch_requests"
    ADD CONSTRAINT "knowledge_branch_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_branches"
    ADD CONSTRAINT "knowledge_branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_changes"
    ADD CONSTRAINT "profile_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "article_favorites_user_created_idx" ON "public"."article_favorites" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "article_likes_article_user_uidx" ON "public"."article_likes" USING "btree" ("article_id", "user_id");



CREATE INDEX "article_likes_user_created_idx" ON "public"."article_likes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "articles_author_status_created_idx" ON "public"."articles" USING "btree" ("author_id", "status", "created_at" DESC);



CREATE INDEX "articles_kb_branch_status_sort_idx" ON "public"."articles" USING "btree" ("kb_branch_id", "status", "kb_enabled", "kb_sort_order", "created_at" DESC);



CREATE INDEX "articles_status_visibility_created_idx" ON "public"."articles" USING "btree" ("status", "visibility", "created_at" DESC);



CREATE INDEX "comments_article_created_idx" ON "public"."comments" USING "btree" ("article_id", "created_at", "id");



CREATE INDEX "comments_user_created_idx" ON "public"."comments" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "internal_resources_created_by_created_idx" ON "public"."internal_resources" USING "btree" ("created_by", "created_at" DESC);



CREATE INDEX "internal_resources_status_created_idx" ON "public"."internal_resources" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "knowledge_branch_requests_article_idx" ON "public"."knowledge_branch_requests" USING "btree" ("article_id");



CREATE UNIQUE INDEX "knowledge_branch_requests_pending_article_uidx" ON "public"."knowledge_branch_requests" USING "btree" ("article_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "knowledge_branch_requests_requester_created_idx" ON "public"."knowledge_branch_requests" USING "btree" ("requester_id", "created_at" DESC);



CREATE INDEX "knowledge_branch_requests_status_created_idx" ON "public"."knowledge_branch_requests" USING "btree" ("status", "created_at" DESC);



CREATE UNIQUE INDEX "knowledge_branches_parent_slug_uidx" ON "public"."knowledge_branches" USING "btree" (COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "slug");



CREATE INDEX "knowledge_branches_parent_sort_idx" ON "public"."knowledge_branches" USING "btree" ("parent_id", "sort_order", "name");



CREATE INDEX "profile_changes_status_created_idx" ON "public"."profile_changes" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "profile_changes_user_status_created_idx" ON "public"."profile_changes" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE INDEX "profiles_role_idx" ON "public"."profiles" USING "btree" ("role");



CREATE UNIQUE INDEX "profiles_username_lower_uidx" ON "public"."profiles" USING "btree" ("lower"("username")) WHERE ("username" IS NOT NULL);



CREATE OR REPLACE TRIGGER "protect_article_interaction_count_update" BEFORE UPDATE OF "likes_count", "comments_count" ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_article_interaction_counts"();



CREATE OR REPLACE TRIGGER "protect_profile_role_update" BEFORE UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_role"();



CREATE OR REPLACE TRIGGER "set_articles_updated_at" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_internal_resources_updated_at" BEFORE UPDATE ON "public"."internal_resources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_knowledge_branch_requests_updated_at" BEFORE UPDATE ON "public"."knowledge_branch_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_knowledge_branches_updated_at" BEFORE UPDATE ON "public"."knowledge_branches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profile_changes_updated_at" BEFORE UPDATE ON "public"."profile_changes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_article_comment_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."apply_article_interaction_count_delta"();



CREATE OR REPLACE TRIGGER "update_article_like_count" AFTER INSERT OR DELETE ON "public"."article_likes" FOR EACH ROW EXECUTE FUNCTION "public"."apply_article_interaction_count_delta"();



ALTER TABLE ONLY "public"."article_favorites"
    ADD CONSTRAINT "article_favorites_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_favorites"
    ADD CONSTRAINT "article_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_likes"
    ADD CONSTRAINT "article_likes_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_likes"
    ADD CONSTRAINT "article_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_kb_branch_id_fkey" FOREIGN KEY ("kb_branch_id") REFERENCES "public"."knowledge_branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_resources"
    ADD CONSTRAINT "internal_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."knowledge_branch_requests"
    ADD CONSTRAINT "knowledge_branch_requests_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_branch_requests"
    ADD CONSTRAINT "knowledge_branch_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_branch_requests"
    ADD CONSTRAINT "knowledge_branch_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_branches"
    ADD CONSTRAINT "knowledge_branches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_branches"
    ADD CONSTRAINT "knowledge_branches_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_changes"
    ADD CONSTRAINT "profile_changes_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_changes"
    ADD CONSTRAINT "profile_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create knowledge branches" ON "public"."knowledge_branches" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Admins can delete all articles" ON "public"."articles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can delete article comments" ON "public"."comments" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can delete branch requests" ON "public"."knowledge_branch_requests" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can delete knowledge branches" ON "public"."knowledge_branches" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can delete resources" ON "public"."internal_resources" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can insert profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert resources" ON "public"."internal_resources" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Admins can update all articles" ON "public"."articles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update branch requests" ON "public"."knowledge_branch_requests" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update knowledge branches" ON "public"."knowledge_branches" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update resources" ON "public"."internal_resources" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can view all articles" ON "public"."articles" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all branch requests" ON "public"."knowledge_branch_requests" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all resources" ON "public"."internal_resources" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view profile changes" ON "public"."profile_changes" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Anyone can view knowledge branches" ON "public"."knowledge_branches" FOR SELECT USING (true);



CREATE POLICY "Anyone can view profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create own articles" ON "public"."articles" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("author_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'pending'::"text"]))));



CREATE POLICY "Authors can delete own articles" ON "public"."articles" FOR DELETE TO "authenticated" USING ((("author_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'rejected'::"text"]))));



CREATE POLICY "Authors can update own articles" ON "public"."articles" FOR UPDATE TO "authenticated" USING (("author_id" = "auth"."uid"())) WITH CHECK ((("author_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'pending'::"text"]))));



CREATE POLICY "Members can view internal articles" ON "public"."articles" FOR SELECT TO "authenticated" USING ((("status" = 'published'::"text") AND ("visibility" = 'internal'::"text") AND "public"."is_member"()));



CREATE POLICY "Members can view published resources" ON "public"."internal_resources" FOR SELECT TO "authenticated" USING ((("status" = 'published'::"text") AND "public"."is_member"()));



CREATE POLICY "Public articles viewable by everyone" ON "public"."articles" FOR SELECT USING ((("status" = 'published'::"text") AND ("visibility" = 'public'::"text")));



CREATE POLICY "Readers can view article comments" ON "public"."comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."articles"
  WHERE ("articles"."id" = "comments"."article_id"))));



CREATE POLICY "Users can create own article favorites" ON "public"."article_favorites" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."articles"
  WHERE ("articles"."id" = "article_favorites"."article_id")))));



CREATE POLICY "Users can create own article likes" ON "public"."article_likes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."articles"
  WHERE ("articles"."id" = "article_likes"."article_id")))));



CREATE POLICY "Users can create own branch requests" ON "public"."knowledge_branch_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = "auth"."uid"()) AND ("status" = 'pending'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."articles"
  WHERE (("articles"."id" = "knowledge_branch_requests"."article_id") AND ("articles"."author_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create own comments" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."articles"
  WHERE ("articles"."id" = "comments"."article_id")))));



CREATE POLICY "Users can create own profile changes" ON "public"."profile_changes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text") AND ("reviewed_by" IS NULL) AND ("reviewed_at" IS NULL)));



CREATE POLICY "Users can delete own article favorites" ON "public"."article_favorites" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own article likes" ON "public"."article_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own comments" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."articles"
  WHERE ("articles"."id" = "comments"."article_id")))));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own article favorites" ON "public"."article_favorites" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own article likes" ON "public"."article_likes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own articles" ON "public"."articles" FOR SELECT TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "Users can view own branch requests" ON "public"."knowledge_branch_requests" FOR SELECT TO "authenticated" USING (("requester_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile changes" ON "public"."profile_changes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."article_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."internal_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_branch_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_member"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_member"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_member"() TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profile_changes" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."profile_changes" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."review_profile_change"("p_change_id" "uuid", "p_decision" "text", "p_review_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_profile_change"("p_change_id" "uuid", "p_decision" "text", "p_review_note" "text") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."article_favorites" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."article_favorites" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."article_likes" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."article_likes" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."articles" TO "service_role";
GRANT SELECT ON TABLE "public"."articles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."articles" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "service_role";
GRANT SELECT ON TABLE "public"."comments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."comments" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."internal_resources" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."internal_resources" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."knowledge_branch_requests" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."knowledge_branch_requests" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."knowledge_branches" TO "service_role";
GRANT SELECT ON TABLE "public"."knowledge_branches" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."knowledge_branches" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."profiles" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
